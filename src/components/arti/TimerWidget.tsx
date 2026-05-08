import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Pause, Play, Plus, Square, X } from "lucide-react";
import {
  elapsedMs,
  formatTime,
  remainingMs,
  type TimerInstance,
  type StartTimerArgs,
} from "@/hooks/useTimers";
import { cn } from "@/lib/utils";

export type TimerWidgetMode = "prep" | "timeout" | "intra";

interface Props {
  timers: TimerInstance[];
  mode: TimerWidgetMode;
  onStart: (args: StartTimerArgs) => void;
  onStop: (selector: string) => void;
  onPause: (selector: string) => void;
  onResume: (selector: string) => void;
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

function WallClock({ className }: { className?: string }) {
  const now = useNow(1000);
  const time = new Date(now).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div className={cn("flex items-baseline gap-1 font-mono tabular-nums", className)}>
      <Clock className="h-3.5 w-3.5 self-center text-primary" />
      <span className="text-sm font-light tracking-tight">{time}</span>
    </div>
  );
}

interface TimerPillProps {
  timer: TimerInstance;
  now: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

function TimerPill({ timer, now, onStop, onPause, onResume }: TimerPillProps) {
  const isCountdown = timer.durationMs != null;
  const value = isCountdown ? (remainingMs(timer, now) ?? 0) : elapsedMs(timer, now);
  const display = formatTime(value);
  const paused = timer.pausedAt != null;

  // Tourniquet UI: amber after 60min, red after 120min — matches AORN thresholds.
  let tone = "border-border/60 bg-surface-2/40 text-foreground/90";
  if (timer.purpose === "tourniquet") {
    const elapsed = elapsedMs(timer, now);
    const limit = timer.meta?.extremity === "lower" ? 90 * 60_000 : 60 * 60_000;
    if (elapsed >= 120 * 60_000) {
      tone = "border-destructive/50 bg-destructive/15 text-destructive";
    } else if (elapsed >= limit) {
      tone = "border-warning/50 bg-warning/15 text-warning";
    }
  }
  if (timer.purpose === "antibiotic_redose" && isCountdown && value <= 5 * 60_000) {
    tone = "border-warning/50 bg-warning/15 text-warning";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
        tone,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
          {timer.label}
        </div>
        <div className="mt-0.5 font-mono text-xl font-thin tabular-nums tracking-tight">
          {display}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {paused ? (
          <button
            onClick={onResume}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            aria-label="Resume timer"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            aria-label="Pause timer"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={onStop}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          aria-label="Stop timer"
        >
          <Square className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function PresetButton({
  label,
  detail,
  onClick,
  disabled,
}: {
  label: string;
  detail?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-0.5 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-surface-2/60 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">{label}</span>
      {detail && <span className="text-xs font-light text-muted-foreground">{detail}</span>}
    </button>
  );
}

export function TimerWidget({ timers, mode, onStart, onStop, onPause, onResume }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [customMin, setCustomMin] = useState("10");
  const [customLabel, setCustomLabel] = useState("");
  const now = useNow(1000);

  const collapsed = mode === "timeout";
  const intraOp = mode === "intra";
  const hasCaseClock = timers.some((t) => t.purpose === "case");
  const hasTourniquet = timers.some((t) => t.purpose === "tourniquet");
  const hasAntibiotic = timers.some((t) => t.purpose === "antibiotic_redose");

  return (
    <div className="glass relative w-72 rounded-xl border border-border/60 bg-surface/40 p-3 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <WallClock />
        {!collapsed && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            aria-label={expanded ? "Collapse timer panel" : "Expand timer panel"}
          >
            {expanded ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {collapsed && (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/80">
          Time-out in progress · timer paused
        </p>
      )}

      {!collapsed && timers.length > 0 && (
        <div className="mt-3 space-y-2">
          {timers.map((t) => (
            <TimerPill
              key={t.id}
              timer={t}
              now={now}
              onStop={() => onStop(t.id)}
              onPause={() => onPause(t.id)}
              onResume={() => onResume(t.id)}
            />
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
              {intraOp && (
                <div className="space-y-1.5">
                  <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                    Case presets
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <PresetButton
                      label="Case clock"
                      detail={hasCaseClock ? "Already running" : "Count up from 0"}
                      onClick={() => onStart({ purpose: "case" })}
                      disabled={hasCaseClock}
                    />
                    <PresetButton
                      label="Tourniquet UE"
                      detail={hasTourniquet ? "Already running" : "Warn at 60 min"}
                      onClick={() => onStart({ purpose: "tourniquet", extremity: "upper" })}
                      disabled={hasTourniquet}
                    />
                    <PresetButton
                      label="Tourniquet LE"
                      detail={hasTourniquet ? "Already running" : "Warn at 90 min"}
                      onClick={() => onStart({ purpose: "tourniquet", extremity: "lower" })}
                      disabled={hasTourniquet}
                    />
                    <PresetButton
                      label="Cefazolin"
                      detail={hasAntibiotic ? "Already running" : "Redose in 225 min"}
                      onClick={() =>
                        onStart({
                          purpose: "antibiotic_redose",
                          drug: "Cefazolin",
                          durationMinutes: 225,
                        })
                      }
                      disabled={hasAntibiotic}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  Manual
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <PresetButton
                    label="Stopwatch"
                    detail="Count up"
                    onClick={() =>
                      onStart({ purpose: "stopwatch", label: customLabel || "Stopwatch" })
                    }
                  />
                  <PresetButton
                    label={`${customMin || 10}-min timer`}
                    detail="Count down"
                    onClick={() => {
                      const mins = Math.max(1, Number(customMin) || 10);
                      onStart({
                        purpose: "custom",
                        label: customLabel || `${mins}-min timer`,
                        durationMinutes: mins,
                      });
                    }}
                  />
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="flex-1 rounded-md border border-border/50 bg-surface-2/30 px-2 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none"
                  />
                  <input
                    type="number"
                    min={1}
                    value={customMin}
                    onChange={(e) => setCustomMin(e.target.value)}
                    className="w-16 rounded-md border border-border/50 bg-surface-2/30 px-2 py-1.5 text-center text-xs font-light tabular-nums text-foreground focus:border-primary/40 focus:outline-none"
                    aria-label="Custom timer minutes"
                  />
                </div>
              </div>

              {timers.length > 0 && (
                <button
                  onClick={() => onStop("all")}
                  className="w-full rounded-md border border-border/40 bg-surface-2/20 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  Stop all timers
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
