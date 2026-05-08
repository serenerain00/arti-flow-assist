import { useCallback, useEffect, useRef, useState } from "react";

export type TimerPurpose = "case" | "tourniquet" | "antibiotic_redose" | "custom" | "stopwatch";

export interface TimerInstance {
  id: string;
  label: string;
  purpose: TimerPurpose;
  /** Wall-clock ms when the timer started (or last resumed). */
  startedAt: number;
  /** Wall-clock ms when paused; null if running. */
  pausedAt: number | null;
  /** Accumulated ms before the current run (carried across pauses). */
  elapsedBeforePause: number;
  /** Total countdown duration in ms; null = stopwatch (count up). */
  durationMs: number | null;
  meta?: {
    extremity?: "upper" | "lower";
    drug?: string;
  };
  /** Threshold seconds already announced — kept so we never repeat warnings. */
  firedThresholds: number[];
}

export interface TimerThresholdEvent {
  timerId: string;
  label: string;
  purpose: TimerPurpose;
  kind: "warning" | "limit" | "critical" | "expiring" | "expired";
  message: string;
}

export interface StartTimerArgs {
  label?: string;
  purpose?: TimerPurpose;
  /** When set, timer counts down from this duration; else stopwatch. */
  durationMinutes?: number;
  /** Tourniquet only — drives 60/90/120 min thresholds. */
  extremity?: "upper" | "lower";
  drug?: string;
}

const TOURNIQUET_THRESHOLDS_UE = [60 * 60, 90 * 60, 120 * 60];
const TOURNIQUET_THRESHOLDS_LE = [90 * 60, 105 * 60, 120 * 60];
const ANTIBIOTIC_DEFAULT_MIN = 225;
const ANTIBIOTIC_PREEXPIRE_SEC = 5 * 60;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function presetLabel(purpose: TimerPurpose, args: StartTimerArgs): string {
  if (args.label) return args.label;
  switch (purpose) {
    case "case":
      return "Case clock";
    case "tourniquet":
      return args.extremity === "lower" ? "Tourniquet (lower)" : "Tourniquet (upper)";
    case "antibiotic_redose":
      return args.drug ? `${args.drug} redose` : "Antibiotic redose";
    case "stopwatch":
      return "Stopwatch";
    default:
      return "Timer";
  }
}

function defaultDurationMs(purpose: TimerPurpose, args: StartTimerArgs): number | null {
  if (args.durationMinutes != null) return args.durationMinutes * 60_000;
  switch (purpose) {
    case "antibiotic_redose":
      return ANTIBIOTIC_DEFAULT_MIN * 60_000;
    case "case":
    case "stopwatch":
    case "tourniquet":
      return null;
    default:
      return null;
  }
}

/**
 * Compute current elapsed ms since the timer was started, accounting for
 * any paused intervals.
 */
export function elapsedMs(timer: TimerInstance, now: number): number {
  if (timer.pausedAt != null) {
    return timer.elapsedBeforePause + (timer.pausedAt - timer.startedAt);
  }
  return timer.elapsedBeforePause + (now - timer.startedAt);
}

/**
 * Remaining ms for a countdown. Returns null for stopwatches.
 * Clamps to 0 (never negative) so UI and Arti can show "0:00" cleanly.
 */
export function remainingMs(timer: TimerInstance, now: number): number | null {
  if (timer.durationMs == null) return null;
  return Math.max(0, timer.durationMs - elapsedMs(timer, now));
}

