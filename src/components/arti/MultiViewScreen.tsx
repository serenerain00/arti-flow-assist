import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Droplet,
  Heart,
  Layers,
  LogOut,
  Maximize2,
  Package,
  Pill,
  ScanLine,
  Stethoscope,
  Thermometer,
  UserCog,
  Wind,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ArtiInvoker } from "./ArtiInvoker";
import { PATIENT_CLINICAL, type CaseItem } from "./cases";
import { PREF_CARD } from "./PreferenceCard";
import {
  driftVitals,
  findPhase,
  formatElapsed,
  getIntraopSnapshot,
  initialVitals,
  neighborPhase,
  phaseIndex,
  phaseLabel,
  type IntraopPhaseId,
  type IntraopSnapshot,
  type VitalSnapshot,
} from "./intraop";
import type { ArtiToolResult } from "@/hooks/useArtiVoice";
import type { IntraopActions, IntraopActionsRef } from "./IntraopDashboard";

/**
 * Multi-view: alternate intraop layout for wall display.
 *
 * Renders the four most-glanced data streams (circulating nurse, scrub
 * tech, surgeon's primary view, anesthesia) as a 4-quadrant command
 * center. The Sidebar is intentionally hidden — every pixel is owed to
 * the team. Voice still drives all interaction; tiles are read-only.
 *
 * The component reuses `IntraopActions` so all existing intraop voice
 * tools (setPhase, advancePhase, focusRole, etc.) keep working while
 * multi-view is on screen. The main difference vs `IntraopDashboard` is
 * layout density and the central video tile.
 */

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  activeCase?: CaseItem;
  onExitMultiView: () => void;
  /** Optional one-tap end-case from multi-view. Same destination as voice 'end case'. */
  onEndCase?: () => void;
  onPrompt: (text: string) => void;
  /** Same ref the IntraopDashboard registers to — multi-view fills it in while mounted. */
  actionsRef?: IntraopActionsRef;
}

const SUGGESTIONS = [
  "What's the BP?",
  "Counts so far",
  "Advance to verification",
  "Time since last antibiotic",
];

// Local placeholder for the surgeon's arthroscope feed. Muted so OR
// audio stays clean for voice. File lives in /public.
const SURGEON_VIDEO_SRC = "/scopeFeed.mp4";

// Imaging modality sources. The arthroscope is treated as "live" — it's
// the default view. The others are mock external studies that can be
// swapped in via voice ("show me the MRI", "show fluoroscopy", "show CT").
type ImagingMode = "arthroscopy" | "fluoroscopy" | "mri" | "ct" | "side_by_side";

const MRI_VIDEO_SRC =
  "https://www.youtube.com/embed/m_34buNeZ04?start=5&autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=m_34buNeZ04&playsinline=1";
// CT image lives in /public — pre-op shoulder CT, axial + coronal panels.
const CT_IMAGE_SRC = "/ctscans.jpeg";

const IMAGING_LABEL: Record<ImagingMode, string> = {
  arthroscopy: "Live · Arthroscope",
  fluoroscopy: "Fluoroscopy",
  mri: "MRI · Patient Study",
  ct: "CT · Patient Study",
  side_by_side: "Side-by-side",
};

// Modality-specific sublabels that appear under the main DICOM badge so
// the team can see at a glance what the tile is showing.
const IMAGING_SUBLABEL: Partial<Record<ImagingMode, string>> = {
  ct: "Axial + Coronal · pre-op",
  mri: "T2 Coronal · pre-op",
  fluoroscopy: "Stored AP / Axial / Lateral",
};

// Dropdown order for the picker on the surgeon tile. Display labels are
// what the team sees; `mode` is the canonical voice modality. We label
// fluoroscopy as "X-Ray (Fluoro)" because the team colloquially asks for
// X-rays during the case.
const MODALITY_OPTIONS: Array<{ mode: ImagingMode; label: string }> = [
  { mode: "arthroscopy", label: "Live Scope" },
  { mode: "mri", label: "MRI" },
  { mode: "fluoroscopy", label: "X-Ray (Fluoro)" },
  { mode: "ct", label: "CT" },
  { mode: "side_by_side", label: "Side-by-side" },
];

