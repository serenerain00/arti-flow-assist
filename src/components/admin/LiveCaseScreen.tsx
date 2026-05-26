import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { Activity, ExternalLink, LayoutGrid } from "lucide-react";
import { ClockWidget } from "./builder/widgets/ClockWidget";
import { TimerWidget } from "./builder/widgets/TimerWidget";
import { StopwatchWidget } from "./builder/widgets/StopwatchWidget";
import { ArtiWidget } from "./builder/widgets/ArtiWidget";
import { CarouselWidget } from "./builder/widgets/CarouselWidget";
import { ImageWidget } from "./builder/widgets/ImageWidget";
import { PrefCardTextWidget } from "./builder/widgets/PrefCardTextWidget";
import { PacsWidget } from "./builder/widgets/PacsWidget";
import { ProcedurePlanningWidget } from "./builder/widgets/ProcedurePlanningWidget";
import { TimeoutChecklistWidget } from "./builder/widgets/TimeoutChecklistWidget";
import {
  PHASES,
  PHASE_LABEL,
  gridSpan,
  type Dashboard,
  type Phase,
  type WidgetInstance,
} from "./builder/types";
import { subscribeWallPresence } from "./builder/wallPresence";
import type { PrefCardImage, Procedure, Surgeon } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  dashboards: Dashboard[];
  surgeons: Surgeon[];
  procedures: Procedure[];
  images: PrefCardImage[];
  activeDashboardId: string | null;
  currentPhase: Phase;
  onSelectDashboard: (id: string) => void;
  onSelectPhase: (phase: Phase) => void;
}

interface DisplayImage {
  id: string;
  name: string;
  dataUrl: string;
}

export function LiveCaseScreen({
  dashboards,
  surgeons,
  procedures,
  images,
  activeDashboardId,
  currentPhase,
  onSelectDashboard,
  onSelectPhase,
}: Props) {
  // Any saved dashboard is fair game for a live case for now — when this is
  // wired to a real OR console the active surgeon + procedure will dictate
  // the pick. For local testing we just grab one at random on mount.
  const usable = useMemo(() => [...dashboards], [dashboards]);

  useEffect(() => {
    if (usable.length === 0) return;
    // Keep the current selection only if it still resolves to a real
    // dashboard. A persisted id from a prior session may point at one that
    // no longer exists — in that case fall through and pick a fresh one so
    // we never get stuck on the empty state.
    if (activeDashboardId && usable.some((d) => d.id === activeDashboardId)) return;
    const random = usable[Math.floor(Math.random() * usable.length)];
    onSelectDashboard(random.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable, activeDashboardId]);

  const active = useMemo(
    () => dashboards.find((d) => d.id === activeDashboardId) ?? null,
    [dashboards, activeDashboardId],
  );

  return (
    <motion.div
      key="live-case"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex h-full w-full overflow-hidden"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 22rem",
      }}
    >
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <TopBar dashboard={active} surgeons={surgeons} procedures={procedures} />
        {active ? (
          <WallView
            dashboard={active}
            phase={currentPhase}
            procedures={procedures}
            images={images}
          />
        ) : (
          <NoDashboardState />
        )}
      </div>
      <PhaseDrawer
        dashboards={usable}
        surgeons={surgeons}
        procedures={procedures}
        activeId={activeDashboardId}
        onSelectDashboard={onSelectDashboard}
        currentPhase={currentPhase}
        onSelectPhase={onSelectPhase}
        activeDashboard={active}
      />
    </motion.div>
  );
}

