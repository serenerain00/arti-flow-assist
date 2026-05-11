import { useEffect, useMemo, useState } from "react";
import { Moon, Clock4, ArrowRight } from "lucide-react";
import type { CaseItem } from "./cases";
import { TODAY_CASES } from "./cases";

interface Props {
  /** The case that just ended — used to find the next case for prep context. */
  endedCase?: CaseItem;
  onExit: () => void;
  onStartNextCase: () => void;
}

// Generic procedural-prep reminders that don't expose any patient data.
// These cycle slowly so the wall feels alive without demanding attention.
const PREP_REMINDERS: string[] = [
  "Sterile field rebuild in progress.",
  "Equipment tower checks complete.",
  "Implants staged for the next case.",
  "OR temperature 68°F · humidity within range.",
  "Anesthesia cart restocked.",
  "Counts reset · ready for opening sponge count.",
  "Suction lines flushed · clean trap installed.",
];

function parseHHMMToDate(hhmm: string): Date | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function relativeTo(target: Date | null, now: Date): string {
  if (!target) return "—";
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (diffMin === 0) return "now";
  if (diffMin > 0) {
    if (diffMin < 60) return `in ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
  }
  return `${-diffMin} min overdue`;
}

export function AmbientRecoveryScreen({ endedCase, onExit, onStartNextCase }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [reminderIdx, setReminderIdx] = useState(0);

  useEffect(() => {
    const tickClock = setInterval(() => setNow(new Date()), 1000);
    const rotateReminders = setInterval(
      () => setReminderIdx((i) => (i + 1) % PREP_REMINDERS.length),
      6000,
    );
    return () => {
      clearInterval(tickClock);
      clearInterval(rotateReminders);
    };
  }, []);

  const nextCase = useMemo<CaseItem | undefined>(() => {
    if (endedCase) {
      const idx = TODAY_CASES.findIndex((c) => c.id === endedCase.id);
      if (idx >= 0) {
        for (let i = idx + 1; i < TODAY_CASES.length; i++) {
          const c = TODAY_CASES[i];
          if (c.status !== "completed" && c.status !== "cancelled") return c;
        }
      }
      return undefined;
    }
    return TODAY_CASES.find((c) => c.status !== "completed" && c.status !== "cancelled");
  }, [endedCase]);

  const nextTarget = nextCase ? parseHHMMToDate(nextCase.time) : null;
  const clockStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const roomId = endedCase?.room ?? TODAY_CASES[0]?.room ?? "OR 326";

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#070b14] text-foreground">
      {/* Low-contrast ambient gradient field */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-indigo-500/[0.08] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[44rem] w-[44rem] rounded-full bg-sky-400/[0.08] blur-3xl" />
        <div className="absolute left-1/3 top-1/4 h-[26rem] w-[26rem] rounded-full bg-violet-500/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col px-12 py-10">
        {/* Header chip */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-200">
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-indigo-200/80">
            Ambient Recovery · {roomId}
          </div>
        </div>

        {/* Center column */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* Date */}
          <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            {dateStr}
          </div>

          {/* Big clock */}
          <div className="mt-3 text-[9rem] font-extralight leading-none tracking-tight text-foreground/90 tabular-nums">
            {clockStr}
          </div>

          {/* Rotating prep reminder */}
          <div className="mt-10 flex h-12 items-center">
            <div
              key={reminderIdx}
              className="animate-fade-in text-lg font-light text-foreground/70"
            >
              {PREP_REMINDERS[reminderIdx]}
            </div>
          </div>
        </div>

        {/* Bottom rail — next case (no patient data) + actions */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <div className="rounded-3xl border border-white/5 bg-white/[0.015] px-7 py-5 backdrop-blur-sm">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Next case
            </div>
            {nextCase ? (
              <div className="mt-2 flex items-end gap-8">
                <div>
                  <div className="text-3xl font-extralight tracking-tight">
                    {nextCase.procedureShort}
                    {nextCase.side ? (
                      <span className="ml-2 text-base text-muted-foreground">
                        · {nextCase.side}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm font-light text-foreground/60">
                    {nextCase.surgeon}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Scheduled
                  </div>
                  <div className="mt-1 text-2xl font-extralight tracking-tight tabular-nums">
                    {nextCase.time}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Countdown
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xl font-light text-indigo-200">
                    <Clock4 className="h-4 w-4" strokeWidth={1.7} />
                    {relativeTo(nextTarget, now)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-base font-light text-muted-foreground">
                No more cases scheduled in this room today.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <button
              onClick={onStartNextCase}
              disabled={!nextCase}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-400/10 px-6 py-3 text-sm font-light uppercase tracking-wider text-indigo-100 transition-colors hover:bg-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start next case
              <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
            </button>
            <button
              onClick={onExit}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-2.5 text-xs font-light uppercase tracking-wider text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
            >
              Exit ambient mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
