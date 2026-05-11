import { useEffect, useMemo, useState } from "react";
import { Sparkles, CheckCircle2, Circle, Clock4, ArrowRight } from "lucide-react";
import type { CaseItem } from "./cases";
import { TODAY_CASES } from "./cases";

export interface CleaningItem {
  id: string;
  label: string;
}

export const CLEANING_ITEMS: CleaningItem[] = [
  { id: "drapes-removed", label: "Remove drapes & dispose of single-use items" },
  { id: "wipe-down-table", label: "Wipe down OR table, arm boards, and positioning aids" },
  { id: "disinfect-tower", label: "Disinfect equipment tower, cables, and footpedals" },
  { id: "spot-clean", label: "Spot-clean walls and floor (visible contamination)" },
  { id: "linens-sharps", label: "Replace linens; empty sharps & waste bins" },
  { id: "restock-supplies", label: "Restock supplies and instruments for next case" },
  { id: "final-readiness", label: "Run final readiness check (counts, suction, lights)" },
];

/** Fuzzy-match a cleaning item by free-text label. */
export function findCleaningItem(query: string): CleaningItem | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  const byId = CLEANING_ITEMS.find((i) => i.id === q);
  if (byId) return byId;
  const byLabel = CLEANING_ITEMS.find((i) => i.label.toLowerCase().includes(q));
  if (byLabel) return byLabel;
  return CLEANING_ITEMS.find((i) => {
    const words = i.label.toLowerCase().split(/\s+/);
    return words.some((w) => w.length >= 4 && q.includes(w));
  });
}

interface Props {
  /** The case that just ended — used to find the next case in the schedule. */
  endedCase: CaseItem;
  onStartNextCase: () => void;
  /** Optional: switch the wall to Ambient Recovery (between-cases calm mode). */
  onEnterAmbient?: () => void;
  /** Lifted checklist state so voice tools can drive it. */
  checked: Set<string>;
  onToggle: (id: string) => void;
}

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
  const ago = -diffMin;
  if (ago < 60) return `${ago} min overdue`;
  return `${Math.floor(ago / 60)}h overdue`;
}

export function TurnoverScreen({
  endedCase,
  onStartNextCase,
  onEnterAmbient,
  checked,
  onToggle,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  // Tick the clock + relative countdown once a second.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextCase = useMemo<CaseItem | undefined>(() => {
    const idx = TODAY_CASES.findIndex((c) => c.id === endedCase.id);
    if (idx < 0) return undefined;
    // Walk forward through the schedule for the next non-completed case.
    for (let i = idx + 1; i < TODAY_CASES.length; i++) {
      const c = TODAY_CASES[i];
      if (c.status !== "completed" && c.status !== "cancelled") return c;
    }
    return undefined;
  }, [endedCase.id]);

  const nextTarget = nextCase ? parseHHMMToDate(nextCase.time) : null;
  const allDone = checked.size === CLEANING_ITEMS.length;

  const clockStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-[#0a1320] via-[#0f1a2e] to-[#0a1320] text-foreground">
      {/* Subtle ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[34rem] w-[34rem] rounded-full bg-cyan-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col px-12 py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-400/15 text-sky-300">
              <Sparkles className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300/80">
                Room Turnover
              </div>
              <div className="text-2xl font-extralight tracking-tight">
                OR {endedCase.room.replace(/^OR\s*/i, "")} · between cases
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Local time
            </div>
            <div className="text-5xl font-extralight tracking-tight text-foreground/90">
              {clockStr}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mt-10 grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Cleaning checklist */}
          <div className="rounded-3xl border border-sky-400/15 bg-white/[0.02] p-8 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300/80">
                Cleaning checklist
              </div>
              <div className="text-sm font-light text-muted-foreground">
                {checked.size} / {CLEANING_ITEMS.length} complete
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {CLEANING_ITEMS.map((item) => {
                const isChecked = checked.has(item.id);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onToggle(item.id)}
                      className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.015] px-5 py-4 text-left transition-colors hover:border-sky-400/30 hover:bg-white/[0.04]"
                    >
                      {isChecked ? (
                        <CheckCircle2 className="h-6 w-6 shrink-0 text-success" strokeWidth={1.7} />
                      ) : (
                        <Circle
                          className="h-6 w-6 shrink-0 text-muted-foreground/60"
                          strokeWidth={1.7}
                        />
                      )}
                      <span
                        className={`text-base font-light ${
                          isChecked ? "text-foreground/50 line-through" : "text-foreground/90"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right rail — next case + privacy */}
          <div className="flex flex-col gap-6">
            {/* Privacy banner */}
            <div className="rounded-3xl border border-sky-400/15 bg-white/[0.02] p-6 backdrop-blur-sm">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300/80">
                Privacy
              </div>
              <div className="mt-2 text-sm font-light text-foreground/80">
                Patient identifiers are hidden during turnover. Resume the case to view chart and
                clinical data.
              </div>
            </div>

            {/* Next case card */}
            <div className="flex-1 rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-400/[0.06] to-cyan-300/[0.03] p-8 backdrop-blur-sm">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-sky-300/80">
                Next case
              </div>
              {nextCase ? (
                <>
                  <div className="mt-3 text-3xl font-extralight tracking-tight">
                    {nextCase.procedureShort}
                    <span className="ml-2 text-base text-muted-foreground">
                      {nextCase.side ? `· ${nextCase.side}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-light text-foreground/70">
                    {nextCase.surgeon}
                  </div>
                  <div className="mt-8 flex items-end gap-6">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        Scheduled
                      </div>
                      <div className="mt-1 text-3xl font-extralight tracking-tight">
                        {nextCase.time}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        Countdown
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xl font-light text-sky-200">
                        <Clock4 className="h-4 w-4" strokeWidth={1.7} />
                        {relativeTo(nextTarget, now)}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-3 text-base font-light text-muted-foreground">
                  No more cases scheduled in this room today.
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={onStartNextCase}
                  disabled={!nextCase}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-400/10 px-6 py-3 text-sm font-light uppercase tracking-wider text-sky-100 transition-colors hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {allDone ? "Start next case" : "Skip cleaning · start next case"}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.7} />
                </button>
                {onEnterAmbient && (
                  <button
                    onClick={onEnterAmbient}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-light uppercase tracking-wider text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
                    title="Switch to Ambient Recovery (or say 'Arti, ambient mode')"
                  >
                    Switch to ambient
                  </button>
                )}
              </div>
              {!allDone && nextCase ? (
                <div className="mt-3 text-xs font-light text-muted-foreground">
                  Or finish the checklist first — say "Arti, start next case" when ready.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