function TopBar({
  dashboard,
  surgeons,
  procedures,
}: {
  dashboard: Dashboard | null;
  surgeons: Surgeon[];
  procedures: Procedure[];
}) {
  let context = "No active dashboard";
  let title = "Live case";
  if (dashboard) {
    if (dashboard.surgeonId && dashboard.procedureId) {
      const s = surgeons.find((x) => x.id === dashboard.surgeonId);
      const p = procedures.find((x) => x.id === dashboard.procedureId);
      context = s ? `Dr. ${s.firstName} ${s.lastName}`.trim() : "Procedure dashboard";
      title = p?.name ?? dashboard.name;
    } else {
      context = "Template";
      title = dashboard.name;
    }
  }
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border bg-surface/40 px-6 py-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
          Live case · {context}
        </div>
        <div className="mt-0.5 text-sm font-light text-foreground">{title}</div>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-success">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Broadcasting
      </div>
    </div>
  );
}

function WallView({
  dashboard,
  phase,
  procedures,
  images,
}: {
  dashboard: Dashboard;
  phase: Phase;
  procedures: Procedure[];
  images: PrefCardImage[];
}) {
  const widgets = dashboard.layouts[phase];
  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-[#070b14] px-6 py-6">
      {widgets.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center text-center">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
              {PHASE_LABEL[phase]}
            </div>
            <h2 className="mt-2 text-lg font-light text-foreground">No widgets in this phase</h2>
          </div>
        </div>
      ) : (
        <div
          className="grid h-full w-full grid-cols-4 gap-3 auto-rows-[minmax(140px,_1fr)]"
          style={{ gridAutoFlow: "row dense" }}
        >
          {widgets.map((w) => (
            <WallCell key={w.id} widget={w} procedures={procedures} images={images} />
          ))}
        </div>
      )}
    </div>
  );
}

function WallCell({
  widget,
  procedures,
  images,
}: {
  widget: WidgetInstance;
  procedures: Procedure[];
  images: PrefCardImage[];
}) {
  const span = gridSpan(widget.size);
  const isCustom = widget.config.source === "custom";
  const procedure =
    !isCustom && widget.config.procedureId
      ? procedures.find((p) => p.id === widget.config.procedureId)
      : undefined;
  const procImages = procedure ? images.filter((i) => i.procedureId === procedure.id) : [];
  const customImages: DisplayImage[] = widget.config.customImages ?? [];
  const carouselImages = isCustom ? customImages : procImages;
  const displayImage = isCustom
    ? customImages[0]
    : widget.config.imageId
      ? images.find((i) => i.id === widget.config.imageId)
      : procImages[0];
  const html = isCustom ? widget.config.customHtml : procedure?.prefCardHtml;
  const caption = isCustom ? undefined : procedure?.name;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10 bg-surface/60"
      style={{ gridColumn: `span ${span.col}`, gridRow: `span ${span.row}` }}
    >
      {widget.type === "clock" && <ClockWidget size={widget.size} />}
      {widget.type === "timer" && (
        <TimerWidget
          size={widget.size}
          durationSec={widget.config.durationSec ?? 300}
          label={widget.config.label}
        />
      )}
      {widget.type === "stopwatch" && (
        <StopwatchWidget size={widget.size} label={widget.config.label} />
      )}
      {widget.type === "arti" && <ArtiWidget size={widget.size} />}
      {widget.type === "carousel" && (
        <CarouselWidget size={widget.size} images={carouselImages} />
      )}
      {widget.type === "image" && (
        <ImageWidget size={widget.size} caption={caption} image={displayImage} />
      )}
      {widget.type === "prefcard-text" && (
        <PrefCardTextWidget size={widget.size} caption={caption} html={html} />
      )}
      {widget.type === "pacs" && <PacsWidget size={widget.size} />}
      {widget.type === "procedure-planning" && <ProcedurePlanningWidget size={widget.size} />}
      {widget.type === "timeout-checklist" && <TimeoutChecklistWidget size={widget.size} />}
    </div>
  );
}

function NoDashboardState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
        <LayoutGrid className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-light text-foreground">No dashboards available</h2>
      <p className="max-w-md text-sm font-light text-muted-foreground">
        Build a procedure dashboard or publish a template, then come back here to drive the wall
        display.
      </p>
    </div>
  );
}

