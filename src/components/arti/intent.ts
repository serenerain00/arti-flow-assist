// Tiny rule-based intent classifier for the Arti demo. Not real NLP —
// just keyword matches sufficient to drive the demo flow.

export type ArtiIntent =
  | { kind: "wake" }                 // "hi arti", "hello", "wake up"
  | { kind: "show-cases" }           // "show me the cases", "case list", "schedule"
  | { kind: "open-case"; query: string }  // "open marcus chen's case", "next case"
  | { kind: "go-home" }              // "home", "dashboard"
  | { kind: "sleep" }                // "go to sleep", "sleep"
  | { kind: "unknown"; text: string };

export function parseIntent(raw: string): ArtiIntent {
  const text = raw.toLowerCase().trim();
  if (!text) return { kind: "unknown", text: raw };

  // Wake / greet
  if (/\b(hi|hey|hello|hola|good (morning|afternoon|evening))\b.*\barti\b/.test(text)
      || /^arti\b/.test(text)
      || /\bwake (up|arti)\b/.test(text)) {
    return { kind: "wake" };
  }

  // Sleep
  if (/\b(go to sleep|sleep|standby|stand by|power down)\b/.test(text)) {
    return { kind: "sleep" };
  }

  // Case list
  if (/\b(case list|cases|schedule|today'?s cases|show.*cases?)\b/.test(text)) {
    return { kind: "show-cases" };
  }

  // Open / start a specific case
  if (/\b(open|start|show|pull up|go to|begin)\b.*(case|patient|pre[- ]?op)/.test(text)
      || /\bnext case\b/.test(text)) {
    return { kind: "open-case", query: text };
  }

  // Home
  if (/\b(home|dashboard|main screen)\b/.test(text)) {
    return { kind: "go-home" };
  }

  return { kind: "unknown", text: raw };
}