export function formatTime(totalMs: number): string {
  const totalSec = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface ThresholdSpec {
  /** Elapsed seconds threshold (count-up) OR null when comparing remaining. */
  atElapsedSec?: number;
  /** Remaining seconds threshold (count-down only). */
  atRemainingSec?: number;
  kind: TimerThresholdEvent["kind"];
  message: string;
}

function thresholdsFor(timer: TimerInstance): ThresholdSpec[] {
  if (timer.purpose === "tourniquet") {
    const limits =
      timer.meta?.extremity === "lower" ? TOURNIQUET_THRESHOLDS_LE : TOURNIQUET_THRESHOLDS_UE;
    const ext = timer.meta?.extremity === "lower" ? "lower" : "upper";
    const recommendedLimit = ext === "lower" ? "ninety minutes" : "one hour";
    return [
      {
        atElapsedSec: limits[0],
        kind: "warning",
        message: `Tourniquet at ${recommendedLimit} — recommended ${ext}-extremity limit reached.`,
      },
      {
        atElapsedSec: limits[1],
        kind: "limit",
        message: `Tourniquet at ${ext === "lower" ? "one hour forty-five" : "ninety minutes"} — approaching the two-hour ceiling.`,
      },
      {
        atElapsedSec: limits[2],
        kind: "critical",
        message: `Two hours of tourniquet time. Surgeon should be notified.`,
      },
    ];
  }
  if (timer.purpose === "antibiotic_redose" && timer.durationMs != null) {
    return [
      {
        atRemainingSec: ANTIBIOTIC_PREEXPIRE_SEC,
        kind: "expiring",
        message: `${timer.meta?.drug ?? "Antibiotic"} redose due in five minutes.`,
      },
      {
        atRemainingSec: 0,
        kind: "expired",
        message: `${timer.meta?.drug ?? "Cefazolin"} redose now.`,
      },
    ];
  }
  if (timer.durationMs != null) {
    return [
      {
        atRemainingSec: 0,
        kind: "expired",
        message: `${timer.label} done.`,
      },
    ];
  }
  return [];
}

export interface UseTimersOptions {
  /** Called once per crossed threshold so the route can speak it. */
  onThresholdEvent?: (event: TimerThresholdEvent) => void;
}

export interface UseTimersResult {
  timers: TimerInstance[];
  /** Returns timer id, or null if start was rejected. */
  startTimer: (args: StartTimerArgs) => string | null;
  stopTimer: (selector: string) => boolean;
  pauseTimer: (selector: string) => boolean;
  resumeTimer: (selector: string) => boolean;
  cancelTimer: (selector: string) => boolean;
  /** Snapshot of timers as text for Claude's live context. */
  describeForContext: () => string;
}

/**
 * Multi-timer state machine. Drives count-up (case clock, tourniquet,
 * stopwatch) and count-down (antibiotic redose, custom alarm) timers, with
 * purpose-specific warning thresholds emitted as side-effect events.
 *
 * Tick frequency is 1 Hz — sufficient for second-resolution display and
 * threshold detection, low enough that React re-render cost on a busy
 * dashboard stays negligible.
 */
export function useTimers(options: UseTimersOptions = {}): UseTimersResult {
  const [timers, setTimers] = useState<TimerInstance[]>([]);
  const optsRef = useRef(options);
  optsRef.current = options;
  const timersRef = useRef<TimerInstance[]>([]);
  timersRef.current = timers;

  // 1 Hz ticker — drives re-renders for second-resolution display AND
  // checks every active timer for newly-crossed thresholds. Combined into
  // a single effect so we only setTimers when a real threshold fires.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => {
      forceTick((n) => n + 1);
      const now = Date.now();
      let changed = false;
      const next = timersRef.current.map((t) => {
        if (t.pausedAt != null) return t;
        const specs = thresholdsFor(t);
        if (specs.length === 0) return t;
        const newlyFired: number[] = [];
        for (const spec of specs) {
          // Negative key for remaining-based thresholds keeps them from
          // colliding with elapsed-based keys in firedThresholds.
          const key = spec.atElapsedSec != null ? spec.atElapsedSec : -(spec.atRemainingSec ?? 0);
          if (t.firedThresholds.includes(key)) continue;
          let crossed = false;
          if (spec.atElapsedSec != null) {
            crossed = elapsedMs(t, now) >= spec.atElapsedSec * 1000;
          } else if (spec.atRemainingSec != null) {
            const rem = remainingMs(t, now);
            if (rem != null) crossed = rem <= spec.atRemainingSec * 1000;
          }
          if (crossed) {
            newlyFired.push(key);
            optsRef.current.onThresholdEvent?.({
              timerId: t.id,
              label: t.label,
              purpose: t.purpose,
              kind: spec.kind,
              message: spec.message,
            });
          }
        }
        if (newlyFired.length === 0) return t;
        changed = true;
        return { ...t, firedThresholds: [...t.firedThresholds, ...newlyFired] };
      });
      if (changed) setTimers(next);
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const findIndex = useCallback((selector: string): number => {
    if (!selector) return -1;
    const list = timersRef.current;
    const lower = selector.toLowerCase();
    let idx = list.findIndex((t) => t.id === selector);
    if (idx >= 0) return idx;
    idx = list.findIndex((t) => t.label.toLowerCase() === lower);
    if (idx >= 0) return idx;
    idx = list.findIndex((t) => t.purpose === lower);
    if (idx >= 0) return idx;
    idx = list.findIndex((t) => t.label.toLowerCase().includes(lower));
    return idx;
  }, []);

  const startTimer = useCallback((args: StartTimerArgs): string | null => {
    const purpose = args.purpose ?? (args.durationMinutes != null ? "custom" : "stopwatch");
    const label = presetLabel(purpose, args);
    const durationMs = defaultDurationMs(purpose, args);
    const id = uid();
    setTimers((prev) => {
      // Replace any existing timer with the same purpose for case/tourniquet —
      // there's only ever one of each per case. Custom/stopwatch can stack.
      const singletonPurposes: TimerPurpose[] = ["case", "tourniquet", "antibiotic_redose"];
      const filtered = singletonPurposes.includes(purpose)
        ? prev.filter((t) => t.purpose !== purpose)
        : prev;
      const next: TimerInstance = {
        id,
        label,
        purpose,
        startedAt: Date.now(),
        pausedAt: null,
        elapsedBeforePause: 0,
        durationMs,
        meta:
          args.extremity || args.drug ? { extremity: args.extremity, drug: args.drug } : undefined,
        firedThresholds: [],
      };
      return [...filtered, next];
    });
    return id;
  }, []);

  const stopTimer = useCallback(
    (selector: string): boolean => {
      if (selector === "all") {
        const had = timersRef.current.length > 0;
        setTimers([]);
        return had;
      }
      const i = findIndex(selector);
      if (i < 0) return false;
      const id = timersRef.current[i].id;
      setTimers((prev) => prev.filter((t) => t.id !== id));
      return true;
    },
    [findIndex],
  );

  const pauseTimer = useCallback(
    (selector: string): boolean => {
      const i = findIndex(selector);
      if (i < 0) return false;
      const target = timersRef.current[i];
      if (target.pausedAt != null) return false;
      setTimers((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, pausedAt: Date.now() } : t)),
      );
      return true;
    },
    [findIndex],
  );

  const resumeTimer = useCallback(
    (selector: string): boolean => {
      const i = findIndex(selector);
      if (i < 0) return false;
      const target = timersRef.current[i];
      if (target.pausedAt == null) return false;
      setTimers((prev) =>
        prev.map((t) => {
          if (t.id !== target.id) return t;
          const carried = t.elapsedBeforePause + ((t.pausedAt ?? Date.now()) - t.startedAt);
          return {
            ...t,
            startedAt: Date.now(),
            pausedAt: null,
            elapsedBeforePause: carried,
          };
        }),
      );
      return true;
    },
    [findIndex],
  );

  const cancelTimer = useCallback((selector: string): boolean => stopTimer(selector), [stopTimer]);

  const describeForContext = useCallback((): string => {
    if (timers.length === 0) return "Active timers: none";
    const now = Date.now();
    const lines = timers.map((t) => {
      const elapsed = elapsedMs(t, now);
      const elapsedStr = formatTime(elapsed);
      if (t.durationMs == null) {
        return `  - ${t.label} (${t.purpose}): ${elapsedStr} elapsed${t.pausedAt ? " — PAUSED" : ""}`;
      }
      const rem = remainingMs(t, now) ?? 0;
      return `  - ${t.label} (${t.purpose}): ${formatTime(rem)} remaining of ${formatTime(t.durationMs)}${t.pausedAt ? " — PAUSED" : ""}`;
    });
    return `Active timers (${timers.length}):\n${lines.join("\n")}`;
  }, [timers]);

  return {
    timers,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    cancelTimer,
    describeForContext,
  };
}
