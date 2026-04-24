import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SCHEDULE_CASES } from "../components/arti/schedule";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = readFileSync(
  resolve(process.cwd(), "skills/personality.md"),
  "utf-8",
);

// Static schedule reference — built once at module load, never changes per
// request. Combined with the system prompt into a single cached block so
// Haiku only processes this once per 5-minute window per process, not every
// turn. This is the single biggest latency win for repeat voice commands.
const STATIC_SCHEDULE_OVERVIEW = SCHEDULE_CASES.map(
  (c) =>
    `  - ${c.date} ${c.time} ${c.room} · ${c.patientName} (${c.patientAgeSex}) · ${c.procedureShort}${c.side ? ` ${c.side}` : ""} · ${c.surgeon} · Anes ${c.anesthesiologist} · Scrub ${c.scrubTech} · ${c.status}`,
).join("\n");

const CACHED_SYSTEM = `${SYSTEM_PROMPT}\n\n---\nFull OR schedule (stable reference — use this to answer patient / surgeon / date / count questions):\n${STATIC_SCHEDULE_OVERVIEW}`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "wake",
    description: "Wake Arti from sleep/standby. Use when the user greets Arti or asks it to wake up.",
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
    name: "show_schedule_day",
    description:
      "Open a specific day's detail on the Schedule. Use whenever the user mentions a date — e.g. 'show me May 20th', 'what's on April 27', 'pull up next Tuesday'. Convert the spoken date to ISO format YYYY-MM-DD using 'Today is …' from context as the reference year; pick the closest future or past occurrence if ambiguous.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "Target date in ISO format YYYY-MM-DD (e.g., '2026-05-20' for 'May 20th').",
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
    name: "toggle_sterile_cockpit",
    description: "Enable or disable sterile cockpit mode. Omit enabled to toggle.",
    input_schema: {
      type: "object" as const,
      properties: { enabled: { type: "boolean" } },
      required: [],
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
    description: "Open a surgical how-to video by title or keyword.",
    input_schema: {
      type: "object" as const,
      properties: { title: { type: "string" } },
      required: [],
    },
  },
  {
    name: "show_preference_card",
    description: "Scroll to and display the surgeon preference card.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "show_preference_card_layout_images",
    description: "Open the full-screen image lightbox showing surgical table layout photos.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "switch_role",
    description: "Switch the dashboard view to a specific team member's perspective (nurse, scrub tech, surgeon, or anesthesia).",
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
    description: "Open the patient details modal showing full demographics, allergies, medications, labs, and consents.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "close_patient_details",
    description: "Close the patient details modal. Use when user says 'close', 'close that', 'close the modal', 'go back', or 'dismiss' while the patient details modal is open.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "toggle_opening_checklist_item",
    description: "Check or uncheck an opening checklist item on the scrub tech view by its zero-based index (0–6). Items: 0=Instrument trays, 1=Back table draped, 2=Mayo stand, 3=Implants logged, 4=Suture loaded, 5=Irrigation primed, 6=Drain ready.",
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
    name: "open_table_layout_images",
    description: "Open the scrub tech table layout images lightbox (back table and Mayo stand photos).",
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
    description: "Scroll the current screen. Use for 'scroll down', 'scroll up', 'go to top', 'scroll slowly', 'keep scrolling', etc. Set continuous=true only when the user wants ongoing auto-scroll (e.g. 'keep scrolling', 'scroll slowly'). For a discrete nudge (e.g. 'scroll down a bit') use continuous=false.",
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
    description: "Stop any ongoing continuous scroll. Use when user says 'stop', 'stop scrolling', 'that's enough', etc.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

export interface ArtiToolCall {
  name: string;
  input: Record<string, string | number | boolean | null>;
}

export const processVoiceCommand = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as {
    transcript: string;
    context: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  })
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
      input: b.input as Record<string, string | number | boolean | null>,
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
      "show_preference_card_layout_images",
      "open_table_layout_images",
      // Media
      "open_how_to_video",
      // Role view switch — the panel visibly changes, audio is redundant.
      "switch_role",
    ]);
    const isSilent = toolCalls.length > 0 && toolCalls.every((tc) => SILENT_TOOLS.has(tc.name));

    // Use whatever text Claude returned in the first turn (greetings, answers, etc.).
    let response = isSilent ? "" : first.content
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
              text: `---\nLive context:\n${data.context}\n\nSpeak ONE short sentence confirming what just happened. No patient names. No case details. No elaboration.\nGreeting/wake examples: "Good morning." "Hey, good to have you in." "Ready when you are."\nNavigation examples: "Home screen." "Here's the case list." "Opening next case." "Quad view open."\nAction examples: "Done." "Counts updated." "Sterile cockpit on." "Alert dismissed."`,
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
