import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  ANESTHESIOLOGISTS,
  CIRCULATORS,
  SCHEDULE_CASES,
  SCRUB_TECHS,
  SURGEONS,
} from "../components/arti/schedule";
import { LIBRARY_OVERVIEW } from "../components/arti/videoLibrary";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = readFileSync(resolve(process.cwd(), "skills/personality.md"), "utf-8");

// Static schedule reference — built once at module load, never changes per
// request. Combined with the system prompt into a single cached block so
// Haiku only processes this once per 5-minute window per process, not every
// turn. This is the single biggest latency win for repeat voice commands.
const STATIC_SCHEDULE_OVERVIEW = SCHEDULE_CASES.map(
  (c) =>
    `  - ${c.date} ${c.time} ${c.room} · ${c.patientName} (${c.patientAgeSex}) · ${c.procedureShort}${c.side ? ` ${c.side}` : ""} · ${c.surgeon} · Anes ${c.anesthesiologist} · Scrub ${c.scrubTech} · ${c.status}`,
).join("\n");

const TEAM_ROSTER = [
  `Surgeons:`,
  ...SURGEONS.map((s) => `  - ${s.name} (${s.specialty})`),
  ``,
  `Anesthesiologists:`,
  ...ANESTHESIOLOGISTS.map((n) => `  - ${n}`),
  ``,
  `Scrub Techs:`,
  ...SCRUB_TECHS.map((n) => `  - ${n}`),
  ``,
  `Circulating Nurses:`,
  ...CIRCULATORS.map((n) => `  - ${n}`),
].join("\n");