function PhaseDrawer({
  dashboards,
  surgeons,
  procedures,
  activeId,
  onSelectDashboard,
  currentPhase,
  onSelectPhase,
  activeDashboard,
}: {
  dashboards: Dashboard[];
  surgeons: Surgeon[];
  procedures: Procedure[];
  activeId: string | null;
  onSelectDashboard: (id: string) => void;
  currentPhase: Phase;
  onSelectPhase: (phase: Phase) => void;
  activeDashboard: Dashboard | null;
}) {
  const phaseListRef = useRef<HTMLDivElement | null>(null);
  const [wallOpen, setWallOpen] = useState(false);

  // Stagger-in phase cards on mount (matches the widget palette feel).
  useEffect(() => {
    const list = phaseListRef.current;
    if (!list) return;
    const cards = list.querySelectorAll("[data-phase-card]");
    gsap.fromTo(
      cards,
      { x: 28, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: "back.out(1.4)" },
    );
  }, [activeId]);

  // Detect if a wall display tab is already open via BroadcastChannel
  // heartbeats — disable the "Open wall display" button when one exists.
  useEffect(() => {
    return subscribeWallPresence(setWallOpen);
  }, []);

  const openPreviewInNewTab = () => {
    if (!activeId || wallOpen || typeof window === "undefined") return;
    const origin = window.location.origin;
    window.open(`${origin}/?preview=${activeId}`, "_blank", "noopener,noreferrer");
  };

  const buttonDisabled = !activeId || wallOpen;

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-border bg-surface/60">
      <div className="border-b border-border px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
          Phase control
        </div>
        <p className="mt-1 text-xs font-light text-muted-foreground">
          Pick the phase to broadcast to the wall display.
        </p>
      </div>

      <div ref={phaseListRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {PHASES.map((phase) => {
          const isCurrent = currentPhase === phase;
          const count = activeDashboard?.layouts[phase].length ?? 0;
          return (
            <button
              key={phase}
              type="button"
              data-phase-card
              onClick={() => onSelectPhase(phase)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                isCurrent
                  ? "border-success/50 bg-success/10"
                  : "border-border/60 bg-surface-2/40 hover:border-primary/40 hover:bg-surface-2/70",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-primary",
                  isCurrent
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border/60 bg-surface-3/50",
                )}
              >
                <Activity className="h-4 w-4" strokeWidth={1.7} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{PHASE_LABEL[phase]}</span>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/50 bg-success/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                      </span>
                      Currently displayed
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs font-light text-muted-foreground">
                  {count} widget{count === 1 ? "" : "s"} in this phase
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {dashboards.length > 1 && (
        <div className="border-t border-border px-5 py-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            Active dashboard
          </div>
          <select
            value={activeId ?? ""}
            onChange={(e) => onSelectDashboard(e.target.value)}
            className="w-full appearance-none rounded-md border border-border/60 bg-surface-2/60 px-3 py-2 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
          >
            {dashboards.map((d) => {
              const s = d.surgeonId ? surgeons.find((x) => x.id === d.surgeonId) : null;
              const p = d.procedureId ? procedures.find((x) => x.id === d.procedureId) : null;
              const label =
                s && p
                  ? `${s.firstName} ${s.lastName} · ${p.name}`
                  : `${d.name}${d.isTemplate ? " (template)" : ""}`;
              return (
                <option key={d.id} value={d.id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div className="border-t border-border px-5 py-4">
        <button
          type="button"
          onClick={openPreviewInNewTab}
          disabled={buttonDisabled}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] transition-all",
            !buttonDisabled
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
              : "cursor-not-allowed border border-border/60 bg-surface-2/60 text-muted-foreground",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          {wallOpen ? "Wall display open" : "Open wall display"}
        </button>
        <p className="mt-2 text-[10px] font-light text-muted-foreground">
          {wallOpen
            ? "A wall display tab is already open. Close it to open a new one."
            : "Opens the wall view in a new tab. Phase changes here update the wall in real time."}
        </p>
      </div>
    </aside>
  );
}
