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
import { TODAY_CASES, STATUS_META } from "../cases";
import { cn } from "@/lib/utils";
import type { WidgetContext } from "./types";

/**
 * Home-screen widget renderers, factored out so registry.tsx doesn't
 * balloon. Each export takes the shared `WidgetContext` so it has access
 * to `onPrompt` for click-emits-prompt actions.
 */

// ─────────────────────────────────────────────────────────────────────────
// Hero — greeting + day stats. Re-renders every 30s so the time stays live.
// ─────────────────────────────────────────────────────────────────────────

export function HomeHeroWidget({ ctx, staffName }: { ctx: WidgetContext; staffName: string }) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setTime(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);

  const completed = TODAY_CASES.filter((c) => c.status === "completed").length;
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
  // Suppress the unused-ctx lint in the home palette without changing the
  // signature — every widget receives ctx so the registry stays uniform.
  void ctx;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface/50 p-7 md:p-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "var(--gradient-deep)" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
            Arti · ready
          </div>
          <h1 className="mt-3 text-3xl font-extralight leading-[1.1] tracking-tight md:text-4xl">
            {greeting}, <span className="text-primary">{staffName.split(" ")[0]}</span>.
          </h1>
          <p className="mt-3 max-w-xl text-sm font-light text-muted-foreground">
            {dateStr} · {timeStr} · OR 326 is calibrated and sterile. {remaining} cases remain on
            today's board.
          </p>
        </div>
        <div className="flex shrink-0 items-end gap-8 self-end">
          <Stat label="Cases today" value={String(TODAY_CASES.length)} />
          <Stat label="Completed" value={String(completed)} accent="success" />
          <Stat label="Remaining" value={String(remaining)} accent="primary" />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Up next — card for the next case on the board.
// ─────────────────────────────────────────────────────────────────────────