export function MultiViewScreen({
  staffName,
  staffRole,
  initials,
  activeCase,
  onExitMultiView,
  onEndCase,
  onPrompt,
  actionsRef,
}: Props) {
  const snapshot = useMemo(() => getIntraopSnapshot(activeCase?.id), [activeCase?.id]);
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;

  const [elapsedSec, setElapsedSec] = useState(0);
  const [vitals, setVitals] = useState<VitalSnapshot>(() => initialVitals());
  const [currentPhase, setCurrentPhase] = useState<IntraopPhaseId>(snapshot.currentPhase);
  const [now, setNow] = useState(() => new Date());
  /**
   * Which imaging stream the surgeon's center tile is showing. Default
   * is the live arthroscope feed; voice ("show me the MRI") swaps in
   * external studies. Persists until changed — unlike IntraopDashboard's
   * 4s spotlight, multi-view is a sustained wall display.
   */
  const [imagingMode, setImagingMode] = useState<ImagingMode>("arthroscopy");

  useEffect(() => {
    setElapsedSec(0);
    setVitals(initialVitals());
    setCurrentPhase(snapshot.currentPhase);
    setImagingMode("arthroscopy");
  }, [activeCase?.id, snapshot.currentPhase]);

  useEffect(() => {
    const i = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    const i = window.setInterval(() => setVitals((v) => driftVitals(v)), 2500);
    return () => window.clearInterval(i);
  }, []);

  useEffect(() => {
    const i = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(i);
  }, []);

  // Register voice actions while mounted. Mirrors IntraopDashboard so the
  // existing intraop_* tools dispatch through this view when it's on top.
  useEffect(() => {
    if (!actionsRef) return;
    const actions: IntraopActions = {
      focusRole: () => ({ ok: true }),
      setPhase: (p): ArtiToolResult => {
        const direct = phaseIndex(p, snapshot.phases) >= 0 ? p : undefined;
        const matched = direct ?? findPhase(p, snapshot.phases)?.id;
        if (!matched) return { ok: false, reason: "unknown phase" };
        setCurrentPhase(matched);
        return { ok: true };
      },
      advancePhase: (dir): ArtiToolResult => {
        setCurrentPhase((p) => neighborPhase(p, dir, snapshot.phases));
        return { ok: true };
      },
      showImaging: (modality): ArtiToolResult => {
        setImagingMode(modality);
        return { ok: true };
      },
      showPanel: () => ({ ok: true }),
      getLiveContext: () => {
        const idx = phaseIndex(currentPhase, snapshot.phases);
        const phase = snapshot.phases[idx];
        const step = phase?.step ?? phase?.detail ?? "";
        const nextPhase = snapshot.phases[idx + 1];
        const trayList = (p?: { trays?: string[] }) =>
          p?.trays?.length ? p.trays.join(", ") : "none specified";
        const lines = [
          `Multi-view: case ACTIVE (4-quadrant wall layout)`,
          `  Surgeon center tile: showing ${imagingMode === "arthroscopy" ? "the LIVE arthroscope feed" : `the ${IMAGING_LABEL[imagingMode]} (external study, NOT live)`}`,
          `  Available imaging modalities (call intraop_show_imaging with modality=...):`,
          `    arthroscopy — live scope feed (default). Trigger: 'show the scope', 'back to live', 'live feed'.`,
          `    mri — pre-op MRI study. Trigger: 'show MRI', 'open MRI', 'pull up the MRI'.`,
          `    ct — pre-op CT (axial + coronal). Trigger: 'show CT', 'show CT scans', 'show me the CTs', 'pull up the CT', 'show the CAT scan'.`,
          `    fluoroscopy — stored fluoro views. Trigger: 'show fluoro', 'show fluoroscopy', 'show X-ray'.`,
          `    side_by_side — split view. Trigger: 'side by side'.`,
          `  Current phase: ${phaseLabel(currentPhase, snapshot.phases)} (step ${idx + 1} of ${snapshot.phases.length})`,
          `  Step detail: ${step}`,
          `  Trays for current phase: ${trayList(phase)}`,
          nextPhase
            ? `  Next phase: ${nextPhase.label} — trays: ${trayList(nextPhase)}`
            : `  Next phase: none (this is the final phase)`,
          `  Elapsed: ${formatElapsed(elapsedSec)} of ~${snapshot.estimatedMinutes} min`,
          `  Anesthesia vitals: HR ${vitals.hr} · BP ${vitals.bp.sys}/${vitals.bp.dia} · MAP ${vitals.map} · SpO2 ${vitals.spo2}% · EtCO2 ${vitals.etco2} · Temp ${vitals.tempC}°C`,
          `  Anesthesia depth: ${snapshot.depth.agent} · MAC ${snapshot.depth.mac}${snapshot.depth.bis ? ` · BIS ${snapshot.depth.bis}` : ""}${snapshot.depth.tof ? ` · TOF ${snapshot.depth.tof}` : ""}`,
          `  Airway: ${snapshot.airway.device} ${snapshot.airway.size} @ ${snapshot.airway.depthCm} cm${snapshot.airway.difficult ? " · DIFFICULT" : ""}`,
          `  Antibiotic: ${snapshot.antibiotic.agent} · last ${snapshot.antibiotic.lastDose} · next due in ${snapshot.antibiotic.dueInMinutes} min`,
          `  Implants: ${snapshot.implants.length === 0 ? "none planned" : snapshot.implants.map((i) => `${i.component} (${i.status})`).join(", ")}`,
          `  Sutures: ${snapshot.sutures.map((s) => `${s.type} ${s.used}/${s.opened}`).join(", ") || "none"}`,
          `  Fluids: in ${snapshot.fluids.ins.reduce((t, x) => t + x.volumeMl, 0)} mL · out ${snapshot.fluids.outs.reduce((t, x) => t + x.volumeMl, 0)} mL · EBL ${snapshot.fluids.ebl} mL`,
          `  Allergies: ${clinical?.allergies.map((a) => `${a.agent} (${a.severity})`).join(", ") || "none on record"}`,
        ];
        return lines.join("\n");
      },
    };
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actionsRef, currentPhase, elapsedSec, snapshot, vitals, clinical, imagingMode]);

  const procedureLabel = activeCase?.procedure ?? "Rotator Cuff Repair";
  const procedureShort = activeCase?.procedureShort ?? "RCR";
  const surgeon = activeCase?.surgeon ?? "Dr. Anika Patel";
  const room = activeCase?.room ?? "OR 326";
  const patientLine = activeCase
    ? `${activeCase.patientName} · ${activeCase.patientAgeSex}${activeCase.side ? ` · ${activeCase.side}` : ""}`
    : "Patient";
  const clockLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, color-mix(in oklab, var(--primary) 14%, transparent) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, color-mix(in oklab, var(--accent) 10%, transparent) 0%, transparent 55%)",
        }}
      />

      {/* ── Header bar ── */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-border/40 bg-surface/40 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
            arti wall
          </div>
          <span className="h-4 w-px bg-border" />
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-light tracking-tight">{procedureLabel}</h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {procedureShort}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.25em] text-success">
            <Circle className="h-1.5 w-1.5 fill-success heartbeat" strokeWidth={0} />
            Case Active
          </span>
          <span className="rounded-full border border-border bg-surface-3/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {room}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">
              Elapsed
            </div>
            <div className="font-mono text-base tabular-nums text-foreground">
              {formatElapsed(elapsedSec)}
            </div>
          </div>
          <span className="h-6 w-px bg-border" />
          <div className="font-mono text-base tabular-nums text-muted-foreground">{clockLabel}</div>
          <span className="h-6 w-px bg-border" />
          <button
            type="button"
            onClick={onExitMultiView}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-3/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            title="Exit multi-view"
          >
            <X className="h-3 w-3" strokeWidth={2} />
            Exit Multi-view
          </button>
          {onEndCase && (
            <button
              type="button"
              onClick={onEndCase}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-destructive transition-colors hover:border-destructive/60 hover:bg-destructive/15"
              title="End case and start turnover (or say 'Arti, end case')"
            >
              <LogOut className="h-3 w-3" strokeWidth={2} />
              End Case
            </button>
          )}
          <div className="flex items-center gap-2 pl-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-3 font-mono text-[10px] text-foreground">
              {initials}
            </div>
            <div className="text-right">
              <div className="text-[10px] font-light leading-tight">{staffName}</div>
              <div className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/70">
                {staffRole}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main grid: 4 quadrants around a central surgeon column ── */}
      <main
        data-scroll
        className="relative z-0 grid min-h-0 flex-1 grid-cols-12 grid-rows-2 gap-3 overflow-hidden p-3"
      >
        {/* Left column — nurse (top) + scrub tech (bottom) */}
        <NurseTile
          className="col-span-3 row-span-1"
          snapshot={snapshot}
          allergies={clinical?.allergies ?? []}
        />
        <ScrubTile className="col-span-3 row-span-1" snapshot={snapshot} />

        {/* Center column — surgeon primary view spans both rows */}
        <SurgeonTile
          className="col-span-6 row-span-2"
          snapshot={snapshot}
          currentPhase={currentPhase}
          surgeon={surgeon}
          patientLine={patientLine}
          imagingMode={imagingMode}
          onSetImagingMode={setImagingMode}
        />

        {/* Right column — anesthesia (top) + team & room (bottom) */}
        <AnesthesiaTile className="col-span-3 row-span-1" vitals={vitals} snapshot={snapshot} />
        <TeamRoomTile
          className="col-span-3 row-span-1"
          surgeon={surgeon}
          room={room}
          elapsedSec={elapsedSec}
          estimatedMinutes={snapshot.estimatedMinutes}
        />
      </main>

      <ArtiInvoker
        placeholder="Ask Arti — multi-view active…"
        onSubmit={onPrompt}
        suggestions={SUGGESTIONS}
      />
    </div>
  );
}

