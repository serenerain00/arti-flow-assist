import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = readFileSync(
  resolve(process.cwd(), "skills/personality.md"),
  "utf-8",
);

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
    const system = `${SYSTEM_PROMPT}\n\n---\nLive context:\n${data.context}`;

    const messages: Anthropic.MessageParam[] = [
      ...data.history.map(h => ({ role: h.role, content: h.content })),
      { role: "user", content: data.transcript },
    ];

    const first = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0,
      system,
      messages,
      tools: TOOLS,
    });

    const toolUseBlocks = first.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const toolCalls: ArtiToolCall[] = toolUseBlocks.map((b) => ({
      name: b.name,
      input: b.input as Record<string, string | number | boolean | null>,
    }));

    // Only truly mechanical actions that need no verbal acknowledgement are silent.
    const SILENT_TOOLS = new Set(["sleep", "scroll", "stop_scroll"]);
    const isSilent = toolCalls.length > 0 && toolCalls.every(tc => SILENT_TOOLS.has(tc.name));

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

      const second = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 32,
        temperature: 0,
        system: `${system}\n\nSpeak ONE short sentence confirming what just happened. No patient names. No case details. No elaboration.\nGreeting/wake examples: "Good morning." "Hey, good to have you in." "Ready when you are."\nNavigation examples: "Home screen." "Here's the case list." "Opening next case." "Quad view open."\nAction examples: "Done." "Counts updated." "Sterile cockpit on." "Alert dismissed."`,
        messages: [
          { role: "user", content: data.transcript },
          { role: "assistant", content: first.content },
          { role: "user", content: toolResults },
        ],
      });

      response = second.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
    }

    return { response, toolCalls };
  });
