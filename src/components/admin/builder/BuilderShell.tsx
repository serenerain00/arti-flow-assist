import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import gsap from "gsap";
import {
  ArrowLeft,
  ChevronDown,
  LogOut,
  PanelRight,
  PanelRightClose,
  Rocket,
  Save,
  SidebarOpen,
} from "lucide-react";
import { Canvas } from "./Canvas";
import { Palette } from "./Palette";
import { PhaseTabs } from "./PhaseTabs";
import { PublishModal } from "./PublishModal";
import { SaveDialog } from "./SaveDialog";
import { ClockWidget } from "./widgets/ClockWidget";
import { TimerWidget } from "./widgets/TimerWidget";
import { StopwatchWidget } from "./widgets/StopwatchWidget";
import { ArtiWidget } from "./widgets/ArtiWidget";
import { CarouselWidget } from "./widgets/CarouselWidget";
import { ImageWidget } from "./widgets/ImageWidget";
import { PrefCardTextWidget } from "./widgets/PrefCardTextWidget";
import { PacsWidget } from "./widgets/PacsWidget";
import { ProcedurePlanningWidget } from "./widgets/ProcedurePlanningWidget";
import { makeWidgetId } from "./storage";
import {
  PHASES,
  RESERVED_WIDGET_TYPES,
  WIDGET_META,
  gridSpan,
  type Dashboard,
  type Phase,
  type PhaseLayouts,
  type WidgetConfig,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
} from "./types";
import type { PrefCardImage, Procedure, Surgeon } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  dashboard: Dashboard;
  procedures: Procedure[];
  surgeons: Surgeon[];
  images: PrefCardImage[];
  sidebarHidden: boolean;
  onShowSidebar: () => void;
  onUpdate: (patch: Partial<Dashboard>) => void;
  onBackToList: () => void;
  onSaveAsTemplate: (name: string) => void;
}

interface DragInfo {
  source: "palette" | "canvas";
  widgetType?: WidgetType;
  widgetId?: string;
  overId: string | null;
}

function defaultConfig(type: WidgetType): WidgetConfig {
  if (type === "timer") return { durationSec: 300, label: "Timer" };
  if (type === "stopwatch") return { label: "Stopwatch" };
  if (type === "carousel" || type === "image" || type === "prefcard-text") {
    return { source: "procedure" };
  }
  return {};
}

/** Inject reserved widgets if missing — runs against the dashboard's own
 *  layouts on first mount so PACS + Procedure Planning are always present. */
export function ensureReservedWidgets(layouts: PhaseLayouts): PhaseLayouts {
  const next: PhaseLayouts = {
    preop: [...layouts.preop],
    intraop: [...layouts.intraop],
    postop: [...layouts.postop],
  };
  let changed = false;
  for (const phase of PHASES) {
    const list = next[phase];
    const missing = RESERVED_WIDGET_TYPES.filter((type) => !list.some((w) => w.type === type));
    if (missing.length === 0) continue;
    const seeded: WidgetInstance[] = missing.map((type) => ({
      id: makeWidgetId(),
      type,
      size: WIDGET_META[type].defaultSize,
      config: defaultConfig(type),
    }));
    next[phase] = [...seeded, ...list];
    changed = true;
  }
  return changed ? next : layouts;
}

