import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <section className="glass relative overflow-hidden rounded-2xl p-7 md:p-8">
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

// ─────────────────────────────────────────────────────────────────────────
// Circulating-nurse readiness widgets — designed around what a circulator
// actually needs to scan in the minutes before her case starts. Status
// lights tell her at a glance: what's covered, what's pending, what's
// missing. Seeded with realistic items for the up-next case so the demo
// reads as live OR data, not abstract placeholders.
// ─────────────────────────────────────────────────────────────────────────

type ReadinessStatus = "ready" | "pending" | "issue";

const STATUS_PIP: Record<ReadinessStatus, { dotClass: string; ringClass: string; label: string }> =
  {
    ready: {
      dotClass: "bg-success",
      ringClass: "border-success/40 bg-success/10 text-success",
      label: "Ready",
    },
    pending: {
      dotClass: "bg-warning",
      ringClass: "border-warning/40 bg-warning/10 text-warning",
      label: "Pending",
    },
    issue: {
      dotClass: "bg-destructive",
      ringClass: "border-destructive/40 bg-destructive/10 text-destructive",
      label: "Missing",
    },
  };

function StatusPip({ status }: { status: ReadinessStatus }) {
  const meta = STATUS_PIP[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        meta.ringClass,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}

function WidgetShell({
  eyebrow,
  title,
  trailing,
  children,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass h-full rounded-2xl p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
            {eyebrow}
          </div>
          <h3 className="mt-1.5 text-base font-light tracking-tight text-foreground">{title}</h3>
        </div>
        {trailing}
      </header>
      {children}
    </section>
  );
}

// ─── Supply status ─────────────────────────────────────────────────────

export const SUPPLY_GROUPS: Array<{
  category: string;
  items: Array<{ label: string; status: ReadinessStatus; detail?: string }>;
}> = [
  {
    category: "Implants",
    items: [
      { label: "Glenosphere 38 mm", status: "ready", detail: "On back table" },
      { label: "Humeral stem · size 8", status: "ready", detail: "Press-fit" },
      { label: "Backup cemented stem", status: "pending", detail: "Vendor ETA 8 min" },
    ],
  },
  {
    category: "Sutures & Anchors",
    items: [
      { label: "FiberWire #2 × 4", status: "ready" },
      { label: "SwiveLock 4.75 mm × 2", status: "ready" },
    ],
  },
  {
    category: "Sterile Trays",
    items: [
      { label: "Medtronix RSA tray", status: "ready", detail: "Sterilized 06:42" },
      { label: "Mayo / opening set", status: "ready", detail: "On rack 2" },
    ],
  },
  {
    category: "Disposables",
    items: [
      { label: "ChloraPrep × 3", status: "ready" },
      { label: "Raytec 4×4 × 20", status: "ready" },
      { label: "Lap sponges × 10", status: "ready" },
      { label: "Hemovac drain 10 Fr", status: "ready" },
    ],
  },
  {
    category: "Blood Products",
    items: [
      { label: "T&S complete", status: "ready", detail: "Posted 06:18" },
      { label: "2u PRBC available", status: "ready", detail: "On standby" },
    ],
  },
];

export function HomeSupplyStatusWidget({ ctx }: { ctx: WidgetContext }) {
  void ctx;
  const counts = useMemo(() => {
    let ready = 0;
    let pending = 0;
    let issue = 0;
    for (const g of SUPPLY_GROUPS) {
      for (const it of g.items) {
        if (it.status === "ready") ready++;
        else if (it.status === "pending") pending++;
        else issue++;
      }
    }
    return { ready, pending, issue };
  }, []);
  return (
    <WidgetShell
      eyebrow="Pre-incision · supply"
      title="Supply status"
      trailing={
        <div className="flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
          <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-success">
            {counts.ready} ready
          </span>
          {counts.pending > 0 && (
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning">
              {counts.pending} pending
            </span>
          )}
          {counts.issue > 0 && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive">
              {counts.issue} missing
            </span>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SUPPLY_GROUPS.map((g) => (
          <div key={g.category}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              {g.category}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {g.items.map((it) => (
                <li
                  key={it.label}
                  className="flex items-center justify-between gap-3 text-sm font-light"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground/90">{it.label}</div>
                    {it.detail && (
                      <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {it.detail}
                      </div>
                    )}
                  </div>
                  <StatusPip status={it.status} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

// ─── OR status ─────────────────────────────────────────────────────────

export const OR_STATUS_GROUPS: Array<{
  category: string;
  items: Array<{ label: string; status: ReadinessStatus; detail?: string }>;
}> = [
  {
    category: "Instruments",
    items: [
      { label: "Mayo stand staged", status: "ready", detail: "Per Patel pref card" },
      { label: "Back table set", status: "ready" },
      { label: "Power reamer & drill", status: "ready", detail: "Battery 96%" },
    ],
  },
  {
    category: "OR Table",
    items: [
      { label: "Beach chair · 60–70°", status: "ready" },
      { label: "Spider arm holder", status: "ready", detail: "Mounted, locked" },
      { label: "Padding · axillary roll", status: "ready" },
    ],
  },
  {
    category: "Imaging Displays",
    items: [
      { label: "Wall display", status: "ready", detail: "Live · Arti Wall" },
      { label: "Surgeon monitor", status: "ready", detail: "30° scope input" },
      { label: "Anesthesia mirror", status: "ready" },
    ],
  },
  {
    category: "Sterile Field & Equipment",
    items: [
      { label: "Sterile field calibrated", status: "ready", detail: "06:42" },
      { label: "Bovie · blend 30/30", status: "ready" },
      { label: "Arthroscopy pump", status: "pending", detail: "Priming · 3 min" },
      { label: "Suction × 2", status: "ready" },
    ],
  },
];

export function HomeORStatusWidget({ ctx }: { ctx: WidgetContext }) {
  void ctx;
  return (
    <WidgetShell eyebrow="Pre-incision · room" title="OR readiness">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {OR_STATUS_GROUPS.map((g) => (
          <div key={g.category}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              {g.category}
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {g.items.map((it) => (
                <li
                  key={it.label}
                  className="flex items-center justify-between gap-3 text-sm font-light"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-foreground/90">{it.label}</div>
                    {it.detail && (
                      <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {it.detail}
                      </div>
                    )}
                  </div>
                  <StatusPip status={it.status} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

// ─── Task checklist ────────────────────────────────────────────────────

export interface HomeTask {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
}

export const SEED_TASKS: HomeTask[] = [
  { id: "consent", label: "Verify consent signed in EMR", done: true, detail: "Signed 06:31" },
  { id: "prior-count", label: "Confirm prior case count complete", done: true },
  {
    id: "block",
    label: "Confirm interscalene block w/ anesthesia",
    done: false,
    detail: "Due 09:25",
  },
  { id: "raytec", label: "Stock raytec for room turnover", done: false },
  { id: "timeout", label: "Schedule final time-out", done: false, detail: "09:42 target" },
  { id: "family", label: "Update Mrs. Chen — 09:30 check-in", done: false },
];

const HOME_TASKS_STORAGE_KEY = "arti.home.tasks";

/** Read the live checklist state from localStorage, overlaying saved
 *  done/not-done flags onto the seed list. Used by both the widget and
 *  the route's voice-context builder so Arti always reads the live
 *  state — Laura can ask "what's done and what's left?" without
 *  looking at the wall. */
export function loadHomeTasks(): HomeTask[] {
  if (typeof window === "undefined") return SEED_TASKS.map((t) => ({ ...t }));
  try {
    const raw = window.localStorage.getItem(HOME_TASKS_STORAGE_KEY);
    if (!raw) return SEED_TASKS.map((t) => ({ ...t }));
    const parsed = JSON.parse(raw) as Record<string, boolean> | null;
    if (!parsed || typeof parsed !== "object") {
      return SEED_TASKS.map((t) => ({ ...t }));
    }
    return SEED_TASKS.map((t) => ({
      ...t,
      done: typeof parsed[t.id] === "boolean" ? parsed[t.id] : t.done,
    }));
  } catch {
    return SEED_TASKS.map((t) => ({ ...t }));
  }
}

function saveHomeTasks(tasks: HomeTask[]): void {
  if (typeof window === "undefined") return;
  try {
    const map = Object.fromEntries(tasks.map((t) => [t.id, t.done]));
    window.localStorage.setItem(HOME_TASKS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Custom event that fires whenever the wrap-up checklist state changes —
 * needed because the storage event only fires across tabs, not within the
 * same tab. The widget subscribes so voice updates re-render the UI
 * without having to lift state into the route.
 */
const HOME_TASKS_CHANGED_EVENT = "arti:home-tasks-changed";

/** Fuzzy-match a wrap-up task by free-text (label substring or id). */
export function findHomeTask(query: string): HomeTask | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  const tasks = loadHomeTasks();
  const byId = tasks.find((t) => t.id === q);
  if (byId) return byId;
  const byLabel = tasks.find((t) => t.label.toLowerCase().includes(q));
  if (byLabel) return byLabel;
  // Reverse direction — query contains a meaningful word from the label.
  return tasks.find((t) => {
    const words = t.label.toLowerCase().split(/\s+/);
    return words.some((w) => w.length >= 4 && q.includes(w));
  });
}

/**
 * External setter — voice tools call this to flip a wrap-up task. Persists
 * to localStorage and fires the in-tab change event so the mounted widget
 * (if any) re-renders. Returns the task that was updated, or undefined if
 * no match.
 */
export function setHomeTaskDone(query: string, done: boolean): HomeTask | undefined {
  const task = findHomeTask(query);
  if (!task) return undefined;
  const next = loadHomeTasks().map((t) => (t.id === task.id ? { ...t, done } : t));
  saveHomeTasks(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HOME_TASKS_CHANGED_EVENT));
  }
  return { ...task, done };
}

export function HomeTaskChecklistWidget({ ctx }: { ctx: WidgetContext }) {
  void ctx;
  const [tasks, setTasks] = useState<HomeTask[]>(() => loadHomeTasks());
  // Persist on every change so voice tools can read the live state.
  useEffect(() => {
    saveHomeTasks(tasks);
  }, [tasks]);
  // Re-load from storage when voice tools flip a task externally. Custom
  // event is needed because the native `storage` event doesn't fire in the
  // same tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setTasks(loadHomeTasks());
    window.addEventListener(HOME_TASKS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(HOME_TASKS_CHANGED_EVENT, handler);
  }, []);
  const remaining = tasks.filter((t) => !t.done).length;
  return (
    <WidgetShell
      eyebrow="My remaining tasks"
      title="Wrap-up checklist"
      trailing={
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
            remaining === 0
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning",
          )}
        >
          {remaining === 0 ? "All done" : `${remaining} left`}
        </span>
      }
    >
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() =>
                setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
              }
              className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                  t.done ? "border-success bg-success" : "border-muted-foreground/40",
                )}
              >
                {t.done && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3 text-success-foreground">
                    <path
                      d="M2 6l2.5 2.5L10 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-sm font-light leading-snug",
                    t.done ? "text-muted-foreground line-through" : "text-foreground/90",
                  )}
                >
                  {t.label}
                </div>
                {t.detail && (
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {t.detail}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

// ─── Comms feed ────────────────────────────────────────────────────────

export type CommSource = "PACU" | "Family" | "Anesthesia" | "Sub-sterile" | "Charge RN";

export interface HomeCommReply {
  id: string;
  from: "incoming" | "outgoing";
  /** Sender label rendered in the thread bubble ("Laura, RN" / "PACU charge"). */
  senderLabel: string;
  text: string;
  timeIso: string;
}

export interface HomeComm {
  id: string;
  source: CommSource;
  time: string;
  message: string;
  unread?: boolean;
  /** Reply thread, oldest-first. Initial message is rendered above the thread. */
  thread?: HomeCommReply[];
}

const HOME_COMMS_STORAGE_KEY = "arti.home.comms";
const HOME_COMMS_CHANGED_EVENT = "arti:home-comms-changed";

const COMM_TONE: Record<CommSource, string> = {
  PACU: "border-primary/40 bg-primary/10 text-primary",
  Family: "border-accent/40 bg-accent/10 text-accent",
  Anesthesia: "border-warning/40 bg-warning/10 text-warning",
  "Sub-sterile": "border-success/40 bg-success/10 text-success",
  "Charge RN": "border-border/60 bg-surface-2 text-foreground/85",
};

export const SEED_COMMS: HomeComm[] = [
  {
    id: "pacu-1",
    source: "PACU",
    time: "06:48",
    message: "Bay 3 ready when you are. Send patient anytime after 09:50.",
    unread: true,
  },
  {
    id: "family-1",
    source: "Family",
    time: "07:15",
    message: "Mrs. Chen requested an update at 09:30 — please call waiting room ext 4408.",
    unread: true,
  },
  {
    id: "anesth-1",
    source: "Anesthesia",
    time: "06:55",
    message: "Pre-op interscalene block complete, patient stable. Bringing back at 09:25.",
  },
  {
    id: "subster-1",
    source: "Sub-sterile",
    time: "07:02",
    message: "RSA tray on rack 2, glenosphere 38 mm verified.",
  },
  {
    id: "charge-1",
    source: "Charge RN",
    time: "06:30",
    message: "OR 327 turnover delayed ~15 min — heads up if you need the boom.",
  },
];

/** Read the live comms list — seed merged with any saved unread/thread state. */
export function loadHomeComms(): HomeComm[] {
  if (typeof window === "undefined") return SEED_COMMS.map((c) => ({ ...c }));
  try {
    const raw = window.localStorage.getItem(HOME_COMMS_STORAGE_KEY);
    if (!raw) return SEED_COMMS.map((c) => ({ ...c }));
    const parsed = JSON.parse(raw) as Record<
      string,
      { unread?: boolean; thread?: HomeCommReply[] }
    > | null;
    if (!parsed || typeof parsed !== "object") return SEED_COMMS.map((c) => ({ ...c }));
    return SEED_COMMS.map((c) => {
      const overlay = parsed[c.id];
      if (!overlay) return { ...c };
      return {
        ...c,
        unread: typeof overlay.unread === "boolean" ? overlay.unread : c.unread,
        thread: Array.isArray(overlay.thread) ? overlay.thread : c.thread,
      };
    });
  } catch {
    return SEED_COMMS.map((c) => ({ ...c }));
  }
}

function saveHomeComms(comms: HomeComm[]): void {
  if (typeof window === "undefined") return;
  try {
    const overlay: Record<string, { unread?: boolean; thread?: HomeCommReply[] }> = {};
    for (const c of comms) {
      overlay[c.id] = { unread: c.unread, thread: c.thread };
    }
    window.localStorage.setItem(HOME_COMMS_STORAGE_KEY, JSON.stringify(overlay));
  } catch {
    // ignore
  }
}

function emitCommsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HOME_COMMS_CHANGED_EVENT));
  }
}

/** Mark a single comm as read. Returns the updated comm or undefined. */
export function markCommRead(id: string): HomeComm | undefined {
  const comms = loadHomeComms();
  const idx = comms.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  if (!comms[idx].unread) return comms[idx];
  comms[idx] = { ...comms[idx], unread: false };
  saveHomeComms(comms);
  emitCommsChanged();
  return comms[idx];
}

/** Append a reply to a comm thread. Auto-clears unread. */
export function appendCommReply(id: string, reply: HomeCommReply): HomeComm | undefined {
  const comms = loadHomeComms();
  const idx = comms.findIndex((c) => c.id === id);
  if (idx < 0) return undefined;
  const thread = [...(comms[idx].thread ?? []), reply];
  comms[idx] = { ...comms[idx], thread, unread: false };
  saveHomeComms(comms);
  emitCommsChanged();
  return comms[idx];
}

/** Find the most-recent comm from a given source (for voice-by-name replies). */
export function findLatestCommBySource(source: CommSource): HomeComm | undefined {
  const comms = loadHomeComms();
  return comms.find((c) => c.source === source);
}

export function HomeCommsFeedWidget({ ctx }: { ctx: WidgetContext }) {
  void ctx;
  const [comms, setComms] = useState<HomeComm[]>(() => loadHomeComms());
  const [openCommId, setOpenCommId] = useState<string | null>(null);

  // Subscribe to changes so voice updates (or another tab) re-render this widget.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setComms(loadHomeComms());
    window.addEventListener(HOME_COMMS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(HOME_COMMS_CHANGED_EVENT, handler);
  }, []);

  const unread = comms.filter((c) => c.unread).length;
  const openComm = openCommId ? (comms.find((c) => c.id === openCommId) ?? null) : null;

  function handleOpen(id: string) {
    markCommRead(id);
    setOpenCommId(id);
  }

  function handleSendReply(text: string) {
    if (!openComm || !text.trim()) return;
    appendCommReply(openComm.id, {
      id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: "outgoing",
      senderLabel: "Laura, RN",
      text: text.trim(),
      timeIso: new Date().toISOString(),
    });
  }

  return (
    <WidgetShell
      eyebrow="Inbound · last 30 min"
      title="Communications"
      trailing={
        unread > 0 ? (
          <span className="rounded-full border border-primary/50 bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            {unread} unread
          </span>
        ) : null
      }
    >
      <ul className="space-y-2.5">
        {comms.map((c) => {
          const replyCount = c.thread?.length ?? 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => handleOpen(c.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors hover:border-primary/40",
                  c.unread
                    ? "border-primary/30 bg-primary/[0.04]"
                    : "border-border/60 bg-surface-2/30",
                )}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                      COMM_TONE[c.source],
                    )}
                  >
                    {c.source}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {c.time}
                  </span>
                  {replyCount > 0 && (
                    <span className="rounded-full border border-border/60 bg-surface-3/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {replyCount} repl{replyCount === 1 ? "y" : "ies"}
                    </span>
                  )}
                  {c.unread && (
                    <span
                      className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  )}
                </div>
                <p className="text-sm font-light leading-snug text-foreground/90">{c.message}</p>
              </button>
            </li>
          );
        })}
      </ul>

      <CommsThreadModal
        open={openComm !== null}
        onClose={() => setOpenCommId(null)}
        comm={openComm}
        onSend={handleSendReply}
      />
    </WidgetShell>
  );
}

// ── Comms thread modal (clicked comm → conversation view + reply input) ──

function CommsThreadModal({
  open,
  onClose,
  comm,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  comm: HomeComm | null;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  // Reset draft when switching threads.
  useEffect(() => {
    if (!open) setDraft("");
  }, [open, comm?.id]);

  if (!comm) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-[min(95vw,42rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                COMM_TONE[comm.source],
              )}
            >
              {comm.source}
            </span>
            <span className="font-light">Thread</span>
            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
              opened {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Replies are sent as Laura, RN. Voice equivalent: &ldquo;Arti, message {comm.source} —
            &lt;your reply&gt;.&rdquo;
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
          {/* Original incoming message */}
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-tl-md border border-primary/30 bg-primary/[0.06] px-4 py-3 text-sm font-light text-foreground/90">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {comm.source} · {comm.time}
              </div>
              <div className="mt-1">{comm.message}</div>
            </div>
          </div>

          {/* Thread */}
          {(comm.thread ?? []).map((r) => {
            const isOut = r.from === "outgoing";
            return (
              <div key={r.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm font-light",
                    isOut
                      ? "rounded-tr-md border border-success/30 bg-success/[0.08] text-foreground/90"
                      : "rounded-tl-md border border-primary/30 bg-primary/[0.06] text-foreground/90",
                  )}
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                    {r.senderLabel} ·{" "}
                    {new Date(r.timeIso).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="mt-1">{r.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onSend(draft);
            setDraft("");
          }}
          className="flex shrink-0 items-center gap-2 border-t border-border/40 px-2 pt-3"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Reply to ${comm.source}…`}
            className="flex-1 rounded-full border border-border/50 bg-surface-3/30 px-4 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full border border-primary/40 bg-primary/15 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