// ─── Nurse tile ────────────────────────────────────────────────────────

interface NurseTileProps {
  className?: string;
  snapshot: IntraopSnapshot;
  allergies: Array<{ agent: string; reaction: string; severity: "severe" | "moderate" | "mild" }>;
}

function NurseTile({ className, snapshot, allergies }: NurseTileProps) {
  const totalIns = snapshot.fluids.ins.reduce((t, x) => t + x.volumeMl, 0);
  const totalOuts = snapshot.fluids.outs.reduce((t, x) => t + x.volumeMl, 0);
  return (
    <Tile className={className} accent="primary" icon={Activity} title="Circulating Nurse">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Antibiotic" value={`${snapshot.antibiotic.dueInMinutes}m`} sub="next due" />
        <Stat label="EBL" value={`${snapshot.fluids.ebl}`} sub="mL" />
        <Stat label="Fluids in" value={`${totalIns}`} sub="mL" />
        <Stat label="Fluids out" value={`${totalOuts}`} sub="mL" />
      </div>

      {allergies.length > 0 ? (
        <Section label="Allergies">
          <ul className="space-y-1">
            {allergies.slice(0, 3).map((a) => (
              <li
                key={a.agent}
                className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[11px]"
              >
                <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
                <span className="font-medium text-warning">{a.agent}</span>
                <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-warning/70">
                  {a.severity}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <Section label="Allergies">
          <p className="text-[11px] text-muted-foreground">None on record</p>
        </Section>
      )}

      <Section label="Time-out">
        <div className="flex items-center gap-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
          All four items verified
        </div>
      </Section>
    </Tile>
  );
}

// ─── Scrub tile ────────────────────────────────────────────────────────

function ScrubTile({ className, snapshot }: { className?: string; snapshot: IntraopSnapshot }) {
  return (
    <Tile className={className} accent="success" icon={UserCog} title="Scrub Tech">
      <PrefCardChecklist />

      <Section label="Implants">
        {snapshot.implants.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">None planned for this case.</p>
        ) : (
          <ul className="space-y-1">
            {snapshot.implants.slice(0, 4).map((i) => (
              <li
                key={`${i.component}-${i.lot ?? i.spec}`}
                className="flex items-center justify-between rounded-md border border-border/40 bg-surface-2/40 px-2 py-1 text-[11px]"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Package className="h-3 w-3 shrink-0 text-success" />
                  <span className="truncate font-light">{i.component}</span>
                </div>
                <span
                  className={cn(
                    "ml-2 shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider",
                    i.status === "verified" && "bg-success/15 text-success",
                    i.status === "scanned" && "bg-primary/15 text-primary",
                    i.status === "staged" && "bg-muted/40 text-muted-foreground",
                    i.status === "pending" && "bg-warning/15 text-warning",
                  )}
                >
                  {i.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Tile>
  );
}

// ─── Preference card checklist ─────────────────────────────────────────

/**
 * Combined view of the surgeon's preference card — instruments + supplies
 * shown as a one-glance "accounted for" checklist. Demo state: most items
 * are checked off (case is mid-procedure); a couple are still pending so
 * the warning state is visible. State is local + tap-toggleable so the
 * scrub tech can confirm the last items as they come up.
 */
function PrefCardChecklist() {
  type Kind = "instrument" | "supply";
  const items = useMemo<Array<{ id: string; label: string; kind: Kind }>>(
    () => [
      ...PREF_CARD.instruments.map((label, i) => ({
        id: `i${i}`,
        label,
        kind: "instrument" as const,
      })),
      ...PREF_CARD.supplies.map((label, i) => ({
        id: `s${i}`,
        label,
        kind: "supply" as const,
      })),
    ],
    [],
  );

  // Default: every item accounted for. A case wouldn't start with
  // anything missing — the wall reflects that. Tap to toggle if a tray
  // turns out to be short.
  const [accounted, setAccounted] = useState<Set<string>>(() => new Set(items.map((it) => it.id)));

  const total = items.length;
  const done = accounted.size;
  const allDone = done === total;

  const toggle = (id: string) => {
    setAccounted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <div className="font-mono text-[8px] uppercase tracking-[0.3em] text-muted-foreground/60">
          Pref Card · Accounted For
        </div>
        <div
          className={cn(
            "font-mono text-[10px] tabular-nums",
            allDone ? "text-success" : "text-warning",
          )}
        >
          {done} / {total}
        </div>
      </div>
      <ul className="space-y-1">
        {items.map((it) => {
          const on = accounted.has(it.id);
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => toggle(it.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-[11px] transition-colors",
                  on
                    ? "border-success/30 bg-success/5 text-foreground hover:border-success/50"
                    : "border-warning/30 bg-warning/5 text-foreground hover:border-warning/50",
                )}
                aria-pressed={on}
                title={on ? "Mark not accounted" : "Mark accounted"}
              >
                {on ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2} />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-warning" strokeWidth={1.8} />
                )}
                <span className="truncate font-light">{it.label}</span>
                <span className="ml-auto shrink-0 font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">
                  {it.kind}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Surgeon tile (center, big) ────────────────────────────────────────

interface SurgeonTileProps {
  className?: string;
  snapshot: IntraopSnapshot;
  currentPhase: IntraopPhaseId;
  surgeon: string;
  patientLine: string;
  imagingMode: ImagingMode;
  onSetImagingMode: (mode: ImagingMode) => void;
}

function SurgeonTile({
  className,
  snapshot,
  currentPhase,
  surgeon,
  patientLine,
  imagingMode,
  onSetImagingMode,
}: SurgeonTileProps) {
  const idx = phaseIndex(currentPhase, snapshot.phases);
  const phase = snapshot.phases[idx];
  const stepText = phase?.step ?? phase?.detail ?? "";
  const caption = phase?.imagingCaption ?? "";
  const phasesLeft = snapshot.phases.length - idx - 1;
  const isLive = imagingMode === "arthroscopy";

  // Modality dropdown — mouse parity for "show me CT / MRI / X-Ray / scope".
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  return (
    <Tile className={className} accent="accent" icon={Stethoscope} title="Surgeon · Primary View">
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* Video */}
        <div className="relative flex-1 overflow-hidden rounded-xl border border-border/60 bg-black">
          {isLive ? (
            <video
              src={SURGEON_VIDEO_SRC}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
          ) : imagingMode === "mri" ? (
            <iframe
              key="mri"
              title="MRI study"
              src={MRI_VIDEO_SRC}
              allow="autoplay; encrypted-media; picture-in-picture"
              className="h-full w-full"
              style={{ pointerEvents: "none" }}
            />
          ) : imagingMode === "ct" ? (
            <img
              key="ct"
              src={CT_IMAGE_SRC}
              alt="CT study — axial and coronal slices of the operative shoulder"
              className="h-full w-full object-contain bg-black"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-white/60">
              {IMAGING_LABEL[imagingMode]} not available in this prototype
            </div>
          )}
          {/* DICOM-style overlay */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-3 top-3 flex flex-col gap-1">
              <div ref={pickerRef} className="pointer-events-auto relative">
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/90 backdrop-blur transition-colors hover:border-white/50 hover:text-white"
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                  title="Switch imaging source"
                >
                  {isLive && <span className="h-1.5 w-1.5 rounded-full bg-success heartbeat" />}
                  {IMAGING_LABEL[imagingMode]}
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      pickerOpen && "rotate-180",
                    )}
                    strokeWidth={2}
                  />
                </button>
                {pickerOpen && (
                  <ul
                    role="listbox"
                    className="absolute left-0 top-full z-30 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-white/15 bg-black/90 shadow-2xl backdrop-blur-xl"
                  >
                    {MODALITY_OPTIONS.map((opt) => {
                      const active = opt.mode === imagingMode;
                      return (
                        <li key={opt.mode} role="option" aria-selected={active}>
                          <button
                            type="button"
                            onClick={() => {
                              onSetImagingMode(opt.mode);
                              setPickerOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider transition-colors",
                              active
                                ? "bg-white/15 text-white"
                                : "text-white/70 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            <span className="flex h-3 w-3 shrink-0 items-center justify-center">
                              {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
                            </span>
                            <span className="flex-1">{opt.label}</span>
                            {opt.mode === "arthroscopy" && (
                              <span className="h-1.5 w-1.5 rounded-full bg-success heartbeat" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {IMAGING_SUBLABEL[imagingMode] && (
                <div className="self-start rounded-md border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/70 backdrop-blur">
                  {IMAGING_SUBLABEL[imagingMode]}
                </div>
              )}
            </div>
            {isLive && (
              <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/90 backdrop-blur">
                30° Scope
              </div>
            )}
            {!isLive && (
              <button
                type="button"
                onClick={() => onSetImagingMode("arthroscopy")}
                className="pointer-events-auto absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-white/90 backdrop-blur transition-colors hover:border-white/50 hover:text-white"
                title="Return to live arthroscope feed"
              >
                ← Live feed
              </button>
            )}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              {isLive && (
                <div className="rounded-md border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[10px] text-white/85 backdrop-blur">
                  {caption}
                </div>
              )}
              {isLive && (
                <div className="rounded-md border border-white/15 bg-black/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/85 backdrop-blur">
                  Recording
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phase + step info */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-7 rounded-xl border border-border/40 bg-surface-2/40 p-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-accent">
              Current Phase · {phaseLabel(currentPhase, snapshot.phases)}
            </div>
            <p className="mt-1.5 text-sm font-light leading-snug text-foreground">{stepText}</p>
            <div className="mt-2 flex items-center gap-1">
              {snapshot.phases.map((p, i) => {
                const past = i < idx;
                const here = i === idx;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      past && "bg-accent/60",
                      here && "bg-accent",
                      !past && !here && "bg-border",
                    )}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              <span>
                {phasesLeft === 0
                  ? "Final phase"
                  : `${phasesLeft} phase${phasesLeft === 1 ? "" : "s"} remaining`}
              </span>
              <span>
                {idx + 1} / {snapshot.phases.length}
              </span>
            </div>
          </div>

          <div className="col-span-5 rounded-xl border border-border/40 bg-surface-2/40 p-3">
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-accent">Case</div>
            <div className="mt-1.5 truncate text-sm font-light">{patientLine}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{surgeon}</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <MiniStat icon={Layers} label="Implants" value={`${snapshot.implants.length}`} />
              <MiniStat icon={ScanLine} label="Open asks" value={`${snapshot.supplies.length}`} />
            </div>
          </div>
        </div>
      </div>
    </Tile>
  );
}

// ─── Anesthesia tile ───────────────────────────────────────────────────

interface AnesthesiaTileProps {
  className?: string;
  vitals: VitalSnapshot;
  snapshot: IntraopSnapshot;
}

function AnesthesiaTile({ className, vitals, snapshot }: AnesthesiaTileProps) {
  return (
    <Tile className={className} accent="warning" icon={Wind} title="Anesthesia Provider">
      <div className="grid grid-cols-3 gap-2">
        <Vital label="HR" value={vitals.hr} unit="bpm" tone="warning" icon={Heart} />
        <Vital
          label="BP"
          value={`${vitals.bp.sys}/${vitals.bp.dia}`}
          unit={`MAP ${vitals.map}`}
          tone="warning"
        />
        <Vital label="SpO₂" value={vitals.spo2} unit="%" tone="warning" icon={Activity} />
        <Vital label="EtCO₂" value={vitals.etco2} unit="mmHg" tone="warning" />
        <Vital label="Temp" value={vitals.tempC} unit="°C" tone="warning" icon={Thermometer} />
        <Vital label="MAC" value={snapshot.depth.mac} unit="" tone="warning" />
      </div>

      <Section label="Plan">
        <p className="text-[11px] leading-snug text-foreground">{snapshot.depth.agent}</p>
        {snapshot.depth.tof && (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            TOF {snapshot.depth.tof}
            {snapshot.depth.bis ? ` · BIS ${snapshot.depth.bis}` : ""}
          </p>
        )}
      </Section>

      <Section label="Airway">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-light">
            {snapshot.airway.device} {snapshot.airway.size} @ {snapshot.airway.depthCm} cm
          </span>
          <span
            className={cn(
              "font-mono text-[9px] uppercase tracking-wider",
              snapshot.airway.difficult ? "text-warning" : "text-muted-foreground/70",
            )}
          >
            {snapshot.airway.difficult ? "Difficult" : `Mall ${snapshot.airway.mallampati ?? "—"}`}
          </span>
        </div>
      </Section>

      {/* Antibiotic redose reminder — surfaces the upcoming dose timing on
          the wall so the anesthesia team sees it without having to focus
          the role panel. Red when ≤5 min, warning when ≤15, calm otherwise. */}
      <AntibioticReminder snapshot={snapshot} />
    </Tile>
  );
}

function AntibioticReminder({ snapshot }: { snapshot: IntraopSnapshot }) {
  const { agent, lastDose, dueInMinutes } = snapshot.antibiotic;
  const tone = dueInMinutes <= 5 ? "danger" : dueInMinutes <= 15 ? "warning" : "calm";
  const toneClasses =
    tone === "danger"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-warning/50 bg-warning/10 text-warning"
        : "border-success/30 bg-success/8 text-success";
  const headlineLabel =
    tone === "danger" ? "Redose now" : tone === "warning" ? "Redose soon" : "On schedule";
  return (
    <Section label="Antibiotic redose">
      <div className={cn("rounded-lg border px-2.5 py-2", toneClasses)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
            <Pill className="h-3 w-3" strokeWidth={2} />
            {headlineLabel}
          </div>
          <div className="font-mono text-base tabular-nums">
            {dueInMinutes}
            <span className="ml-0.5 text-[10px] opacity-70">min</span>
          </div>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-[10px] font-light">
          <span className="text-foreground/80">{agent}</span>
          <span className="text-muted-foreground/80">last {lastDose}</span>
        </div>
      </div>
    </Section>
  );
}

// ─── Team & Room tile ──────────────────────────────────────────────────

interface TeamRoomTileProps {
  className?: string;
  surgeon: string;
  room: string;
  elapsedSec: number;
  estimatedMinutes: number;
}

function TeamRoomTile({
  className,
  surgeon,
  room,
  elapsedSec,
  estimatedMinutes,
}: TeamRoomTileProps) {
  const elapsedMin = Math.floor(elapsedSec / 60);
  const remaining = Math.max(0, estimatedMinutes - elapsedMin);
  const pct = Math.min(100, Math.max(2, Math.round((elapsedMin / estimatedMinutes) * 100)));

  const team = [
    { role: "Lead surgeon", name: surgeon },
    { role: "Anesthesia", name: "Dr. Mara Suzuki" },
    { role: "Circulating RN", name: "Sarah Lin" },
    { role: "Scrub tech", name: "Marcus Reyes" },
    { role: "First assist", name: "Dr. Jordan Wei" },
  ];

  return (
    <Tile className={className} accent="primary" icon={Maximize2} title="Team & Room">
      <Section label="Team in room">
        <ul className="space-y-1">
          {team.map((t) => (
            <li key={t.role} className="flex items-baseline justify-between text-[11px]">
              <span className="font-light">{t.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                {t.role}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Room">
        <div className="grid grid-cols-2 gap-1.5">
          <MiniStat icon={Clock} label="Remaining" value={`~${remaining}m`} />
          <MiniStat icon={Droplet} label="Room" value={room} />
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-surface-3/60">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Section>
    </Tile>
  );
}

// ─── Reusable atoms ────────────────────────────────────────────────────

type AccentTone = "primary" | "success" | "accent" | "warning";

const TONE_CLASSES: Record<AccentTone, { ring: string; text: string; bg: string }> = {
  primary: { ring: "ring-primary/20", text: "text-primary", bg: "bg-primary/8" },
  success: { ring: "ring-success/20", text: "text-success", bg: "bg-success/8" },
  accent: { ring: "ring-accent/20", text: "text-accent", bg: "bg-accent/8" },
  warning: { ring: "ring-warning/20", text: "text-warning", bg: "bg-warning/8" },
};

interface TileProps {
  className?: string;
  accent: AccentTone;
  icon: typeof Activity;
  title: string;
  children: React.ReactNode;
}

function Tile({ className, accent, icon: Icon, title, children }: TileProps) {
  const tone = TONE_CLASSES[accent];
  return (
    <section
      className={cn(
        "glass relative flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-2xl p-4 ring-1",
        tone.ring,
        className,
      )}
    >
      <header className="flex shrink-0 items-center gap-2">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md", tone.bg)}>
          <Icon className={cn("h-3.5 w-3.5", tone.text)} strokeWidth={1.8} />
        </span>
        <h2 className={cn("font-mono text-[10px] uppercase tracking-[0.3em]", tone.text)}>
          {title}
        </h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">{children}</div>
    </section>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[8px] uppercase tracking-[0.3em] text-muted-foreground/60">
        {label}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface-2/40 px-2.5 py-1.5">
      <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-muted-foreground/70">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-xl font-thin tabular-nums text-foreground">{value}</span>
        {sub && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

interface VitalProps {
  label: string;
  value: number | string;
  unit: string;
  tone: AccentTone;
  icon?: typeof Heart;
}

function Vital({ label, value, unit, tone, icon: Icon }: VitalProps) {
  const t = TONE_CLASSES[tone];
  return (
    <div className="rounded-lg border border-border/40 bg-surface-2/40 px-2 py-1.5">
      <div className="flex items-center gap-1">
        {Icon && <Icon className={cn("h-3 w-3", t.text)} strokeWidth={1.8} />}
        <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-muted-foreground/70">
          {label}
        </span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-thin tabular-nums text-foreground">{value}</span>
        {unit && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border/40 bg-surface-2/40 px-2 py-1">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">{value}</span>
    </div>
  );
}
