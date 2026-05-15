import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { WidgetSize } from "../types";

interface Props {
  size: WidgetSize;
  durationSec: number;
  label?: string;
}

function fmt(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function TimerWidget({ size, durationSec, label }: Props) {
  const [remaining, setRemaining] = useState(durationSec);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setRemaining(durationSec);
    setRunning(false);
  }, [durationSec]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  // Stop propagation so the widget's drag handle / config don't capture the click.
  const stopProp = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 py-4">
      {size !== "small" && (
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {label?.trim() || "Timer"}
        </div>
      )}
      <div
        className={
          size === "large"
            ? "text-7xl font-extralight leading-none tracking-tight tabular-nums"
            : size === "medium"
              ? "text-5xl font-extralight leading-none tracking-tight tabular-nums"
              : "text-3xl font-extralight leading-none tracking-tight tabular-nums"
        }
      >
        {fmt(remaining)}
      </div>
      {size !== "small" && (
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={stopProp(() => setRunning((r) => !r))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-surface-2/60 text-foreground transition-colors hover:bg-surface-2"
            aria-label={running ? "Pause timer" : "Start timer"}
          >
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={stopProp(() => {
              setRunning(false);
              setRemaining(durationSec);
            })}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-surface-2/60 text-foreground transition-colors hover:bg-surface-2"
            aria-label="Reset timer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
