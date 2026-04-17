import { useEffect, useState } from "react";
import {
  Activity,
  Calendar,
  Clock,
  HeartPulse,
  ListChecks,
  Sparkles,
  Thermometer,
  TrendingUp,
  Wind,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PromptBar } from "./PromptBar";
import { TODAY_CASES, STATUS_META } from "./cases";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onPrompt: (text: string) => void;
}

/**
 * Ambient post-greeting Home. This is what Arti shows once the staff is
 * acknowledged but hasn't asked for anything specific yet. Three jobs:
 *   1. Confirm "I see you, here's where the day stands."
 *   2. Surface the next case + quick environment vitals.
 *   3. Invite the next instruction via the prompt.
 */
export function HomeDashboard({ staffName, staffRole, initials, onSleep, onPrompt }: Props) {
  const [time, setTime] = useState<Date>(new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 1000 * 30);
    return () => clearInterval(i);
  }, []);

  const completed = TODAY_CASES.filter((c) => c.status === "completed").length;
  const upNext = TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0];
  const remaining = TODAY_CASES.length - completed;

  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const dateStr = time.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
          cockpitMode={false}
          onToggleCockpit={() => {}}
        />

        <main className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 pt-10 pb-40 animate-fade-in">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl border border-border bg-surface/50 p-8 md:p-10">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{ background: "var(--gradient-deep)" }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
                  Arti · ready
                </div>
                <h1 className="mt-3 text-4xl font-extralight leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
                  {greeting},{" "}
                  <span className="text-primary">{staffName.split(" ")[0]}</span>.
                </h1>
                <p className="mt-3 max-w-xl text-base font-light text-muted-foreground">
                  {dateStr} · {timeStr} · OR 326 is calibrated and sterile. {remaining}{" "}
                  cases remain on today's board.
                </p>
              </div>
              <div className="flex shrink-0 items-end gap-8 self-end">
                <Stat label="Cases today" value={String(TODAY_CASES.length)} />
                <Stat label="Completed" value={String(completed)} accent="success" />
                <Stat label="Remaining" value={String(remaining)} accent="primary" />
              </div>
            </div>
          </section>

          {/* Two-column: Up next + environment / quick-actions */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Up next */}
            <article className="xl:col-span-2 glass relative overflow-hidden rounded-2xl p-7">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
                  Up Next
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    STATUS_META[upNext.status].tone
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full heartbeat",
                      STATUS_META[upNext.status].dot
                    )}
                  />
                  {STATUS_META[upNext.status].label}
                </span>
              </div>

              <h2 className="mt-3 text-3xl font-extralight tracking-tight">
                {upNext.procedure}
                <span className="text-muted-foreground/60"> · {upNext.procedureShort}</span>
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-light text-muted-foreground">
                <span>
                  {upNext.patientName} · {upNext.patientAgeSex} · {upNext.side} shoulder
                </span>
                <span>{upNext.surgeon}</span>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-6">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Scheduled start
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="font-mono text-4xl font-thin tabular-nums">
                      {upNext.time}
                    </span>
                  </div>
                </div>
                <div className="h-12 w-px bg-border" />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Pre-op readiness
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ReadinessPip ok label="Tray" />
                    <ReadinessPip ok label="Imaging" />
                    <ReadinessPip ok label="Consent" />
                    <ReadinessPip label="Time-out" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => onPrompt(`open ${upNext.patientName}'s case`)}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                Open Pre-Op
              </button>
            </article>

            {/* Environment */}
            <aside className="space-y-5">
              <div className="glass rounded-2xl p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Room Vitals · OR 326
                </div>
                <div className="mt-4 space-y-4">
                  <Vital icon={Thermometer} label="Temperature" value="21.4°C" sub="target 21–23°C" />
                  <Vital icon={Wind} label="Humidity" value="48%" sub="target 30–60%" />
                  <Vital icon={Activity} label="Air exchanges" value="20 / hr" sub="ASHRAE compliant" />
                  <Vital icon={HeartPulse} label="Sterile field" value="Calibrated" sub="checked 06:42" />
                </div>
              </div>
            </aside>
          </section>

          {/* Analytics — bar + pie */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              eyebrow="Throughput · last 7 days"
              title="Cases per day"
              trailing={<TrendingPill value="+12%" />}
            >
              <CasesPerDayChart />
            </ChartCard>

            <ChartCard
              eyebrow="Mix · today"
              title="Procedure mix"
            >
              <ProcedureMixChart />
            </ChartCard>
          </section>

          {/* Quick suggestions */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <QuickCard
              icon={ListChecks}
              title="Today's case list"
              copy={`${TODAY_CASES.length} cases scheduled in OR 326`}
              cta="Show me"
              onClick={() => onPrompt("show me the case list")}
            />
            <QuickCard
              icon={Calendar}
              title="Open the next case"
              copy={`${upNext.procedureShort} · ${upNext.patientName} at ${upNext.time}`}
              cta="Pre-op"
              onClick={() => onPrompt(`open ${upNext.patientName}'s case`)}
            />
            <QuickCard
              icon={Sparkles}
              title="Surgeon preferences"
              copy="Pull Dr. Patel's RSA preference card"
              cta="Open card"
              onClick={() => onPrompt("open marcus chen's case")}
            />
          </section>
        </main>

        {/* Floating prompt */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-8 pb-6">
          <div className="pointer-events-auto w-full max-w-2xl">
            <PromptBar
              placeholder="Ask Arti anything…"
              onSubmit={onPrompt}
              suggestions={[
                "Show me the case list",
                "Open the next case",
                "What's my day look like?",
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "success";
}) {
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-4xl font-thin tabular-nums",
          accent === "primary" && "text-primary",
          accent === "success" && "text-success"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Vital({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-sm font-light text-foreground">{label}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {sub}
          </div>
        </div>
      </div>
      <div className="font-mono text-base tabular-nums text-foreground/90">{value}</div>
    </div>
  );
}

function ReadinessPip({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider",
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-warning")} />
      {label}
    </span>
  );
}

function QuickCard({
  icon: Icon,
  title,
  copy,
  cta,
  onClick,
}: {
  icon: typeof Sparkles;
  title: string;
  copy: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group glass relative overflow-hidden rounded-2xl p-6 text-left transition-all hover:border-primary/40 hover:bg-surface/70"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </div>
      <div className="mt-4 text-base font-light text-foreground">{title}</div>
      <div className="mt-1 text-sm font-light text-muted-foreground">{copy}</div>
      <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 transition-colors group-hover:text-primary">
        {cta} →
      </div>
    </button>
  );
}

/* ----------------------------------------------------------------- */
/*  Charts                                                            */
/* ----------------------------------------------------------------- */

const CASES_PER_DAY = [
  { day: "Mon", cases: 4 },
  { day: "Tue", cases: 6 },
  { day: "Wed", cases: 5 },
  { day: "Thu", cases: 7 },
  { day: "Fri", cases: 5 },
  { day: "Sat", cases: 2 },
  { day: "Sun", cases: 0 },
];

const PROCEDURE_MIX = [
  { name: "RSA", value: 38, color: "var(--primary)" },
  { name: "Rotator Cuff", value: 27, color: "var(--accent)" },
  { name: "SLAP / Bankart", value: 18, color: "var(--success)" },
  { name: "Other", value: 17, color: "var(--surface-3)" },
];

function ChartCard({
  eyebrow,
  title,
  trailing,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("glass relative overflow-hidden rounded-2xl p-6", className)}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
            {eyebrow}
          </div>
          <h3 className="mt-1.5 text-lg font-light tracking-tight text-foreground">{title}</h3>
        </div>
        {trailing}
      </header>
      <div className="mt-5 h-[220px] w-full">{children}</div>
    </article>
  );
}

function TrendingPill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
      <TrendingUp className="h-3 w-3" />
      {value}
    </span>
  );
}

function ChartTooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload?: { name?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label ?? item.payload?.name ?? item.name}
      </div>
      <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">
        {item.value}
      </div>
    </div>
  );
}

function CasesPerDayChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={CASES_PER_DAY} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          width={32}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-2)", opacity: 0.4 }}
          content={<ChartTooltipBox />}
        />
        <Bar dataKey="cases" radius={[6, 6, 0, 0]} maxBarSize={36}>
          {CASES_PER_DAY.map((d, i) => (
            <Cell
              key={d.day}
              fill={i === 3 ? "var(--primary)" : "color-mix(in oklab, var(--primary) 55%, transparent)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProcedureMixChart() {
  const total = PROCEDURE_MIX.reduce((s, d) => s + d.value, 0);
  return (
    <div className="grid h-full grid-cols-[1fr_auto] items-center gap-4">
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltipBox />} />
            <Pie
              data={PROCEDURE_MIX}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {PROCEDURE_MIX.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Total
          </div>
          <div className="font-mono text-2xl font-thin tabular-nums text-foreground">
            {total}
          </div>
        </div>
      </div>
      <ul className="space-y-2 pr-1">
        {PROCEDURE_MIX.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-xs font-light text-muted-foreground">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-foreground/80">{d.name}</span>
            <span className="ml-auto font-mono tabular-nums text-muted-foreground/70">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
