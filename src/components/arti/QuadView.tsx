import { useEffect, useLayoutEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { AlertStack } from "./AlertStack";
import { TeamRoster } from "./TeamRoster";
import type { InstrumentId, TimeOutId } from "./AwakeDashboard";
import { X, Maximize2, LayoutGrid } from "lucide-react";

export type QuadPanelId = "timeout" | "instruments" | "alerts" | "team";

interface Props {
  open: boolean;
  focused: QuadPanelId | null;
  onFocus: (id: QuadPanelId | null) => void;
  onClose: () => void;
  // panel data
  timeOutChecked: Set<TimeOutId>;
  toggleTimeOutItem: (id: TimeOutId) => void;
  counts: Record<InstrumentId, number>;
  adjustInstrumentCount: (id: InstrumentId, delta: number) => void;
  dismissedAlerts: Set<number>;
  dismissAlert: (i: number) => void;
}

const PANELS: { id: QuadPanelId; label: string }[] = [
  { id: "timeout", label: "Time-Out" },
  { id: "instruments", label: "Instrument Count" },
  { id: "alerts", label: "Alerts" },
  { id: "team", label: "Team" },
];

/**
 * Full-screen quad takeover (not a modal): replaces the dashboard while
 * the VoiceBar at the bottom of the screen remains visible. iOS-style
 * 2x2 grid that animates a single panel into focus when zoomed.
 */
export function QuadView({
  open,
  focused,
  onFocus,
  onClose,
  timeOutChecked,
  toggleTimeOutItem,
  counts,
  adjustInstrumentCount,
  dismissedAlerts,
  dismissAlert,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<Map<QuadPanelId, HTMLDivElement>>(new Map());

  // Esc to close / unfocus
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (focused) onFocus(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, focused, onFocus, onClose]);

  // Enter animation
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
      );
      gsap.fromTo(
        Array.from(tilesRef.current.values()),
        { y: 30, scale: 0.92, autoAlpha: 0 },
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.55,
          ease: "power3.out",
          stagger: 0.07,
        },
      );
    }, containerRef);
    return () => ctx.revert();
  }, [open]);

  // Focus / unfocus tile animation (FLIP-style)
  useLayoutEffect(() => {
    if (!open || !gridRef.current) return;
    const ctx = gsap.context(() => {
      tilesRef.current.forEach((el, id) => {
        const isFocused = focused === id;
        const isHidden = focused !== null && !isFocused;
        gsap.to(el, {
          autoAlpha: isHidden ? 0 : 1,
          scale: isHidden ? 0.85 : 1,
          duration: 0.45,
          ease: "power3.inOut",
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, [focused, open]);

  const renderPanel = (id: QuadPanelId) => {
    switch (id) {
      case "timeout":
        return (
          <TimeOutPanel
            checked={timeOutChecked as Set<string>}
            onToggle={(i) => toggleTimeOutItem(i as TimeOutId)}
          />
        );
      case "instruments":
        return (
          <InstrumentCount
            counts={counts}
            onAdjust={(i, d) => adjustInstrumentCount(i as InstrumentId, d)}
          />
        );
      case "alerts":
        return <AlertStack dismissed={dismissedAlerts} onDismiss={dismissAlert} />;
      case "team":
        return <TeamRoster />;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-30 flex flex-col bg-background"
        >
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-border/40 px-8 py-5">
            <div className="flex items-center gap-3">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {focused
                  ? `Focused · ${PANELS.find((p) => p.id === focused)?.label}`
                  : "Quad View · Overview"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {focused && (
                <button
                  onClick={() => onFocus(null)}
                  className="rounded-full bg-surface-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
                >
                  ← Back to overview
                </button>
              )}
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors"
                aria-label="Close quad view"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Grid — leaves room for the VoiceBar at the bottom */}
          <div
            ref={gridRef}
            className={cn(
              "min-h-0 flex-1 gap-4 px-6 py-4 pb-24",
              focused
                ? "no-scrollbar flex overflow-y-auto"
                : "grid grid-cols-2 grid-rows-2 overflow-hidden",
            )}
          >
            {PANELS.map(({ id, label }) => {
              const isFocused = focused === id;
              const isHidden = focused !== null && !isFocused;
              return (
                <div
                  key={id}
                  ref={(el) => {
                    if (el) tilesRef.current.set(id, el);
                    else tilesRef.current.delete(id);
                  }}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface-2 text-left transition-shadow",
                    "hover:border-primary/40 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]",
                    isFocused ? "w-full" : "min-h-0",
                    isHidden && "pointer-events-none hidden",
                  )}
                >
                  <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
                    <span className="rounded-full bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                      {label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFocus(isFocused ? null : id)}
                    className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background/70 text-muted-foreground backdrop-blur opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    aria-label={isFocused ? `Unfocus ${label}` : `Focus ${label}`}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <div
                    className={cn(
                      "min-h-0 flex-1 pt-10",
                      isFocused ? "overflow-visible" : "no-scrollbar overflow-y-auto",
                    )}
                  >
                    {renderPanel(id)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hint */}
          <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            {focused
              ? 'Say "back to overview" or "close quad view"'
              : 'Say "focus alerts" · "focus team" · "close quad view"'}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
