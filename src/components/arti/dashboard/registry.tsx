import { type ComponentType, type ReactElement } from "react";
import {
  Activity,
  AlertOctagon,
  BarChart3,
  Box,
  CalendarClock,
  ClipboardCheck,
  Hash,
  Home,
  Image as ImageIcon,
  PieChart,
  Sparkles,
  Stethoscope,
  Syringe,
  Thermometer,
  Users,
  UserCog,
  Wind,
} from "lucide-react";
import type { WidgetContext, WidgetDef, WidgetId } from "./types";
import type { InstrumentId } from "../AwakeDashboard";
import { TimeOutPanel } from "../TimeOutPanel";
import { InstrumentCount } from "../InstrumentCount";
import { AlertStack } from "../AlertStack";
import { TeamRoster } from "../TeamRoster";
import { PreferenceCard } from "../PreferenceCard";
import { ScrubTechPanel } from "../ScrubTechPanel";
import { SurgeonPanel } from "../SurgeonPanel";
import { AnesthesiaPanel } from "../AnesthesiaPanel";
import { AnatomyModel3D } from "../AnatomyModel3D";
import {
  HomeCasesPerDayWidget,
  HomeHeroWidget,
  HomeProcedureMixWidget,
  HomeQuickActionsWidget,
  HomeRoomVitalsWidget,
  HomeUpNextWidget,
} from "./homeWidgets";

// ─────────────────────────────────────────────────────────────────────────
// Metadata + icon — defines what the user sees in the palette drawer.
// ─────────────────────────────────────────────────────────────────────────

export const WIDGET_DEFS: Record<WidgetId, WidgetDef> = {
  // ── Home-overview widgets ─────────────────────────────────────────────
  "home-hero": {
    id: "home-hero",
    title: "Greeting & Day Stats",
    blurb: "Welcome strip with cases-today / completed / remaining counters.",
    defaultSpan: "full",
    surfaces: ["home"],
  },
  "home-up-next": {
    id: "home-up-next",
    title: "Up Next Case",
    blurb: "The next case on the board with time, side, readiness pips.",
    defaultSpan: 2,
    surfaces: ["home"],
  },
  "home-room-vitals": {
    id: "home-room-vitals",
    title: "Room Vitals",
    blurb: "OR 326 environment — temperature, humidity, exchanges, sterile field.",
    defaultSpan: 1,
    surfaces: ["home"],
  },
  "home-cases-per-day": {
    id: "home-cases-per-day",
    title: "Cases Per Day",
    blurb: "Bar chart of throughput over the trailing seven days.",
    defaultSpan: 2,
    surfaces: ["home"],
  },
  "home-procedure-mix": {
    id: "home-procedure-mix",
    title: "Procedure Mix",
    blurb: "Donut chart breaking today's case mix by procedure type.",
    defaultSpan: 1,
    surfaces: ["home"],
  },
  "home-quick-actions": {
    id: "home-quick-actions",
    title: "Quick Actions",
    blurb: "Three call-to-action cards — case list, next case, surgeon prefs.",
    defaultSpan: "full",
    surfaces: ["home"],
  },

  // ── Procedure-context widgets (work on Home + Pre-op) ────────────────
  "preference-card": {
    id: "preference-card",
    title: "Preference Card",
    blurb: "Surgeon's pref card — implants, supplies, layout images.",
    defaultSpan: "full",
    surfaces: ["home", "preop"],
    naturalRoles: ["nurse", "scrub", "surgeon"],
  },
  "anatomy-3d": {
    id: "anatomy-3d",
    title: "3D Anatomy",
    blurb: "Interactive shoulder model — drag to rotate, scroll to zoom.",
    defaultSpan: 1,
    surfaces: ["home", "preop"],
    naturalRoles: ["surgeon", "scrub"],
  },
  "case-summary": {
    id: "case-summary",
    title: "Case Summary",
    blurb: "Patient, MRN, procedure, surgeon, room, time at a glance.",
    defaultSpan: 1,
    surfaces: ["home", "preop"],
  },

  // ── Pre-op only widgets (need live case state) ───────────────────────
  "time-out": {
    id: "time-out",
    title: "Time-Out Checklist",
    blurb: "WHO Universal Protocol — patient, site, procedure, allergies.",
    defaultSpan: 2,
    surfaces: ["preop"],
    naturalRoles: ["nurse"],
  },
  "instrument-counts": {
    id: "instrument-counts",
    title: "Instrument Counts",
    blurb: "Live counts: raytec, lap, needle, blade, clamps.",
    defaultSpan: 2,
    surfaces: ["preop"],
    naturalRoles: ["nurse", "scrub"],
  },
  alerts: {
    id: "alerts",
    title: "Advisory Alerts",
    blurb: "Tier-tagged advisories with dismiss rules.",
    defaultSpan: 1,
    surfaces: ["preop"],
    naturalRoles: ["nurse"],
  },
  "team-roster": {
    id: "team-roster",
    title: "Team Roster",
    blurb: "Today's OR team with roles + initials.",
    defaultSpan: 1,
    surfaces: ["preop"],
    naturalRoles: ["nurse", "scrub"],
  },
  "scrub-panel": {
    id: "scrub-panel",
    title: "Scrub Tech Panel",
    blurb: "Big-numeral counts, table layout, opening checklist, implants.",
    defaultSpan: "full",
    surfaces: ["preop"],
    naturalRoles: ["scrub"],
  },
  "surgeon-panel": {
    id: "surgeon-panel",
    title: "Surgeon Panel",
    blurb: "Procedure steps, case summary, implant plan, pref-card images.",
    defaultSpan: "full",
    surfaces: ["preop"],
    naturalRoles: ["surgeon"],
  },
  "anesthesia-panel": {
    id: "anesthesia-panel",
    title: "Anesthesia Panel",
    blurb: "Allergies, plan, meds, airway, labs, machine check.",
    defaultSpan: "full",
    surfaces: ["preop"],
    naturalRoles: ["anesthesia"],
  },
};