export function BuilderShell({
  dashboard,
  procedures,
  surgeons,
  images,
  sidebarHidden,
  onShowSidebar,
  onUpdate,
  onBackToList,
  onSaveAsTemplate,
}: Props) {
  const [activePhase, setActivePhase] = useState<Phase>("preop");
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [saveOpen, setSaveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<DragInfo | null>(null);

  // On mount or when switching dashboards, ensure reserved widgets exist.
  useEffect(() => {
    const seeded = ensureReservedWidgets(dashboard.layouts);
    if (seeded !== dashboard.layouts) onUpdate({ layouts: seeded });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.id]);

  const layouts = dashboard.layouts;
  const widgets = layouts[activePhase];

  const persist = (nextWidgets: WidgetInstance[]) => {
    const nextLayouts: PhaseLayouts = { ...layouts, [activePhase]: nextWidgets };
    onUpdate({ layouts: nextLayouts });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === "palette") {
      setDragInfo({
        source: "palette",
        widgetType: data.widgetType as WidgetType,
        overId: null,
      });
    } else {
      setDragInfo({ source: "canvas", widgetId: String(event.active.id), overId: null });
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    setDragInfo((prev) =>
      prev ? { ...prev, overId: event.over?.id ? String(event.over.id) : null } : prev,
    );
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragInfo(null);
    if (!over) return;

    const fromPalette = active.data.current?.source === "palette";

    if (fromPalette) {
      const widgetType = active.data.current?.widgetType as WidgetType | undefined;
      if (!widgetType) return;
      const meta = WIDGET_META[widgetType];
      const next: WidgetInstance = {
        id: makeWidgetId(),
        type: widgetType,
        size: meta.defaultSize,
        config: defaultConfig(widgetType),
      };
      if (over.id === "canvas-dropzone") {
        persist([...widgets, next]);
        return;
      }
      const overIndex = widgets.findIndex((w) => w.id === over.id);
      if (overIndex < 0) {
        persist([...widgets, next]);
      } else {
        const copy = [...widgets];
        copy.splice(overIndex, 0, next);
        persist(copy);
      }
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        persist(arrayMove(widgets, oldIndex, newIndex));
      }
    }
  };

  const onDragCancel = () => setDragInfo(null);

  const removeWidget = (id: string) => persist(widgets.filter((w) => w.id !== id));
  const resizeWidget = (id: string, size: WidgetSize) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, size } : w)));
  const configWidget = (id: string, patch: Partial<WidgetConfig>) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, config: { ...w.config, ...patch } } : w)));

  const totalWidgets = layouts.preop.length + layouts.intraop.length + layouts.postop.length;
  const userAddedWidgets =
    layouts.preop.filter((w) => !RESERVED_WIDGET_TYPES.includes(w.type)).length +
    layouts.intraop.filter((w) => !RESERVED_WIDGET_TYPES.includes(w.type)).length +
    layouts.postop.filter((w) => !RESERVED_WIDGET_TYPES.includes(w.type)).length;

  // "Confirmed" tracks whether the user has clicked Save since the last edit.
  // Auto-save persists every change behind the scenes; this state is purely
  // for the explicit-confirmation UX — disable the button after a successful
  // save until the next change re-enables it.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    setConfirmed(false);
  }, [dashboard.updatedAt]);

  // Templates can be saved as-is (the reserved widgets alone are a valid
  // starting layout). Procedure dashboards require user-added widgets so
  // the Save button isn't a no-op against the auto-seeded defaults.
  const baseCanSave = dashboard.isTemplate ? true : userAddedWidgets > 0;
  const canSave = baseCanSave && !confirmed;

  // Auto-save persists every edit; clicking Save just flashes a confirmation
  // and locks the button until the next change.
  const handleSave = () => {
    setConfirmed(true);
    setSavedFlash(dashboard.name);
    window.setTimeout(() => setSavedFlash(null), 2400);
  };

  const handleSaveAndExit = () => {
    setConfirmed(true);
    // Auto-save already persisted; just exit back to the dashboards list.
    onBackToList();
  };

  const handleSaveAsTemplateClick = () => {
    setSaveOpen(true);
  };

  const handleSaveAsTemplate = (name: string) => {
    onSaveAsTemplate(name);
    setSaveOpen(false);
    setSavedFlash(name);
    window.setTimeout(() => setSavedFlash(null), 2400);
  };

  // Publish marks the dashboard as published, locks the Save button via
  // confirmed, and opens the modal that offers a "Preview in new tab" link.
  const handlePublish = () => {
    onUpdate({ published: true, publishedAt: Date.now() });
    setConfirmed(true);
    setPublishOpen(true);
  };

  const handlePreviewInNewTab = () => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    window.open(`${origin}/?preview=${dashboard.id}`, "_blank", "noopener,noreferrer");
  };

  // Compute palette insertion index based on overId during palette drag.
  const paletteInsertIndex = useMemo(() => {
    if (!dragInfo || dragInfo.source !== "palette") return null;
    if (!dragInfo.overId || dragInfo.overId === "canvas-dropzone") return widgets.length;
    const idx = widgets.findIndex((w) => w.id === dragInfo.overId);
    return idx >= 0 ? idx : widgets.length;
  }, [dragInfo, widgets]);

  // Context strings for the topbar.
  const surgeon = dashboard.surgeonId
    ? surgeons.find((s) => s.id === dashboard.surgeonId)
    : undefined;
  const procedure = dashboard.procedureId
    ? procedures.find((p) => p.id === dashboard.procedureId)
    : undefined;
  const contextLabel = dashboard.isTemplate
    ? "Template"
    : surgeon && procedure
      ? `${surgeon.firstName} ${surgeon.lastName} · ${procedure.name}`
      : "Dashboard";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-background"
        style={{
          display: "grid",
          gridTemplateColumns: `1fr ${paletteOpen ? "18rem" : "0px"}`,
          transition: "grid-template-columns 0.42s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <TopBar
            sidebarHidden={sidebarHidden}
            onShowSidebar={onShowSidebar}
            onBack={onBackToList}
            paletteOpen={paletteOpen}
            onTogglePalette={() => setPaletteOpen((v) => !v)}
            onSave={handleSave}
            onSaveAndExit={handleSaveAndExit}
            onSaveAsTemplate={handleSaveAsTemplateClick}
            onPublish={handlePublish}
            canSave={canSave}
            contextLabel={contextLabel}
            dashboardName={dashboard.name}
            isTemplate={dashboard.isTemplate}
            onRename={(name) => onUpdate({ name })}
            totalWidgets={totalWidgets}
            savedFlash={savedFlash}
          />
          <PhaseTabs active={activePhase} layouts={layouts} onChange={setActivePhase} />
          <Canvas
            phase={activePhase}
            widgets={widgets}
            procedures={procedures}
            surgeons={surgeons}
            images={images}
            draggingId={dragInfo?.source === "canvas" ? (dragInfo.widgetId ?? null) : null}
            palettePreview={dragInfo?.source === "palette" ? (dragInfo.widgetType ?? null) : null}
            paletteInsertIndex={paletteInsertIndex}
            onRemoveWidget={removeWidget}
            onResizeWidget={resizeWidget}
            onConfigWidget={configWidget}
          />
        </div>
        <Palette open={paletteOpen} />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragInfo ? (
          <DragGhost
            dragInfo={dragInfo}
            widgets={widgets}
            procedures={procedures}
            images={images}
          />
        ) : null}
      </DragOverlay>

      <SaveDialog
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onSave={handleSaveAsTemplate}
      />

      <PublishModal
        open={publishOpen}
        dashboardName={dashboard.name}
        onPreview={handlePreviewInNewTab}
        onClose={() => setPublishOpen(false)}
      />
    </DndContext>
  );
}

