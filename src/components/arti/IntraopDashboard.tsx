import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Box,
  Camera,
  Circle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Droplet,
  Flame,
  Gauge,
  Grid2x2,
  Heart,
  Image as ImageIcon,
  Layers,
  Mic,
  Package,
  Pill,
  Radio,
  ScanLine,
  Scissors,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Thermometer,
  TestTube,
  Truck,
  UserCog,
  Wind,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import { PATIENT_CLINICAL, type CaseItem } from "./cases";
import { AnatomyModel3D } from "./AnatomyModel3D";
import {
  driftVitals,
  findPhase,
  formatElapsed,
  getIntraopSnapshot,
  initialVitals,
  neighborPhase,
  phaseIndex,
  phaseLabel,
  type ActivityEvent,
  type AiPrompt,
  type AiPromptTone,
  type ImplantStatus,
  type IntraopPhaseId,
  type IntraopSnapshot,
  type SpecimenStatus,
  type VitalSnapshot,
} from "./intraop";
import type { ArtiToolResult } from "@/hooks/useArtiVoice";

type IntraopRole = "nurse" | "scrub" | "surgeon" | "anesthesia";

/**
 * Live mutators the route can drive via voice while the intraop screen
 * is mounted. Mirrors the DashboardActions ref bridge used by the pre-op
 * screen — IntraopDashboard writes the current actions object on mount
 * and clears it on unmount.
 */
export interface IntraopActions {
  focusRole: (role: IntraopRole) => ArtiToolResult;
  setPhase: (phase: IntraopPhaseId) => ArtiToolResult;
  advancePhase: (direction: "next" | "previous") => ArtiToolResult;
  showImaging: (
    modality: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side",
  ) => ArtiToolResult;
  showPanel: (
    panel: "implants" | "supplies" | "antibiotic" | "vitals" | "activity" | "phase",
  ) => ArtiToolResult;
  /** Returns a plain-text snapshot of live state for Claude's context window. */
  getLiveContext: () => string;
}

export type IntraopActionsRef = React.MutableRefObject<IntraopActions | null>;

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onLogout: () => void;
  activeCase?: CaseItem;
  onEndCase: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Switch into the 4-quadrant multi-view wall layout. */
  onShowMultiView?: () => void;
  /** Route-owned ref bridge — IntraopDashboard registers actions on mount. */
  actionsRef?: IntraopActionsRef;
}

const ROLE_DEFS: Array<{
  id: IntraopRole;
  label: string;
  icon: typeof Activity;
  toneText: string;
  toneBorder: string;
  toneBg: string;
}> = [
  {
    id: "nurse",
    label: "Circulating Nurse",
    icon: Activity,
    toneText: "text-primary",
    toneBorder: "border-primary/50",
    toneBg: "bg-primary/10",
  },
  {
    id: "scrub",
    label: "Scrub Tech",
    icon: UserCog,
    toneText: "text-success",
    toneBorder: "border-success/50",
    toneBg: "bg-success/10",
  },
  {
    id: "surgeon",
    label: "Surgeon",
    icon: Stethoscope,
    toneText: "text-accent",
    toneBorder: "border-accent/50",
    toneBg: "bg-accent/10",
  },
  {
    id: "anesthesia",
    label: "Anesthesia",
    icon: Wind,
    toneText: "text-warning",
    toneBorder: "border-warning/50",
    toneBg: "bg-warning/10",
  },
];

const SUGGESTIONS_BY_ROLE: Record<IntraopRole, string[]> = {
  nurse: ["What phase are we in?", "Show implants", "Antibiotic redose status", "Open quad view"],
  scrub: ["Show requested tools", "Open back table", "Mark anchor scanned"],
  surgeon: ["Show fluoroscopy", "Open preference card", "Advance to verification"],
  anesthesia: ["Show vitals trend", "Time since last antibiotic", "Open allergies"],
};