export const WIDGET_ICON: Record<
  WidgetId,
  ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  "home-hero": Home,
  "home-up-next": CalendarClock,
  "home-room-vitals": Thermometer,
  "home-cases-per-day": BarChart3,
  "home-procedure-mix": PieChart,
  "home-quick-actions": Sparkles,
  "preference-card": ImageIcon,
  "anatomy-3d": Box,
  "case-summary": Syringe,
  "time-out": ClipboardCheck,
  "instrument-counts": Hash,
  alerts: AlertOctagon,
  "team-roster": Users,
  "scrub-panel": UserCog,
  "surgeon-panel": Stethoscope,
  "anesthesia-panel": Wind,
};
// Reference Activity so the unused-import lint is appeased — it was kept
// for parity with the existing icon palette and may be used by future
// widgets.
void Activity;

// ─────────────────────────────────────────────────────────────────────────
// Renderers — each returns the JSX for one widget given the live ctx.
// Wraps existing panels rather than duplicating their internals.
// ─────────────────────────────────────────────────────────────────────────

// Helpers for "always-supplied" pre-op handlers — Home defaults them to
// no-ops since those widgets don't appear on Home (filtered by surface).
const noop = () => undefined;

export const WIDGET_RENDERERS: Record<WidgetId, (ctx: WidgetContext) => ReactElement> = {
  "home-hero": (ctx) => <HomeHeroWidget ctx={ctx} staffName={ctx.staffName} />,
  "home-up-next": (ctx) => <HomeUpNextWidget ctx={ctx} />,
  "home-room-vitals": (ctx) => <HomeRoomVitalsWidget ctx={ctx} />,
  "home-cases-per-day": (ctx) => <HomeCasesPerDayWidget ctx={ctx} />,
  "home-procedure-mix": (ctx) => <HomeProcedureMixWidget ctx={ctx} />,
  "home-quick-actions": (ctx) => <HomeQuickActionsWidget ctx={ctx} />,
  "time-out": (ctx) => (
    <TimeOutPanel
      checked={(ctx.timeOutChecked ?? new Set()) as Set<string>}
      onToggle={(id) => ctx.toggleTimeOutItem?.(id as never)}
    />
  ),
  "instrument-counts": (ctx) => (
    <InstrumentCount
      counts={ctx.counts}
      onAdjust={(id, delta) => ctx.adjustInstrumentCount?.(id as InstrumentId, delta)}
    />
  ),
  alerts: (ctx) => (
    <AlertStack dismissed={ctx.dismissedAlerts} onDismiss={ctx.dismissAlert ?? noop} />
  ),
  "team-roster": () => <TeamRoster />,
  "preference-card": (ctx) => <PreferenceCard onOpenLightbox={ctx.onOpenLightbox} />,
  "scrub-panel": (ctx) => (
    <ScrubTechPanel
      activeCase={ctx.activeCase}
      counts={ctx.counts ?? { raytec: 0, lap: 0, needle: 0, blade: 0, clamps: 0 }}
      onAdjust={(id, delta) => ctx.adjustInstrumentCount?.(id as InstrumentId, delta)}
      onOpenLightbox={ctx.onOpenLightbox ?? noop}
      openingChecklist={ctx.openingChecklist ?? new Set()}
      onToggleChecklistItem={ctx.toggleOpeningChecklistItem ?? noop}
    />
  ),
  "surgeon-panel": (ctx) => (
    <SurgeonPanel
      activeCase={ctx.activeCase}
      onOpenLightbox={ctx.onOpenLightbox ?? noop}
      videoSession={
        ctx.activeCase && ctx.patientVideoSessions
          ? ctx.patientVideoSessions[ctx.activeCase.id]
          : undefined
      }
      onOpenPatientVideo={ctx.onOpenPatientVideo ?? noop}
      onOpenXrays={ctx.onOpenXrays ?? noop}
    />
  ),
  "anesthesia-panel": (ctx) => (
    <AnesthesiaPanel
      activeCase={ctx.activeCase}
      machineCheckDone={ctx.machineCheck}
      onToggleMachineCheck={ctx.toggleMachineCheckItem ?? noop}
    />
  ),
  "anatomy-3d": (ctx) => (
    <div className="aspect-[16/11] w-full rounded-2xl border border-border/60 bg-surface/40 p-3">
      <AnatomyModel3D
        caption={`${ctx.activeCase?.procedureShort ?? "RSA"} · ${
          ctx.activeCase?.side ? `${ctx.activeCase.side} shoulder` : "Right shoulder"
        }`}
      />
    </div>
  ),
  "case-summary": (ctx) => <CaseSummaryWidget ctx={ctx} />,
};

// Compact case-summary widget — used as a procedure-dashboard staple.
function CaseSummaryWidget({ ctx }: { ctx: WidgetContext }) {
  const c = ctx.activeCase;
  const rows: Array<[string, string]> = [
    ["Patient", `${c?.patientName ?? "—"} · ${c?.patientAgeSex ?? ""}`],
    ["MRN", c?.patientMrn ?? "—"],
    ["Procedure", `${c?.procedureShort ?? "—"}${c?.side ? ` · ${c.side}` : ""}`],
    ["Surgeon", c?.surgeon ?? "—"],
    ["Room · Time", `${c?.room ?? "—"} · ${c?.time ?? "—"}`],
  ];
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
        <Syringe className="h-3 w-3" /> Case Summary
      </div>
      <div className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</span>
            <span className="font-light text-foreground/85">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const ALL_WIDGET_IDS: WidgetId[] = Object.keys(WIDGET_DEFS) as WidgetId[];