function DragGhost({
  dragInfo,
  widgets,
  procedures,
  images,
}: {
  dragInfo: DragInfo;
  widgets: WidgetInstance[];
  procedures: Procedure[];
  images: PrefCardImage[];
}) {
  if (dragInfo.source === "palette" && dragInfo.widgetType) {
    const meta = WIDGET_META[dragInfo.widgetType];
    return (
      <div className="flex items-center gap-3 rounded-xl border border-primary/60 bg-popover px-4 py-3 shadow-2xl">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-surface-2 text-primary">
          <meta.icon className="h-4 w-4" strokeWidth={1.7} />
        </div>
        <div className="text-sm font-medium text-foreground">{meta.label}</div>
      </div>
    );
  }
  if (dragInfo.source === "canvas" && dragInfo.widgetId) {
    const widget = widgets.find((w) => w.id === dragInfo.widgetId);
    if (!widget) return null;
    const span = gridSpan(widget.size);
    const procedure =
      widget.config.source !== "custom" && widget.config.procedureId
        ? procedures.find((p) => p.id === widget.config.procedureId)
        : undefined;
    const procImages = procedure ? images.filter((i) => i.procedureId === procedure.id) : [];
    const isCustom = widget.config.source === "custom";
    const customImages = widget.config.customImages ?? [];
    const carouselImages = isCustom ? customImages : procImages;
    const displayImage = isCustom
      ? customImages[0]
      : widget.config.imageId
        ? images.find((i) => i.id === widget.config.imageId)
        : procImages[0];
    const html = isCustom ? widget.config.customHtml : procedure?.prefCardHtml;
    return (
      <div
        className="overflow-hidden rounded-2xl border-2 border-primary/80 bg-surface/80 shadow-2xl"
        style={{
          width: 160 * span.col,
          height: 140 * span.row,
        }}
      >
        <div className="relative h-full w-full">
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
            <ImageWidget size={widget.size} image={displayImage} />
          )}
          {widget.type === "prefcard-text" && <PrefCardTextWidget size={widget.size} html={html} />}
          {widget.type === "pacs" && <PacsWidget size={widget.size} />}
          {widget.type === "procedure-planning" && <ProcedurePlanningWidget size={widget.size} />}
        </div>
      </div>
    );
  }
  return null;
}

