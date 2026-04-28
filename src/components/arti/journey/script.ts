/**
 * Story journey — the "how this was built" walkthrough Arti narrates
 * when the user says "show me how this was created".
 *
 * Each stage is a discrete narration chunk paired with a visual variant.
 * The journey screen plays them sequentially, using v.speak() promise
 * resolution to drive auto-advance. Total runtime ~40-50 s with
 * ElevenLabs Flash at default rate.
 *
 * Narration tone: warm, confident, conversational — same voice the rest
 * of Arti uses. Brief enough that an Arthrex demo audience stays
 * engaged; specific enough that the engineering crowd recognizes the
 * stack name-drops.
 */

export type StageVisual =
  | "vision"
  | "stack"
  | "brain"
  | "voice"
  | "polish"
  | "knowledge"
  | "closing"
  | "credits";

export interface JourneyStage {
  id: string;
  title: string;
  subtitle: string;
  /** What Arti speaks while this stage is active. */
  narration: string;
  /** Which visual variant to render. */
  visual: StageVisual;
  /**
   * Tech name-drops surfaced in the visual. Order ≈ order they're
   * mentioned in narration so the visual can stagger them in roughly
   * sync with the spoken word.
   */
  tags: string[];
}

export const JOURNEY: JourneyStage[] = [
  {
    id: "vision",
    title: "The Vision",
    subtitle: "An ambient OR companion",
    narration:
      "Arti began with one question. What if the OR wall could think? An ambient companion for surgical teams — present, fast, and quiet.",
    visual: "vision",
    tags: ["Ambient", "Voice-first", "Surgical"],
  },
  {
    id: "stack",
    title: "The Foundation",
    subtitle: "Modern, typed, full-stack",
    narration:
      "Built on React nineteen and TypeScript, served by TanStack Start, styled with Tailwind. Modern foundations for a modern operating room.",
    visual: "stack",
    tags: ["React 19", "TypeScript", "TanStack", "Tailwind"],
  },
  {
    id: "brain",
    title: "The Brain",
    subtitle: "Claude Haiku 4.5",
    narration:
      "At the core, Claude Haiku from Anthropic. Sixty voice tools let me navigate screens, update counts, switch cases, control the equipment tower — all from natural speech.",
    visual: "brain",
    tags: [
      "Anthropic",
      "Claude Haiku",
      "60+ tools",
      "navigate",
      "open_case",
      "set_count",
      "focus_console",
      "library",
    ],
  },
  {
    id: "voice",
    title: "The Voice",
    subtitle: "Speech in, speech out",
    narration:
      "You speak through the browser's Web Speech API. I respond through ElevenLabs Flash, streaming low-latency audio in under a second. Conversational by design.",
    visual: "voice",
    tags: ["Web Speech API", "ElevenLabs Flash", "< 1s latency"],
  },
  {
    id: "polish",
    title: "The Polish",
    subtitle: "Motion that matches the room",
    narration:
      "Framer Motion drives the modals. GSAP choreographs the moments. React Three Fiber renders the equipment tower in full 3D. Hand-tuned to feel like one continuous experience.",
    visual: "polish",
    tags: ["Framer Motion", "GSAP", "React Three Fiber", "Bloom"],
  },
  {
    id: "knowledge",
    title: "The Knowledge",
    subtitle: "Real surgical content",
    narration:
      "Twenty-one curated surgical videos from Arthrex, JBJS, and trusted educational channels. Six PubMed-verified research papers. No fabricated content — only what a surgeon would actually pull up.",
    visual: "knowledge",
    tags: ["Arthrex", "JBJS", "PubMed", "21 videos", "6 papers"],
  },
  {
    id: "closing",
    title: "Built for Arthrex",
    subtitle: "Voice that understands the room",
    narration:
      "Built for the Arthrex team. Built for the OR. This is what voice can be when it understands the room.",
    visual: "closing",
    tags: ["Arthrex", "Arti"],
  },
  {
    id: "credits",
    title: "Melissa Casole",
    subtitle: "Senior UX Designer · Arthrex",
    narration:
      "And finally — none of this happens without Melissa Casole, Senior UX Designer at Arthrex. She wrote my personality, picked my voice, and decided I should never argue with a surgeon mid-case. Wise call. Thank you, Melissa.",
    visual: "credits",
    tags: ["Designed by", "Melissa Casole", "Arthrex"],
  },
];
