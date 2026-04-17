// Tiny rule-based intent classifier for the Arti demo. Not real NLP —
// just keyword matches sufficient to drive the text-prompt path to the
// same actions the voice agent has access to. Voice goes directly to
// client tools; this is the keyboard/text fallback so parity holds.

import type { InstrumentId, QuadPanelId, TimeOutId } from "@/hooks/useArtiVoice";

export type ArtiIntent =
  // Phase / navigation
  | { kind: "wake" }
  | { kind: "show-cases" }
  | { kind: "open-case"; query: string }
  | { kind: "go-home" }
  | { kind: "sleep" }
  // Dashboard tools
  | { kind: "toggle-timeout"; id: TimeOutId }
  | { kind: "adjust-count"; item: InstrumentId; delta: number }
  | { kind: "toggle-cockpit"; enabled?: boolean }
  | { kind: "open-quad" }
  | { kind: "focus-quad"; panel: QuadPanelId }
  | { kind: "close-quad" }
  | { kind: "show-pref-card" }
  | { kind: "show-pref-images" }
  | { kind: "unknown"; text: string };

/** Map spoken instrument names to the canonical ID set. */
function detectInstrument(text: string): InstrumentId | undefined {
  if (/\blaps?\b|\blap pads?\b/.test(text)) return "lap";
  if (/\braytec|\braytex|gauze|4\s*x\s*4/.test(text)) return "raytec";
  if (/\bsponges?\b/.test(text)) return "raytec"; // closest default
  if (/\bneedles?\b/.test(text)) return "needle";
  if (/\bblades?\b/.test(text)) return "blade";
  if (/\bclamps?\b|\bhemostats?\b|\bmosquitos?\b/.test(text)) return "clamps";
  return undefined;
}

function detectTimeOutItem(text: string): TimeOutId | undefined {
  if (/\b(patient(?:'s)?\s*(?:id(?:entity)?)?|id confirmed|right patient)\b/.test(text))
    return "patient";
  if (/\b(site|side|mark(?:ed|ing)?|laterality)\b/.test(text)) return "site";
  if (/\bprocedure\b/.test(text)) return "procedure";
  if (/\ballerg(?:y|ies)|antibiotic|prophylaxis\b/.test(text)) return "allergies";
  return undefined;
}

function detectQuadPanel(text: string): QuadPanelId | undefined {
  if (/\btime[-\s]?out|checklist\b/.test(text)) return "timeout";
  if (/\binstrument|counts?|sharps?|sponges?\b/.test(text)) return "instruments";
  if (/\balerts?\b/.test(text)) return "alerts";
  if (/\bteam|staff|roster\b/.test(text)) return "team";
  return undefined;
}

/** Extract a signed integer delta from natural language ("add 2", "remove one"). */
function detectDelta(text: string): number | undefined {
  const wordToNum: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  // Pull the first number-ish token (digit or word).
  let magnitude = 1;
  const numMatch = text.match(/\b(\d+)\b/);
  if (numMatch) {
    magnitude = parseInt(numMatch[1], 10);
  } else {
    for (const [word, n] of Object.entries(wordToNum)) {
      if (new RegExp(`\\b${word}\\b`).test(text)) {
        magnitude = n;
        break;
      }
    }
  }

  if (/\b(remove|subtract|take|minus|decrease|down|less)\b/.test(text)) return -magnitude;
  if (/\b(add|plus|increase|up|more|another|one more)\b/.test(text)) return magnitude;
  return undefined;
}

export function parseIntent(raw: string): ArtiIntent {
  const text = raw.toLowerCase().trim();
  if (!text) return { kind: "unknown", text: raw };

  /* ----- Wake / sleep ----- */

  if (
    /\b(hi|hey|hello|hola|good (morning|afternoon|evening))\b.*\barti\b/.test(text) ||
    /^arti\b/.test(text) ||
    /\bwake (up|arti)\b/.test(text)
  ) {
    return { kind: "wake" };
  }

  if (/\b(go to sleep|sleep|standby|stand by|power down)\b/.test(text)) {
    return { kind: "sleep" };
  }

  /* ----- Sterile cockpit ----- */

  if (/\b(sterile\s*cockpit|cockpit mode|focus mode)\b/.test(text)) {
    if (/\b(on|enable|start|engage|enter)\b/.test(text)) {
      return { kind: "toggle-cockpit", enabled: true };
    }
    if (/\b(off|disable|stop|exit|leave|end)\b/.test(text)) {
      return { kind: "toggle-cockpit", enabled: false };
    }
    return { kind: "toggle-cockpit" };
  }

  /* ----- Quad view ----- */

  if (/\b(close|exit|back to) quad|normal view|close overview\b/.test(text)) {
    return { kind: "close-quad" };
  }
  if (/\b(focus|zoom|expand) (on )?(the )?(time[-\s]?out|instruments?|alerts?|team)/.test(text)) {
    const panel = detectQuadPanel(text);
    if (panel) return { kind: "focus-quad", panel };
  }
  if (/\b(show (everything|overview|dashboard)|quad view|open overview|open quad)\b/.test(text)) {
    return { kind: "open-quad" };
  }

  /* ----- Preference card ----- */

  if (
    /\b(back table|mayo stand|room setup|layout (image|picture)s?|setup (image|picture)s?)\b/.test(
      text,
    )
  ) {
    return { kind: "show-pref-images" };
  }
  if (/\b(preference card|pref card)\b/.test(text)) {
    return { kind: "show-pref-card" };
  }

  /* ----- Time-out checklist ----- */

  if (/\b(mark|confirm|check (?:off )?|verify|time[-\s]?out)\b/.test(text)) {
    const id = detectTimeOutItem(text);
    if (id) return { kind: "toggle-timeout", id };
  }

  /* ----- Instrument counts ----- */

  {
    const item = detectInstrument(text);
    const delta = detectDelta(text);
    if (item && delta !== undefined) {
      return { kind: "adjust-count", item, delta };
    }
  }

  /* ----- Cases ----- */

  if (/\b(case list|cases|schedule|today'?s cases|show.*cases?)\b/.test(text)) {
    return { kind: "show-cases" };
  }
  if (
    /\b(open|start|show|pull up|go to|begin)\b.*(case|patient|pre[- ]?op)/.test(text) ||
    /\bnext case\b/.test(text)
  ) {
    return { kind: "open-case", query: text };
  }

  /* ----- Home ----- */

  if (/\b(home|dashboard|main screen)\b/.test(text)) {
    return { kind: "go-home" };
  }

  return { kind: "unknown", text: raw };
}