function TopBar({
  sidebarHidden,
  onShowSidebar,
  onBack,
  paletteOpen,
  onTogglePalette,
  onSave,
  onSaveAndExit,
  onSaveAsTemplate,
  onPublish,
  canSave,
  contextLabel,
  dashboardName,
  isTemplate,
  onRename,
  totalWidgets,
  savedFlash,
}: {
  sidebarHidden: boolean;
  onShowSidebar: () => void;
  onBack: () => void;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onSave: () => void;
  onSaveAndExit: () => void;
  onSaveAsTemplate: () => void;
  onPublish: () => void;
  canSave: boolean;
  contextLabel: string;
  dashboardName: string;
  isTemplate: boolean;
  onRename: (name: string) => void;
  totalWidgets: number;
  savedFlash: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dashboardName);

  useEffect(() => setDraft(dashboardName), [dashboardName]);

  useEffect(() => {
    if (!savedFlash) return;
    const el = document.getElementById("save-flash");
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 6, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.32, ease: "back.out(1.4)" },
    );
  }, [savedFlash]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== dashboardName) onRename(trimmed);
    else setDraft(dashboardName);
    setEditing(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-surface/40 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {sidebarHidden && (
          <button
            type="button"
            onClick={onShowSidebar}
            aria-label="Show sidebar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface-2/60 text-foreground transition-colors hover:bg-surface-2"
          >
            <SidebarOpen className="h-4 w-4" strokeWidth={1.7} />
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to dashboards"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface-2/60 text-foreground transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
        </button>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
            {contextLabel}
          </div>
          {editing ? (
            <input
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setDraft(dashboardName);
                  setEditing(false);
                }
              }}
              className="mt-0.5 w-full rounded-md border border-border/60 bg-surface-2/60 px-2 py-0.5 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => isTemplate && setEditing(true)}
              disabled={!isTemplate}
              className={cn(
                "block text-left text-sm font-light text-foreground",
                isTemplate ? "rounded-md px-1 -mx-1 hover:bg-surface-2/60" : "cursor-default",
              )}
              title={isTemplate ? "Click to rename" : undefined}
            >
              {dashboardName || (isTemplate ? "Untitled template" : "Dashboard")}
            </button>
          )}
          <div className="mt-0.5 text-xs font-light text-muted-foreground">
            {totalWidgets === 0
              ? "Empty across all phases"
              : `${totalWidgets} widget${totalWidgets === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {savedFlash && (
          <div
            id="save-flash"
            className="rounded-full bg-success/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-success"
          >
            Saved · {savedFlash}
          </div>
        )}
        {!isTemplate && (
          <button
            type="button"
            onClick={onSaveAsTemplate}
            disabled={!canSave}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] transition-all",
              canSave
                ? "border-border/60 bg-surface-2/60 text-foreground hover:bg-surface-2"
                : "cursor-not-allowed border-border/40 bg-surface-2/40 text-muted-foreground",
            )}
          >
            <Save className="h-3 w-3" strokeWidth={2} />
            Save as template
          </button>
        )}
        {isTemplate ? (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] transition-all",
                canSave
                  ? "border-border/60 bg-surface-2/60 text-foreground hover:bg-surface-2"
                  : "cursor-not-allowed border-border/40 bg-surface-2/40 text-muted-foreground",
              )}
            >
              <Save className="h-3 w-3" strokeWidth={2} />
              Save template
            </button>
            <button
              type="button"
              onClick={onPublish}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
            >
              <Rocket className="h-3 w-3" strokeWidth={2} />
              Publish
            </button>
          </>
        ) : (
          <SplitSaveButton
            canSave={canSave}
            onSave={onSave}
            onSaveAndExit={onSaveAndExit}
          />
        )}
        <button
          type="button"
          onClick={onTogglePalette}
          aria-label={paletteOpen ? "Hide widget palette" : "Show widget palette"}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-surface-2/60 text-foreground transition-colors hover:bg-surface-2"
        >
          {paletteOpen ? (
            <PanelRightClose className="h-4 w-4" strokeWidth={1.7} />
          ) : (
            <PanelRight className="h-4 w-4" strokeWidth={1.7} />
          )}
        </button>
      </div>
    </div>
  );
}

function SplitSaveButton({
  canSave,
  onSave,
  onSaveAndExit,
}: {
  canSave: boolean;
  onSave: () => void;
  onSaveAndExit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          if (!canSave) return;
          onSave();
        }}
        disabled={!canSave}
        className={cn(
          "inline-flex items-center gap-2 rounded-l-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] transition-all",
          canSave
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
            : "cursor-not-allowed border border-r-0 border-border/60 bg-surface-2/60 text-muted-foreground",
        )}
      >
        <Save className="h-3 w-3" strokeWidth={2} />
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          if (!canSave) return;
          setOpen((v) => !v);
        }}
        disabled={!canSave}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More save options"
        className={cn(
          "inline-flex items-center justify-center rounded-r-full px-2 py-1.5 transition-all",
          canSave
            ? "bg-primary text-primary-foreground hover:bg-primary/80"
            : "cursor-not-allowed border border-border/60 bg-surface-2/60 text-muted-foreground",
          // Keep a subtle divider so the chevron reads as a distinct button.
          canSave && "border-l border-primary-foreground/20",
        )}
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-border/60 bg-popover shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSaveAndExit();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-light text-popover-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
            Save and exit
          </button>
        </div>
      )}
    </div>
  );
}
