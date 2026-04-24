import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Hospital,
  Package,
  Star,
  User as UserIcon,
  X,
} from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import { STATUS_META } from "./cases";
import {
  SCHEDULE_CASES,
  SERVICE_LINES,
  SERVICE_LINE_COLORS,
  SURGEONS,
  addMinutes,
  formatLongDate,
  getCasesForDate,
  parseDateKey,
  summarizeDay,
  toDateKey,
  type ScheduleCase,
  type ServiceLine,
} from "./schedule";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onBackHome: () => void;
  onPrompt: (text: string) => void;
  /** Populated when a voice command like "show me May 20th" selects a day. */
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
  /** Click a case → try to open its preop if it matches a known case. */
  onOpenCase?: (caseId: string, query: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Controlled service-line filter. Lifted so voice tools can drive it. */
  activeLines?: Set<ServiceLine>;
  onActiveLinesChange?: (next: Set<ServiceLine>) => void;
  /** Controlled surgeon filter ("all" = no filter). */
  surgeonFilter?: string | "all";
  onSurgeonFilterChange?: (next: string | "all") => void;
}

// ──────────────────────────────────────────────────────────────────────────
// Top-level ScheduleScreen
// ──────────────────────────────────────────────────────────────────────────

export function ScheduleScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onPrompt,
  selectedDate,
  onSelectDate,
  onOpenCase,
  onSidebarNavigate,
  activeLines: activeLinesProp,
  onActiveLinesChange,
  surgeonFilter: surgeonFilterProp,
  onSurgeonFilterChange,
}: Props) {
  // Anchor month (first of month). Defaults to today's month.
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Controlled-with-fallback pattern: prefer props (voice drives these from
  // the route), fall back to local state when the parent doesn't pass them.
  const [activeLinesLocal, setActiveLinesLocal] = useState<Set<ServiceLine>>(
    () => new Set(SERVICE_LINES),
  );
  const [surgeonFilterLocal, setSurgeonFilterLocal] = useState<string | "all">("all");
  const activeLines = activeLinesProp ?? activeLinesLocal;
  const surgeonFilter = surgeonFilterProp ?? surgeonFilterLocal;
  const setActiveLines = (next: Set<ServiceLine>) => {
    if (onActiveLinesChange) onActiveLinesChange(next);
    else setActiveLinesLocal(next);
  };
  const setSurgeonFilter = (next: string | "all") => {
    if (onSurgeonFilterChange) onSurgeonFilterChange(next);
    else setSurgeonFilterLocal(next);
  };

  // When a voice command selects a day in another month, pan the calendar to it.
  useEffect(() => {
    if (!selectedDate) return;
    const d = parseDateKey(selectedDate);
    if (d.getMonth() !== anchor.getMonth() || d.getFullYear() !== anchor.getFullYear()) {
      setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [selectedDate, anchor]);

  const handleSelectDay = (date: string) => {
    onSelectDate?.(date);
  };

  const handleCloseDrawer = () => {
    onSelectDate?.(null);
  };

  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const todayKey = toDateKey(new Date());

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} activeKey="schedule" onNavigate={onSidebarNavigate} />

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
                Schedule · OR Board
              </div>
              <h1 className="mt-2 text-4xl font-extralight tracking-tight text-foreground">
                {monthLabel}
              </h1>
              <p className="mt-1 text-sm font-light text-muted-foreground">
                Tap a day for the full case list, timeline, and role-specific alerts — or ask Arti:
                <span className="ml-1 italic">"show me May 20th"</span>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const t = new Date();
                  setAnchor(new Date(t.getFullYear(), t.getMonth(), 1));
                  onSelectDate?.(toDateKey(t));
                }}
                className="rounded-full border border-border bg-surface/60 px-4 py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Filter bar */}
          <section className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
              <Filter className="h-3 w-3" />
              Filters
            </div>

            {SERVICE_LINES.map((line) => {
              const on = activeLines.has(line);
              return (
                <button
                  key={line}
                  type="button"
                  onClick={() => {
                    const next = new Set(activeLines);
                    if (next.has(line)) next.delete(line);
                    else next.add(line);
                    setActiveLines(next);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-light transition-colors",
                    on
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-surface/40 text-muted-foreground/70 hover:border-primary/30",
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SERVICE_LINE_COLORS[line] }}
                  />
                  {line}
                </button>
              );
            })}

            <div className="ml-2 h-6 w-px bg-border" />

            <select
              value={surgeonFilter}
              onChange={(e) => setSurgeonFilter(e.target.value as typeof surgeonFilter)}
              className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-light text-foreground focus:border-primary/50 focus:outline-none"
            >
              <option value="all">All surgeons</option>
              {SURGEONS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </section>

          {/* Calendar grid */}
          <CalendarGrid
            anchor={anchor}
            todayKey={todayKey}
            selectedDate={selectedDate ?? null}
            activeLines={activeLines}
            surgeonFilter={surgeonFilter}
            onSelectDay={handleSelectDay}
          />

          {/* Month stats footer */}
          <MonthStats anchor={anchor} activeLines={activeLines} surgeonFilter={surgeonFilter} />
        </main>

        <ArtiInvoker
          placeholder="Ask Arti about a date…"
          onSubmit={onPrompt}
          suggestions={["Show me May 5th", "Open today's schedule", "Back to home"]}
        />
      </div>

      {/* Day detail drawer */}
      <DayDetailDrawer
        date={selectedDate ?? null}
        onClose={handleCloseDrawer}
        onOpenCase={onOpenCase}
        onPrompt={onPrompt}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Calendar grid (month view, 6 rows × 7 cols)
// ──────────────────────────────────────────────────────────────────────────

function CalendarGrid({
  anchor,
  todayKey,
  selectedDate,
  activeLines,
  surgeonFilter,
  onSelectDay,
}: {
  anchor: Date;
  todayKey: string;
  selectedDate: string | null;
  activeLines: Set<ServiceLine>;
  surgeonFilter: string | "all";
  onSelectDay: (date: string) => void;
}) {
  // Build 6-week grid starting from the Sunday before the 1st of the month.
  const gridDays = useMemo(() => {
    const start = new Date(anchor);
    start.setDate(1);
    start.setDate(1 - start.getDay()); // back to Sunday
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [anchor]);

  return (
    <div className="rounded-2xl border border-border bg-surface/30 p-3">
      {/* Weekday header */}
      <div className="mb-2 grid grid-cols-7 gap-1 px-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const cases = getCasesForDate(key).filter(
            (c) =>
              activeLines.has(c.serviceLine) &&
              (surgeonFilter === "all" || c.surgeon === surgeonFilter),
          );
          return (
            <DayCell
              key={key}
              date={d}
              dateKey={key}
              inMonth={inMonth}
              isToday={isToday}
              isSelected={isSelected}
              cases={cases}
              onClick={() => onSelectDay(key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  date,
  dateKey,
  inMonth,
  isToday,
  isSelected,
  cases,
  onClick,
}: {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  cases: ScheduleCase[];
  onClick: () => void;
}) {
  const count = cases.length;
  const highRisk = cases.filter(
    (c) => c.asaClass === "III" || c.asaClass === "IV" || c.asaClass === "IV-E",
  ).length;
  const firstCase = cases[0];
  // Uniq service lines represented today (for dot colors)
  const lines = [...new Set(cases.map((c) => c.serviceLine))];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${formatLongDate(dateKey)}, ${count} cases`}
      className={cn(
        "group relative flex aspect-[7/6] min-h-[104px] flex-col items-start gap-1.5 rounded-lg border p-2 text-left transition-all",
        inMonth
          ? "border-border/60 bg-surface/40 hover:border-primary/40 hover:bg-surface/70"
          : "border-transparent bg-surface/10 text-muted-foreground/40 hover:bg-surface/30",
        isToday && "ring-1 ring-primary/60",
        isSelected && "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--primary)]",
      )}
    >
      {/* Date number */}
      <div className="flex w-full items-center justify-between">
        <span
          className={cn(
            "font-mono text-sm tabular-nums",
            isToday
              ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
              : inMonth
                ? "text-foreground"
                : "text-muted-foreground/40",
          )}
        >
          {date.getDate()}
        </span>
        {count > 0 && (
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
            {count} case{count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* First-case preview */}
      {inMonth && firstCase && (
        <div className="mt-auto w-full space-y-1">
          <div className="flex items-start gap-1 text-[11px] leading-tight">
            <span className="font-mono tabular-nums text-muted-foreground/80">
              {firstCase.time}
            </span>
            <span className="truncate font-light text-foreground/90">
              {firstCase.procedureShort}
            </span>
          </div>
          <div className="truncate text-[10px] font-light text-muted-foreground/70">
            {firstCase.surgeon.replace(/^Dr\. /, "Dr ")}
          </div>
          {count > 1 && (
            <div className="text-[10px] font-light text-muted-foreground/50">+{count - 1} more</div>
          )}
        </div>
      )}

      {/* Service line dots + risk marker */}
      {inMonth && count > 0 && (
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1">
          {highRisk > 0 && (
            <span
              title={`${highRisk} high-ASA case${highRisk === 1 ? "" : "s"}`}
              className="flex h-3 w-3 items-center justify-center rounded-full bg-warning/20 text-warning"
            >
              <AlertTriangle className="h-2 w-2" />
            </span>
          )}
          {lines.slice(0, 3).map((l) => (
            <span
              key={l}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: SERVICE_LINE_COLORS[l] }}
            />
          ))}
        </div>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Day detail drawer
// ──────────────────────────────────────────────────────────────────────────

function DayDetailDrawer({
  date,
  onClose,
  onOpenCase,
  onPrompt,
}: {
  date: string | null;
  onClose: () => void;
  onOpenCase?: (caseId: string, query: string) => void;
  onPrompt?: (text: string) => void;
}) {
  // Close on Escape.
  useEffect(() => {
    if (!date) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [date, onClose]);

  const cases = date ? getCasesForDate(date) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity",
          date ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Panel */}
      <aside
        aria-hidden={!date}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-[560px] max-w-[92vw] flex-col border-l border-border bg-surface/95 shadow-2xl backdrop-blur-xl transition-transform duration-300",
          date ? "translate-x-0" : "translate-x-full",
        )}
      >
        {date && (
          <DayDetailContent
            date={date}
            cases={cases}
            onClose={onClose}
            onOpenCase={onOpenCase}
            onPrompt={onPrompt}
          />
        )}
      </aside>
    </>
  );
}

function DayDetailContent({
  date,
  cases,
  onClose,
  onOpenCase,
  onPrompt,
}: {
  date: string;
  cases: ScheduleCase[];
  onClose: () => void;
  onOpenCase?: (caseId: string, query: string) => void;
  onPrompt?: (text: string) => void;
}) {
  const summary = summarizeDay(date);
  const highRisk = cases.filter(
    (c) => c.asaClass === "III" || c.asaClass === "IV" || c.asaClass === "IV-E",
  );
  const difficultAirway = cases.filter((c) =>
    (c.specialNeeds ?? []).some((n) => /difficult airway/i.test(n)),
  );
  const implantCount = cases.filter((c) => c.implantsRequired).length;
  const addOns = cases.filter((c) => c.addOn);
  const cancelled = cases.filter((c) => c.status === "cancelled");
  const rooms = [...new Set(cases.map((c) => c.room))].sort();

  return (
    <>
      <header className="shrink-0 border-b border-border/60 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
              Day Detail
            </div>
            <h2 className="mt-1 text-2xl font-light tracking-tight text-foreground">
              {formatLongDate(date)}
            </h2>
            <p className="mt-1 text-xs font-light text-muted-foreground">
              {summary.total} case{summary.total === 1 ? "" : "s"}
              {rooms.length > 0 && ` · ${rooms.length} room${rooms.length === 1 ? "" : "s"}`}
              {summary.firstStart && ` · first case ${summary.firstStart}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Insight chips */}
        {summary.total > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            {highRisk.length > 0 && (
              <InsightChip
                tone="warn"
                icon={<AlertTriangle className="h-3 w-3" />}
                label={`${highRisk.length} high-ASA (III+)`}
              />
            )}
            {difficultAirway.length > 0 && (
              <InsightChip
                tone="warn"
                icon={<AlertTriangle className="h-3 w-3" />}
                label={`${difficultAirway.length} difficult airway`}
              />
            )}
            {implantCount > 0 && (
              <InsightChip
                tone="info"
                icon={<Package className="h-3 w-3" />}
                label={`${implantCount} implant case${implantCount === 1 ? "" : "s"}`}
              />
            )}
            {addOns.length > 0 && (
              <InsightChip
                tone="info"
                icon={<Star className="h-3 w-3" />}
                label={`${addOns.length} add-on`}
              />
            )}
            {cancelled.length > 0 && (
              <InsightChip
                tone="danger"
                icon={<X className="h-3 w-3" />}
                label={`${cancelled.length} cancelled`}
              />
            )}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {cases.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
            <CalendarIcon className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.3} />
            <div className="mt-4 text-sm font-light text-muted-foreground">
              No cases scheduled for this day.
            </div>
          </div>
        ) : (
          <>
            <RoomTimeline cases={cases} rooms={rooms} />
            <CaseList cases={cases} onOpenCase={onOpenCase} onPrompt={onPrompt} />
          </>
        )}
      </div>
    </>
  );
}

function InsightChip({
  tone,
  icon,
  label,
}: {
  tone: "info" | "warn" | "danger";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono uppercase tracking-wider",
        tone === "warn" && "border-warning/40 bg-warning/10 text-warning",
        tone === "danger" && "border-destructive/40 bg-destructive/10 text-destructive",
        tone === "info" && "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      {icon}
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Per-room timeline visualization
// ──────────────────────────────────────────────────────────────────────────

const DAY_START_MIN = 7 * 60; // 07:00
const DAY_END_MIN = 19 * 60; // 19:00

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function RoomTimeline({ cases, rooms }: { cases: ScheduleCase[]; rooms: string[] }) {
  const span = DAY_END_MIN - DAY_START_MIN;
  const hoursTicks: number[] = [];
  for (let h = 7; h <= 19; h += 2) hoursTicks.push(h);

  return (
    <section className="border-b border-border/40 px-6 py-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/80">
        <Clock className="h-3 w-3" />
        OR timeline
      </div>

      <div className="relative">
        {/* Axis labels */}
        <div className="relative mb-2 h-4 border-b border-border/40">
          {hoursTicks.map((h) => {
            const pct = ((h * 60 - DAY_START_MIN) / span) * 100;
            return (
              <span
                key={h}
                className="absolute -translate-x-1/2 font-mono text-[9px] tabular-nums text-muted-foreground/60"
                style={{ left: `${pct}%`, top: 0 }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            );
          })}
        </div>

        {/* One row per room */}
        <div className="space-y-2">
          {rooms.map((room) => {
            const roomCases = cases.filter((c) => c.room === room);
            return (
              <div key={room} className="flex items-center gap-3">
                <div className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                  {room.replace("OR ", "")}
                </div>
                <div className="relative h-7 flex-1 rounded-md bg-surface-2/40">
                  {roomCases.map((c) => {
                    const start = timeToMin(c.time);
                    const end = start + c.durationMin;
                    const left = Math.max(0, ((start - DAY_START_MIN) / span) * 100);
                    const width = Math.max(1, ((end - start) / span) * 100);
                    const dimmed = c.status === "cancelled";
                    return (
                      <div
                        key={c.id}
                        title={`${c.time} · ${c.procedureShort} · ${c.patientName}`}
                        className={cn(
                          "absolute top-0.5 h-6 overflow-hidden rounded-md border px-1.5 py-0.5 text-[10px] font-light",
                          dimmed && "opacity-40 line-through",
                        )}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: `color-mix(in oklab, ${SERVICE_LINE_COLORS[c.serviceLine]} 25%, transparent)`,
                          borderColor: SERVICE_LINE_COLORS[c.serviceLine],
                          color: SERVICE_LINE_COLORS[c.serviceLine],
                        }}
                      >
                        <span className="block truncate text-foreground/90">
                          {c.procedureShort} · {c.patientName.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Case list (within drawer)
// ──────────────────────────────────────────────────────────────────────────

function CaseList({
  cases,
  onOpenCase,
  onPrompt,
}: {
  cases: ScheduleCase[];
  onOpenCase?: (caseId: string, query: string) => void;
  onPrompt?: (text: string) => void;
}) {
  return (
    <section className="px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/80">
          Cases ({cases.length})
        </div>
        {onPrompt && (
          <button
            type="button"
            onClick={() => onPrompt("open the next case")}
            className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
          >
            Ask Arti to open a case →
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {cases.map((c) => (
          <CaseRow
            key={c.id}
            c={c}
            onOpen={onOpenCase ? () => onOpenCase(c.id, `${c.patientName}'s case`) : undefined}
          />
        ))}
      </ul>
    </section>
  );
}

function CaseRow({ c, onOpen }: { c: ScheduleCase; onOpen?: () => void }) {
  const endTime = addMinutes(c.time, c.durationMin);
  const highRisk = c.asaClass === "III" || c.asaClass === "IV" || c.asaClass === "IV-E";
  const dimmed = c.status === "cancelled";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn(
          "group w-full rounded-xl border border-border/60 bg-surface/40 p-4 text-left transition-all",
          onOpen && "hover:border-primary/40 hover:bg-surface/70",
          !onOpen && "cursor-default",
          dimmed && "opacity-60",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Time + room + status */}
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="tabular-nums text-foreground">
                {c.time}–{endTime}
              </span>
              <span>·</span>
              <span>{c.room}</span>
              <span>·</span>
              <span>{c.serviceLine}</span>
              {c.firstCase && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                  <Star className="h-2.5 w-2.5" />
                  First
                </span>
              )}
              {c.addOn && (
                <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-accent">
                  Add-on
                </span>
              )}
            </div>

            {/* Procedure + side */}
            <div
              className={cn(
                "mt-1.5 text-base font-light text-foreground",
                dimmed && "line-through",
              )}
            >
              {c.procedure}
              {c.side && <span className="text-muted-foreground/70"> · {c.side}</span>}
            </div>

            {/* Patient + surgeon */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-light text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-3 w-3" />
                {c.patientName} · {c.patientAgeSex}
              </span>
              <span>·</span>
              <span>{c.surgeon}</span>
              <span>·</span>
              <span>{c.anesthesiaType}</span>
              <span className={cn(highRisk && "font-medium text-warning")}>ASA {c.asaClass}</span>
            </div>

            {/* Team (anesthesiologist · scrub tech · circulator) */}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] font-light">
              <dt className="font-mono uppercase tracking-wider text-muted-foreground/60">
                Anes
              </dt>
              <dd className="text-foreground/90">{c.anesthesiologist}</dd>
              <dt className="font-mono uppercase tracking-wider text-muted-foreground/60">
                Scrub
              </dt>
              <dd className="text-foreground/90">{c.scrubTech}</dd>
              <dt className="font-mono uppercase tracking-wider text-muted-foreground/60">
                Circ
              </dt>
              <dd className="text-foreground/90">{c.circulator}</dd>
            </dl>

            {/* Special needs */}
            {c.specialNeeds && c.specialNeeds.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {c.specialNeeds.map((n) => (
                  <li
                    key={n}
                    className="rounded-full border border-warning/30 bg-warning/5 px-2 py-0.5 text-[10px] font-light text-warning"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            )}

            {c.notes && (
              <div className="mt-1.5 text-[11px] font-light italic text-muted-foreground/70">
                {c.notes}
              </div>
            )}
          </div>

          {/* Status pill */}
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
              STATUS_META[c.status].tone,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[c.status].dot)} />
            {STATUS_META[c.status].label}
          </span>
        </div>
      </button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Month stats footer (block/utilization summary)
// ──────────────────────────────────────────────────────────────────────────

function MonthStats({
  anchor,
  activeLines,
  surgeonFilter,
}: {
  anchor: Date;
  activeLines: Set<ServiceLine>;
  surgeonFilter: string | "all";
}) {
  const stats = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const firstKey = toDateKey(first);
    const lastKey = toDateKey(last);

    const cases = SCHEDULE_CASES.filter(
      (c) =>
        c.date >= firstKey &&
        c.date <= lastKey &&
        activeLines.has(c.serviceLine) &&
        (surgeonFilter === "all" || c.surgeon === surgeonFilter),
    );

    const totalMinutes = cases.reduce((sum, c) => sum + c.durationMin, 0);
    const bySurgeon: Record<string, number> = {};
    for (const c of cases) {
      bySurgeon[c.surgeon] = (bySurgeon[c.surgeon] ?? 0) + 1;
    }
    const byRoom: Record<string, number> = {};
    for (const c of cases) {
      byRoom[c.room] = (byRoom[c.room] ?? 0) + 1;
    }
    return {
      total: cases.length,
      totalHours: Math.round(totalMinutes / 60),
      bySurgeon,
      byRoom,
    };
  }, [anchor, activeLines, surgeonFilter]);

  return (
    <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="glass rounded-2xl p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/80">
          Month volume
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-thin tabular-nums text-foreground">{stats.total}</span>
          <span className="text-sm font-light text-muted-foreground">cases</span>
        </div>
        <div className="mt-1 text-xs font-light text-muted-foreground">
          {stats.totalHours} block hours
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/80">
          Top surgeons
        </div>
        <ul className="mt-2 space-y-1">
          {Object.entries(stats.bySurgeon)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, n]) => (
              <li
                key={name}
                className="flex items-center justify-between text-sm font-light text-foreground"
              >
                <span className="truncate">{name}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{n}</span>
              </li>
            ))}
        </ul>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/80">
          Room utilization
        </div>
        <ul className="mt-2 space-y-1">
          {Object.entries(stats.byRoom)
            .sort((a, b) => b[1] - a[1])
            .map(([room, n]) => (
              <li
                key={room}
                className="flex items-center justify-between text-sm font-light text-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Hospital className="h-3.5 w-3.5 text-muted-foreground/70" />
                  {room}
                </span>
                <span className="font-mono tabular-nums text-muted-foreground">{n}</span>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
}