export function HomeUpNextWidget({ ctx }: { ctx: WidgetContext }) {
  const upNext = TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0];
  return (
    <button
      type="button"
      onClick={() => ctx.onPrompt(`open ${upNext.patientName}'s case`)}
      className="glass group relative w-full overflow-hidden rounded-2xl p-6 text-left transition-all hover:border-primary/40 hover:bg-surface/70"
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
          Up Next
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            STATUS_META[upNext.status].tone,
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full heartbeat", STATUS_META[upNext.status].dot)}
          />
          {STATUS_META[upNext.status].label}
        </span>
      </div>
      <h2 className="mt-3 text-2xl font-extralight tracking-tight">
        {upNext.procedure}
        <span className="text-muted-foreground/60"> · {upNext.procedureShort}</span>
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm font-light text-muted-foreground">
        <span>
          {upNext.patientName} · {upNext.patientAgeSex}
          {upNext.side ? ` · ${upNext.side} shoulder` : ""}
        </span>
        <span>{upNext.surgeon}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Scheduled start
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-mono text-3xl font-thin tabular-nums">{upNext.time}</span>
          </div>
        </div>
        <div className="h-10 w-px bg-border" />
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
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity group-hover:opacity-90">
        <Sparkles className="h-3.5 w-3.5" />
        Open Pre-Op
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Room vitals — environmental snapshot for OR 326.
// ─────────────────────────────────────────────────────────────────────────

export function HomeRoomVitalsWidget({ ctx }: { ctx: WidgetContext }) {
  void ctx;
  return (
    <div className="glass h-full rounded-2xl p-5 text-left">
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
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cases per day — bar chart over the trailing week.
// ─────────────────────────────────────────────────────────────────────────

const CASES_PER_DAY = [
  { day: "Mon", cases: 4 },
  { day: "Tue", cases: 6 },
  { day: "Wed", cases: 5 },
  { day: "Thu", cases: 7 },
  { day: "Fri", cases: 5 },
  { day: "Sat", cases: 2 },
  { day: "Sun", cases: 0 },
];

export function HomeCasesPerDayWidget({ ctx }: { ctx: WidgetContext }) {
  return (
    <ChartCard
      eyebrow="Throughput · last 7 days"
      title="Cases per day"
      trailing={<TrendingPill value="+12%" />}
      onClick={() => ctx.onPrompt("show me the case list")}
    >
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
                fill={
                  i === 3
                    ? "var(--primary)"
                    : "color-mix(in oklab, var(--primary) 55%, transparent)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Procedure mix — donut + legend.
// ─────────────────────────────────────────────────────────────────────────

const PROCEDURE_MIX = [
  { name: "RSA", value: 38, color: "var(--primary)" },
  { name: "Rotator Cuff", value: 27, color: "var(--accent)" },
  { name: "SLAP / Bankart", value: 18, color: "var(--success)" },
  { name: "Other", value: 17, color: "var(--surface-3)" },
];

export function HomeProcedureMixWidget({ ctx }: { ctx: WidgetContext }) {
  const total = PROCEDURE_MIX.reduce((s, d) => s + d.value, 0);
  return (
    <ChartCard
      eyebrow="Mix · today"
      title="Procedure mix"
      onClick={() => ctx.onPrompt("show me the case list")}
    >
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
            <div className="font-mono text-2xl font-thin tabular-nums text-foreground">{total}</div>
          </div>
        </div>
        <ul className="space-y-2 pr-1">
          {PROCEDURE_MIX.map((d) => (
            <li key={d.name} className="flex items-center gap-2 font-mono text-[10px]">
              <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
              <span className="text-foreground/85">{d.name}</span>
              <span className="text-muted-foreground/70 tabular-nums">{d.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Quick actions — three big call-to-action cards.
// ─────────────────────────────────────────────────────────────────────────

export function HomeQuickActionsWidget({ ctx }: { ctx: WidgetContext }) {
  const upNext = TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <QuickCard
        icon={ListChecks}
        title="Today's case list"
        copy={`${TODAY_CASES.length} cases scheduled in OR 326`}
        cta="Show me"
        onClick={() => ctx.onPrompt("show me the case list")}
      />
      <QuickCard
        icon={Calendar}
        title="Open the next case"
        copy={`${upNext.procedureShort} · ${upNext.patientName} at ${upNext.time}`}
        cta="Pre-op"
        onClick={() => ctx.onPrompt(`open ${upNext.patientName}'s case`)}
      />
      <QuickCard
        icon={Sparkles}
        title="Surgeon preferences"
        copy="Pull Dr. Patel's RSA preference card"
        cta="Open card"
        onClick={() => ctx.onPrompt("open dr patel preference cards")}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Local helpers (kept private to home widgets)
// ─────────────────────────────────────────────────────────────────────────

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
          "mt-1 text-3xl font-thin tabular-nums md:text-4xl",
          accent === "primary" && "text-primary",
          accent === "success" && "text-success",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-warning/40 bg-warning/10 text-warning",
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
      type="button"
      onClick={onClick}
      className="group glass relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:border-primary/40 hover:bg-surface/70"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-primary">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </div>
      <div className="mt-3 text-base font-light text-foreground">{title}</div>
      <div className="mt-1 text-sm font-light text-muted-foreground">{copy}</div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70 transition-colors group-hover:text-primary">
        {cta} →
      </div>
    </button>
  );
}

function ChartCard({
  eyebrow,
  title,
  trailing,
  children,
  onClick,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
            {eyebrow}
          </div>
          <h3 className="mt-1.5 text-base font-light tracking-tight text-foreground">{title}</h3>
        </div>
        {trailing}
      </header>
      <div className="mt-4 h-[200px] w-full">{children}</div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="glass relative w-full overflow-hidden rounded-2xl p-5 text-left transition-all hover:border-primary/40 hover:bg-surface/70"
      >
        {body}
      </button>
    );
  }
  return <article className="glass relative overflow-hidden rounded-2xl p-5">{body}</article>;
}

function TrendingPill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-success">
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
      <div className="mt-0.5 font-mono text-sm tabular-nums text-foreground">{item.value}</div>
    </div>
  );
}
