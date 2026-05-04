import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ScanLine,
  ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaseItem, ImagingView, PatientImagingStudy } from "./cases";

/**
 * Imperative handle exposed to AwakeDashboard so voice tools (next view,
 * prev view, show specific view, zoom, reset) can drive the viewer.
 */
export interface PatientXraysHandle {
  nextView: () => void;
  prevView: () => void;
  showView: (query: string) => boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  study: PatientImagingStudy;
  activeCase: CaseItem;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.5;

function modalityLabel(m: ImagingView["modality"]): string {
  return m === "XR" ? "Radiograph" : m === "CT" ? "Computed Tomography" : "Magnetic Resonance";
}

/**
 * Resolve a free-text view query ("AP", "axillary", "the MRI", "lateral",
 * "y view") to one of the views in the study. Returns the matched index
 * or -1 when nothing reasonable matches.
 */
function resolveView(views: ImagingView[], query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return -1;

  // Direct id match first.
  const byId = views.findIndex((v) => v.id.toLowerCase() === q);
  if (byId >= 0) return byId;

  // Whole-label match.
  const byLabel = views.findIndex((v) => v.label.toLowerCase() === q);
  if (byLabel >= 0) return byLabel;

  // Modality keywords.
  if (/\b(mri|mr|arthrogram)\b/.test(q)) {
    const i = views.findIndex((v) => v.modality === "MRI" || v.label.toLowerCase().includes("mr"));
    if (i >= 0) return i;
  }
  if (/\b(ct|cat|3d)\b/.test(q)) {
    const i = views.findIndex((v) => v.modality === "CT");
    if (i >= 0) return i;
  }

  // View-name keywords.
  const map: Array<[RegExp, string]> = [
    [/\bgrashey\b/, "grashey"],
    [/\b(ap|anteroposterior|front)\b/, "ap"],
    [/\b(axil|axillary)\b/, "axil"],
    [/\b(scapular y|y view|outlet|y projection)\b/, "y"],
    [/\bwest\s*point\b/, "westpoint"],
    [/\bstryker\b/, "stryker"],
    [/\bcoronal\b/, "coronal"],
    [/\bsagittal\b/, "sagittal"],
    [/\baxial\b/, "axial"],
  ];
  for (const [pattern, key] of map) {
    if (pattern.test(q)) {
      const i = views.findIndex((v) => v.label.toLowerCase().includes(key));
      if (i >= 0) return i;
    }
  }

  // Final fallback: first label whose words overlap with the query.
  return views.findIndex((v) => q.split(/\s+/).some((w) => v.label.toLowerCase().includes(w)));
}

export const PatientXraysModal = forwardRef<PatientXraysHandle, Props>(function PatientXraysModal(
  { open, onClose, study, activeCase },
  ref,
) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Drag state — kept in refs so re-renders during drag don't restart it.
  const dragStartRef = useRef<{ x: number; y: number; pan: { x: number; y: number } } | null>(
    null,
  );

  const activeView = study.views[activeIndex] ?? study.views[0];

  // Reset to first view + neutral zoom every time the modal opens.
  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [open, study]);

  // Reset zoom/pan whenever the active view changes — mirrors how PACS
  // viewers reset window/level when you advance to a new image.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activeIndex]);

