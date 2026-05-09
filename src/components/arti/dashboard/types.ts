import type { CaseItem } from "../cases";
import type { InstrumentId, TimeOutId } from "../AwakeDashboard";
import type { ActiveRole } from "../RoleSwitcherBar";
import type { LightboxImage } from "../ImageLightboxModal";
import type { PatientVideoSession } from "../PatientVideoModal";

/**
 * Identity of every widget the user can place on a dashboard. Source of
 * truth — when adding a new widget, extend this union AND register a
 * renderer + metadata in `registry.tsx`.
 */
export type WidgetId =
  // ── Home-overview widgets ─────────────────────────────────────────────
  | "home-hero"
  | "home-up-next"
  | "home-room-vitals"
  | "home-cases-per-day"
  | "home-procedure-mix"
  | "home-quick-actions"
  // ── Circulating-nurse pre-case readiness widgets (home) ──────────────
  | "supply-status"
  | "or-status"
  | "task-checklist"
  | "comms-feed"
  // ── Case-context widgets (preview-friendly on home, live in pre-op) ──
  | "preference-card"
  | "anatomy-3d"
  | "case-summary"
  // ── Pre-op only widgets (require live case state) ────────────────────
  | "time-out"
  | "instrument-counts"
  | "alerts"
  | "team-roster"
  | "scrub-panel"
  | "surgeon-panel"
  | "anesthesia-panel";

/** Where a widget is meaningful — drives palette filtering. */
export type DashboardSurface = "home" | "preop";

/** How wide a widget claims in the responsive 12-column grid. */
export type WidgetSpan = 1 | 2 | "full";

/**
 * Static metadata for one widget (does not include user-instance state
 * like span overrides — that's stored in DashboardConfig.items).
 */
export interface WidgetDef {
  id: WidgetId;
  title: string;
  /** One-line description used in the palette drawer. */
  blurb: string;
  /** Default span if a config doesn't specify one. */
  defaultSpan: WidgetSpan;
  /**
   * Surfaces (dashboards) where this widget is meaningful. Drives the
   * palette filter so e.g. "Time-Out" doesn't appear in the Home palette.
   */
  surfaces: DashboardSurface[];
  /** Optional natural-role hint, used for preop role-aware defaults. */
  naturalRoles?: ActiveRole[];
}

/**
 * One widget instance on a dashboard. The minimal shape needed to
 * render it — extend with per-instance config (size, style, voice
 * label) later if needed.
 */
export interface DashboardItem {
  id: WidgetId;
  /** Optional override for the widget's default span. */
  span?: WidgetSpan;
}

export interface DashboardConfig {
  items: DashboardItem[];
}

/**
 * Bag of state + handlers that every widget renderer needs. Built once
 * per render and passed down to each widget. Many fields are optional
 * because a Home-mounted dashboard doesn't have live case state — only
 * widgets that need them check.
 */
export interface WidgetContext {
  activeCase?: CaseItem;
  /** Display name of the logged-in user — used by the home greeting widget. */
  staffName: string;
  /** Free-form prompt entry — used by home widgets that emit voice prompts. */
  onPrompt: (text: string) => void;
  /** Time-out checklist (lifted to route, threaded through dashboard). Optional. */
  timeOutChecked?: Set<TimeOutId>;
  toggleTimeOutItem?: (id: TimeOutId) => void;
  /** Instrument counts. Optional. */
  counts?: Record<InstrumentId, number>;
  adjustInstrumentCount?: (id: InstrumentId, delta: number) => void;
  /** Alerts. Optional. */
  dismissedAlerts?: Set<number>;
  dismissAlert?: (index: number) => void;
  /** Scrub: opening checklist + machine-check parity. Optional. */
  openingChecklist?: Set<number>;
  toggleOpeningChecklistItem?: (index: number) => void;
  machineCheck?: Set<number>;
  toggleMachineCheckItem?: (index: number) => void;
  /** Per-case patient-video sessions, used by the Surgeon panel. */
  patientVideoSessions?: Record<string, PatientVideoSession>;
  /** Cross-cutting handlers wired by the parent dashboard. */
  onOpenLightbox?: (images: LightboxImage[], index?: number, title?: string) => void;
  onOpenPatientVideo?: () => void;
  onOpenXrays?: () => void;
}
