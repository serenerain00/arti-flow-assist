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
    name: "navigate_consoles",
    description:
      "Open the OR equipment-tower status screen — a stylized 3D view of the integrated arthroscopy stack (light source, 4K camera console, image management, fluid pump, shaver, RF console) with live connection status and per-device telemetry (pressure, flow, RPM, intensity, etc). Use for: 'show me the OR consoles', 'show the equipment tower', 'console status', 'tower status', 'show me the equipment', 'pull up the consoles', 'are the consoles ready', 'check the tower'. After this nav opens, the user can voice-focus an individual console with focus_console.",
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
      "Filter the Schedule screen to one surgeon's cases. Resolve the user's reference ('Patel', 'Dr. Foster', 'the spine surgeon') to a full surgeon name from the Schedule / Full OR schedule context. Pass an empty string to clear the surgeon filter (show all surgeons). Examples: 'filter by Dr. Patel' → 'Dr. Anika Patel'. 'show Foster's cases' → 'Dr. Jamal Foster'. 'clear the surgeon filter' → ''.",
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
      "Open a focused modal showing one person's case schedule (vertical card list, soonest-first). Use for: 'show me Dr. Patel's schedule', 'what's Marcus Webb's day look like', 'pull up Dr. Shah's week', 'show me the anesthesiologist's schedule', 'now show me Dr. Foster' (when modal already open — switches person). Resolve the spoken reference to a CANONICAL name from the Team roster in the cached system prompt — pass the full string as it appears (e.g. 'Dr. Anika Patel', 'Marcus Webb, CST', 'Dr. Priya Shah', 'Melissa Quinn, RN'). Always include `role` so the modal knows which schedule field to filter on.",
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
    name: "open_case",
    description: "Open a specific case by patient name, procedure keyword, or 'next'.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "sleep",
    description: "Put Arti to sleep and dim the display.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
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
    name: "adjust_instrument_count",
    description: "Increase or decrease an instrument count by a signed delta.",
    input_schema: {
      type: "object" as const,
      properties: {
        item: {
          type: "string",
          enum: ["raytec", "lap", "needle", "blade", "clamps"],
        },
        delta: {
          type: "number",
          description: "Positive to add, negative to remove.",
        },
      },
      required: ["item", "delta"],
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
      "Open the in-OR surgical how-to viewer with the latest video matching a procedure or keyword. Use for: 'show me the how-to video for X', 'show me how-to videos for this procedure', 'show me a video for this case's procedure', 'pull up the latest reverse shoulder video', 'play the SLAP repair walkthrough'. " +
      "PRONOUN RESOLUTION: When the user says 'this procedure', 'this case', 'this case's procedure', or refers to the procedure without naming it, look at the Active case line in live context and use that procedure name as the argument. Same applies when a case is highlighted in a list (use that case's procedure). " +
      "NARRATION REQUIRED: When you call this tool, in the SAME turn ALSO return ONE short sentence text quoting the matched video's title (or procedure), the surgeon/channel, and the published year — followed by 1–2 voice command suggestions. Use the Reference library section in the system prompt to look up the exact title/surgeon/year. Example: 'Reverse Total Shoulder Replacement, Arthrex, 2017. Try saying play, next chapter, or show research.'",
    input_schema: {
      type: "object" as const,
      properties: {
        procedure: {
          type: "string",
          description:
            "Procedure name, implant name, or technique keyword. Examples: 'reverse total shoulder', 'rotator cuff', 'Bankart', 'SLAP', 'subacromial decompression', 'glenoid baseplate', 'biceps tenodesis'.",
        },
        title: {
          type: "string",
          description:
            "Legacy free-text fallback. Prefer `procedure`. Either argument is sufficient.",
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
        // Responses are capped at ≤1–2 sentences by the system prompt. 120
        // tokens is enough headroom for a greeting + tool call; lower cap =
        // faster time-to-last-token for every voice turn.
        max_tokens: 120,
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
      // focus_console is intentionally NOT silent — when the user asks
      // "is the pump connected?" Arti reads the live tower status block
      // and speaks a one-sentence telemetry answer in the same turn.
      "show_schedule_day",
      "close_schedule_day",
      // Modals & overlays
      "open_patient_details",
      "close_patient_details",
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
              text: `---\nLive context:\n${data.context}\n\nSpeak ONE short sentence confirming what just happened. No patient names. No case details. No elaboration.\nGreeting/wake examples: "Good morning." "Hey, good to have you in." "Ready when you are."\nNavigation examples: "Home screen." "Here's the case list." "Opening next case." "Quad view open."\nAction examples: "Done." "Counts updated." "Alert dismissed."`,
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
