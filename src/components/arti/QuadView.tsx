import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { AlertStack } from "./AlertStack";
import { TeamRoster } from "./TeamRoster";
import type { InstrumentId, TimeOutId } from "./AwakeDashboard";
import { X, Maximize2 } from "lucide-react";

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
 * Quad view: 4 panels at once, iOS-app-switcher style.
 * Tap or voice-select a panel to "zoom" it into a focused hero view.
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

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl animate-fade-in"
      onClick={() => (focused ? onFocus(null) : onClose())}
    >
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-8 py-5">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {focused ? `Focused · ${PANELS.find((p) => p.id === focused)?.label}` : "Quad View"}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3 text-muted-foreground hover:bg-surface-3/80 hover:text-foreground transition-colors"
          aria-label="Close quad view"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Grid */}
      <div
        className={cn(
          "grid h-[calc(100vh-9rem)] w-[calc(100vw-6rem)] gap-5 transition-all duration-500 ease-out",
          focused ? "grid-cols-1 grid-rows-1" : "grid-cols-2 grid-rows-2"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {PANELS.map(({ id, label }) => {
          const isFocused = focused === id;
          const isHidden = focused !== null && !isFocused;
          return (
            <button
              key={id}
              onClick={() => onFocus(isFocused ? null : id)}
              className={cn(
                "group relative overflow-hidden rounded-3xl border border-border bg-surface-2 text-left transition-all duration-500 ease-out",
                "hover:border-primary/40 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.4)]",
                isHidden && "scale-90 opacity-0 pointer-events-none",
                isFocused && "col-span-1 row-span-1"
              )}
              aria-label={`Focus ${label}`}
            >
              <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
                <span className="rounded-full bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {label}
                </span>
              </div>
              {!isFocused && (
                <div className="absolute right-4 top-4 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "h-full w-full overflow-y-auto p-5 pt-14 transition-transform duration-500",
                  isFocused ? "scale-100" : "scale-100"
                )}
              >
                {renderPanel(id)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
        {focused
          ? "Esc or tap outside to return · Say “close” to dismiss"
          : 'Tap a panel or say "focus alerts" · Esc to close'}
      </div>
    </div>
  );
}
