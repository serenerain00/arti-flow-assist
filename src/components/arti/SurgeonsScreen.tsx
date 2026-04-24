import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Search, Stethoscope } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import {
  SCHEDULE_CASES,
  SURGEONS,
  formatLongDate,
  toDateKey,
  type ScheduleCase,
  type Surgeon,
} from "./schedule";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Click a surgeon → opens the PersonScheduleModal at the route level. */
  onOpenSurgeonSchedule?: (name: string) => void;
}

interface SurgeonRow {
  surgeon: Surgeon;
  /** Soonest non-completed/cancelled case from today onward. Null if none. */
  next: ScheduleCase | null;
  /** Counts in upcoming windows. */
  weekCount: number;
  monthCount: number;
}

/**
 * Surgeons directory. Vertical card list of every surgeon, sorted so the
 * one with the soonest upcoming case is at the top. A search box filters by
 * surgeon name, specialty, or any procedure they have on the schedule.
 *
 * Click a surgeon → opens PersonScheduleModal pre-filtered to them.
 */
export function SurgeonsScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onPrompt,
  onSidebarNavigate,
  onOpenSurgeonSchedule,
}: Props) {
  const [query, setQuery] = useState("");

  // Reset query on mount so navigating away/back gives a fresh state.
  useEffect(() => {
    setQuery("");
  }, []);

  const rows: SurgeonRow[] = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const weekEndKey = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return toDateKey(d);
    })();
    const monthEndKey = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return toDateKey(d);
    })();

    return SURGEONS.map((s) => {
      const upcoming = SCHEDULE_CASES.filter(
        (c) =>
          c.surgeon === s.name &&
          c.date >= todayKey &&
          c.status !== "cancelled" &&
          c.status !== "completed",
      ).sort((a, b) =>
        a.date !== b.date
          ? a.date.localeCompare(b.date)
          : a.time.localeCompare(b.time),
      );
      const next = upcoming[0] ?? null;
      const weekCount = upcoming.filter((c) => c.date <= weekEndKey).length;
      const monthCount = upcoming.filter((c) => c.date <= monthEndKey).length;
      return { surgeon: s, next, weekCount, monthCount };
    }).sort((a, b) => {
      // Soonest next case first; surgeons with no upcoming cases sink to bottom.
      if (!a.next && !b.next) return a.surgeon.name.localeCompare(b.surgeon.name);
      if (!a.next) return 1;
      if (!b.next) return -1;
      const ka = `${a.next.date} ${a.next.time}`;
      const kb = `${b.next.date} ${b.next.time}`;
      return ka.localeCompare(kb);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ surgeon }) => {
      // Match on name or specialty
      if (surgeon.name.toLowerCase().includes(q)) return true;
      if (surgeon.specialty.toLowerCase().includes(q)) return true;
      // Or any procedure they have on the schedule
      const hasProc = SCHEDULE_CASES.some(
        (c) =>
          c.surgeon === surgeon.name &&
          (c.procedure.toLowerCase().includes(q) ||
            c.procedureShort.toLowerCase().includes(q)),
      );
      return hasProc;
    });
  }, [rows, query]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} activeKey="surgeons" onNavigate={onSidebarNavigate} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
          cockpitMode={false}
          onToggleCockpit={() => {}}
        />

        <main
          data-scroll
          className="relative min-h-0 flex-1 overflow-y-auto px-8 pt-8 pb-40 animate-fade-in"
        >
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
                Surgeons · Directory
              </div>
              <h1 className="mt-2 text-4xl font-extralight tracking-tight text-foreground">
                {SURGEONS.length} surgeons
              </h1>
              <p className="mt-1 text-sm font-light text-muted-foreground">
                Sorted by soonest upcoming case. Tap a card to open their schedule, or ask Arti:
                <span className="ml-1 italic">"show me Dr. Patel's schedule"</span>.
              </p>
            </div>

            {/* Search */}
            <label className="flex w-full max-w-xs items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm font-light text-foreground transition-colors focus-within:border-primary/50">
              <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, specialty, or procedure"
                className="min-w-0 flex-1 bg-transparent placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </label>
          </header>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/30 px-6 py-16 text-center">
              <Stethoscope className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.3} />
              <div className="mt-4 text-base font-light text-foreground">No surgeons match</div>
              <div className="mt-1 text-xs font-light text-muted-foreground">
                Try a different name, specialty, or procedure code.
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((row) => (
                <SurgeonCard
                  key={row.surgeon.name}
                  row={row}
                  onClick={
                    onOpenSurgeonSchedule
                      ? () => onOpenSurgeonSchedule(row.surgeon.name)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </main>

        <ArtiInvoker
          placeholder="Search or ask about a surgeon…"
          onSubmit={onPrompt}
          suggestions={[
            "Show me Dr. Patel's schedule",
            "Who has the most cases this week?",
            "Back to home",
          ]}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Card
// ──────────────────────────────────────────────────────────────────────────

function SurgeonCard({ row, onClick }: { row: SurgeonRow; onClick?: () => void }) {
  const { surgeon, next, weekCount, monthCount } = row;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "group w-full rounded-2xl border border-border/60 bg-surface/40 p-5 text-left transition-all",
          onClick && "hover:border-primary/40 hover:bg-surface/70",
          !onClick && "cursor-default",
        )}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-medium text-white"
            style={{
              background: `linear-gradient(135deg, ${surgeon.color}, color-mix(in oklab, ${surgeon.color} 60%, white))`,
            }}
          >
            {surgeon.initials}
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-light text-foreground">{surgeon.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-light text-muted-foreground">
              <span>{surgeon.specialty}</span>
              <span>·</span>
              <span>{surgeon.homeRoom}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              Upcoming
            </div>
            <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
              {weekCount} <span className="text-muted-foreground/70">/ wk</span>
            </div>
            <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {monthCount} / 30d
            </div>
          </div>
        </div>

        {/* Next case */}
        <div className="mt-4 rounded-xl border border-border/40 bg-surface-2/40 px-3 py-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            <CalendarIcon className="h-3 w-3" />
            Next case
          </div>
          {next ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-sm tabular-nums text-foreground">
                {formatRelativeDate(next.date)} · {next.time}
              </span>
              <span className="text-sm font-light text-foreground">
                {next.procedureShort}
                {next.side ? ` ${next.side[0]}` : ""}
              </span>
              <span className="text-xs font-light text-muted-foreground">
                · {next.patientName}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-xs font-light italic text-muted-foreground">
              Nothing on the board
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

/** "Today" / "Tomorrow" / "Mon Apr 27" depending on proximity. */
function formatRelativeDate(dateKey: string): string {
  const today = new Date();
  const todayKey = toDateKey(today);
  if (dateKey === todayKey) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === toDateKey(tomorrow)) return "Tomorrow";
  // Within next 7 days → weekday + short date
  const target = new Date(dateKey);
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff > 0 && diff < 7) {
    return target.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return formatLongDate(dateKey).replace(/^[A-Za-z]+, /, "");
}