  // Keyboard: Esc closes, ←/→ for view nav.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight")
        setActiveIndex((i) => Math.min(i + 1, study.views.length - 1));
      else if (e.key === "ArrowLeft") setActiveIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, study.views.length]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (zoom <= 1) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragStartRef.current = { x: e.clientX, y: e.clientY, pan: { ...pan } };
    },
    [zoom, pan],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    setPan({ x: start.pan.x + (e.clientX - start.x), y: start.pan.y + (e.clientY - start.y) });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    dragStartRef.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  }, []);
  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const next = Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2));
      // Snap pan back to center when fully zoomed out.
      if (next === ZOOM_MIN) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);
  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useImperativeHandle(
    ref,
    (): PatientXraysHandle => ({
      nextView: () => setActiveIndex((i) => Math.min(i + 1, study.views.length - 1)),
      prevView: () => setActiveIndex((i) => Math.max(i - 1, 0)),
      showView: (query: string) => {
        const idx = resolveView(study.views, query);
        if (idx < 0) return false;
        setActiveIndex(idx);
        return true;
      },
      zoomIn,
      zoomOut,
      resetZoom,
    }),
    [study.views, zoomIn, zoomOut, resetZoom],
  );

  const dob = useMemo(() => `DOB ${activeCase.patientAgeSex}`, [activeCase.patientAgeSex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="xrays-root"
          role="dialog"
          aria-modal
          aria-label={`${activeCase.patientName} — imaging`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex h-[calc(100vh-3rem)] w-full max-w-7xl overflow-hidden rounded-3xl border border-border/40 bg-[#05070a] shadow-[0_0_60px_-10px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── PACS viewport (left) ───────────────────────────────── */}
            <div className="relative flex min-w-0 flex-1 flex-col">
              {/* Patient banner — never ambiguous which patient.
                  Color-coded (accent) so it visually anchors the screen. */}
              <div className="flex shrink-0 items-center justify-between border-b border-border/40 bg-surface/30 px-6 py-3 backdrop-blur">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <ScanLine className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-light text-foreground">
                      {activeCase.patientName}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {activeCase.patientMrn} · {activeCase.patientAgeSex} · {dob}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-accent">
                    {study.protocol}
                  </span>
                  <button
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Image viewport — dark, with DICOM-style overlays */}
              <div
                className={cn(
                  "relative flex-1 overflow-hidden bg-black",
                  zoom > 1 ? "cursor-grab" : "cursor-default",
                )}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: "center",
                    transition: dragStartRef.current ? "none" : "transform 180ms ease-out",
                  }}
                >
                  <img
                    src={activeView.src}
                    alt={`${activeView.label} · ${study.bodyRegion}`}
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                  />
                </div>

                {/* Top-left overlay: patient demographics */}
                <div className="pointer-events-none absolute left-4 top-4 font-mono text-[11px] leading-tight tracking-wider text-white/85">
                  <div className="text-[12px] tracking-normal">{activeCase.patientName}</div>
                  <div>{activeCase.patientMrn}</div>
                  <div>{activeCase.patientAgeSex}</div>
                </div>

                {/* Top-right overlay: study metadata */}
                <div className="pointer-events-none absolute right-4 top-4 text-right font-mono text-[11px] leading-tight tracking-wider text-white/85">
                  <div className="text-[12px] tracking-normal">{activeView.modality}</div>
                  <div>{study.studyDate}</div>
                  <div className="text-white/55">{study.accession}</div>
                </div>

                {/* Bottom-left overlay: view label */}
                <div className="pointer-events-none absolute left-4 bottom-4 font-mono text-[11px] leading-tight uppercase tracking-wider text-white/85">
                  <div className="text-[12px] normal-case tracking-normal">{activeView.label}</div>
                  <div className="text-white/55">{study.bodyRegion}</div>
                  {activeView.description && (
                    <div className="text-white/55 normal-case tracking-normal">
                      {activeView.description}
                    </div>
                  )}
                </div>

                {/* Bottom-right overlay: BIG laterality marker — the
                    single most important pre-incision check. PACS
                    viewers traditionally render this as a giant L/R
                    so wrong-side surgery is impossible at a glance. */}
                <div className="pointer-events-none absolute bottom-4 right-4 flex items-end">
                  <span
                    className={cn(
                      "font-mono text-7xl font-bold leading-none tracking-tighter",
                      study.laterality === "R" ? "text-emerald-300/80" : "text-amber-300/80",
                    )}
                  >
                    {study.laterality}
                  </span>
                </div>

                {/* Zoom indicator */}
                {zoom > 1 && (
                  <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/80 backdrop-blur-sm">
                    {zoom.toFixed(1)}×
                  </div>
                )}
              </div>

              {/* Transport row */}
              <div className="flex shrink-0 items-center justify-between border-t border-border/40 bg-surface/30 px-6 py-3 backdrop-blur">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveIndex((i) => Math.max(i - 1, 0))}
                    disabled={activeIndex === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-30"
                    title="Previous view"
                    aria-label="Previous view"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveIndex((i) => Math.min(i + 1, study.views.length - 1))
                    }
                    disabled={activeIndex === study.views.length - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-30"
                    title="Next view"
                    aria-label="Next view"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    View {activeIndex + 1} / {study.views.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={zoomOut}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-30"
                    disabled={zoom <= ZOOM_MIN}
                    title="Zoom out"
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    onClick={resetZoom}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    title="Reset view"
                    aria-label="Reset view"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={zoomIn}
                    disabled={zoom >= ZOOM_MAX}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-30"
                    title="Zoom in"
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Thumbnail strip */}
              <div className="shrink-0 border-t border-border/40 bg-surface/40 px-6 py-3 backdrop-blur">
                <div className="flex gap-3 overflow-x-auto">
                  {study.views.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setActiveIndex(i)}
                      className={cn(
                        "group relative flex h-20 w-28 shrink-0 flex-col overflow-hidden rounded-lg border-2 bg-black transition-all",
                        i === activeIndex
                          ? "border-accent shadow-[0_0_18px_-4px_var(--accent)]"
                          : "border-border/40 hover:border-primary/40",
                      )}
                      title={`${v.label} · ${v.modality}`}
                    >
                      <img
                        src={v.src}
                        alt={v.label}
                        className="h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-95"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white/85">
                        <span className="truncate">{v.label}</span>
                        <span className="ml-1 text-white/55">{v.modality}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice hints */}
              <div className="shrink-0 border-t border-border/40 bg-surface-2/50 px-6 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Voice <span className="text-primary">›</span> "next view" · "show the AP" · "show
                the MRI" · "zoom in" · "reset" · "close X-rays"
              </div>
            </div>

            {/* ── Findings panel (right) ─────────────────────────────── */}
            <aside
              data-scroll-modal
              className="hidden w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border/40 bg-surface-2/40 lg:flex"
            >
              <div className="sticky top-0 z-10 border-b border-border/40 bg-surface-2/95 px-5 py-4 backdrop-blur">
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                  Radiology read
                </div>
                <div className="mt-0.5 text-sm font-light text-foreground/80">
                  {study.bodyRegion} · {study.studyDate}
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="rounded-2xl border border-border/40 bg-surface-3/40 p-4">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-accent">
                    <ScanSearch className="h-3.5 w-3.5" />
                    {activeView.label} · {modalityLabel(activeView.modality)}
                  </div>
                  {activeView.description && (
                    <div className="mt-1 text-[11px] font-light text-muted-foreground">
                      {activeView.description}
                    </div>
                  )}
                  <div className="mt-3 text-sm font-light leading-relaxed text-foreground/85">
                    {activeView.findings ?? "No formal read on file for this view."}
                  </div>
                </div>

                {/* Always-visible study summary */}
                <div className="rounded-2xl border border-border/30 bg-surface-3/20 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Study
                  </div>
                  <dl className="mt-2 space-y-1.5 text-[11px]">
                    {[
                      ["Patient", activeCase.patientName],
                      ["MRN", activeCase.patientMrn],
                      ["Body region", study.bodyRegion],
                      ["Side", study.laterality === "R" ? "Right" : "Left"],
                      ["Study date", study.studyDate],
                      ["Accession", study.accession],
                      ["Views", String(study.views.length)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right font-light text-foreground/85">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </aside>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
