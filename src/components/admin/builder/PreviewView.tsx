import { useEffect, useMemo, useState } from "react";
import { loadDashboards } from "./storage";
import {
  loadImages,
  loadProcedures,
  loadSurgeons,
} from "../storage";
import { loadLiveCase, subscribeLiveCase, type LiveCaseState } from "./liveCase";
import { startWallHeartbeat } from "./wallPresence";
import { ClockWidget } from "./widgets/ClockWidget";
import { TimerWidget } from "./widgets/TimerWidget";
import { StopwatchWidget } from "./widgets/StopwatchWidget";
import { ArtiWidget } from "./widgets/ArtiWidget";
import { CarouselWidget } from "./widgets/CarouselWidget";
import { PrefCardImageWidget } from "./widgets/PrefCardImageWidget";
import { PrefCardTextWidget } from "./widgets/PrefCardTextWidget";
import { PacsWidget } from "./widgets/PacsWidget";
import { ProcedurePlanningWidget } from "./widgets/ProcedurePlanningWidget";
import {
  PHASES,
  PHASE_LABEL,
  gridSpan,
  type Dashboard,
  type Phase,
  type WidgetInstance,
} from "./types";
import type { PrefCardImage, Procedure, Surgeon } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  dashboardId: string;
}

interface DisplayImage {
  id: string;
  name: string;
  dataUrl: string;
}

export function PreviewView({ dashboardId }: Props) {
  const [allDashboards, setAllDashboards] = useState<Dashboard[]>([]);
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [images, setImages] = useState<PrefCardImage[]>([]);
  const [activePhase, setActivePhase] = useState<Phase>("preop");
  const [loaded, setLoaded] = useState(false);
  const [liveCase, setLiveCase] = useState<LiveCaseState>({
    active: false,
    dashboardId: null,
    currentPhase: "preop",
    updatedAt: 0,
  });

  useEffect(() => {
    setAllDashboards(loadDashboards());
    setSurgeons(loadSurgeons());
    setProcedures(loadProcedures());
    setImages(loadImages());
    setLiveCase(loadLiveCase());
    setLoaded(true);
    // Listen to the controller tab so phase + active-dashboard changes
    // there flow to this tab in real time.
    const unsubLive = subscribeLiveCase(setLiveCase);
    // Heartbeat presence so the controller can grey out "Open wall display"
    // while this tab is open.
    const stopHeartbeat = startWallHeartbeat();
    return () => {
      unsubLive();
      stopHeartbeat();
    };
  }, []);

  // When live case is active and points at a dashboard, that takes priority
  // over the dashboard from the URL — the controller is in charge.
  const effectiveDashboardId =
    liveCase.active && liveCase.dashboardId ? liveCase.dashboardId : dashboardId;
  const dashboard = useMemo(
    () => allDashboards.find((d) => d.id === effectiveDashboardId) ?? null,
    [allDashboards, effectiveDashboardId],
  );

  // Phase: when live case is active, follow the controller; otherwise let
  // the local tab control it via the in-page phase tabs.
  const displayPhase = liveCase.active ? liveCase.currentPhase : activePhase;

  const surgeonLabel = useMemo(() => {
    if (!dashboard?.surgeonId) return null;
    const s = surgeons.find((x) => x.id === dashboard.surgeonId);
    if (!s) return null;
    return `Dr. ${s.firstName} ${s.lastName}`.trim();
  }, [dashboard, surgeons]);

  const procedureLabel = useMemo(() => {
    if (!dashboard?.procedureId) return null;
    const p = procedures.find((x) => x.id === dashboard.procedureId);
    return p?.name ?? null;
  }, [dashboard, procedures]);

  if (!loaded) {
    return <div className="fixed inset-0 bg-[#070b14]" />;
  }

  if (!dashboard) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#070b14] text-foreground">
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-muted-foreground">
            No dashboard
          </div>
          <h1 className="mt-3 text-2xl font-light text-foreground">Dashboard not found</h1>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            The dashboard may have been wiped or never saved.
          </p>
        </div>
      </div>
    );
  }

  const widgets = dashboard.layouts[displayPhase];

  return (
    <div className="fixed inset-0 flex flex-col bg-[#070b14] text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-white/5 px-8 py-4">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.5em]">
            <span className="text-primary">Arti · Wall</span>
            {liveCase.active && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-success">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                Live · controller
              </span>
            )}
          </div>
          <h1 className="mt-1 text-xl font-light text-foreground">
            {procedureLabel || dashboard.name}
            {surgeonLabel && (
              <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {surgeonLabel}
              </span>
            )}
          </h1>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {PHASES.map((phase) => {
            const isActive = displayPhase === phase;
            return (
              <button
                key={phase}
                type="button"
                onClick={() => {
                  if (liveCase.active) return;
                  setActivePhase(phase);
                }}
                disabled={liveCase.active && !isActive}
                title={liveCase.active ? "Controlled by the live case controller" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : liveCase.active
                      ? "cursor-not-allowed text-muted-foreground/40"
                      : "text-muted-foreground hover:text-foreground",
                )}
              >
                {PHASE_LABEL[phase]}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="relative min-h-0 flex-1 overflow-auto px-6 py-6">
        {widgets.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                {PHASE_LABEL[displayPhase]}
              </div>
              <h2 className="mt-2 text-lg font-light text-foreground">No widgets in this phase</h2>
            </div>
          </div>
        ) : (
          <div
            className="grid h-full w-full grid-cols-4 gap-3 auto-rows-[minmax(160px,_1fr)]"
            style={{ gridAutoFlow: "row dense" }}
          >
            {widgets.map((w) => (
              <PreviewCell
                key={w.id}
                widget={w}
                procedures={procedures}
                images={images}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PreviewCell({
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
      {widget.type === "prefcard-image" && (
        <PrefCardImageWidget size={widget.size} caption={caption} image={displayImage} />
      )}
      {widget.type === "prefcard-text" && (
        <PrefCardTextWidget size={widget.size} caption={caption} html={html} />
      )}
      {widget.type === "pacs" && <PacsWidget size={widget.size} />}
      {widget.type === "procedure-planning" && <ProcedurePlanningWidget size={widget.size} />}
    </div>
  );
}