const CACHED_SYSTEM = `${SYSTEM_PROMPT}\n\n---\nFull OR schedule (stable reference — use this to answer patient / surgeon / date / count questions):\n${STATIC_SCHEDULE_OVERVIEW}\n\n---\nTeam roster (use these canonical names for show_person_schedule and team-lookup queries):\n${TEAM_ROSTER}\n\n---\nReference library (use these exact titles / authors / years when narrating which video or paper you opened):\n${LIBRARY_OVERVIEW}`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "wake",
    description:
      "Wake Arti from sleep/standby. Use when the user greets Arti or asks it to wake up.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_home",
    description: "Navigate to the home dashboard.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_cases",
    description: "Show today's case list.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_schedule",
    description:
      "Open the Schedule screen (month-view OR calendar). Use for: 'show me the schedule', 'open the calendar', 'show me the schedule screen', 'what's on the schedule this month'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_surgeons",
    description:
      "Open the Surgeons directory screen (vertical card list of all surgeons sorted by their soonest upcoming case, with name/specialty/procedure search). Use for: 'show me the surgeons', 'open the surgeons list', 'show me all surgeons', 'pull up the surgeons directory', 'who are my surgeons', 'show me the surgeon list'. Use this only for the directory; for ONE specific surgeon's day-by-day schedule, use show_person_schedule instead.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_patients",
    description:
      "Open the Patients screen — vertical card list of every patient scheduled for surgery TODAY in OR 326, with name/MRN/procedure search and risk flags (severe allergies, difficult airway, flagged labs). Use for: 'show me today's patients', 'show me the patients', 'pull up the patient list', 'who are today's patients', 'open patients'. Tapping a card opens that patient's full chart modal — for opening one specific patient by name from voice, prefer this nav and let the user click, or use open_patient_details if a case is already active in preop.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_topmost_modal",
    description:
      "Universal close — closes whatever modal/overlay is currently topmost on the screen. " +
      "USE THIS WHENEVER the user says 'close' / 'close it' / 'close that' / 'dismiss' / 'close this' / 'go back' WITHOUT naming the specific thing. The tool reads its own priority order (reminder toast → person schedule → how-to video → image lightbox → x-rays → patient video → patient details → quad view → schedule day drawer) and closes the topmost. " +
      "PREFER this tool over the more-specific close_* tools (close_lightbox, close_how_to_video, close_quad_view, close_xrays, close_patient_video, close_patient_details, close_person_schedule, close_schedule_day, dismiss_reminder_alert) when the user's command is generic. Only use a specific close_* tool when the user explicitly names what to close ('close the video', 'close the lightbox', 'close the patient video', 'close the X-rays'). " +
      "If nothing is open, this tool is a no-op and returns gracefully — never refuse a 'close' command.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "start_journey",
    description:
      "Launch the cinematic 'how Arti was built' walkthrough — a narrated, animated 7-stage story covering the vision, tech stack, voice integration, and content sources. Use for: 'show me how this was created', 'show me how it was built', 'how did you make this', 'tell me how Arti works', 'walk me through this app', 'show me the build story', 'show me the demo'. Works from ANY screen — closes any open overlay and full-bleeds the journey screen. Once started, narration auto-plays through all stages; the user can voice-pause / voice-skip / voice-exit.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "exit_journey",
    description:
      "Exit the journey walkthrough and return to sleep. Use ONLY when the user is currently on the journey screen (live context will say 'Current screen: how-it-was-built journey'). Trigger phrases: 'exit', 'exit journey', 'I'm done', 'back to sleep', 'stop the demo', 'go to sleep', 'close it'. If on any other screen, do NOT use this tool — use the appropriate close_topmost_modal or navigation tool instead.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "journey_pause",
    description:
      "Pause the journey narration on the current stage. Use ONLY on the journey screen. Trigger phrases: 'pause', 'arti pause', 'stop', 'hold on', 'wait', 'stop talking'. While the journey is paused, all narration stops; the visual freezes its current state. The user can resume with 'resume' / 'continue' / 'play'. " +
      "DISAMBIGUATION: when NOT on the journey screen, 'pause'/'stop' should route to other tools — video_pause for the how-to viewer, stop_scroll for active scroll, etc. The live context's 'Current screen' field tells you whether journey_pause applies.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "journey_resume",
    description:
      "Resume the journey narration after a pause. Use ONLY on the journey screen when paused. Trigger phrases: 'resume', 'continue', 'play', 'keep going', 'go on', 'unpause'. Replays the current stage's narration from the beginning (sub-second resume isn't tracked).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "journey_next",
    description:
      "Advance to the next stage of the journey. Use ONLY on the journey screen. Trigger phrases: 'next', 'next stage', 'skip', 'skip ahead', 'next chapter', 'move on'. If already on the final stage, this exits the journey.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "journey_previous",
    description:
      "Go back one stage in the journey. Use ONLY on the journey screen. Trigger phrases: 'previous', 'go back', 'previous stage', 'back', 'last one'. No-op if already on the first stage.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_consoles",
    description:
      "Open the OR equipment-tower status screen — a stylized 3D view of the integrated arthroscopy stack (light source, 4K camera console, image management, fluid pump, shaver, RF console) with live connection status and per-device telemetry (pressure, flow, RPM, intensity, etc). Use for: 'show me the OR consoles', 'show the equipment tower', 'console status', 'tower status', 'show me the equipment', 'pull up the consoles', 'are the consoles ready', 'check the tower'. After this nav opens, the user can voice-focus an individual console with focus_console.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "start_screensaver",
    description:
      "Switch the wall to a calm sunrise landscape screensaver — used right before the patient is wheeled in so the room feels like a place to breathe. ALWAYS works regardless of current screen or open modal. Trigger phrases: 'start screensaver', 'screensaver', 'screensaver please', 'calm mode', 'calm screen', 'show the landscape', 'show the calm screen', 'show the sunrise', 'pause and breathe', 'patient is coming in', 'patient incoming', 'getting ready for the patient', 'bring up the calm screen', 'go to ambient mode', 'show the wallpaper'. The screen exits via exit_screensaver, the X button, the sidebar, or pressing Esc.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "exit_screensaver",
    description:
      "Exit the calm sunrise screensaver and return to the home dashboard. Only valid while the screensaver is active (live context will say 'Phase: screensaver'). Trigger phrases: 'exit screensaver', 'end screensaver', 'close screensaver', 'stop screensaver', 'leave screensaver', 'turn off screensaver', 'wake me', 'we're ready', 'patient is in', 'back to home', 'I'm done with the screensaver', 'exit calm mode'. If the user says a generic 'close' / 'go back' while the screensaver is open, also use this tool (the screensaver isn't a modal so close_topmost_modal won't catch it).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_library",
    description:
      "Open the curated surgical Video Library — a searchable, filterable grid of every how-to video Arti has indexed (shoulder, knee, hip, hand/wrist, foot/ankle). Use for: 'show me the video library', 'open the library', 'pull up the surgical videos', 'browse the videos', 'show me all the how-to videos', 'show me what videos you have', 'what videos are available'. The user can then tap a card or say 'show me the [procedure] video' to play one. Differs from open_how_to_video — that one immediately plays the latest matching video; navigate_library opens the browse-and-search UI.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "set_home_dashboard_mode",
    description:
      "Switch the Home dashboard between its two modes: 'my' (My Dashboard — the user's personal day overview) and 'procedure' (Procedure Dashboard — per-procedure preview cards for the up-next case). Auto-navigates to home if the user is elsewhere. " +
      "Use for: 'show me the procedure dashboard' / 'open procedure dashboard' / 'switch to procedure view' / 'flip to procedure mode' → mode='procedure'. " +
      "And: 'show me my dashboard' / 'switch back to my dashboard' / 'go back to my view' / 'show my home' → mode='my'. " +
      "Bare 'show me the dashboard' / 'open home' goes to navigate_home, NOT here — only fire when the user names one of the two modes (procedure/personal/my) explicitly. Cannot fire while the user is editing the dashboard layout (route returns ok:false).",
    input_schema: {
      type: "object" as const,
      properties: {
        mode: {
          type: "string",
          enum: ["my", "procedure"],
          description: "'my' = personal day overview · 'procedure' = per-procedure preview.",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "navigate_settings",
    description:
      "Open the Settings landing screen (Preferences). Use for: 'open settings', 'open preferences', 'show me settings', 'go to settings'. From there the user can drill into General or Admin Settings. Do NOT use for direct admin / smart-device requests — for those, jump to navigate_admin_settings or navigate_smart_settings respectively.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_admin_settings",
    description:
      "Open the Admin Settings page (password-gated landing for Software Updates, Support Logging, and Smart Settings). Use for: 'open admin settings', 'show admin settings', 'pull up admin', 'open system settings', 'are there any software updates' (lands here, then user can tap Software Updates), 'open support logs'. The user must enter any text on the password gate before the cards appear — that's a UI step, not a tool call.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "navigate_smart_settings",
    description:
      "Open the Smart Settings screen (Admin → Smart Settings) — device control for OR 326. Lights, displays, environment, audio, and door access. Use for: 'open smart settings', 'open device controls', 'open the smart room controls', 'show me the smart devices', 'open the lights' (lands here with Lighting category expanded), 'open boom 1' (lands here and selects Boom 1 — pair with select_smart_device after), 'control the OR room', 'pull up room controls'. NOTE: this opens the SCREEN. To actually change a device, follow up with set_smart_property or toggle_smart_device.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "select_smart_device",
    description:
      "Focus a specific smart device on the Smart Settings screen so its controls are visible. Auto-navigates to Smart Settings if not already there. Use for: 'open boom 1', 'show me the x-ray viewer controls', 'select ambient lights', 'open the surgeon monitor'. The route fuzzy-matches the spoken phrase against device names + ids — pass whatever the user said. Available devices appear in the live context block when the screen is open.",
    input_schema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description:
            "Device name or keyword (e.g. 'boom 1', 'x-ray viewer', 'ambient', 'wall display', 'thermostat').",
        },
      },
      required: ["device"],
    },
  },
  {
    name: "set_smart_property",
    description:
      "Set a numeric or string property on a smart device. Works whether the user is on Smart Settings or not — the route writes to localStorage and the Mock OR widget updates live if visible. " +
      "Use for: 'dim boom 1 to 60', 'set Boom 2 brightness to 80%', 'set ambient color temp to 4000K', 'change the wall display layout to multi-view', 'set thermostat to 22°C', 'set music volume to 30', 'set the surgeon monitor input to MRI'. " +
      "Pass a property keyword the route can fuzzy-match against the device's spec keys + labels: 'brightness', 'color temp' / 'color temperature' / 'kelvin', 'spot' / 'spot size', 'volume', 'setpoint' / 'temperature', 'target' / 'humidity', 'exchanges' / 'airflow', 'layout', 'input', 'playlist'. " +
      "For percent / kelvin / temperature properties, pass `value` as a number. For select properties, pass the option value (e.g. 'mri', 'multiview', 'ambient'). " +
      "When the user is on Smart Settings and says 'set brightness to 50' WITHOUT naming a device, omit `device` — the route uses the currently-selected device.",
    input_schema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description:
            "Optional. Device name/keyword. Omit to target the currently-selected device on Smart Settings.",
        },
        property: {
          type: "string",
          description:
            "Property name/keyword (brightness, color_temp, spot_size, volume, setpoint, layout, input, playlist, target, exchanges, locked, on, etc.).",
        },
        value: {
          description:
            "New value. Numeric for percent/kelvin/temperature properties; string for select; boolean for toggle. Pass percentages WITHOUT the % sign (e.g. 60 not '60%').",
        },
      },
      required: ["property", "value"],
    },
  },
  {
    name: "reset_all_smart_devices",
    description:
      "Bulk-reset every smart device (lights, displays, environment, audio, doors) back to its built-in defaults. " +
      "TWO-STEP CONFIRMATION: " +
      "  • If the user says 'reset all smart devices' / 'reset everything' / 'reset the room' / 'restore defaults' WITHOUT a clear yes/confirm, call this with confirmed=false (or omit) — the route opens an 'Are you sure?' modal. " +
      "  • When that modal is OPEN and the user says 'yes' / 'confirm' / 'do it' / 'reset' / 'go ahead' / 'I'm sure', call this AGAIN with confirmed=true to actually execute the reset and close the modal. " +
      "  • If the user says 'no' / 'cancel' / 'never mind' while the modal is open, use close_topmost_modal instead. " +
      "Live context surfaces the modal state so you know which path applies.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirmed: {
          type: "boolean",
          description:
            "True ONLY when the confirm modal is already open and the user has just said yes. Default false.",
        },
      },
      required: [],
    },
  },
  {
    name: "toggle_smart_device",
    description:
      "Toggle a boolean property on a smart device — power, lock, etc. Convenience over set_smart_property when the user said 'turn on/off' or 'lock/unlock'. " +
      "Use for: 'turn off the x-ray viewer', 'turn on the wall display', 'turn off Boom 2', 'lock the OR door', 'unlock the door', 'turn on the music', 'open the intercom'. " +
      "If the user said 'lock the door', pass property='locked' on=true; for the door 'unlock', on=false. For everything else default to property='on'.",
    input_schema: {
      type: "object" as const,
      properties: {
        device: {
          type: "string",
          description: "Device name/keyword (e.g. 'x-ray viewer', 'boom 2', 'door', 'music').",
        },
        property: {
          type: "string",
          description:
            "Optional. Boolean property key (defaults to 'on'; use 'locked' for the door).",
        },
        on: {
          type: "boolean",
          description: "Target state — true to enable / lock / power on; false otherwise.",
        },
      },
      required: ["device", "on"],
    },
  },
  {
    name: "library_filter_category",
    description:
      "Filter the Video Library to a specific anatomic region. " +
      "ALWAYS works — closes any open overlay, navigates to the library if not already there, applies the filter. Never refuse this command because of an open modal. " +
      "OR STAFF SPEAK IS TERSE — recognize ALL of these short imperative patterns and map to the right enum: " +
      "  'knee' / 'knees' / 'knee videos' / 'knee procedures' / 'knee stuff' / 'just knee' / 'knee only' / 'filter knee' / 'show knee' / 'narrow to knee' → 'Knee'. " +
      "  'shoulder' / 'shoulders' / 'shoulder videos' / 'just shoulder' / 'filter shoulder' / 'rotator stuff' / 'cuff stuff' → 'Shoulder'. " +
      "  'hip' / 'hips' / 'hip videos' / 'hip stuff' / 'just hip' / 'filter hip' → 'Hip'. " +
      "  'foot' / 'ankle' / 'foot ankle' / 'foot and ankle' / 'ankle stuff' / 'achilles videos' → 'Foot/Ankle'. " +
      "  'hand' / 'wrist' / 'hand and wrist' / 'hand wrist' / 'carpal' / 'wrist stuff' → 'Hand/Wrist'. " +
      "  'all' / 'all videos' / 'everything' / 'all categories' / 'show me all' / 'no filter' / 'remove filter' → 'All'. " +
      "Body region words are ALWAYS a category filter — even if the user says only 'knee' with no other context. Specific procedure names (ACL, meniscus, Bankart, RTSA, rotator cuff repair, biceps tenodesis, etc.) are SEARCH queries — use library_search for those. When the user says both ('knee videos with Denard' / 'knee meniscus') call BOTH tools.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["All", "Shoulder", "Knee", "Hip", "Foot/Ankle", "Hand/Wrist"],
          description: "Anatomic region. 'All' clears the filter.",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "library_search",
    description:
      "Set the Video Library search box. " +
      "ALWAYS works — closes any open overlay, navigates to the library, applies the search. Never refuse because of an open modal. " +
      "Use this for SPECIFIC PROCEDURE / TECHNIQUE / SURGEON / CHANNEL keywords — anything more specific than a body region. " +
      "OR STAFF SPEAK PATTERNS — recognize all of these as search requests, extract the keyword: " +
      "  'find ACL' / 'ACL videos' / 'show me ACL' / 'pull up ACL' → query='ACL'. " +
      "  'search meniscus' / 'meniscus videos' / 'meniscus repair' / 'just meniscus' → query='meniscus'. " +
      "  'rotator cuff' / 'cuff repair' / 'find a cuff video' / 'speedbridge' → query='rotator cuff' (or 'speedbridge'). " +
      "  'Bankart' / 'SLAP' / 'tenodesis' / 'biceps' / 'subacromial' → query as said. " +
      "  'RTSA' / 'reverse shoulder' / 'TKA' / 'total knee' → query as said. " +
      "  'Denard' / 'Millett' / 'Arthrex' / 'animations only' / 'find videos with [name]' → query=[that name]. " +
      "  'clear search' / 'reset search' / 'remove keyword' → query='' (empty). " +
      "Filters by title, procedure, surgeon, channel, and tags simultaneously. If the user combines a region + procedure ('knee meniscus', 'shoulder rotator cuff'), call BOTH library_filter_category and library_search in the same turn.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Free-text search keywords. Pass empty string to clear.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "library_set_animated_only",
    description:
      "Toggle the 'Animated only' filter on the Video Library. ALWAYS works — closes any open modal and navigates to the library if needed. Use for: 'show only animated videos', 'animated only', 'just the animations', 'turn off animated only', 'show all video types'. Pass true to restrict to animated content (safest for embed reliability), false to show everything.",
    input_schema: {
      type: "object" as const,
      properties: {
        enabled: {
          type: "boolean",
          description: "true = restrict to animated only; false = show all videos.",
        },
      },
      required: ["enabled"],
    },
  },
  {
    name: "library_set_saved_only",
    description:
      "Toggle the 'Saved only' filter on the Video Library, which narrows the grid to videos the user has bookmarked. ALWAYS works — closes any modal and navigates to the library if needed. Use for: 'show only saved videos', 'show my saved videos', 'show my favorites', 'show all videos again' (pass false), 'turn off saved filter'. Prefer the more-specific show_saved_videos tool when the user just says 'show me my videos' / 'show my videos' (it also clears other filters for a clean view).",
    input_schema: {
      type: "object" as const,
      properties: {
        enabled: {
          type: "boolean",
          description: "true = restrict to saved/bookmarked only; false = show all videos.",
        },
      },
      required: ["enabled"],
    },
  },
  {
    name: "show_saved_videos",
    description:
      "Open the Video Library filtered to only the user's saved/bookmarked videos. Clears any other active filters (search, category, animated-only) so the saved set is presented cleanly. Trigger phrases: 'show me my videos', 'show my videos', 'show my saved videos', 'show my bookmarks', 'pull up my saved videos', 'show me what I saved', 'open my saved videos', 'my favorites', 'my library', 'what have I saved'. Use this instead of library_set_saved_only when the user wants a clean view of what they've personally bookmarked.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "save_video",
    description:
      "Add a surgical how-to video to the user's saved/bookmarked set so they can find it later under 'show my videos'. With no args, saves the video currently open in the how-to viewer (the most common case). Pass `id` for a specific library video, or `query` to resolve by free-text procedure name (same fuzzy matching as open_how_to_video). Trigger phrases: 'save this', 'save it', 'save this video', 'save the video', 'bookmark this', 'bookmark it', 'add to my saved videos', 'save it for later', 'add to favorites', 'favorite this', 'save the [procedure] video' (use query). Idempotent — re-saving an already-saved video is a no-op.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "Library video id (e.g. 'v-rtsa'). Optional.",
        },
        query: {
          type: "string",
          description:
            "Free-text procedure / topic to resolve when the user names a video without opening it (e.g. 'save the rotator cuff video'). Optional.",
        },
      },
      required: [],
    },
  },
  {
    name: "unsave_video",
    description:
      "Remove a surgical how-to video from the user's saved/bookmarked set. With no args, targets the currently-open video. Trigger phrases: 'unsave', 'unsave this', 'remove from saved', 'remove bookmark', 'unbookmark', 'take this off my saved list', 'forget this video', 'don't save this anymore'. Use toggle_save_video instead if the user just says 'toggle save' or it's unclear whether they want to add or remove.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Library video id. Optional." },
        query: { type: "string", description: "Free-text resolver. Optional." },
      },
      required: [],
    },
  },
  {
    name: "toggle_save_video",
    description:
      "Toggle the saved/bookmarked state of the currently-open how-to video (or one resolved by id/query). Adds it to saved if it isn't there, removes it if it is. Use ONLY when the user explicitly says 'toggle save' / 'toggle bookmark' or it's genuinely ambiguous. Prefer save_video / unsave_video for explicit save / unsave intents.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Library video id. Optional." },
        query: { type: "string", description: "Free-text resolver. Optional." },
      },
      required: [],
    },
  },
  {
    name: "library_clear_filters",
    description:
      "Reset every Video Library filter — clear search, set category to 'All', turn off animated-only and saved-only. ALWAYS works regardless of current screen or open modal. " +
      "OR STAFF SPEAK — recognize all of these terse imperatives: 'clear filters' / 'clear it' / 'reset' / 'reset filters' / 'reset library' / 'show all' / 'show all videos' / 'show me everything' / 'everything' / 'no filters' / 'remove filters' / 'drop the filter' / 'wipe filters' / 'start over'. " +
      "Prefer this over library_filter_category('All') when the user wants a TOTAL reset (also clears search + animated-only + saved-only). Use library_filter_category('All') only when they want to keep the search but drop the region filter.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "focus_console",
    description:
      "Highlight one specific console on the OR tower (rotates the 3D view toward it and opens its detail panel with telemetry + attachments). " +
      "Use for: 'show me the camera console', 'show me the 4K camera', 'show the Nano camera' (→ camera), 'show the fluid pump' / 'is the pump connected' / 'pump status' (→ pump), 'shaver console' / 'show the shaver' / 'show the burr' (→ shaver), 'RF console' / 'show me the radiofrequency' / 'show the wand' (→ rf), 'light source' / 'show me the light' (→ light), 'show me the image manager' / 'recorder' / 'Synergy ID' (→ image). " +
      "If the user says 'is X connected' or asks about a console's status, ALSO answer the question in spoken text (one short sentence) — read the live context's 'OR tower consoles' block to find the actual status and telemetry. Example: 'Fluid pump is active — 60 mmHg, 200 mL/min.'",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          enum: ["camera", "pump", "shaver", "rf", "light", "image"],
          description:
            "Canonical console id. Map free-text references using these synonyms: " +
            "camera = camera console, 4K, Nano, CCU, scope, endoscope, Synergy 4K. " +
            "pump = fluid pump, fluid management, irrigation pump, arthroscopy pump, DualWave. " +
            "shaver = shaver console, burr, blade, APS, power instrument. " +
            "rf = RF console, radiofrequency, ablation, coag, wand, Quantum. " +
            "light = light source, LED, lamp, illuminator. " +
            "image = image management, Synergy ID, recorder, captures.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "show_schedule_day",
    description:
      "Open a specific day's detail on the Schedule. Use whenever the user mentions a date — e.g. 'show me May 20th', 'what's on April 27', 'pull up next Tuesday'. Convert the spoken date to ISO format YYYY-MM-DD using 'Today is …' from context as the reference year; pick the closest future or past occurrence if ambiguous.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Target date in ISO format YYYY-MM-DD (e.g., '2026-05-20' for 'May 20th').",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "close_schedule_day",
    description:
      "Close the currently open day-detail drawer on the Schedule screen while keeping the user on the Schedule (calendar) view. Use when the user says 'close', 'close that', 'close the day', 'close the details', 'dismiss', or 'go back' while a schedule day drawer is open. Do NOT use navigate_home, navigate_cases, or any other navigation tool for these phrases — the user wants to stay on the calendar.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "set_reminder",
    description:
      "Schedule a one-shot reminder. Use when the user says 'remind me to X in Y minutes/hours', 'remind me in 10 to check the counts', 'set a reminder for 5 minutes to call Dr. Patel', etc. Convert hours to minutes ('in an hour' → 60, 'in 30 minutes' → 30, 'in half an hour' → 30). Use imperative form for `text` — strip leading 'to' ('to check the counts' → 'check the counts'). When the reminder fires Arti will speak it and show a toast.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description:
            "Imperative phrase describing what to remind the user about. E.g. 'check the instrument counts', 'call the blood bank'. Do NOT include 'remind me to' or 'to'.",
        },
        minutes: {
          type: "number",
          description:
            "How many minutes from now to fire the reminder. Must be > 0. Hours → multiply by 60.",
        },
      },
      required: ["text", "minutes"],
    },
  },
  {
    name: "cancel_reminders",
    description:
      "Cancel all pending reminders. Use for 'cancel my reminders', 'clear my reminders', 'never mind the reminders', 'forget the reminders'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "dismiss_reminder_alert",
    description:
      "Dismiss the currently visible reminder toast/alert(s). Only use when context says 'Reminder alert showing'. Trigger phrases: 'close alert', 'close the alert', 'close reminder', 'close the reminder', 'close reminder alert', 'dismiss', 'dismiss alert', 'dismiss that', 'got it', 'thanks', 'thank you', 'okay', 'acknowledged', 'noted', 'close that'. Do NOT use close_patient_details, close_lightbox, close_quad_view, or close_schedule_day for these phrases while a reminder alert is visible — the reminder alert has highest close precedence. If no reminder alert is showing, use the normal close-disambiguation rules.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "schedule_set_service_lines",
    description:
      "Set which service lines are visible on the Schedule screen. Pass the FINAL desired list, not a delta — if the user says 'also show cardiothoracic', read the current 'Schedule filters' line in live context, then pass current-plus-Cardiothoracic. Examples: 'show only orthopedics' → ['Orthopedics']. 'show orthopedics and spine' → ['Orthopedics','Spine']. 'hide general' → (current without General). 'show all service lines' → all five. Use only when the user wants to filter by service line, not by surgeon.",
    input_schema: {
      type: "object" as const,
      properties: {
        lines: {
          type: "array",
          items: {
            type: "string",
            enum: ["Orthopedics", "Cardiothoracic", "General", "Spine", "ENT"],
          },
          description: "Final list of service lines that should remain visible.",
        },
      },
      required: ["lines"],
    },
  },
  {
    name: "schedule_set_surgeon",
    description:
      "Filter the Schedule (calendar) screen to ONE surgeon's cases — applies in-place to the calendar grid, no modal. " +
      "DEFAULT for any surgeon-name reference WHEN the live context shows 'Current screen: schedule / calendar'. Triggers include: " +
      "  • 'show me Dr. Patel' / 'show Dr. Foster' / 'pull up Patel' (no temporal word required — being on the schedule already implies filter intent) " +
      "  • 'show me Dr. Patel's cases' / 'Dr. Foster's cases' / 'just Patel's cases' " +
      "  • 'filter by Dr. Patel' / 'only Dr. Foster' / 'narrow to Patel' " +
      "  • 'show me the spine surgeon' (resolve from team roster) " +
      "Pass an empty string to clear the surgeon filter (show all). 'clear the surgeon filter' / 'show all surgeons' / 'show everyone' → surgeon=''. " +
      "Resolve the user's spoken reference to a full surgeon name from the Team roster in the cached system prompt (e.g. 'Patel' → 'Dr. Anika Patel'). " +
      "DO NOT use show_person_schedule when on the calendar — that opens a modal. The user already SEES the calendar; filter it in place.",
    input_schema: {
      type: "object" as const,
      properties: {
        surgeon: {
          type: "string",
          description: "Full surgeon name as it appears in the schedule, or empty string to clear.",
        },
      },
      required: ["surgeon"],
    },
  },
  {
    name: "schedule_clear_filters",
    description:
      "Reset all Schedule filters — show every service line and every surgeon. Use for 'clear the filters', 'clear all filters', 'show everything', 'reset the filters', 'show all cases', 'remove the filter'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_person_schedule",
    description:
      "Open a focused modal showing one person's CASE SCHEDULE / CALENDAR (vertical card list, soonest-first). Fire ONLY when the user explicitly references the schedule, calendar, day, week, or month for that person — phrases must contain a temporal/calendar word. Examples: 'show me Dr. Patel's schedule', 'what's Marcus Webb's day look like', 'pull up Dr. Shah's week', 'show me the anesthesiologist's calendar', 'when is Dr. Foster operating next', 'now show me Dr. Foster' (only when this modal is ALREADY open — switches person). " +
      "DO NOT fire for bare 'open/show me Dr. X' / 'pull up Dr. X' / 'open Patel's preference cards' — those go to open_surgeon_profile (the procedure-preferences screen). " +
      "DO NOT fire when the live context shows 'Current screen: schedule / calendar'. On the calendar, surgeon-name phrases ('show me Dr. Patel', 'Dr. Patel's cases') filter the calendar IN PLACE via schedule_set_surgeon — opening a modal on top of the calendar would cover what the user is already looking at. The ONLY exception is when the user explicitly says 'open her schedule modal' / 'pull up her week' (clear modal-open intent). " +
      "For non-surgeon roles (anesthesiologist, scrub tech, circulating nurse) this is the correct tool whenever the user wants their day/week/month. " +
      "Resolve the spoken reference to a CANONICAL name from the Team roster in the cached system prompt — pass the full string as it appears (e.g. 'Dr. Anika Patel', 'Marcus Webb, CST', 'Dr. Priya Shah', 'Melissa Quinn, RN'). Always include `role` so the modal knows which schedule field to filter on.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Canonical full name from the Team roster. Include credential suffixes for techs (', CST') and circulators (', RN').",
        },
        role: {
          type: "string",
          enum: ["Surgeon", "Anesthesiologist", "Scrub Tech", "Circulator"],
          description: "Which role this person serves on the schedule.",
        },
      },
      required: ["name", "role"],
    },
  },
  {
    name: "set_person_schedule_view",
    description:
      "Change the time scope of the open Person Schedule modal. 'show me her week' / 'this week' → 'week'. 'today only' / 'just today' → 'day'. 'this month' / 'show me the whole month' → 'month'.",
    input_schema: {
      type: "object" as const,
      properties: {
        view: {
          type: "string",
          enum: ["day", "week", "month"],
          description: "Time scope to display.",
        },
      },
      required: ["view"],
    },
  },
  {
    name: "close_person_schedule",
    description:
      "Close the Person Schedule modal. Use only when the modal is open AND the user wants to close JUST that modal (not navigate away). Phrases: 'close', 'close that', 'close the modal', 'close the schedule', 'dismiss', 'go back'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "open_surgeon_profile",
    description:
      "Open a surgeon's procedure-preferences profile screen — the source of truth for their preference cards, procedure-by-procedure details, and uploaded images. " +
      "DEFAULT for any unqualified 'open/show me/pull up Dr. X' or last-name reference WHEN X is a surgeon and the user did NOT say 'schedule', 'calendar', 'day', 'week', or 'month'. Examples that fire here: " +
      "  • 'Open Dr. Patel' / 'Open Patel' / 'Pull up Dr. Foster' / 'Show me Vasquez' " +
      "  • 'Open Dr. Patel's preference cards' / 'show me Dr. Foster's procedures' / 'pull up Patel's profile' " +
      "  • 'Show me Dr. Patel's RSA' (also pass `procedure: \"rsa\"`) " +
      "DO NOT fire when the user said 'schedule', 'calendar', 'day', 'week', 'month', or 'when' — those go to show_person_schedule. " +
      "DO NOT fire when the live context shows 'Current screen: schedule / calendar' AND the user said only a surgeon name (e.g. 'show me Dr. Patel'). On the calendar that filters in-place via schedule_set_surgeon. Profile-specific verbs ('preference cards', 'profile', 'procedures', 'pref card') still route here even from the schedule. " +
      "The profile screen is NOT the case-level layout images (those live on the case preop view) — it is the surgeon's own per-procedure card. The optional `procedure` arg expands a specific procedure by name or slug ('rsa', 'rcr', 'acl', 'cabg', 'fess', etc.) on landing.",
    input_schema: {
      type: "object" as const,
      properties: {
        surgeon: {
          type: "string",
          description:
            "Surgeon name as it appears in the team roster (e.g. 'Dr. Anika Patel'). Last-name-only ('Patel') is also acceptable.",
        },
        procedure: {
          type: "string",
          description:
            "Optional. Procedure slug or name to expand on landing (e.g. 'rsa', 'rotator cuff', 'fess'). Omit to land on the first procedure.",
        },
      },
      required: ["surgeon"],
    },
  },
  {
    name: "expand_procedure",
    description:
      "ON THE SURGEON-PROFILE SCREEN: EXPAND (open / show / pull up / focus) a specific procedure card so its details + preference-card images are visible. " +
      "FIRE for any of: 'open RSA', 'open RCR', 'open ACL', 'show RSA', 'pull up CABG', 'expand rotator cuff', 'open the rotator cuff one', 'show me lumbar fusion', 'open coronary artery bypass'. " +
      "Match the user's phrase against BOTH the procedure `slug` (e.g. 'rsa', 'rcr', 'acl', 'cabg', 'fess') AND the `name` (e.g. 'Reverse Total Shoulder Arthroplasty', 'Arthroscopic Rotator Cuff Repair'). The live context lists every procedure on the active surgeon's profile with both fields — pass whatever the user said and the route fuzzy-matches by slug → exact name → substring → word-bag. " +
      "If the user said an acronym (RSA, RCR, ACL, etc.) just pass the acronym lowercased; the route resolves. " +
      "Idempotent — calling on an already-expanded procedure is fine (re-scrolls into view). " +
      "ONLY valid on the surgeon-profile screen.",
    input_schema: {
      type: "object" as const,
      properties: {
        procedure: {
          type: "string",
          description:
            "Procedure slug (rsa/rcr/acl/cabg/fess/lumbar-fusion/etc.) OR full/partial name. Both work.",
        },
      },
      required: ["procedure"],
    },
  },
  {
    name: "collapse_procedure",
    description:
      "ON THE SURGEON-PROFILE SCREEN: COLLAPSE (close / hide / shut) a procedure card. " +
      "FIRE for any of these phrases when the user is on the surgeon profile and a procedure is currently expanded: 'close', 'close it', 'close that', 'close panel', 'close procedure', 'close procedure panel', 'close the procedure', 'collapse', 'collapse it', 'collapse RSA', 'hide RSA', 'shut it', 'close RSA'. " +
      "DO NOT use close_topmost_modal for these phrases on this screen — collapse_procedure owns generic 'close' verbs here. " +
      "If the user names a specific procedure, pass it; if they say a bare 'close' / 'collapse' / 'close it' with no target, OMIT `procedure` and the route collapses whichever is currently expanded. " +
      "Only valid on the surgeon-profile screen.",
    input_schema: {
      type: "object" as const,
      properties: {
        procedure: {
          type: "string",
          description:
            "Optional. Procedure slug or name to collapse. Omit when the user said a bare 'close' / 'collapse' — the route closes whichever card is currently expanded.",
        },
      },
      required: [],
    },
  },
  {
    name: "next_procedure",
    description:
      "ON THE SURGEON-PROFILE SCREEN: expand the NEXT procedure in the list (the one after whichever is currently expanded; wraps to first after the last). " +
      "FIRE for: 'next', 'next procedure', 'next one', 'show me the next procedure', 'go to the next one', 'next card', 'show next', 'arti next'. " +
      "If nothing is expanded yet, this expands the first procedure. " +
      "DO NOT use open_case here — on this screen 'next' refers to the next procedure card, NOT the next case on the OR board.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "previous_procedure",
    description:
      "ON THE SURGEON-PROFILE SCREEN: expand the PREVIOUS procedure in the list (wraps to last after the first). " +
      "FIRE for: 'previous', 'previous procedure', 'previous one', 'go back', 'go back one', 'prior procedure', 'show me the previous procedure', 'back one'. " +
      "If nothing is expanded yet, this expands the last procedure. " +
      "DO NOT use open_case here — on this screen 'previous' refers to the previous procedure card, NOT a case on the OR board.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "rename_pref_card_image",
    description:
      "Rename a preference-card image inside the currently-expanded procedure of the surgeon-profile screen. Use for: 'rename back table to layout 1', 'rename image 2 to mayo stand setup', 'change the label on the first image to RSA back table'. Identify the image by its current label or its 1-based index as shown in live context.",
    input_schema: {
      type: "object" as const,
      properties: {
        image: {
          type: "string",
          description:
            "Current label of the image, or its 1-based index ('1', '2', ...). The route fuzzy-matches the label.",
        },
        new_label: { type: "string", description: "New label to display." },
      },
      required: ["image", "new_label"],
    },
  },
  {
    name: "remove_pref_card_image",
    description:
      "Remove (soft-delete) a preference-card image from the currently-expanded procedure. Use for: 'remove the mayo stand image', 'delete image 2', 'take that one off the card'. Identify the image by current label or 1-based index.",
    input_schema: {
      type: "object" as const,
      properties: {
        image: {
          type: "string",
          description: "Current label of the image, or its 1-based index.",
        },
      },
      required: ["image"],
    },
  },
  {
    name: "prompt_pref_card_upload",
    description:
      "ON THE SURGEON-PROFILE SCREEN: open the system file-picker so the user can upload new preference-card image(s) into a procedure. " +
      "FIRE for: 'upload an image', 'upload images', 'upload a picture for RCR', 'upload images for RSA', 'add a picture', 'add images to lumbar fusion', 'attach a layout photo'. " +
      "If the user names a procedure (slug or full/partial name), pass it as `procedure` — the route will EXPAND that procedure if not already expanded, then open the upload dialog on its card. If the user does NOT name a procedure, omit it and the route uses whichever is currently expanded. " +
      "The actual file selection is a click-only OS dialog. Confirm verbally with 'Pick a file.' (≤5 words). Browsers may block the dialog if the voice command isn't a direct user gesture — note that to the user only if it visibly fails.",
    input_schema: {
      type: "object" as const,
      properties: {
        procedure: {
          type: "string",
          description:
            "Optional. Procedure slug or name to upload INTO. The route auto-expands that procedure first. Omit to upload into whichever is currently expanded.",
        },
      },
      required: [],
    },
  },
  {
    name: "greet_person",
    description:
      "Speak a warm personalized greeting to a THIRD PARTY — a person, group, or audience the user explicitly asks Arti to greet on their behalf. " +
      "" +
      "DO NOT FIRE for: " +
      "  • 'Hi Arti' / 'Hello Arti' / 'Hey Arti' / 'Morning Arti' / 'Good evening Arti' — these are the user greeting Arti directly. Respond with a brief warm 1-sentence reply using the user's first name from live context (e.g. 'Hey Laura, what can I do for you?' / 'Morning, Laura.'); do NOT call this tool. " +
      "  • Any greeting where the only target is the assistant itself ('hi', 'hello', 'hey'). Bare salutations are not requests to greet anyone — just answer warmly. " +
      "  • Any phrasing that implies the user is greeting Arti ('say hi') with no third-party target — that's a self-greet; reply directly, do not call the tool. " +
      "" +
      "FIRE ONLY when the user explicitly names a THIRD PARTY to greet: " +
      "  • 'say hello to X' / 'greet X' / 'welcome X' / 'say hi to X' (where X is someone other than Arti) " +
      "  • 'tell X good morning' / 'wish X a good morning' / 'morning, X' (when X is clearly a person, not Arti) " +
      "  • 'introduce yourself to X' (X is a third party) " +
      "  • 'welcome X back' / 'good to see X' / 'say X is welcome here' " +
      "" +
      "WHO YOU CAN GREET — anyone the user names that ISN'T Arti. Do NOT restrict to people on the team roster or schedule; the roster is only for show_person_schedule lookups. For greetings, accept the name exactly as the user said it and produce a warm sentence around it. Valid targets include: " +
      "  • OR staff (named or generic): 'Alex', 'Dr. Chen', 'Marcus', 'the scrub tech', 'whoever just walked in'. " +
      "  • Vendors / reps: 'the Arthrex rep', 'the Stryker team', 'the device rep'. " +
      "  • Visiting clinicians: 'Dr. Smith from cardiology', 'the resident', 'the fellow'. " +
      "  • Family / friends: 'my mom', 'my husband Tom', 'my kids'. " +
      "  • Groups / audiences: 'the room', 'everyone', 'the residents', 'the new nurses', 'the family in the waiting room'. " +
      "  • Made-up / unfamiliar names: just use them as said — don't refuse because the name isn't recognized. " +
      "" +
      "Once a valid third-party target is identified, this is the ONLY way Arti speaks a name without the hard guardrails refusing. " +
      "" +
      "NARRATION REQUIRED (when firing): in the SAME turn as the tool call, return a warm 1-sentence greeting text that uses the exact name/phrase the user gave you. Vary wording naturally; use the time-of-day greeting from live context when it fits ('Good morning, Alex.'). Keep under 12 words. " +
      "" +
      "Examples: 'Hey Alex, good to have you in the room.' / 'Welcome, Dr. Chen.' / 'Morning Jamie.' / 'Welcome to OR 326, Arthrex team.' / 'Good to see you back, Dr. Patel.' / 'Welcome, Stryker rep.' / 'Hi Tom, glad you're here.' / 'Morning everyone.' / 'Hello Dr. Smith from cardiology.' " +
      "" +
      "If Live Case mode is on (see live context), use neutral phrasing only — 'Hello, Dr. Chen.' / 'Welcome, Stryker rep.' — no banter.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "Whatever the user called the target — name, role, group description. Pass as-spoken; don't normalize or lookup. Examples: 'Alex', 'Dr. Chen', 'the Arthrex team', 'Jamie and Sarah', 'my mom', 'the Stryker rep', 'everyone'.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "open_case",
    description:
      "Open a specific case by patient name, procedure keyword, or sequential reference. " +
      "QUERY VOCABULARY (matches how OR staff actually speak): " +
      "  • 'next' / 'next case' / 'next one' / 'next up' / 'what's next' → query='next'. ALWAYS resolves to the case with status='next' (the upcoming-room case), NOT a step forward from the active one. Surgeons mean 'the next case in the room', not 'the one after the screen I'm looking at'. " +
      "  • 'case after Marcus' / 'after this' / 'the one after that' / 'next case after [name]' → query MUST contain the word 'after' for sequential. Pass query='after this' or query='case after Marcus' so the route walks one step forward from the active case. " +
      "  • 'previous case' / 'last case' / 'go back' / 'before this' / 'prior case' → query='previous'. Steps backward from the active case. " +
      "  • 'first case' / 'first one' → query='first'. " +
      "  • DIRECT REFERENCE — pass patient name, procedure short, or fragment: query='Marcus Chen', query='Helena', query='RCR', query='rotator cuff', query='Bankart'. " +
      "" +
      "NARRATION (REQUIRED, OVERRIDES PERSONALITY DEFAULT): the personality says 'never narrate intent', BUT this tool is an exception. In the SAME turn as the tool call, you MUST return ONE short text sentence using the resolved case's PATIENT NAME and procedure. Never just say 'Opening next case' — always 'Opening Marcus Chen, reverse total shoulder.' " +
      "" +
      "TO COMPUTE THE RESOLVED CASE BEFORE NARRATING: read the live context's 'Today's board' block (lists every case in TODAY_CASES order with patient name, procedure short, status). " +
      "  • For query='next' → find the case marked status='next'. " +
      "  • For 'after [name]' / 'after this' → find the active case row, take the next row down. " +
      "  • For 'previous' → take the row above the active case. " +
      "  • For 'first' → take the top row. " +
      "  • For direct names → match against the board. " +
      "" +
      "NARRATION TEMPLATES (pick the one that fits, swap in the actual name + procedure short, keep ≤ 8 words): " +
      "  • 'Opening Marcus Chen, reverse total shoulder.' " +
      "  • 'Opening Marcus Chen's case.' " +
      "  • 'Next case — Marcus Chen, RTSA.' " +
      "  • 'Back to Helena Voss, rotator cuff repair.' " +
      "  • 'Priya Raman, SLAP repair.' " +
      "  • 'Linnea Park's subacromial decompression.' " +
      "Use the patient's actual name from the board EVERY TIME — never the word 'next' or 'previous' as a substitute for the name.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Patient name, procedure keyword, or one of: 'next' (upcoming case) / 'after [name]' or 'after this' (sequential forward) / 'previous' (sequential backward) / 'first'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sleep",
    description: "Put Arti to sleep and dim the display.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  // ── Intraop ("case active") ─────────────────────────────────────────
  {
    name: "start_case",
    description:
      "Open the pre-incision time-out checklist OR — when the time-out modal is already open and all 4 items are confirmed — advance INTO the intraop ('case active') view. " +
      "FIRE for any of these phrases: " +
      "  • 'start case' / 'start the case' / 'start' / 'start it' / 'go' / 'begin' / 'let's go' / 'start now' " +
      "  • 'start checklist' / 'start the checklist' / 'open the checklist' / 'start time-out' / 'start the time-out' / 'open time-out' / 'time out' / 'begin timeout' " +
      "  • 'start pre-op workflow' / 'begin pre-op' / 'start preop' / 'open pre-op' (when not already on preop, the route loads the up-next case there) " +
      "  • 'continue' / 'ready to start' / 'we're ready' (when the modal is already open) " +
      "Treat 'start checklist' / 'start time-out' / 'start pre-op workflow' as IDENTICAL to 'start case' — the checklist IS the case-start gate. " +
      "Behavior depends on live context: " +
      "  • On HOME (modal closed) → the route auto-loads the up-next case and opens the time-out modal. Respond e.g. 'Starting Marcus Chen's checklist.' " +
      "  • On PRE-OP (modal closed) → opens the time-out modal for the active case. Respond e.g. 'Starting the time-out.' " +
      "  • Time-out modal OPEN with 4/4 confirmed → starts the case (transitions to intraop). Respond e.g. 'Starting Marcus Chen's case.' DO NOT say 'already started' or 'already open'. " +
      "  • Time-out modal OPEN with <4 checked → the route returns ok:false with the count; respond by naming the pending items so the user can confirm them. NEVER say 'already started' or 'already open' just because the modal is open. " +
      "  • Already on intraop → respond 'Already in progress.' (route returns state.already=true). " +
      "NARRATION REQUIRED: in the same turn as the tool call, return ONE short sentence using the resolved patient's name when known. Never empty. NEVER respond 'it's already open' / 'the checklist is already up' when the modal is in fact closed — fire the tool and let the route open it.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Optional patient name / 'next' / procedure keyword. Omit when triggering from Home or Pre-op without a specific case override, and ALWAYS omit for a bare 'start' / 'continue' / 'start checklist' from inside the open time-out modal.",
        },
      },
      required: [],
    },
  },
  {
    name: "end_case",
    description:
      "End the live case — exits intraop and sends the room to Turnover (cleaning checklist + next-case countdown). Only valid while on the intraop screen. " +
      "FIRE for any of these phrases: 'end case' / 'end the case' / 'we're done' / 'wrap up' / 'wrap up the case' / 'stop procedure timer' / 'stop the timer' / 'record procedure complete' / 'procedure complete' / 'case complete' / 'case is over' / 'close out' / 'start room turnover' / 'begin turnover'. " +
      "All of these are synonymous — they end the case and the route transitions to the turnover screen automatically. Narrate a brief confirmation in the same turn ('Case ended.' / 'Room in turnover.'). Under 6 words.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "open_multi_view",
    description:
      "Switch the intraop screen into the 4-quadrant 'multi-view' wall layout. Shows surgeon's primary video, anesthesia vitals, circulating-nurse counts/allergies, and scrub-tech instruments simultaneously. Only valid while a case is active (live context will say 'Phase: intraop'). Trigger phrases: 'show multi view', 'show me multi-view', 'open multi-view', 'multi view please', 'show all roles', 'put up the wall view', 'show everything', 'open the command center', 'show me everything at once'. If not in intraop, do not call — say 'Multi-view is only available during a case.'",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_multi_view",
    description:
      "Exit the multi-view wall layout and return to the standard intraop dashboard. Only valid while multi-view is active (live context will say 'Multi-view: case ACTIVE'). Trigger phrases: 'close multi view', 'exit multi-view', 'go back to single view', 'leave multi view', 'back to nurse view' (when currently in multi-view). If user says generic 'close' / 'go back' on multi-view, also use this tool.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "intraop_focus_role",
    description: "Switch intraop role focus tab (intraop equivalent of switch_role).",
    input_schema: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: ["nurse", "scrub", "surgeon", "anesthesia"],
        },
      },
      required: ["role"],
    },
  },
  {
    name: "intraop_advance_phase",
    description: "Step the phase timeline forward or backward by one.",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: { type: "string", enum: ["next", "previous"] },
      },
      required: ["direction"],
    },
  },
  {
    name: "intraop_set_phase",
    description:
      "Jump the surgical phase timeline to a named phase. Phases are PER-PROCEDURE, so the valid names depend on the active case (e.g. RCR has 'Diagnostic scope', 'Anchor placement', 'Knot tying', 'Final inspection'; RSA has 'Deltopectoral approach', 'Glenoid preparation', etc.). Pass the spoken phase name (label or any clear substring — the dashboard does fuzzy matching). Examples: 'anchor placement', 'anchors', 'knots', 'final inspection'. Don't invent phases that aren't in the live context.",
    input_schema: {
      type: "object" as const,
      properties: {
        phase: {
          type: "string",
          description:
            "Phase name to jump to. Free-text — dashboard matches by exact id, exact label, or substring on label words.",
        },
      },
      required: ["phase"],
    },
  },
  {
    name: "intraop_show_imaging",
    description:
      "Swap the surgeon's primary view tile (multi-view) or spotlight the imaging tile (standard intraop) to a chosen modality. PREFER THIS OVER open_xrays whenever live context says 'Phase: intraop' or 'Multi-view: case ACTIVE'. " +
      "Trigger phrases: " +
      "  • 'show me the MRI' / 'show MRI' / 'show MRI scans' / 'pull up the MRI' / 'open MRI' → modality='mri' " +
      "  • 'show me the CT' / 'show the CT' / 'show CT scans' / 'pull up the CT' / 'open CT' / 'show the CAT scan' → modality='ct' " +
      "  • 'show fluoroscopy' / 'show the fluoro' / 'pull up fluoro' → modality='fluoroscopy' " +
      "  • 'show the live feed' / 'show the arthroscope' / 'back to live' / 'show the scope' → modality='arthroscopy' " +
      "  • 'side by side' → modality='side_by_side' " +
      "Modality 'arthroscopy' returns the surgeon tile to the live arthroscope feed; 'mri' shows the patient's MRI study; 'ct' shows the patient's CT scans (axial/coronal); 'fluoroscopy' shows fluoro; 'side_by_side' splits.",
    input_schema: {
      type: "object" as const,
      properties: {
        modality: {
          type: "string",
          enum: ["arthroscopy", "fluoroscopy", "mri", "ct", "side_by_side"],
        },
      },
      required: ["modality"],
    },
  },
  {
    name: "intraop_show_panel",
    description:
      "Surface a support panel on intraop. Auto-switches role focus when the panel lives on a specific role's view.",
    input_schema: {
      type: "object" as const,
      properties: {
        panel: {
          type: "string",
          enum: ["implants", "supplies", "antibiotic", "vitals", "activity", "phase"],
        },
      },
      required: ["panel"],
    },
  },
  {
    name: "toggle_timeout_item",
    description: "Check or uncheck a surgical time-out checklist item.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          enum: ["patient", "site", "procedure", "allergies"],
          description: "Which time-out item to toggle.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "show_focus_readout",
    description:
      "Open a focused-readout MODAL for a chart-data category, then in the SAME turn READ the data aloud. Use this whenever the user says 'show me X' / 'display X' / 'pull up X' / 'bring up X' (rather than just asking 'what is X'). The modal visually presents the data while you narrate it. " +
      "Map user verbs to category as follows: " +
      "  • 'show allergies' / 'display patient allergies' / 'allergies full screen' / 'pull up allergies' → category:'allergies'. Read severe ones first; if NKDA say so. " +
      "  • 'show consents' / 'display consents' / 'pull up consents' / 'show me what's signed' → category:'consents'. " +
      "  • 'show anesthesia notes' / 'display anesthesia plan' / 'pull up anesthesia' → category:'anesthesia'. Flag difficult airway. " +
      "  • 'open positioning instructions' / 'show positioning' / 'pull up positioning' / 'display the position' → category:'positioning'. " +
      "  • 'display antibiotics status' / 'show antibiotics' / 'pull up antibiotic' / 'antibiotic redose' → category:'antibiotics'. " +
      "  • 'show implant log' / 'display implants' / 'pull up the implants' / 'which implants are opened?' → category:'implants'. " +
      "  • 'display irrigation totals' / 'show fluid totals' / 'pull up fluid balance' / 'track fluid deficit' → category:'fluid'. " +
      "DISTINCT from set tools: this only displays + reads. " +
      "DISTINCT from open_patient_details: that modal shows EVERYTHING; this is single-topic. Prefer this when the user names a specific data category. " +
      "NARRATION REQUIRED: in the same turn, return ONE short readout sentence answering the data ('Severe penicillin — rash and hives. No NSAID allergy.' / 'Beach chair 60 to 70 degrees, articulated arm holder, axillary roll.' / 'Cefazolin 2 grams I V, last dose 7:14, redose in 28 minutes.'). Keep under 18 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: [
            "allergies",
            "consents",
            "anesthesia",
            "positioning",
            "antibiotics",
            "implants",
            "fluid",
          ],
          description: "Which chart category to display in the focus modal.",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "close_focus_readout",
    description:
      "Close the focused-readout modal. Use when user says 'close', 'close that', 'close the readout', 'dismiss', 'go back', 'done' while the focus modal is open. Prefer close_topmost_modal when the user just says 'close'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "set_vital_threshold_alert",
    description:
      "Set up a vital-sign threshold alert. Arti watches the named vital during intraop and announces + toasts the first time it crosses the threshold. " +
      "Trigger phrases: 'alert me if blood pressure drops below 90', 'let me know if BP goes under 100', 'watch the systolic — alert below 95', 'tell me if SpO2 drops below 92', 'alert me if heart rate spikes above 110', 'notify me if MAP falls below 65', 'set an alert for temp below 35'. " +
      "Map free text to vital: 'systolic' / 'sys BP' → bp_sys; 'diastolic' / 'dia' → bp_dia; 'MAP' / 'mean arterial' → map; 'heart rate' / 'HR' / 'pulse' → hr; 'SpO2' / 'oxygen' / 'sats' → spo2; 'EtCO2' / 'CO2' → etco2; 'temp' / 'temperature' → tempC. " +
      "comparison = 'below' for 'drops below / goes under / falls below'; 'above' for 'goes above / spikes over / climbs above'. " +
      "NARRATION REQUIRED: confirm tightly with the watched vital + threshold: 'Watching systolic, alert below 90.' / 'Alert set for S P O 2 below 92.' Under 10 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        vital: {
          type: "string",
          enum: ["bp_sys", "bp_dia", "map", "hr", "spo2", "etco2", "tempC"],
          description: "Vital to watch.",
        },
        comparison: {
          type: "string",
          enum: ["below", "above"],
          description: "Fire when the observed reading goes 'below' or 'above' the threshold.",
        },
        value: {
          type: "number",
          description:
            "Threshold numeric value (mmHg for BP/MAP/EtCO2, bpm for HR, % for SpO2, °C for tempC).",
        },
      },
      required: ["vital", "comparison", "value"],
    },
  },
  {
    name: "clear_vital_threshold_alerts",
    description:
      "Clear ALL active vital-threshold alerts (both fired and unfired). Use when the user says 'clear vital alerts', 'cancel all vital alerts', 'stop watching vitals', 'remove all alerts', 'reset vital watch'. " +
      "NARRATION: 'Vital alerts cleared.' Under 4 words.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "send_comms_reply",
    description:
      "Send a reply on the home Communications feed. Appends to the latest thread from the named source and marks it read. Sources: PACU, Family, Anesthesia, Sub-sterile, Charge RN. " +
      "Aliases accepted in `source`: 'recovery' → PACU, 'waiting room' / 'next of kin' → Family, 'gas' / 'anaesth' → Anesthesia, 'sterile processing' / 'sterile core' → Sub-sterile, 'charge nurse' / 'nurse coordinator' → Charge RN. " +
      "Trigger phrases: 'message PACU that we're 20 minutes out', 'reply to PACU: bed 3 confirmed', 'tell family she's stable', 'send to anesthesia — running ahead', 'let charge know we're behind 15 min', 'reply to sub-sterile: appreciate it'. " +
      "NARRATION REQUIRED: confirm tightly — 'Sent to PACU.' / 'Replied to family.' / 'Message to anesthesia sent.' Keep under 5 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description:
            "Recipient — PACU, Family, Anesthesia, Sub-sterile, or Charge RN (aliases ok).",
        },
        text: {
          type: "string",
          description: "Reply text to send. Pass the full message verbatim.",
        },
      },
      required: ["source", "text"],
    },
  },
  {
    name: "set_handoff_note",
    description:
      "Write a section of the PACU handoff documentation. The 7 sections are: baseline (pre-op condition), procedure (procedure performed), complications (intra-op events), ebl (estimated blood loss), post_op (positioning, sling, weight-bearing, ice, drain care), implants (components used), follow_ups (pain plan, PT, callbacks). " +
      "Trigger phrases: 'EBL was 150 mL', 'note complications were none', 'set complications to none', 'add to handoff that pain plan is interscalene block', 'follow-ups: PT day two, clinic in ten days', 'document baseline as alert and oriented'. " +
      "For APPEND-style asks ('add to follow-ups', 'also note that…'), look at the current value in the live context and pass the COMBINED text (existing + new, separated by '. '). For REPLACE-style ('set EBL to 200 mL', 'change complications to …'), pass just the new text. " +
      "NARRATION REQUIRED: confirm tightly — 'E B L set to 150 mL.' / 'Complications noted: none.' / 'Follow-ups updated.' Keep under 7 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: [
            "baseline",
            "procedure",
            "complications",
            "ebl",
            "post_op",
            "implants",
            "follow_ups",
          ],
          description: "Which handoff section to write.",
        },
        text: {
          type: "string",
          description: "Final text for the section (replaces the current value).",
        },
      },
      required: ["section", "text"],
    },
  },
  {
    name: "set_fluid_pump_joint",
    description:
      "Set the DualWave fluid pump's joint preset. Each preset auto-loads pressure + flow defaults: shoulder (60 mmHg, 200 mL/min), knee (50/250), hip (80/300), ankle (50/200), elbow (40/150), wrist (30/100). " +
      "Trigger phrases: 'set the pump to <joint>', 'switch the pump to <joint>', 'make sure the pump is on <joint>', 'confirm pump is set to <joint>', 'put the pump on <joint>', 'pump to <joint> mode', 'change the pump to <joint>'. " +
      "Also fires for 'make sure the fluid pump is set to <joint>' style confirm-and-set phrasing — if the pump is already on the requested joint, fire anyway (idempotent) and confirm. " +
      "NARRATION REQUIRED: in the same turn as the tool call, confirm tightly with the new mode + numbers. Examples: 'Pump set to shoulder, sixty over two hundred.' / 'Pump already on shoulder.' Keep under 10 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        joint: {
          type: "string",
          enum: ["shoulder", "knee", "hip", "ankle", "elbow", "wrist"],
          description: "Joint preset to load.",
        },
      },
      required: ["joint"],
    },
  },
  {
    name: "complete_timeout",
    description:
      "Mark ALL four time-out items confirmed in one shot — patient, site, procedure, allergies. Use when the user explicitly says the whole time-out was completed: 'record timeout completed', 'time-out done', 'all timeout items confirmed', 'mark time-out complete', 'timeout verified', 'we did the time-out'. " +
      "Distinct from start_case (which opens the modal then transitions to intraop). This tool only flips the checks — it doesn't move to intraop. The user typically follows with a separate 'start case' / 'continue' to actually enter intraop. " +
      "NARRATION REQUIRED: confirm tightly — 'Time-out logged.' / 'All four confirmed.' Under 5 words.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "adjust_instrument_count",
    description:
      "Increase or decrease an instrument count by a signed DELTA (relative change). " +
      "Use for: 'add a raytec' → delta=+1 / 'remove two laps' → delta=-2 / 'one more needle' → delta=+1 / 'we used three blades' → delta=-3 / 'add a couple of clamps' → delta=+2. " +
      "DO NOT use this when the user states an absolute count ('raytec is at 18', 'set lap to 9', 'we have 14 needles') — for those use set_instrument_count instead. " +
      "Pluralize naturally — 'raytecs', 'rays', 'lap pads', 'laparotomy', 'needles', 'blades', 'clamps' all map to the right enum.",
    input_schema: {
      type: "object" as const,
      properties: {
        item: {
          type: "string",
          enum: ["raytec", "lap", "needle", "blade", "clamps"],
        },
        delta: {
          type: "number",
          description: "Signed change to apply. +1 / +2 to add, -1 / -2 to remove.",
        },
      },
      required: ["item", "delta"],
    },
  },
  {
    name: "set_instrument_count",
    description:
      "Set an instrument count to a specific ABSOLUTE value (replaces the current count). " +
      "Use for: 'set raytec to 18' / 'update lap count to 9' / 'change the needle count to 14' / 'raytec is at 19' / 'we have 18 raytecs' / 'count raytec at 19' / 'raytecs are 18 now' / 'show 14 needles'. " +
      "WORKS FROM ANY VALUE — including counts ABOVE the opening reference (e.g. set raytec to 22 when opening was 20 because extras were brought in mid-case) or BELOW (count discrepancy mid-closure). The UI shows the discrepancy banner automatically when current ≠ opening; do not refuse out-of-range values. " +
      "Pluralize naturally — 'raytecs', 'rays', 'lap pads', 'laparotomy', 'needles', 'blades', 'clamps'. " +
      "DO NOT use this for relative changes ('add one', 'remove two', 'one more') — use adjust_instrument_count instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        item: {
          type: "string",
          enum: ["raytec", "lap", "needle", "blade", "clamps"],
        },
        value: {
          type: "number",
          description:
            "Absolute count to set. Any non-negative integer; above- or below-opening values are valid (UI surfaces the discrepancy automatically).",
        },
      },
      required: ["item", "value"],
    },
  },
  {
    name: "dismiss_alert",
    description: "Dismiss a non-critical alert by its zero-based index.",
    input_schema: {
      type: "object" as const,
      properties: { index: { type: "number" } },
      required: ["index"],
    },
  },
  {
    name: "open_quad_view",
    description: "Open the quad-panel overview.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "focus_quad_panel",
    description: "Focus a specific panel in the quad view.",
    input_schema: {
      type: "object" as const,
      properties: {
        panel: {
          type: "string",
          enum: ["timeout", "instruments", "alerts", "team"],
        },
      },
      required: ["panel"],
    },
  },
  {
    name: "close_quad_view",
    description: "Close the quad-panel view.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "open_how_to_video",
    description:
      "Open the in-OR surgical how-to viewer with a specific video. Use for: 'show me the how-to video for X', 'show me how-to videos for this procedure', 'pull up the latest reverse shoulder video', 'play the SLAP repair walkthrough', and — when on the library — 'open it', 'play it', 'open the video', 'show me that one'. " +
      "ARG PRIORITY: id > procedure > title. " +
      "  • `id` (PREFERRED when available) — exact library video id like 'v-acl-repair'. When the live context contains a 'Filtered library' block, ALWAYS prefer passing the id of the right entry over the keyword. If the user says a deictic reference ('open it', 'open that one', 'play the video') AND the filtered list shows exactly one video, pass that one's id. If the filtered list shows multiple, pick the most relevant id based on the user's words; if truly ambiguous, pass procedure instead and let the latest-match resolver pick. " +
      "  • `procedure` — keyword for fuzzy match (use when user names a procedure that's NOT on a filtered list). " +
      "  • `title` — legacy alias for procedure. " +
      "PRONOUN RESOLUTION: 'this procedure' / 'this case' → use the active case's procedure from live context. " +
      "NARRATION REQUIRED: in the SAME turn return ONE short sentence quoting the matched video's title, surgeon/channel, and year, plus 1–2 voice-command suggestions. Use the Reference library block in the system prompt for exact metadata. Example: 'ACL Repair TightRope, Arthrex animation, 2022. Try saying play, next chapter, or show research.'",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description:
            "Exact library video id (e.g. 'v-acl-repair'). PREFER passing this when you can read the right id from the 'Filtered library' block in live context. Skips fuzzy resolution.",
        },
        procedure: {
          type: "string",
          description:
            "Procedure name, implant name, or technique keyword. Examples: 'reverse total shoulder', 'rotator cuff', 'Bankart', 'SLAP', 'subacromial decompression', 'glenoid baseplate', 'biceps tenodesis'. Used when no `id` is available.",
        },
        title: {
          type: "string",
          description: "Legacy free-text fallback. Prefer `id` or `procedure`.",
        },
      },
      required: [],
    },
  },
  {
    name: "open_research_papers",
    description:
      "Open the how-to viewer with the research-papers panel expanded — surfaces real peer-reviewed PubMed papers for a procedure. Use for: 'show me the latest research on X', 'what are the latest research findings around this type of procedure', 'show me the papers for this case', 'pull up the literature on rotator cuff repair', 'what does the literature say about lateralization', 'show me research on knotless Bankart anchors'. The viewer opens to the research panel; if the user describes a specific paper topic, that paper opens directly. " +
      "PRONOUN RESOLUTION: When the user says 'this procedure', 'this type of procedure', 'this case', or refers to it without naming, look at the Active case line in live context and use that procedure name as the argument. " +
      "NARRATION REQUIRED: When you call this tool, in the SAME turn ALSO return ONE short sentence text quoting the matched paper's first author, journal, and year — followed by 1–2 voice command suggestions. Use the Reference library section in the system prompt to look up the exact authors/journal/year. Example: 'Pearce et al, Arthroscopy 2023, on knotless all-suture Bankart. Try saying open paper one or hide research.'",
    input_schema: {
      type: "object" as const,
      properties: {
        procedure: {
          type: "string",
          description:
            "Procedure or topic keyword used to pick the underlying video and its associated research panel. Examples: 'reverse shoulder', 'rotator cuff', 'Bankart', 'SLAP'.",
        },
        topic: {
          type: "string",
          description:
            "Optional sub-topic or paper-specific keyword to open directly (e.g. 'lateralization', 'knotless anchors', 'double row', 'Cochrane'). When omitted, the panel shows the full list.",
        },
      },
      required: [],
    },
  },
  {
    name: "video_play",
    description:
      "Resume playback of the open how-to video. Use for: 'play', 'play it', 'resume', 'continue playing', 'play the video'. Only valid when the video modal is open (live context will say 'Video modal: OPEN').",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_pause",
    description:
      "Pause playback of the open how-to video. Use for: 'pause', 'stop the video', 'pause it', 'pause the video', 'hold on'. Only valid when the video modal is open. Note: 'stop' alone may also mean 'stop_scroll' — disambiguate from live context.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_seek",
    description:
      "Skip the open how-to video forward or back by a number of seconds. Use for: 'rewind 10 seconds', 'go back 30 seconds', 'forward 15', 'skip ahead a minute' (60 s), 'rewind' (default 10 s back), 'jump back', 'fast forward 20'. Always specify direction. Default to seconds=10 if the user doesn't say a number. Use minutes only by converting to seconds.",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["forward", "back"],
          description: "Direction to seek.",
        },
        seconds: {
          type: "number",
          description:
            "How many seconds to seek. Must be > 0. Convert minutes by multiplying by 60. Default 10.",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "video_next_chapter",
    description:
      "Jump to the next chapter / step in the open how-to video. Use for: 'next chapter', 'next step', 'skip to the next part', 'next section', 'move on to the next step'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_prev_chapter",
    description:
      "Jump to the previous chapter / step in the open how-to video. Use for: 'previous chapter', 'last chapter', 'go back a step', 'previous step', 'back one chapter'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_restart",
    description:
      "Restart the open how-to video from the beginning. Use for: 'start over', 'restart the video', 'go to the beginning', 'play from the start', 'rewind to start'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_set_speed",
    description:
      "Change playback speed of the open how-to video. Use for: 'play at half speed' (0.5), 'slow it down' (0.75), 'normal speed' (1), 'speed it up' (1.5), 'play at double speed' (2), 'play at 1.25'. Allowed values: 0.5, 0.75, 1, 1.25, 1.5, 2.",
    input_schema: {
      type: "object" as const,
      properties: {
        rate: {
          type: "number",
          enum: [0.5, 0.75, 1, 1.25, 1.5, 2],
          description: "Playback rate multiplier.",
        },
      },
      required: ["rate"],
    },
  },
  {
    name: "video_show_papers",
    description:
      "Open the related-research panel inside the how-to viewer. Use for: 'show me the research', 'show me the papers', 'open the research panel', 'show related research', 'what does the literature say'. Only valid when the video modal is open.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_hide_papers",
    description:
      "Close the related-research panel inside the how-to viewer (video stays open). Use for: 'hide the research', 'close the papers', 'hide the panel', 'close research'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "video_open_paper",
    description:
      "Open a specific research paper inside the how-to viewer's research panel. Use for: 'open paper one', 'show me paper 2', 'open the lateralization paper', 'show the Cochrane paper', 'open the knotless anchor paper'. Live context lists available papers as 'Papers: 1=...; 2=...' — pass index when the user says a number, otherwise pass keyword.",
    input_schema: {
      type: "object" as const,
      properties: {
        index: {
          type: "number",
          description:
            "1-based index from the live-context paper list (e.g. 1 for the first paper).",
        },
        keyword: {
          type: "string",
          description:
            "Free-text keyword to match against paper titles / tags. Use when the user names the paper by topic.",
        },
      },
      required: [],
    },
  },
  {
    name: "video_close_paper",
    description:
      "Close the currently expanded research paper and return to the paper list (panel stays open). Use for: 'close the paper', 'back to papers', 'go back to the list', 'show all papers'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_how_to_video",
    description:
      "Close the how-to video viewer entirely. Use for: 'close the video', 'close the how-to', 'dismiss the video', 'stop the video and close it', 'close that' (when video modal is open and is the topmost modal).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_preference_card",
    description: "Scroll to and display the surgeon preference card.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_preference_card_layout_images",
    description:
      "Open the full-screen lightbox showing the surgeon's preference-card photos for a case. " +
      "Use for: 'show me the preference card images', 'pull up the prep card photos', 'show preference card for the next case', 'show me the pref card for Marcus Chen', 'show me the preference card for reverse shoulder', 'bring up the preference card images for this procedure'. " +
      "WORKS FROM ANY SCREEN — home, cases, schedule, preop. If `case_query` or `procedure` resolves to a specific case, the wall auto-navigates to that case's preop screen first so the patient/team load correctly. With no args, uses the active case. " +
      "PRONOUN RESOLUTION: 'this procedure' / 'this case' → use the active case's procedure from live context. 'next case' → resolves to the case with status='next' on TODAY_CASES. " +
      "NARRATION REQUIRED: When you call this tool, in the SAME turn ALSO return ONE short sentence text quoting the patient name and procedure. Examples: 'Preference card for Marcus Chen, reverse total shoulder.' or 'Pulling up the pref card for the next case, Bankart repair.'",
    input_schema: {
      type: "object" as const,
      properties: {
        case_query: {
          type: "string",
          description:
            "Patient name, procedure short-code (RCR/RSA/SLAP/BNK/SAD), or 'next' to resolve a specific case. Optional — defaults to the active case.",
        },
        procedure: {
          type: "string",
          description:
            "Procedure name to match (e.g. 'reverse shoulder', 'rotator cuff', 'Bankart'). Optional alternative to case_query.",
        },
      },
      required: [],
    },
  },
  {
    name: "switch_role",
    description:
      "Switch the dashboard view to a specific team member's perspective (nurse, scrub tech, surgeon, or anesthesia).",
    input_schema: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: ["nurse", "scrub", "surgeon", "anesthesia"],
          description: "The role view to display.",
        },
      },
      required: ["role"],
    },
  },
  {
    name: "open_patient_details",
    description:
      "Open the patient details modal showing full demographics, allergies, medications, labs, and consents.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_patient_details",
    description:
      "Close the patient details modal. Use when user says 'close', 'close that', 'close the modal', 'go back', or 'dismiss' while the patient details modal is open.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_procedure_overview",
    description:
      "Open the procedure overview modal — a quick orientation reference for staff unfamiliar with the procedure. Shows estimated duration, required equipment (instruments + supplies), positioning guide, and implant summary for the active case. Trigger phrases: 'show procedure overview', 'open procedure overview', 'orient me to this procedure', 'show me the procedure', 'what's the procedure', 'walk me through this procedure', 'I'm new to this procedure', 'orientation', 'show me the equipment and positioning'. Requires an active case.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_procedure_overview",
    description:
      "Close the procedure overview modal. Use when user says 'close', 'close that', 'close overview', 'go back', or 'dismiss' while the procedure overview is open.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "simulate_equipment_failure",
    description:
      "Trigger the Equipment Failure workflow — pops a route-level modal showing the failed device, troubleshooting steps, and backup availability. Use ONLY when the user explicitly asks to simulate or demonstrate a failure (this is a prototype demo trigger, not a real fault). Trigger phrases: 'simulate equipment failure', 'simulate a camera failure', 'demo the equipment failure workflow', 'simulate the pump going down', 'trigger equipment failure', 'simulate disconnect'. " +
      "NARRATION REQUIRED: in the SAME turn as the tool call, return a brief clinical alert text that names the device — e.g. 'Synergy camera signal lost.' / 'DualWave pump disconnected.' / 'APS shaver console signal lost.' Keep it under 6 words, no banter, no preamble. " +
      "The optional `console` arg lets the user pick a specific device by free-text name ('camera', 'fluid pump', 'shaver', 'RF console', 'light source', 'image management'); defaults to the camera console if omitted.",
    input_schema: {
      type: "object" as const,
      properties: {
        console: {
          type: "string",
          description:
            "Free-text device name (e.g. 'camera', 'pump', 'shaver', 'rf', 'light'). Resolved server-side via tag matching. Omit for the default (camera) when the user doesn't name a specific device.",
        },
      },
      required: [],
    },
  },
  {
    name: "close_equipment_failure",
    description:
      "Close the Equipment Failure modal. Use when user says 'close', 'close the alert', 'dismiss', 'got it', 'understood', 'we're handling it' while the equipment failure modal is open. Prefer close_topmost_modal when the user just says 'close'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "open_vip_planning",
    description:
      "Open the VIP 3D Planning Reference modal — a full-screen view of the pre-op 3D implant plan (interactive 3D model + planned orientation values + implant checklist). Use during implant placement so the surgeon can reference the plan intraoperatively without leaving the wall. Trigger phrases: 'open VIP planning model', 'open VIP planning', 'show VIP plan', 'show me the pre-op plan', 'show the planning model', 'open the 3D plan', 'open the planning reference', 'pull up the VIP plan', 'show the implant plan in 3D', 'open the surgical plan'. Requires an active case.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_vip_planning",
    description:
      "Close the VIP Planning Reference modal. Use when user says 'close', 'close the plan', 'close planning', 'close the model', 'dismiss', 'go back' while the VIP planning modal is open. Prefer close_topmost_modal when the user just says 'close'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "enter_ambient_recovery",
    description:
      "Enter Ambient Recovery mode — a calm, low-attention between-cases display with a large room clock, soft ambient visuals, no patient identifiers, and rotating procedural-prep reminders. Use when the room is between cases and the team wants the wall dialed back. Trigger phrases: 'ambient mode', 'ambient recovery', 'calm mode', 'recovery mode', 'between cases mode', 'dim the wall', 'rest the wall', 'quiet mode'. Often follows a Turnover phase.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "exit_ambient_recovery",
    description:
      "Exit Ambient Recovery mode and return to the home dashboard. Trigger phrases: 'exit ambient mode', 'exit calm mode', 'wake the wall', 'back to home', 'leave ambient', 'turn off ambient', 'I'm done with ambient'. Only valid while Ambient Recovery is the current screen (live context will say 'Phase: ambient').",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_pacu_feed",
    description:
      "Open the PACU (Post-Anesthesia Care Unit) feed modal — a scrollable list of recent messages from the recovery unit (bed availability, patient handoffs, family-update requests, etc). Trigger phrases when the user wants to SEE the feed: 'show PACU', 'show PACU feed', 'open PACU', 'open the PACU messages', 'pull up PACU', 'show me the recovery messages', 'show recovery feed'. " +
      "DO NOT use this tool when the user only wants to KNOW the latest message ('what's the latest from PACU', 'any PACU updates', 'what did PACU say', 'anything from PACU') — for those, read the top message from the live context block as a one-sentence spoken answer without firing this tool. The live context always carries the top-3 PACU messages so the answer is available from any screen.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_pacu_feed",
    description:
      "Close the PACU feed modal. Fire this whenever the PACU feed is OPEN (see live context) and the user says any close-like phrase: 'close', 'close PACU', 'close the PACU', 'close pacu feed', 'close that', 'close the feed', 'dismiss', 'dismiss PACU', 'go back', 'exit PACU', 'hide PACU', 'I'm done', 'done with PACU', 'got it', 'okay close it', 'close out'. Never refuse a close on the PACU screen — if you're unsure, fire this (or close_topmost_modal, both work and are equivalent here).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_pref_card_checklist",
    description:
      "Open the annotated preference-card table checklist modal. Shows the back table or Mayo stand image with numbered pins on each tool, and a side checklist where the circulating nurse / scrub tech can mark each tool accounted for or document a sterility breach. Trigger phrases: 'show pref card checklist', 'open the table checklist', 'pull up the back table', 'show me the Mayo stand', 'open the instrument layout', 'show me the table layout with checklist', 'show what's accounted for on the back table'. Optional `table` arg picks which side opens first.",
    input_schema: {
      type: "object" as const,
      properties: {
        table: {
          type: "string",
          description:
            "Which table to show first — free text. Accepts 'back', 'back table', 'mayo', 'mayo stand'. Defaults to back table.",
        },
      },
      required: [],
    },
  },
  {
    name: "close_pref_card_checklist",
    description:
      "Close the preference-card checklist modal. Use when user says 'close', 'close checklist', 'dismiss', 'go back' while the modal is open. Prefer close_topmost_modal when the user just says 'close'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "set_wrapup_task_status",
    description:
      "Mark an item on the home Wrap-up checklist done or pending. The current seeded tasks are: " +
      "consent (Verify consent signed in EMR), prior-count (Confirm prior case count complete), block (Confirm interscalene block w/ anesthesia), raytec (Stock raytec for room turnover), timeout (Schedule final time-out), family (Update Mrs. Chen — 09:30 check-in). " +
      "Trigger phrases for status:'done' — 'check off <X>', 'mark off <X>', 'mark <X> done', 'update <X>', '<X> is done', '<X> complete', '<X> taken care of', 'I did <X>', 'cross off <X>'. " +
      "Trigger phrases for status:'pending' — 'uncheck <X>', 'undo <X>', '<X> isn't done', '<X> still pending', 'mark <X> not done'. " +
      "`item` is FREE TEXT — pass whatever the user said (e.g. 'consent', 'block', 'raytec', 'family', 'time-out', 'count'). Server fuzzy-matches it against labels. " +
      "NARRATION REQUIRED: in the SAME turn as the tool call, return a brief confirmation — e.g. 'Consent checked off.' / 'Block marked done.' / 'Raytec un-checked.' Keep under 6 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        item: {
          type: "string",
          description:
            "Free-text task name as the user said it (e.g. 'consent', 'block', 'raytec', 'family update', 'time-out').",
        },
        status: {
          type: "string",
          enum: ["done", "pending"],
          description: "'done' to check off, 'pending' to un-check. Default 'done'.",
        },
      },
      required: ["item"],
    },
  },
  {
    name: "set_cleaning_item_status",
    description:
      "Mark an item on the OR Turnover cleaning checklist done or pending. The checklist has these items (the user names them in casual language): drapes & single-use disposal, OR table wipe-down, equipment tower disinfection, spot-clean walls/floor, linens + sharps, restock supplies, final readiness check. " +
      "Trigger phrases for status:'done' — 'drapes are off', 'table wiped down', 'tower disinfected', 'sharps emptied', 'we're stocked', 'final check done', 'mark drapes done', 'check off table'. " +
      "Trigger phrases for status:'pending' — 'undo drapes', 'mark table not done', 'unmark final check'. " +
      "NARRATION REQUIRED: in the SAME turn as the tool call, return a brief confirmation — e.g. 'Drapes marked done.' / 'Table wipe-down pending.' Keep it under 6 words. " +
      "The checklist auto-resets when a new case ends, so don't worry about stale state across cases.",
    input_schema: {
      type: "object" as const,
      properties: {
        item: {
          type: "string",
          description:
            "Free-text item name as the user said it (e.g. 'drapes', 'wipe down table', 'tower', 'sharps', 'restock', 'final check').",
        },
        status: {
          type: "string",
          enum: ["done", "pending"],
          description: "'done' to check off, 'pending' to un-check. Default 'done'.",
        },
      },
      required: ["item"],
    },
  },
  {
    name: "set_pref_card_tool_status",
    description:
      "Update the status of a specific tool on the back table or Mayo stand checklist. Use for: " +
      "(a) accounted-for confirmations — 'I have a needle driver', 'mark the Mayo scissors accounted for', 'Adson forceps is on the table', 'we have the curettes', 'needle driver is here', 'the bone hook is on the field'; " +
      "(b) missing notes — 'mark needle driver missing', 'we don't have the bone hook', 'no curettes yet'; " +
      "(c) STERILITY BREACHES — 'the scalpel dropped', 'X became unsterile', 'X is contaminated', 'X broke sterility', 'X touched the field', 'X needs to be re-sterilized'. " +
      "`tool` (REQUIRED) is free-text matched against the tool labels (e.g. 'mayo scissors', 'adson', 'needle driver', 'glenoid reamer', 'bone hook'). " +
      "`table` (OPTIONAL) is free-text ('back', 'mayo', 'mayo stand') — omit it when the user doesn't name a table; the handler will find the tool across BOTH tables. " +
      "BACK TABLE has: Metzenbaum scissors, Iris scissors, Mayo scissors, Needle driver (Mayo-Hegar), Mayo clamp, Halsted mosquito, Suture scissors, Knife handle #3, Adson forceps, DeBakey forceps, Bayonet forceps, Allis tissue clamp, Kelly clamp, Russian forceps, Operating scissors. " +
      "MAYO STAND has: Glenoid reamer head, Starter awl, Humeral broaches, Trial glenosphere, Trial poly insert, Power handpiece, Burr / cleaning brush, Baseplate trials, Glenosphere impactor, Osteotomes, Curettes, Cobb elevator, Freer elevator, Bone hook, Hohmann retractor, Bone tenaculum, Army-Navy retractor, Senn rake retractor. " +
      "NARRATION REQUIRED: in the SAME turn as the tool call, return a brief clinical confirmation — e.g. 'Needle driver accounted for.' / 'Mayo scissors marked contaminated.' Keep under 7 words.",
    input_schema: {
      type: "object" as const,
      properties: {
        table: {
          type: "string",
          description:
            "OPTIONAL free-text table name — 'back', 'back table', 'mayo', 'mayo stand'. Omit when the user doesn't name a table; the handler searches both tables.",
        },
        tool: {
          type: "string",
          description:
            "REQUIRED free-text tool name as the user said it (e.g. 'mayo scissors', 'adson forceps', 'needle driver', 'curettes', 'bone hook').",
        },
        status: {
          type: "string",
          enum: ["accounted", "missing", "contaminated"],
          description:
            "New status. 'accounted' = on the table / verified. 'missing' = not yet on the table. 'contaminated' = sterility breach (dropped, touched non-sterile field, etc).",
        },
      },
      required: ["tool", "status"],
    },
  },
  {
    name: "open_patient_video",
    description:
      "Open the patient's pre-op video message on the surgeon panel. The patient records this short clip before surgery; the modal shows the video with closed captions, a synced transcript, and AI-extracted insights so the team can scan it quickly. Trigger phrases: 'open patient video', 'show me the patient video', 'play the patient video', 'pull up the patient's pre-op video', 'show me what the patient said', 'open the patient message', 'show the pre-op video'. Auto-switches to the surgeon role view if the user is on a different panel. Requires an active case.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_patient_video",
    description:
      "Close the patient pre-op video modal. Use when user says 'close', 'close that', 'close the video', 'close patient video', 'stop the video', or 'dismiss' while the patient video modal is open. Prefer the more-generic close_topmost_modal when the user just says 'close' without naming the target.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "play_patient_video",
    description:
      "Resume playback on the patient pre-op video modal. PREFER this over video_play whenever the patient video modal is OPEN — generic 'play', 'play it', 'play video', 'play the video', 'play patient video', 'resume', 'continue', 'go ahead', 'keep playing' all map here when the live context shows 'Patient video modal: OPEN'. Only fall back to video_play when the how-to video viewer is the open one. If NEITHER is open and the user says 'play patient video' / 'play the patient video', call open_patient_video instead — it autoplays.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "pause_patient_video",
    description:
      "Pause playback on the patient pre-op video modal. PREFER this over video_pause whenever the patient video modal is OPEN — generic 'pause', 'pause it', 'pause video', 'hold on', 'wait', 'stop' (when not asking to close), 'pause the video' all map here when the live context shows 'Patient video modal: OPEN'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "restart_patient_video",
    description:
      "Restart the patient pre-op video from the beginning and play. Trigger phrases (only when the patient video modal is OPEN): 'restart', 'play it again', 'start over', 'from the beginning', 'rewind to the start', 'replay'. Distinct from video_restart (how-to viewer).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "toggle_patient_video_captions",
    description:
      "Toggle closed captions on the patient pre-op video modal. Trigger phrases (only when the patient video modal is OPEN): 'show captions', 'hide captions', 'turn on CC', 'turn off CC', 'turn on subtitles', 'turn off subtitles', 'closed captions on', 'closed captions off', 'toggle captions'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "mute_patient_video",
    description:
      "Mute audio on the patient pre-op video. The video defaults to MUTED on open (browser autoplay policy) — use this when user explicitly wants to silence it after unmuting. Trigger phrases (only when patient video modal is OPEN): 'mute', 'mute it', 'mute the video', 'silence', 'silence it', 'turn off the audio', 'turn off the sound'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "unmute_patient_video",
    description:
      "Unmute audio on the patient pre-op video. The video starts MUTED on open due to browser autoplay restrictions — staff use this to enable the patient's voice. Trigger phrases (only when patient video modal is OPEN): 'unmute', 'unmute it', 'unmute the video', 'turn on the audio', 'turn on the sound', 'let me hear it', 'let me hear them', 'turn audio on', 'enable sound', 'sound on'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "open_xrays",
    description:
      "Open the PACS-style imaging viewer for the active patient — pre-op X-rays, MRI, CT views with DICOM-style overlays, laterality marker, and radiology read panel. Trigger phrases: 'show me the X-rays', 'pull up the X-rays', 'open the imaging', 'show the films', 'show me the films', 'show the imaging', 'show the patient's X-rays', 'open the PACS', 'pull up imaging', 'show the CT'. Even when the user names a single modality (MRI/CT), open this viewer — the modality-specific view becomes selectable inside. Auto-switches to the surgeon role view if the user is on a different panel. Requires an active case. IMPORTANT: do NOT use this tool when the live context says 'Phase: intraop' or 'Multi-view: case ACTIVE' — in those screens use intraop_show_imaging instead (it swaps the surgeon's primary view tile in place, which is what the team wants mid-case).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_xrays",
    description:
      "Close the patient imaging viewer. Trigger phrases (only when the X-rays modal is OPEN): 'close X-rays', 'close the films', 'close the imaging', 'close PACS', 'close the MRI', 'close that'. Prefer close_topmost_modal when the user just says 'close'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "xrays_next_view",
    description:
      "Advance to the next view in the imaging study (e.g. AP → Axillary → Y → MRI). Trigger phrases (only when X-rays modal is OPEN): 'next', 'next view', 'next image', 'next slice', 'forward', 'go forward'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "xrays_prev_view",
    description:
      "Go back to the previous view in the imaging study. Trigger phrases (only when X-rays modal is OPEN): 'previous', 'previous view', 'back', 'go back', 'last image', 'previous image'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "xrays_show_view",
    description:
      "Jump to a specific view in the imaging study by name. Use when the user asks for a named projection or modality (e.g. 'show the AP', 'pull up the axillary', 'show the MRI', 'go to the Y view', 'show me the CT', 'show the lateral', 'show the West Point view'). Pass the user's view label verbatim as `query` — the viewer fuzzy-matches it against view labels (AP, Axillary Lateral, Scapular Y, Grashey, MRI variants, CT, Outlet, Stryker Notch, West Point). Only available when the X-rays modal is OPEN; the live context lists the exact labels available for the active study.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Free-text view label spoken by the user (e.g. 'AP', 'axillary lateral', 'MRI', 'Y view', 'Grashey', 'CT 3D').",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "xrays_zoom_in",
    description:
      "Zoom in on the active imaging view (steps of 0.5×, max 4×). Trigger phrases (only when X-rays modal is OPEN): 'zoom in', 'closer', 'magnify', 'enlarge', 'get a closer look'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "xrays_zoom_out",
    description:
      "Zoom out on the active imaging view (steps of 0.5×, min 1×). Trigger phrases (only when X-rays modal is OPEN): 'zoom out', 'pull back', 'further out'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "xrays_reset_zoom",
    description:
      "Reset the active imaging view to 1× and re-center. Trigger phrases (only when X-rays modal is OPEN): 'reset', 'reset view', 'reset zoom', 'fit to screen', 'recenter', 'normal view'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "toggle_opening_checklist_item",
    description:
      "Check or uncheck an opening checklist item on the scrub tech view by its zero-based index (0–6). Items: 0=Instrument trays, 1=Back table draped, 2=Mayo stand, 3=Implants logged, 4=Suture loaded, 5=Irrigation primed, 6=Drain ready. The Opening checklist (scrub tech) section in live context shows current state. Phrase mapping: 'instrument trays' → 0; 'back table draped' / 'back table is draped' → 1; 'Mayo stand' → 2; 'implants logged' / 'implants are logged' → 3; 'suture loaded' / 'sutures loaded' → 4; 'irrigation primed' / 'irrigation is ready' → 5; 'drain ready' / 'drain is ready' / 'drain set' → 6. Always call this tool when the user mentions any of these items being done — never skip just because the phrase is short or terminal in the list.",
    input_schema: {
      type: "object" as const,
      properties: {
        index: {
          type: "number",
          description: "Zero-based index of the checklist item to toggle (0–6).",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "toggle_machine_check_item",
    description:
      "Check or uncheck an Anesthesia machine-check item by its zero-based index (0–6). Items: 0=O₂ flush valve, 1=Vaporizer filled (Sevo), 2=Circuit leak test passed, 3=Backup ventilation (Ambu), 4=Suction functional, 5=Emergency drugs drawn up, 6=Warming blanket active. Use when the user says 'check off [item]', 'mark [item] done', 'uncheck [item]', or describes completing a step ('emergency drugs are drawn up', 'warming blanket is on', 'leak test passed'). Use the live context (Machine check section in dashboard state) to map ambiguous phrasings to the right index. The user must be on the Anesthesia view; otherwise the action returns 'not available'.",
    input_schema: {
      type: "object" as const,
      properties: {
        index: {
          type: "number",
          description: "Zero-based index of the machine-check item to toggle (0–6).",
        },
      },
      required: ["index"],
    },
  },
  {
    name: "open_table_layout_images",
    description:
      "Open the scrub tech table layout images lightbox (back table and Mayo stand photos).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "lightbox_next",
    description: "Advance to the next image in the currently open lightbox/image viewer.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "lightbox_prev",
    description: "Go back to the previous image in the currently open lightbox/image viewer.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "lightbox_zoom_in",
    description:
      "Zoom INTO the currently displayed image in the lightbox (table layout or preference card photos). Use for: 'zoom in', 'zoom in on that', 'get closer', 'enlarge', 'make it bigger', 'zoom into the image'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "lightbox_zoom_out",
    description:
      "Zoom OUT on the currently displayed image in the lightbox back to normal size. Use for: 'zoom out', 'zoom back out', 'back out', 'smaller', 'fit the image', 'zoom out of that'.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_lightbox",
    description: "Close the currently open image lightbox/viewer.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "scroll",
    description:
      "Scroll the current screen. Use for 'scroll down', 'scroll up', 'go to top', 'scroll slowly', 'keep scrolling', etc. Set continuous=true only when the user wants ongoing auto-scroll (e.g. 'keep scrolling', 'scroll slowly'). For a discrete nudge (e.g. 'scroll down a bit') use continuous=false.",
    input_schema: {
      type: "object" as const,
      properties: {
        direction: {
          type: "string",
          enum: ["up", "down", "top", "bottom"],
          description: "'top' and 'bottom' jump to the extremes; 'up'/'down' scroll by amount.",
        },
        speed: {
          type: "string",
          enum: ["slow", "normal", "fast"],
          description: "Scroll speed. Default 'normal'.",
        },
        continuous: {
          type: "boolean",
          description: "If true, keep scrolling until stop_scroll is called.",
        },
      },
      required: ["direction"],
    },
  },
  {
    name: "stop_scroll",
    description:
      "Stop any ongoing continuous scroll. Use when user says 'stop', 'stop scrolling', 'that's enough', etc.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

export interface ArtiToolCall {
  name: string;
  input: Record<string, string | number | boolean | null | string[]>;
}

export const processVoiceCommand = createServerFn({ method: "POST" })
  .inputValidator(
    (input: unknown) =>
      input as {
        transcript: string;
        context: string;
        history: Array<{ role: "user" | "assistant"; content: string }>;
      },
  )
  .handler(async ({ data }) => {
    const messages: Anthropic.MessageParam[] = [
      ...data.history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: data.transcript },
    ];

    const first = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        // Responses are capped at ≤1–2 sentences by the system prompt for
        // most turns. Headroom raised to 240 so explicit read-back queries
        // ("what are the video notes / AI insights") can list a few short
        // bullets without truncation. Short responses finish well before
        // this cap, so no latency penalty.
        max_tokens: 240,
        temperature: 0,
        // Split into a cached block (system prompt + full schedule) and a live
        // block (current screen, active case, dashboard state, time). Haiku
        // reads the cached block from Anthropic's prompt cache on repeat
        // calls within 5 minutes, cutting input processing by ~90%.
        system: [
          {
            type: "text",
            text: CACHED_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: `---\nLive context:\n${data.context}`,
          },
        ],
        messages,
        tools: TOOLS,
      },
      { timeout: 15_000 },
    );

    const toolUseBlocks = first.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolCalls: ArtiToolCall[] = toolUseBlocks.map((b) => ({
      name: b.name,
      input: b.input as Record<string, string | number | boolean | null | string[]>,
    }));

    // Silent tools: the screen change itself is the confirmation, so skip TTS
    // entirely. This is the biggest single latency win for voice commands —
    // ElevenLabs generation + audio playback together add ~1.5 s per response,
    // and none of it is needed when the user can see the result.
    //
    // Keep verbal for: wake (greeting), open_case (announces which case),
    // role / count / time-out / alert tools (sterile-field hands-off workflow),
    // and anything that answers a question without changing the screen.
    const SILENT_TOOLS = new Set([
      "sleep",
      "scroll",
      "stop_scroll",
      // Navigation
      "navigate_home",
      "navigate_cases",
      "navigate_schedule",
      "navigate_surgeons",
      "navigate_patients",
      "navigate_consoles",
      "navigate_library",
      "start_screensaver",
      "exit_screensaver",
      "close_topmost_modal",
      // Journey walkthrough — all silent so Arti's narration owns the
      // audio channel without conflicting confirmations.
      "start_journey",
      "exit_journey",
      "journey_pause",
      "journey_resume",
      "journey_next",
      "journey_previous",
      "library_filter_category",
      "library_search",
      "library_set_animated_only",
      "library_set_saved_only",
      "library_clear_filters",
      "show_saved_videos",
      // focus_console is intentionally NOT silent — when the user asks
      // "is the pump connected?" Arti reads the live tower status block
      // and speaks a one-sentence telemetry answer in the same turn.
      "show_schedule_day",
      "close_schedule_day",
      // Modals & overlays
      "open_patient_details",
      "close_patient_details",
      "show_procedure_overview",
      "close_procedure_overview",
      // simulate_equipment_failure is intentionally NOT silent — Claude
      // narrates the device's failure ("Synergy camera signal lost.") so the
      // OR team hears the alert in addition to seeing the modal.
      "close_equipment_failure",
      "open_vip_planning",
      "close_vip_planning",
      "enter_ambient_recovery",
      "exit_ambient_recovery",
      "show_pacu_feed",
      "close_pacu_feed",
      // show_focus_readout is intentionally NOT silent — Claude reads the
      // chart data aloud while the modal displays it. close_focus_readout
      // is silent (just dismisses the visual).
      "close_focus_readout",
      "show_pref_card_checklist",
      "close_pref_card_checklist",
      // set_pref_card_tool_status is intentionally NOT silent — Claude
      // narrates the change ("Mayo scissors marked contaminated.") so the
      // OR team hears the confirmation without watching the screen.
      "open_patient_video",
      "close_patient_video",
      "play_patient_video",
      "pause_patient_video",
      "restart_patient_video",
      "toggle_patient_video_captions",
      "mute_patient_video",
      "unmute_patient_video",
      "open_xrays",
      "close_xrays",
      "xrays_next_view",
      "xrays_prev_view",
      "xrays_show_view",
      "xrays_zoom_in",
      "xrays_zoom_out",
      "xrays_reset_zoom",
      "open_quad_view",
      "focus_quad_panel",
      "close_quad_view",
      // Lightbox / images
      "lightbox_next",
      "lightbox_prev",
      "lightbox_zoom_in",
      "lightbox_zoom_out",
      "close_lightbox",
      "show_preference_card",
      "open_table_layout_images",
      // show_preference_card_layout_images is intentionally NOT silent — Arti
      // narrates the resolved patient name + procedure so the OR team hears
      // which case's pref card just came up without looking at the screen.
      // Media — open_how_to_video and open_research_papers are intentionally
      // NOT silent. The agent narrates the matched video/paper title, author,
      // and year in the same turn so the OR team knows what was loaded
      // without looking at the screen.
      "video_play",
      "video_pause",
      "video_seek",
      "video_next_chapter",
      "video_prev_chapter",
      "video_restart",
      "video_set_speed",
      "video_show_papers",
      "video_hide_papers",
      "video_open_paper",
      "video_close_paper",
      "close_how_to_video",
      // Role view switch — the panel visibly changes, audio is redundant.
      "switch_role",
      // Intraop — all silent except start_case (narrates the patient
      // name in turn 1, like open_case). end_case returns to pre-op
      // visually, no audio needed.
      "end_case",
      "open_multi_view",
      "close_multi_view",
      "intraop_focus_role",
      "intraop_advance_phase",
      "intraop_set_phase",
      "intraop_show_imaging",
      "intraop_show_panel",
      // Schedule filters — the chips and case grid visibly update.
      "schedule_set_service_lines",
      "schedule_set_surgeon",
      "schedule_clear_filters",
      // Reminder alert dismissal — the toast visibly disappears.
      "dismiss_reminder_alert",
      // Person schedule modal — visible card list / view toggle / close.
      "show_person_schedule",
      "set_person_schedule_view",
      "close_person_schedule",
    ]);
    const isSilent = toolCalls.length > 0 && toolCalls.every((tc) => SILENT_TOOLS.has(tc.name));

    // Use whatever text Claude returned in the first turn (greetings, answers, etc.).
    let response = isSilent
      ? ""
      : first.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();

    // When a tool was called but produced no first-turn text, do a short second
    // turn to get a spoken confirmation (navigation, view changes, action tools).
    if (toolUseBlocks.length > 0 && !response && !isSilent) {
      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((b) => ({
        type: "tool_result" as const,
        tool_use_id: b.id,
        content: JSON.stringify({ ok: true }),
      }));

      const second = await client.messages.create(
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 32,
          temperature: 0,
          // Reuse the same cache breakpoint so the second turn also reads
          // from the cached system prompt.
          system: [
            {
              type: "text",
              text: CACHED_SYSTEM,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: `---\nLive context:\n${data.context}\n\nSpeak ONE short sentence confirming what just happened. No patient names, no case details, no elaboration. (For tools that DO need patient names — like open_case — narration is supposed to happen in turn 1, before this fallback. If you're here on a case nav, it means turn 1 was empty; just say "Done." or "Opening." rather than guessing a name from possibly-stale context.)\nGreeting/wake examples: "Good morning." "Hey, good to have you in." "Ready when you are."\nNavigation examples: "Home screen." "Here's the case list." "Quad view open."\nAction examples: "Done." "Counts updated." "Alert dismissed."`,
            },
          ],
          messages: [
            { role: "user", content: data.transcript },
            { role: "assistant", content: first.content },
            { role: "user", content: toolResults },
          ],
        },
        { timeout: 10_000 },
      );

      response = second.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    }

    return { response, toolCalls };
  });