export function IntraopDashboard({
  staffName,
  staffRole,
  initials,
  onSleep,
  onLogout,
  activeCase,
  onEndCase,
  onPrompt,
  onSidebarNavigate,
  onShowMultiView,
  actionsRef,
}: Props) {
  const snapshot = useMemo(() => getIntraopSnapshot(activeCase?.id), [activeCase?.id]);
  const [activeRole, setActiveRole] = useState<IntraopRole>("nurse");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [vitals, setVitals] = useState<VitalSnapshot>(() => initialVitals());
  const [currentPhase, setCurrentPhase] = useState<IntraopPhaseId>(snapshot.currentPhase);
  /**
   * When voice/chat asks for a specific imaging modality or panel, we
   * stash the request here so the matching tile can render a brief
   * "spotlight" frame. Auto-clears after 4s so the screen returns to
   * its calm default.
   */
  const [imagingFocus, setImagingFocus] = useState<
    "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side" | null
  >(null);
  const [panelFocus, setPanelFocus] = useState<
    "implants" | "supplies" | "antibiotic" | "vitals" | "activity" | "phase" | null
  >(null);

  // Reset elapsed timer + vitals + phase when the active case changes.
  useEffect(() => {
    setElapsedSec(0);
    setVitals(initialVitals());
    setCurrentPhase(snapshot.currentPhase);
    setActiveRole("nurse");
  }, [snapshot.currentPhase, activeCase?.id]);

  // Tick elapsed seconds.
  useEffect(() => {
    const i = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(i);
  }, []);

  // Drift vitals every ~2.5s for ambient realism.
  useEffect(() => {
    const i = window.setInterval(() => setVitals((v) => driftVitals(v)), 2500);
    return () => window.clearInterval(i);
  }, []);

  // Auto-clear focus highlights so the wall settles back to its calm default.
  useEffect(() => {
    if (!imagingFocus) return;
    const t = window.setTimeout(() => setImagingFocus(null), 4000);
    return () => window.clearTimeout(t);
  }, [imagingFocus]);
  useEffect(() => {
    if (!panelFocus) return;
    const t = window.setTimeout(() => setPanelFocus(null), 4000);
    return () => window.clearTimeout(t);
  }, [panelFocus]);

  const procedureLabel = activeCase?.procedure ?? "Reverse Total Shoulder Arthroplasty";
  const procedureShort = activeCase?.procedureShort ?? "RSA";
  const surgeon = activeCase?.surgeon ?? "Dr. Anika Patel";
  const patient = activeCase
    ? `${activeCase.patientName} · ${activeCase.patientAgeSex}${activeCase.side ? ` · ${activeCase.side} shoulder` : ""}`
    : "Marcus Chen · 62M · Right shoulder";
  const room = activeCase?.room ?? "OR 326";

  const elapsedMin = Math.floor(elapsedSec / 60);
  const progressPct = Math.min(
    100,
    Math.max(2, Math.round((elapsedMin / snapshot.estimatedMinutes) * 100)),
  );

  // ── Voice / chat actions ─────────────────────────────────────────────
  const focusRole = useCallback((role: IntraopRole): ArtiToolResult => {
    setActiveRole(role);
    return { ok: true };
  }, []);

  const setPhase = useCallback(
    (phase: IntraopPhaseId): ArtiToolResult => {
      // Voice may pass a free-text label ("anchor placement" / "anchors").
      // Fall back to fuzzy matching when the exact id isn't found.
      const direct = phaseIndex(phase, snapshot.phases) >= 0 ? phase : undefined;
      const matched = direct ?? findPhase(phase, snapshot.phases)?.id;
      if (!matched) return { ok: false, reason: "unknown phase" };
      setCurrentPhase(matched);
      return { ok: true };
    },
    [snapshot.phases],
  );

  const advancePhase = useCallback(
    (direction: "next" | "previous"): ArtiToolResult => {
      setCurrentPhase((p) => neighborPhase(p, direction, snapshot.phases));
      return { ok: true };
    },
    [snapshot.phases],
  );

  const showImaging = useCallback(
    (modality: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side"): ArtiToolResult => {
      setImagingFocus(modality);
      return { ok: true };
    },
    [],
  );

  const showPanel = useCallback(
    (
      panel: "implants" | "supplies" | "antibiotic" | "vitals" | "activity" | "phase",
    ): ArtiToolResult => {
      // Most panels live on the nurse view — switching focus there makes
      // them visible without the user having to also say "switch to nurse".
      if (panel === "implants" || panel === "supplies" || panel === "antibiotic") {
        setActiveRole("nurse");
      } else if (panel === "vitals") {
        setActiveRole("anesthesia");
      }
      setPanelFocus(panel);
      return { ok: true };
    },
    [],
  );

  // Register the actions object so the route can dispatch voice tools to us.
  useEffect(() => {
    if (!actionsRef) return;
    const actions: IntraopActions = {
      focusRole,
      setPhase,
      advancePhase,
      showImaging,
      showPanel,
      getLiveContext: () => {
        const idx = phaseIndex(currentPhase, snapshot.phases);
        const phase = snapshot.phases[idx];
        const step = phase?.step ?? phase?.detail ?? "";
        const nextPhase = snapshot.phases[idx + 1];
        const trayList = (p?: { trays?: string[] }) =>
          p?.trays?.length ? p.trays.join(", ") : "none specified";
        const lines = [
          `Intraop dashboard: case ACTIVE`,
          `  Active role focus: ${activeRole}`,
          `  Current phase: ${phaseLabel(currentPhase, snapshot.phases)} (step ${idx + 1} of ${snapshot.phases.length})`,
          `  Step detail: ${step}`,
          `  Trays for current phase: ${trayList(phase)}`,
          nextPhase
            ? `  Next phase: ${nextPhase.label} — trays: ${trayList(nextPhase)}`
            : `  Next phase: none (this is the final phase)`,
          `  Elapsed: ${formatElapsed(elapsedSec)} of ~${snapshot.estimatedMinutes} min planned`,
          `  Vitals: HR ${vitals.hr} · BP ${vitals.bp.sys}/${vitals.bp.dia} · SpO2 ${vitals.spo2}% · EtCO2 ${vitals.etco2} · Temp ${vitals.tempC}°C`,
          `  Antibiotic: ${snapshot.antibiotic.agent} · last ${snapshot.antibiotic.lastDose} · next due in ${snapshot.antibiotic.dueInMinutes} min`,
          `  Implants: ${snapshot.implants.length === 0 ? "none planned" : snapshot.implants.map((i) => `${i.component} (${i.status})`).join(", ")}`,
          `  Open supply asks: ${snapshot.supplies.length === 0 ? "none" : snapshot.supplies.map((s) => `${s.item} [${s.status}]`).join("; ")}`,
        ];
        return lines.join("\n");
      },
    };
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [
    actionsRef,
    activeRole,
    currentPhase,
    elapsedSec,
    snapshot,
    vitals,
    focusRole,
    setPhase,
    advancePhase,
    showImaging,
    showPanel,
  ]);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {/* Cinematic ambient glow specific to "case active" — a slow blue
          radial bloom to make the room feel calm and engaged at the same
          time. Pointer-events-none so it never blocks UI. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 25% 0%, color-mix(in oklab, var(--primary) 18%, transparent) 0%, transparent 55%), radial-gradient(ellipse at 80% 100%, color-mix(in oklab, var(--accent) 12%, transparent) 0%, transparent 55%)",
        }}
      />

      <Sidebar
        onSleep={onSleep}
        onLogout={onLogout}
        activeKey="case"
        onNavigate={onSidebarNavigate}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar staffName={staffName} staffRole={staffRole} initials={initials} onSleep={onSleep} />

        <main data-scroll className="min-h-0 flex-1 overflow-y-auto px-8 py-6 animate-fade-in">
          <div className="flex flex-col gap-5 pb-32">
            {/* Back row — Back to pre-op on the left, Multi-view toggle far right. */}
            <div className="-mb-2 flex items-center justify-between gap-3">
              <button
                onClick={onEndCase}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Back to pre-op
              </button>
              {onShowMultiView && (
                <button
                  type="button"
                  onClick={onShowMultiView}
                  title="Show all four roles at once on the wall"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/40 hover:bg-surface-2/80 hover:text-foreground"
                >
                  <Grid2x2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Multi-view
                </button>
              )}
            </div>

            {/* ── Live case header ── */}
            <header className="glass relative overflow-hidden rounded-2xl p-7">
              {/* live dot + scan line */}
              <span className="absolute inset-x-0 top-0 h-px overflow-hidden" aria-hidden>
                <span
                  className="block h-full w-1/3 scan-line"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 80%, transparent), transparent)",
                  }}
                />
              </span>

              <div className="relative flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-success">
                      <Circle className="h-2 w-2 fill-success heartbeat" strokeWidth={0} />
                      Case Active
                    </span>
                    <span className="rounded-full border border-border bg-surface-3/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {room}
                    </span>
                    <span className="rounded-full border border-border bg-surface-3/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      Recording
                    </span>
                  </div>

                  <h1 className="mt-2 truncate text-4xl font-extralight tracking-tight">
                    {procedureLabel}
                    <span className="text-muted-foreground/60"> · {procedureShort}</span>
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-light text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary heartbeat" />
                      {patient}
                    </span>
                    <span>{surgeon} · Lead surgeon</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    Elapsed
                  </div>
                  <div className="mt-1 flex items-baseline justify-end gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="font-mono text-5xl font-thin tabular-nums tracking-tight text-foreground">
                      {formatElapsed(elapsedSec)}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    of ~{snapshot.estimatedMinutes} min planned
                  </div>
                </div>
              </div>

              {/* Thin progress bar — case completion estimate */}
              <div className="relative mt-5 h-[3px] w-full overflow-hidden rounded-full bg-surface-3/60">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-accent to-primary"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </header>

            {/* ── Phase timeline (controllable via voice + click) ── */}
            <PhaseTimeline
              currentPhase={currentPhase}
              phases={snapshot.phases}
              currentStep={
                snapshot.phases.find((p) => p.id === currentPhase)?.step ??
                snapshot.phases.find((p) => p.id === currentPhase)?.detail ??
                ""
              }
              onSetPhase={(p) => setCurrentPhase(p)}
              onPrev={() => setCurrentPhase((p) => neighborPhase(p, "previous", snapshot.phases))}
              onNext={() => setCurrentPhase((p) => neighborPhase(p, "next", snapshot.phases))}
              highlight={panelFocus === "phase"}
            />

            {/* ── Vitals strip (always visible — calm anesthesia awareness) ── */}
            <VitalsStrip vitals={vitals} highlight={panelFocus === "vitals"} />

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {/* Left + center (2 cols) — imaging then role focus tabs +
                  role-specific support panel. The tabs sit directly above
                  the panel they switch so the relationship is obvious. */}
              <div className="space-y-5 xl:col-span-2">
                <ImagingTile
                  snapshot={snapshot}
                  currentPhase={currentPhase}
                  imagingFocus={imagingFocus}
                />
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-surface/30 px-4 py-3">
                  <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">
                    Role focus
                  </span>
                  {ROLE_DEFS.map((r) => {
                    const active = activeRole === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setActiveRole(r.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-light transition-all duration-200",
                          active
                            ? cn(r.toneBorder, r.toneBg, r.toneText)
                            : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        <r.icon
                          className={cn("h-3.5 w-3.5", !active && "text-muted-foreground/50")}
                          strokeWidth={1.8}
                        />
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <RolePanel
                  role={activeRole}
                  snapshot={snapshot}
                  currentPhase={currentPhase}
                  panelFocus={panelFocus}
                  activeCase={activeCase}
                  onShowImaging={(m) => {
                    showImaging(m);
                  }}
                  imagingFocus={imagingFocus}
                />
              </div>

              {/* Right column — alerts + activity + AI */}
              <div className="space-y-5">
                <AiPromptsCard
                  prompts={snapshot.phases.find((p) => p.id === currentPhase)?.aiPrompts ?? []}
                />
                <ActivityStream events={snapshot.activity} highlight={panelFocus === "activity"} />
              </div>
            </div>
          </div>
        </main>

        <ArtiInvoker
          placeholder="Ask Arti — case is active…"
          onSubmit={onPrompt}
          suggestions={SUGGESTIONS_BY_ROLE[activeRole]}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Phase timeline
// ─────────────────────────────────────────────────────────────────────────

function PhaseTimeline({
  phases,
  currentPhase,
  currentStep,
  onSetPhase,
  onPrev,
  onNext,
  highlight,
}: {
  phases: import("./intraop").IntraopPhase[];
  currentPhase: IntraopPhaseId;
  currentStep: string;
  onSetPhase: (p: IntraopPhaseId) => void;
  onPrev: () => void;
  onNext: () => void;
  highlight?: boolean;
}) {
  const currentIdx = phaseIndex(currentPhase, phases);
  const atStart = currentIdx <= 0;
  const atEnd = currentIdx >= phases.length - 1;

  return (
    <section
      className={cn(
        "glass rounded-2xl p-6 transition-shadow duration-500",
        highlight && "ring-1 ring-primary/40 shadow-[0_0_40px_-10px_var(--primary)]",
      )}
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Surgical phase
          </div>
          <h2 className="mt-1 text-lg font-light">
            {phases[currentIdx]?.label ?? "Active"}
            <span className="ml-2 text-sm text-muted-foreground">
              · step {currentIdx + 1} of {phases.length}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={atStart}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
              atStart
                ? "border-border/30 text-muted-foreground/40"
                : "border-border bg-surface-2/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={atEnd}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
              atEnd
                ? "border-border/30 text-muted-foreground/40"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
            )}
          >
            Next phase <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Pill row — each pill is clickable to jump to that phase. */}
      <div className="flex w-full gap-2">
        {phases.map((p, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSetPhase(p.id)}
              className="group flex flex-col items-stretch text-left"
              style={{ flex: p.weight }}
              title={`Jump to ${p.label}`}
            >
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  done && "bg-primary/70",
                  active && "bg-gradient-to-r from-primary via-accent to-primary",
                  !done && !active && "bg-surface-3/70 group-hover:bg-surface-3",
                )}
              />
              <div
                className={cn(
                  "mt-2 truncate text-center text-[11px] font-light tracking-wide transition-colors",
                  active && "text-foreground",
                  done && "text-muted-foreground",
                  !done && !active && "text-muted-foreground/50 group-hover:text-foreground/80",
                )}
              >
                <span className={cn("inline-flex items-center gap-1.5", active && "text-primary")}>
                  {done && <CheckCircle2 className="h-3 w-3" strokeWidth={2} />}
                  {active && <Radio className="h-3 w-3 heartbeat" strokeWidth={2} />}
                  {p.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-border/50 bg-surface-2/40 p-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Current step
        </div>
        <p className="mt-1 text-sm font-light text-foreground/90">{currentStep}</p>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Voice: <span className="text-foreground/80">"next phase"</span>
          {" · "}
          <span className="text-foreground/80">"jump to closure"</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Vitals strip
// ─────────────────────────────────────────────────────────────────────────

function VitalsStrip({ vitals, highlight }: { vitals: VitalSnapshot; highlight?: boolean }) {
  return (
    <section
      className={cn(
        "glass rounded-2xl p-5 transition-shadow duration-500",
        highlight && "ring-1 ring-warning/40 shadow-[0_0_40px_-10px_var(--warning)]",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning">
            Patient
          </span>
          <span className="text-sm font-light text-foreground/80">
            Stable · Anesthesia monitoring
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Live · streaming
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Vital
          icon={Heart}
          label="Heart rate"
          value={String(vitals.hr)}
          unit="bpm"
          tone="text-primary"
          pulse
        />
        <Vital
          icon={Activity}
          label="Blood pressure"
          value={`${vitals.bp.sys}/${vitals.bp.dia}`}
          unit="mmHg"
          tone="text-foreground"
          subValue={`MAP ${vitals.map}`}
        />
        <Vital icon={Wind} label="SpO₂" value={String(vitals.spo2)} unit="%" tone="text-success" />
        <Vital
          icon={Zap}
          label="EtCO₂"
          value={String(vitals.etco2)}
          unit="mmHg"
          tone="text-accent"
        />
        <Vital
          icon={Thermometer}
          label="Temperature"
          value={vitals.tempC.toFixed(1)}
          unit="°C"
          tone="text-foreground"
        />
      </div>
    </section>
  );
}

function Vital({
  icon: Icon,
  label,
  value,
  unit,
  tone,
  pulse,
  subValue,
}: {
  icon: typeof Heart;
  label: string;
  value: string;
  unit: string;
  tone: string;
  pulse?: boolean;
  subValue?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-2/30 px-4 py-3">
      <Icon className={cn("h-5 w-5 shrink-0", tone, pulse && "heartbeat")} strokeWidth={1.6} />
      <div className="min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className={cn("font-mono text-2xl font-thin tabular-nums tracking-tight", tone)}>
            {value}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {unit}
          </span>
        </div>
        {subValue && (
          <div className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Imaging tile
// ─────────────────────────────────────────────────────────────────────────

function ImagingTile({
  snapshot,
  currentPhase,
  imagingFocus,
}: {
  snapshot: IntraopSnapshot;
  currentPhase: IntraopPhaseId;
  imagingFocus: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side" | null;
}) {
  const caption = snapshot.phases.find((p) => p.id === currentPhase)?.imagingCaption ?? "";
  const focusBorder =
    imagingFocus === "fluoroscopy"
      ? "ring-2 ring-accent/60"
      : imagingFocus === "mri"
        ? "ring-2 ring-primary/60"
        : imagingFocus === "ct"
          ? "ring-2 ring-warning/60"
          : imagingFocus === "side_by_side"
            ? "ring-2 ring-success/60"
            : imagingFocus === "arthroscopy"
              ? "ring-2 ring-success/60"
              : "";
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-black transition-shadow duration-500",
        focusBorder,
      )}
    >
      {/* Looping arthroscopy feed — same asset as MultiViewScreen's
          surgeon tile so both screens read as the same camera. Public
          folder, autoplay + loop + muted so it's safe to render
          anywhere without a gesture. */}
      <video
        src="/scopeFeed.mp4"
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden
      />
      {/* Subtle vignette so the DICOM-style overlays read clearly over
          the brighter parts of the feed. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <div className="relative grid aspect-[16/9] grid-cols-3">
        {/* Main feed */}
        <div className="col-span-2 flex flex-col justify-between p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 rounded-full border border-success/40 bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-success backdrop-blur">
              <Circle className="h-2 w-2 fill-success heartbeat" strokeWidth={0} />
              {snapshot.arthroscopyLive ? "Arthroscopy · Live" : "Arthroscopy"}
            </div>
            <div className="rounded-full border border-border/50 bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
              30° scope · 4K
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
              {caption}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="text-foreground/70">"show fluoroscopy"</span> ·{" "}
              <span className="text-foreground/70">"open MRI"</span> ·{" "}
              <span className="text-foreground/70">"show CT"</span> ·{" "}
              <span className="text-foreground/70">"side by side"</span>
            </div>
          </div>
        </div>

        {/* Side rail — fluoroscopy + CT thumbnails */}
        <div className="relative flex flex-col gap-2 border-l border-border/30 bg-black/35 p-4 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Fluoroscopy · stored
          </div>
          {[
            {
              label: "AP — 5 min ago",
              src: "https://placehold.co/600x600/0a0a0a/6b7280?text=AP&font=mono",
            },
            {
              label: "Axial — 11 min ago",
              src: "https://placehold.co/600x600/0a0a0a/6b7280?text=AX&font=mono",
            },
            {
              label: "Lateral — 14 min ago",
              src: "https://placehold.co/600x600/0a0a0a/6b7280?text=LAT&font=mono",
            },
          ].map((t) => (
            <div
              key={t.label}
              className="overflow-hidden rounded-lg border border-border/50 bg-black"
            >
              <img src={t.src} alt={t.label} className="h-20 w-full object-cover opacity-90" />
              <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {t.label}
              </div>
            </div>
          ))}

          {/* CT — pre-op imaging on file. Voice "show CT" swaps the surgeon
              tile to the full study; this thumb makes it discoverable. */}
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            CT · pre-op
          </div>
          <div
            className={cn(
              "overflow-hidden rounded-lg border bg-black transition-shadow",
              imagingFocus === "ct"
                ? "border-warning/60 shadow-[0_0_20px_-4px_var(--warning)]"
                : "border-border/50",
            )}
          >
            <img
              src="/ctscans.jpeg"
              alt="Pre-op CT — axial and coronal slices"
              className="h-20 w-full object-cover opacity-90"
            />
            <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Axial + Coronal
            </div>
          </div>

          <div className="mt-auto inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            <ImageIcon className="h-3 w-3" /> Side-by-side: voice
          </div>
        </div>
      </div>

      {/* Footer voice hint */}
      <div className="flex items-center justify-between border-t border-border/40 bg-black/40 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <Camera className="h-3.5 w-3.5" /> 4K · H.265 · case-bound
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <Mic className="h-3.5 w-3.5 text-primary" />{" "}
          <span className="text-foreground/80">"Arti, show fluoroscopy"</span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Role panel — all four roles share the same component so we can keep
// the intraop visual language tight and consistent.
// ─────────────────────────────────────────────────────────────────────────

function RolePanel({
  role,
  snapshot,
  currentPhase,
  panelFocus,
  activeCase,
  onShowImaging,
  imagingFocus,
}: {
  role: IntraopRole;
  snapshot: IntraopSnapshot;
  currentPhase: IntraopPhaseId;
  panelFocus: "implants" | "supplies" | "antibiotic" | "vitals" | "activity" | "phase" | null;
  activeCase?: CaseItem;
  onShowImaging: (modality: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side") => void;
  imagingFocus: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side" | null;
}) {
  if (role === "nurse") return <NursePanel snapshot={snapshot} panelFocus={panelFocus} />;
  if (role === "scrub") return <ScrubPanel snapshot={snapshot} />;
  if (role === "surgeon")
    return (
      <SurgeonPanel
        snapshot={snapshot}
        currentPhase={currentPhase}
        activeCase={activeCase}
        onShowImaging={onShowImaging}
        imagingFocus={imagingFocus}
      />
    );
  return <AnesthesiaPanel snapshot={snapshot} activeCase={activeCase} />;
}

function PanelShell({
  title,
  kicker,
  icon: Icon,
  iconTone = "text-primary",
  children,
  trailing,
  className,
}: {
  title: string;
  kicker: string;
  icon: typeof Activity;
  iconTone?: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass rounded-2xl p-6 transition-shadow duration-500", className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-surface-2/60",
              iconTone,
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div>
            <div className={cn("font-mono text-[10px] uppercase tracking-[0.3em]", iconTone)}>
              {kicker}
            </div>
            <h2 className="mt-0.5 text-lg font-light">{title}</h2>
          </div>
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

// Nurse view: implants + supplies + antibiotic timing + documentation
function NursePanel({
  snapshot,
  panelFocus,
}: {
  snapshot: IntraopSnapshot;
  panelFocus: "implants" | "supplies" | "antibiotic" | "vitals" | "activity" | "phase" | null;
}) {
  const ringFor = (id: typeof panelFocus) =>
    panelFocus === id ? "ring-1 ring-primary/40 shadow-[0_0_30px_-10px_var(--primary)]" : "";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <PanelShell
        title="Implant tracking"
        kicker="Circulating · Implants"
        icon={Package}
        className={ringFor("implants")}
      >
        <ul className="space-y-2">
          {snapshot.implants.length === 0 && (
            <li className="rounded-lg border border-dashed border-border p-4 text-center text-xs font-light text-muted-foreground">
              No implants planned for this case.
            </li>
          )}
          {snapshot.implants.map((imp, i) => (
            <li
              key={`${imp.component}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-2/40 p-3"
            >
              <ImplantStatusDot status={imp.status} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground/90">{imp.component}</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {imp.spec}
                  {imp.lot ? ` · lot ${imp.lot}` : ""}
                </div>
              </div>
              <ImplantStatusBadge status={imp.status} />
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell
        title="Antibiotic redose"
        kicker="Med timing"
        icon={Pill}
        iconTone="text-warning"
        className={ringFor("antibiotic")}
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning">
              {snapshot.antibiotic.agent}
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-thin tabular-nums text-warning">
                {snapshot.antibiotic.dueInMinutes <= 0
                  ? "Due"
                  : `${snapshot.antibiotic.dueInMinutes}m`}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                until next dose
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Last dose: {snapshot.antibiotic.lastDose}
            </div>
          </div>
        </div>
      </PanelShell>

      <PanelShell
        title="Supply requests"
        kicker="From the field"
        icon={Truck}
        iconTone="text-accent"
        className={ringFor("supplies")}
      >
        {snapshot.supplies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-light text-muted-foreground">
            No open supply requests.
          </div>
        ) : (
          <ul className="space-y-2">
            {snapshot.supplies.map((s, i) => (
              <li
                key={`${s.item}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-2/40 p-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Truck className="h-4 w-4" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-light text-foreground/90">{s.item}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.requestedBy} · {s.minutesAgo}m ago
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    s.status === "delivered"
                      ? "bg-success/15 text-success"
                      : s.status === "in-route"
                        ? "bg-primary/15 text-primary"
                        : "bg-warning/15 text-warning",
                  )}
                >
                  {s.status === "in-route" ? "in route" : s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>

      <PanelShell
        title="Specimen log"
        kicker="Pathology hand-off"
        icon={TestTube}
        iconTone="text-accent"
      >
        {snapshot.specimens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-light text-muted-foreground">
            No specimens collected.
          </div>
        ) : (
          <ul className="space-y-2">
            {snapshot.specimens.map((s, i) => (
              <li
                key={`${s.source}-${i}`}
                className="rounded-xl border border-border/50 bg-surface-2/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      s.container === "formalin"
                        ? "bg-accent/15 text-accent"
                        : s.container === "fresh"
                          ? "bg-warning/15 text-warning"
                          : "bg-primary/15 text-primary",
                    )}
                  >
                    <TestTube className="h-4 w-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground/90">{s.source}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.container} · {s.destination ? `${s.destination} · ` : ""}
                      collected {s.collectedAt}
                    </div>
                  </div>
                  <SpecimenStatusBadge status={s.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>

      <PanelShell
        title="Patient status"
        kicker="Temp · position · output"
        icon={Thermometer}
        iconTone="text-warning"
      >
        <div className="space-y-3 text-sm font-light">
          {/* Warming */}
          <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-warning" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-warning">
                  Warming
                </span>
              </div>
              <span className="font-mono text-base tabular-nums text-foreground">
                {snapshot.warming.coreTempC.toFixed(1)}°C
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              target ≥ {snapshot.warming.targetMinC.toFixed(1)}°C · {snapshot.warming.trend}
            </div>
            <div className="mt-1 text-[12px] text-foreground/75">
              {snapshot.warming.devices.join(" · ")}
            </div>
          </div>

          {/* Positioning */}
          <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                Positioning
              </span>
            </div>
            <div className="mt-1 text-foreground/90">{snapshot.positioning.name}</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {snapshot.positioning.padding}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Last pressure check: {snapshot.positioning.lastCheckAt}
            </div>
          </div>

          {/* I&O quick view */}
          <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
            <div className="flex items-center gap-2">
              <Droplet className="h-3.5 w-3.5 text-accent" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                I &amp; O
              </span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-3 text-[12px]">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Urine
                </div>
                <div className="tabular-nums text-foreground/90">
                  {sumVolumes(snapshot.fluids.outs.filter((o) => /urine|foley/i.test(o.label)))} mL
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {snapshot.fluids.uopRate}
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  EBL
                </div>
                <div className="tabular-nums text-foreground/90">{snapshot.fluids.ebl} mL</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  IV in
                </div>
                <div className="tabular-nums text-foreground/90">
                  {sumVolumes(snapshot.fluids.ins.filter((i) => !/irrig/i.test(i.label)))} mL
                </div>
              </div>
            </div>
          </div>
        </div>
      </PanelShell>
    </div>
  );
}

function SpecimenStatusBadge({ status }: { status: SpecimenStatus }) {
  const tone =
    status === "received"
      ? "bg-success/15 text-success"
      : status === "to_pathology"
        ? "bg-primary/15 text-primary"
        : status === "labeled"
          ? "bg-accent/15 text-accent"
          : "bg-warning/15 text-warning";
  const label = status === "to_pathology" ? "to path" : status === "labeling" ? "labeling" : status;
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider", tone)}
    >
      {label}
    </span>
  );
}

function sumVolumes(items: { volumeMl: number }[]): number {
  return items.reduce((acc, i) => acc + i.volumeMl, 0);
}

function ImplantStatusDot({ status }: { status: ImplantStatus }) {
  const t =
    status === "verified"
      ? "bg-success"
      : status === "scanned"
        ? "bg-primary"
        : status === "staged"
          ? "bg-accent"
          : "bg-muted-foreground/40";
  return (
    <span
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", t, status !== "pending" && "heartbeat")}
    />
  );
}

function ImplantStatusBadge({ status }: { status: ImplantStatus }) {
  const tone =
    status === "verified"
      ? "bg-success/15 text-success"
      : status === "scanned"
        ? "bg-primary/15 text-primary"
        : status === "staged"
          ? "bg-accent/15 text-accent"
          : "bg-surface-3 text-muted-foreground";
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider", tone)}
    >
      {status}
    </span>
  );
}

// Scrub: instrument readiness + tools queue + sterile field awareness
function ScrubPanel({ snapshot }: { snapshot: IntraopSnapshot }) {
  const queue = [
    { tool: "Glenosphere impactor", note: "On Mayo · ready", ready: true },
    { tool: "Humeral broaches 7–11", note: "Staged in sequence", ready: true },
    { tool: "Trial poly inserts", note: "+0 / +3 / +6 mm", ready: true },
    { tool: "Final poly +3 mm", note: "Awaiting verification", ready: false },
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <PanelShell
        title="Sterile field"
        kicker="Cockpit · scrub"
        icon={Sparkles}
        iconTone="text-success"
      >
        <div className="grid grid-cols-2 gap-3 text-sm font-light">
          {[
            { label: "Field integrity", value: "Clean", tone: "text-success" },
            { label: "Time since gown change", value: "1h 24m", tone: "text-foreground" },
            { label: "Counts status", value: "Opening verified", tone: "text-success" },
            { label: "Closing count", value: "Pending", tone: "text-warning" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                {s.label}
              </div>
              <div className={cn("mt-1 text-base", s.tone)}>{s.value}</div>
            </div>
          ))}
        </div>
      </PanelShell>

      <PanelShell title="Implant trays" kicker="Staged" icon={Package} iconTone="text-accent">
        <ul className="space-y-2">
          {snapshot.implants.slice(0, 4).map((imp, i) => (
            <li
              key={`${imp.component}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface-2/40 p-3"
            >
              <ImplantStatusDot status={imp.status} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground/90">{imp.component}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {imp.spec}
                </div>
              </div>
              <ImplantStatusBadge status={imp.status} />
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell
        title="Requested tools"
        kicker="Queue"
        icon={ClipboardList}
        iconTone="text-primary"
        trailing={
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Voice: <span className="text-foreground">"Mark loaded"</span>
          </span>
        }
      >
        <ul className="space-y-2">
          {queue.map((q) => (
            <li
              key={q.tool}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-2/30 p-3"
            >
              {q.ready ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-warning" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-light text-foreground/90">{q.tool}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {q.note}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                  q.ready ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
                )}
              >
                {q.ready ? "ready" : "pending"}
              </span>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Open supply asks" kicker="From scrub" icon={Truck} iconTone="text-accent">
        {snapshot.supplies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-light text-muted-foreground">
            None open.
          </div>
        ) : (
          <ul className="space-y-2">
            {snapshot.supplies.map((s, i) => (
              <li
                key={`${s.item}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-2/30 p-3"
              >
                <Truck className="h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1 text-sm font-light text-foreground/90">{s.item}</div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.minutesAgo}m
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>

      <PanelShell
        title="Sutures opened"
        kicker="Pack tracker"
        icon={Scissors}
        iconTone="text-accent"
      >
        {snapshot.sutures.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-light text-muted-foreground">
            No sutures opened.
          </div>
        ) : (
          <ul className="space-y-2">
            {snapshot.sutures.map((s) => (
              <li
                key={s.type}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-2/30 p-3"
              >
                <Scissors className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground/90">{s.type}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.opened} opened · {s.used} used · {Math.max(0, s.opened - s.used)} on field
                  </div>
                </div>
                <span className="font-mono text-base tabular-nums text-foreground">{s.opened}</span>
              </li>
            ))}
          </ul>
        )}
      </PanelShell>

      <PanelShell
        title="Running counts"
        kicker="Mirror — closing reconcile"
        icon={ClipboardList}
        iconTone="text-success"
        trailing={
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Voice: <span className="text-foreground/80">"counts to nurse"</span>
          </span>
        }
        className="lg:col-span-2"
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: "Raytec", initial: 20, current: 20 },
            { label: "Lap", initial: 9, current: 9 },
            { label: "Needle", initial: 14, current: 14 },
            { label: "Blade", initial: 3, current: 3 },
            { label: "Clamps", initial: 12, current: 12 },
          ].map((c) => {
            const balanced = c.current === c.initial;
            return (
              <div
                key={c.label}
                className="rounded-xl border border-border/40 bg-surface-2/30 p-3 text-center"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  {c.label}
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-2xl font-thin tabular-nums",
                    balanced ? "text-success" : "text-warning",
                  )}
                >
                  {c.current}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  of {c.initial}
                </div>
              </div>
            );
          })}
        </div>
      </PanelShell>
    </div>
  );
}

// Surgeon: imaging shortcut + procedure progression + preference card
function SurgeonPanel({
  snapshot,
  currentPhase,
  activeCase,
  onShowImaging,
  imagingFocus,
}: {
  snapshot: IntraopSnapshot;
  currentPhase: IntraopPhaseId;
  activeCase?: CaseItem;
  onShowImaging: (modality: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side") => void;
  imagingFocus: "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side" | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <PanelShell
        title="Procedure checklist"
        kicker="Lead surgeon"
        icon={ClipboardList}
        iconTone="text-accent"
      >
        <ol className="space-y-2">
          {snapshot.phases.map((p, i) => {
            const active = p.id === currentPhase;
            const done = i < phaseIndex(currentPhase, snapshot.phases);
            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                  active ? "border-accent/40 bg-accent/[0.06]" : "border-border/40 bg-surface-2/30",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    done && "bg-success/20 text-success",
                    active && "bg-accent text-background heartbeat",
                    !done && !active && "bg-surface-3 text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <span className="font-mono text-[10px]">{i + 1}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      active ? "text-accent" : "text-foreground/90",
                    )}
                  >
                    {p.label}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {active ? (p.step ?? p.detail) : p.detail}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </PanelShell>

      <div className="space-y-5">
        <PanelShell
          title="3D anatomy"
          kicker="Drag to rotate"
          icon={Box}
          iconTone="text-accent"
          trailing={
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Mouse
            </span>
          }
        >
          <div className="aspect-[16/10] w-full">
            <AnatomyModel3D
              caption={`${activeCase?.procedureShort ?? "RSA"} · ${
                activeCase?.side ? `${activeCase.side} shoulder` : "Right shoulder"
              }`}
            />
          </div>
        </PanelShell>

        <PanelShell
          title="Imaging access"
          kicker="Voice or tap"
          icon={ScanLine}
          iconTone="text-accent"
          trailing={
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Live · spotlights tile
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {(
              [
                {
                  modality: "arthroscopy",
                  label: "Live Scope",
                  desc: "30° arthroscope · live",
                  icon: Camera,
                },
                {
                  modality: "fluoroscopy",
                  label: "X-Ray (Fluoro)",
                  desc: "Last AP · 5m ago",
                  icon: ScanLine,
                },
                {
                  modality: "mri",
                  label: "MRI",
                  desc: "Pre-op shoulder",
                  icon: ImageIcon,
                },
                {
                  modality: "ct",
                  label: "CT",
                  desc: "Axial + Coronal",
                  icon: ImageIcon,
                },
                {
                  modality: "side_by_side",
                  label: "Side-by-side",
                  desc: "AP + last frame",
                  icon: Layers,
                },
              ] as const
            ).map((c) => {
              const isActive = imagingFocus === c.modality;
              return (
                <button
                  key={c.modality}
                  type="button"
                  onClick={() => onShowImaging(c.modality)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all",
                    isActive
                      ? "border-accent/60 bg-accent/10"
                      : "border-border/40 bg-surface-2/30 hover:border-accent/40 hover:bg-surface-2/60",
                  )}
                  title={`Spotlight ${c.label} on the imaging tile`}
                >
                  <c.icon
                    className={cn(
                      "mb-2 h-4 w-4 transition-colors",
                      isActive ? "text-accent" : "text-accent/70",
                    )}
                    strokeWidth={1.8}
                  />
                  <div className="text-sm font-light text-foreground/90">{c.label}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </PanelShell>

        {snapshot.implants.length > 0 && (
          <PanelShell
            title="Implant trials"
            kicker="Surgeon decision"
            icon={Package}
            iconTone="text-accent"
          >
            <ul className="space-y-2">
              {snapshot.implants.map((imp, i) => {
                const isPrimary =
                  imp.status === "scanned" || imp.status === "verified" || imp.status === "staged";
                return (
                  <li
                    key={`${imp.component}-${i}`}
                    className={cn(
                      "rounded-xl border p-3 transition-colors",
                      imp.status === "verified"
                        ? "border-success/40 bg-success/[0.06]"
                        : imp.status === "scanned"
                          ? "border-accent/40 bg-accent/[0.06]"
                          : "border-border/40 bg-surface-2/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ImplantStatusDot status={imp.status} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground/90">
                          {imp.component}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {imp.spec}
                        </div>
                      </div>
                      <ImplantStatusBadge status={imp.status} />
                    </div>
                    {isPrimary && imp.status === "scanned" && (
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-accent">
                        Trial loaded · awaiting confirm
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Voice: <span className="text-foreground/80">"confirm trial"</span>
              {" · "}
              <span className="text-foreground/80">"step up size"</span>
            </div>
          </PanelShell>
        )}

        <PanelShell
          title="Preference card"
          kicker="Loaded · Dr. Patel"
          icon={Sparkles}
          iconTone="text-primary"
        >
          <ul className="space-y-2 text-sm font-light text-foreground/85">
            {[
              "Beach-chair position · arm draped free",
              "Standard incision · deltopectoral",
              "Glenosphere 36 mm — primary, 39 mm staged",
              "Poly insert +3 mm — primary",
              "Closure: 2-0 Vicryl deep · 3-0 Monocryl",
            ].map((line) => (
              <li
                key={line}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-2/30 px-3 py-2"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {line}
              </li>
            ))}
          </ul>
        </PanelShell>
      </div>
    </div>
  );
}

// Anesthesia: stability + meds + alerts
function AnesthesiaPanel({
  snapshot,
  activeCase,
}: {
  snapshot: IntraopSnapshot;
  activeCase?: CaseItem;
}) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;
  const allergies = clinical?.allergies ?? [];
  const totalIns = sumVolumes(snapshot.fluids.ins);
  const totalOuts = sumVolumes(snapshot.fluids.outs);

  return (
    <div className="space-y-5">
      {/* Allergies banner — always visible at top, never collapsed.
          Patient-safety critical: anesthesia must see this without hunting. */}
      <AllergyBanner allergies={allergies} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Stability summary — kept tight */}
        <PanelShell
          title="Patient stability"
          kicker="Last 30 min"
          icon={Heart}
          iconTone="text-success"
        >
          <div className="rounded-xl border border-success/30 bg-success/[0.06] p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-success heartbeat" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-success">
                Stable
              </span>
            </div>
            <p className="mt-1 text-sm font-light text-foreground/90">
              No alerts in the last 30 minutes. All vitals within target.
            </p>
          </div>
        </PanelShell>

        {/* Airway snapshot */}
        <PanelShell
          title="Airway"
          kicker={snapshot.airway.difficult ? "DIFFICULT — note in chart" : "Standard"}
          icon={Wind}
          iconTone={snapshot.airway.difficult ? "text-destructive" : "text-primary"}
        >
          <div className="grid grid-cols-2 gap-3 text-sm font-light">
            <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Device
              </div>
              <div className="mt-1 text-foreground/90">
                {snapshot.airway.device} · {snapshot.airway.size}
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Depth at lip
              </div>
              <div className="mt-1 tabular-nums text-foreground/90">
                {snapshot.airway.depthCm} cm
              </div>
            </div>
            {snapshot.airway.mallampati && (
              <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  Mallampati
                </div>
                <div className="mt-1 text-foreground/90">Class {snapshot.airway.mallampati}</div>
              </div>
            )}
            <div
              className={cn(
                "rounded-xl border p-3",
                snapshot.airway.difficult
                  ? "border-destructive/40 bg-destructive/[0.06]"
                  : "border-border/40 bg-surface-2/30",
              )}
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Difficult airway
              </div>
              <div
                className={cn(
                  "mt-1",
                  snapshot.airway.difficult ? "text-destructive" : "text-success",
                )}
              >
                {snapshot.airway.difficult ? "Flagged" : "Not flagged"}
              </div>
            </div>
          </div>
        </PanelShell>

        {/* Anesthetic depth + neuromuscular */}
        <PanelShell
          title="Depth & neuromuscular"
          kicker="MAC · BIS · TOF"
          icon={Gauge}
          iconTone="text-accent"
        >
          <div className="grid grid-cols-3 gap-3 text-sm font-light">
            <div className="col-span-3 rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Agent
              </div>
              <div className="mt-1 text-foreground/90">{snapshot.depth.agent}</div>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3 text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                MAC
              </div>
              <div className="mt-1 font-mono text-2xl font-thin tabular-nums text-foreground">
                {snapshot.depth.mac.toFixed(2)}
              </div>
            </div>
            {snapshot.depth.bis !== undefined && (
              <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3 text-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  BIS
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-2xl font-thin tabular-nums",
                    snapshot.depth.bis < 40 || snapshot.depth.bis > 60
                      ? "text-warning"
                      : "text-success",
                  )}
                >
                  {snapshot.depth.bis}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  target 40–60
                </div>
              </div>
            )}
            {snapshot.depth.tof && (
              <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3 text-center">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  TOF
                </div>
                <div className="mt-1 font-mono text-2xl font-thin tabular-nums text-foreground">
                  {snapshot.depth.tof}
                </div>
              </div>
            )}
          </div>
          {snapshot.depth.lastParalytic && (
            <div className="mt-3 rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Last paralytic
              </div>
              <div className="mt-1 text-sm text-foreground/85">{snapshot.depth.lastParalytic}</div>
            </div>
          )}
        </PanelShell>

        {/* Fluids I&O + EBL */}
        <PanelShell
          title="Fluids · EBL"
          kicker="Running tally"
          icon={Droplet}
          iconTone="text-primary"
        >
          <div className="grid grid-cols-2 gap-3 text-sm font-light">
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-primary">
                Total in
              </div>
              <div className="mt-1 font-mono text-xl tabular-nums text-foreground">
                {totalIns} mL
              </div>
              <ul className="mt-1 space-y-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {snapshot.fluids.ins.map((i) => (
                  <li key={i.label}>
                    {i.label} · {i.volumeMl} mL
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-warning">
                Total out
              </div>
              <div className="mt-1 font-mono text-xl tabular-nums text-foreground">
                {totalOuts} mL
              </div>
              <ul className="mt-1 space-y-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {snapshot.fluids.outs.map((o) => (
                  <li key={o.label}>
                    {o.label} · {o.volumeMl} mL
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Estimated blood loss
              </div>
              <div
                className={cn(
                  "mt-1 font-mono text-2xl font-thin tabular-nums",
                  snapshot.fluids.ebl > 500 ? "text-warning" : "text-success",
                )}
              >
                {snapshot.fluids.ebl} mL
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-surface-2/30 p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Urine output
              </div>
              <div className="mt-1 text-foreground/90">{snapshot.fluids.uopRate}</div>
            </div>
          </div>
        </PanelShell>

        {/* Medication timing — kept */}
        <PanelShell
          title="Medication timing"
          kicker="Reminders"
          icon={Pill}
          iconTone="text-warning"
          className="lg:col-span-2"
        >
          <ul className="space-y-2 text-sm font-light lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            <li className="rounded-xl border border-warning/30 bg-warning/[0.06] p-3 lg:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning">
                Next due
              </div>
              <div className="mt-1 text-base text-foreground/90">{snapshot.antibiotic.agent}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                In {snapshot.antibiotic.dueInMinutes} min · last {snapshot.antibiotic.lastDose}
              </div>
            </li>
            {[
              { label: "Ondansetron 4 mg IV", time: "Given · 12 min ago" },
              { label: "Dexamethasone 8 mg IV", time: "Given · 32 min ago" },
              { label: "Tranexamic acid", time: "Not indicated this case" },
            ].map((m) => (
              <li
                key={m.label}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-surface-2/30 px-3 py-2"
              >
                <Pill className="h-4 w-4 text-muted-foreground/70" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-foreground/85">{m.label}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PanelShell>
      </div>
    </div>
  );
}

function AllergyBanner({
  allergies,
}: {
  allergies: Array<{ agent: string; reaction: string; severity: "severe" | "moderate" | "mild" }>;
}) {
  if (allergies.length === 0) {
    return (
      <section className="rounded-2xl border border-success/30 bg-success/[0.06] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
            <ShieldAlert className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-success">
              Allergies — patient safety
            </div>
            <div className="mt-0.5 text-sm font-light text-foreground/90">
              NKDA · No known drug allergies
            </div>
          </div>
        </div>
      </section>
    );
  }
  const hasSevere = allergies.some((a) => a.severity === "severe");
  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        hasSevere
          ? "border-destructive/40 bg-destructive/[0.08]"
          : "border-warning/40 bg-warning/[0.08]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            hasSevere ? "bg-destructive/15 text-destructive" : "bg-warning/20 text-warning",
          )}
        >
          <AlertTriangle className="h-4 w-4 heartbeat" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.3em]",
              hasSevere ? "text-destructive" : "text-warning",
            )}
          >
            Allergies — patient safety
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {allergies.map((a) => (
              <span
                key={a.agent}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm",
                  a.severity === "severe"
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : a.severity === "moderate"
                      ? "border-warning/50 bg-warning/10 text-warning"
                      : "border-border bg-surface-2/60 text-muted-foreground",
                )}
              >
                <span className="font-medium">{a.agent}</span>
                <span className="opacity-70">→ {a.reaction}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">
                  {a.severity}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Right column — AI prompts + activity stream
// ─────────────────────────────────────────────────────────────────────────

function AiPromptsCard({ prompts }: { prompts: AiPrompt[] }) {
  const toneClasses: Record<AiPromptTone, { chip: string; bar: string }> = {
    info: { chip: "bg-primary/15 text-primary", bar: "bg-primary/60" },
    advisory: { chip: "bg-warning/15 text-warning", bar: "bg-warning" },
    critical: { chip: "bg-destructive/15 text-destructive", bar: "bg-destructive" },
  };

  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Arti · contextual
          </div>
          <h2 className="mt-1 text-lg font-light">Awareness</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {prompts.length} active
        </span>
      </div>

      <ul className="space-y-2">
        {prompts.map((p, i) => {
          const t = toneClasses[p.tone];
          return (
            <li
              key={`${p.title}-${i}`}
              className="relative overflow-hidden rounded-xl border border-border/50 bg-surface-2/40 p-4"
            >
              <span className={cn("absolute inset-y-0 left-0 w-[3px]", t.bar)} />
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    t.chip,
                  )}
                >
                  {p.tone === "advisory" ? "Workflow" : p.tone === "critical" ? "Critical" : "Info"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground/95">{p.title}</div>
                  {p.body && (
                    <p className="mt-1 text-xs font-light leading-relaxed text-muted-foreground">
                      {p.body}
                    </p>
                  )}
                  {p.voiceHint && (
                    <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Mic className="h-3 w-3 text-primary" />
                      <span className="text-foreground/70">"{p.voiceHint}"</span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Single source of truth for the activity-stream legend so the header
// chips, the per-event label chips, and the dot tones never drift.
const KIND_META: Record<
  ActivityEvent["kind"],
  { label: string; dot: string; chip: string }
> = {
  med: { label: "Med", dot: "bg-warning", chip: "bg-warning/15 text-warning" },
  imaging: { label: "Imaging", dot: "bg-accent", chip: "bg-accent/15 text-accent" },
  implant: { label: "Implant", dot: "bg-primary", chip: "bg-primary/15 text-primary" },
  doc: { label: "Doc", dot: "bg-success", chip: "bg-success/15 text-success" },
  ai: {
    label: "AI",
    dot: "bg-gradient-to-br from-primary to-accent",
    chip: "bg-gradient-to-br from-primary/15 to-accent/15 text-foreground",
  },
  room: {
    label: "Room",
    dot: "bg-muted-foreground/60",
    chip: "bg-muted-foreground/15 text-muted-foreground",
  },
};

const KIND_ORDER: ActivityEvent["kind"][] = ["med", "imaging", "implant", "doc", "ai", "room"];

function ActivityStream({ events, highlight }: { events: ActivityEvent[]; highlight?: boolean }) {
  return (
    <section
      className={cn(
        "glass rounded-2xl p-6 transition-shadow duration-500",
        highlight && "ring-1 ring-accent/40 shadow-[0_0_30px_-10px_var(--accent)]",
      )}
    >
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
            Activity
          </div>
          <h2 className="mt-1 text-lg font-light">Room stream</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          live
        </span>
      </div>

      {/* Legend — decodes the dot + chip color system. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {KIND_ORDER.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
          >
            <span aria-hidden className={cn("h-2 w-2 rounded-full", KIND_META[k].dot)} />
            {KIND_META[k].label}
          </span>
        ))}
      </div>

      <ol className="relative space-y-3 pl-5">
        {events.map((e, i) => {
          const meta = KIND_META[e.kind];
          const isLast = i === events.length - 1;
          return (
            <li key={`${e.title}-${i}`} className="relative">
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute -left-5 top-3 -bottom-6 w-px bg-border/40"
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[26px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background",
                  meta.dot,
                )}
              />
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider",
                      meta.chip,
                    )}
                  >
                    {meta.label}
                  </span>
                  <div className="text-sm font-light text-foreground/90">{e.title}</div>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {e.minutesAgo}m
                </span>
              </div>
              {e.detail && (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {e.detail}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
