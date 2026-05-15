import type { LucideIcon } from "lucide-react";
import {
  AirplayIcon,
  Clock,
  FileText,
  Image as ImageIcon,
  Images,
  ScanLine,
  Sparkles,
  TimerReset,
  Watch,
} from "lucide-react";

export type WidgetType =
  | "clock"
  | "timer"
  | "stopwatch"
  | "carousel"
  | "prefcard-image"
  | "prefcard-text"
  | "arti"
  | "pacs"
  | "procedure-planning";

export type WidgetSize = "small" | "medium" | "large";

export type ContentSource = "procedure" | "custom";

export interface WidgetImage {
  id: string;
  name: string;
  dataUrl: string;
}

export interface WidgetConfig {
  /** "procedure" pulls from a saved procedure; "custom" uses inline content. */
  source?: ContentSource;
  /** Procedure source for carousel + prefcard-text widgets. */
  procedureId?: string;
  /** Specific image id (from a procedure) for prefcard-image widget. */
  imageId?: string;
  /** Direct-upload images for carousel / prefcard-image when source is "custom". */
  customImages?: WidgetImage[];
  /** Direct-write HTML for prefcard-text when source is "custom". */
  customHtml?: string;
  /** Timer duration in seconds. */
  durationSec?: number;
  /** Optional label override (e.g., for the timer). */
  label?: string;
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  config: WidgetConfig;
}

export interface WidgetMeta {
  label: string;
  blurb: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  /** Sizes a widget actually supports. Most support all three. */
  sizes: WidgetSize[];
  /** Reserved widgets are auto-placed on every phase, can't be removed,
   *  and don't appear in the palette. They can still be moved/resized. */
  reserved?: boolean;
}

export const WIDGET_META: Record<WidgetType, WidgetMeta> = {
  clock: {
    label: "Clock",
    blurb: "Real-time clock with auto-detected timezone.",
    icon: Clock,
    defaultSize: "small",
    sizes: ["small", "medium", "large"],
  },
  timer: {
    label: "Timer",
    blurb: "Settable countdown for case milestones.",
    icon: TimerReset,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  stopwatch: {
    label: "Stopwatch",
    blurb: "Count-up stopwatch for tracking elapsed time.",
    icon: Watch,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  carousel: {
    label: "Carousel",
    blurb: "Auto-cycling preference card images.",
    icon: Images,
    defaultSize: "medium",
    sizes: ["medium", "large"],
  },
  "prefcard-image": {
    label: "Preference Card Image",
    blurb: "Single preference card image.",
    icon: ImageIcon,
    defaultSize: "medium",
    sizes: ["small", "medium", "large"],
  },
  "prefcard-text": {
    label: "Preference Card",
    blurb: "Rendered preference card text.",
    icon: FileText,
    defaultSize: "large",
    sizes: ["medium", "large"],
  },
  arti: {
    label: "Arti",
    blurb: "Voice-activated Arti orb.",
    icon: Sparkles,
    defaultSize: "small",
    sizes: ["small", "medium", "large"],
  },
  pacs: {
    label: "PACS Imaging",
    blurb: "Reserved · Xray / MRI / CT viewer.",
    icon: ScanLine,
    defaultSize: "large",
    sizes: ["medium", "large"],
    reserved: true,
  },
  "procedure-planning": {
    label: "Procedure Planning",
    blurb: "Reserved · AirPlay from the OR tablet.",
    icon: AirplayIcon,
    defaultSize: "large",
    sizes: ["medium", "large"],
    reserved: true,
  },
};

// Palette order excludes reserved widgets — they're auto-placed.
export const WIDGET_ORDER: WidgetType[] = [
  "clock",
  "timer",
  "stopwatch",
  "arti",
  "carousel",
  "prefcard-image",
  "prefcard-text",
];

export const RESERVED_WIDGET_TYPES: WidgetType[] = ["pacs", "procedure-planning"];

export function gridSpan(size: WidgetSize): { col: number; row: number } {
  switch (size) {
    case "small":
      return { col: 1, row: 1 };
    case "medium":
      return { col: 2, row: 1 };
    case "large":
      return { col: 2, row: 2 };
  }
}

export type Phase = "preop" | "intraop" | "postop";
export const PHASES: Phase[] = ["preop", "intraop", "postop"];
export const PHASE_LABEL: Record<Phase, string> = {
  preop: "Pre-op",
  intraop: "Intra-op",
  postop: "Post-op",
};

export interface PhaseLayouts {
  preop: WidgetInstance[];
  intraop: WidgetInstance[];
  postop: WidgetInstance[];
}

export const EMPTY_LAYOUTS: PhaseLayouts = {
  preop: [],
  intraop: [],
  postop: [],
};

export interface Dashboard {
  id: string;
  name: string;
  /** Set when the dashboard is tied to a specific surgeon's procedure. */
  surgeonId?: string;
  procedureId?: string;
  /** True for free-standing templates that can later be applied to a procedure. */
  isTemplate: boolean;
  layouts: PhaseLayouts;
  createdAt: number;
  updatedAt: number;
  /** Templates can be published — marks them as finalized and previewable. */
  published?: boolean;
  publishedAt?: number;
}
