import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Package,
  Star,
  User as UserIcon,
  X,
} from "lucide-react";
import { STATUS_META } from "./cases";
import {
  SERVICE_LINE_COLORS,
  addMinutes,
  formatLongDate,
  getCasesForPerson,
  rangeForView,
  resolvePerson,
  type PersonRole,
  type PersonScheduleView,
  type ScheduleCase,
} from "./schedule";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  /** Spoken name as resolved by `resolvePerson` — full canonical name. */
  personName: string | null;
  /** Required role hint so we know which schedule field to filter on. */
  personRole: PersonRole | null;
  view: PersonScheduleView;
  onClose: () => void;
  onChangeView: (v: PersonScheduleView) => void;
  /** Optional: clicking a case routes through here; route handler decides what to do. */
  onOpenCase?: (caseId: string, query: string) => void;
}

const ROLE_LABEL: Record<PersonRole, string> = {
  Surgeon: "Surgeon",
  Anesthesiologist: "Anesthesiologist",
  "Scrub Tech": "Scrub Tech",
  Circulator: "Circulating Nurse",
};

export function PersonScheduleModal({
  open,
  personName,
  personRole,
  view,
  onClose,
  onChangeView,
  onOpenCase,
}: Props) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const person = useMemo(
    () => (personName && personRole ? resolvePerson(personName, personRole) : null),
    [personName, personRole],
  );

  const range = useMemo(() => rangeForView(view), [view]);

  const cases = useMemo(() => {
    if (!person) return [];
    return getCasesForPerson(person, range.start, range.end);
  }, [person, range.start, range.end]);

  // Quick stats
  const stats = useMemo(() => {
    const totalMinutes = cases.reduce((s, c) => s + c.durationMin, 0);
    const implants = cases.filter((c) => c.implantsRequired).length;
    const highRisk = cases.filter(
      (c) => c.asaClass === "III" || c.asaClass === "IV" || c.asaClass === "IV-E",
    ).length;
    const lines = [...new Set(cases.map((c) => c.serviceLine))];
    return {
      total: cases.length,
      hours: Math.round(totalMinutes / 60),
      implants,
      highRisk,
      lines,
    };
  }, [cases]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ps-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            key="ps-card"
            role="dialog"
            aria-modal
            aria-label={`${person?.name ?? "Person"} schedule`}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "tween", duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-1/2 z-[81] flex max-h-[92vh] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface/95 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <header className="shrink-0 border-b border-border/60 px-6 py-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-medium text-white"
                  style={{
                    background: person
                      ? `linear-gradient(135deg, var(--primary), var(--accent))`
                      : "var(--surface-2)",
                  }}
                >
                  {person?.initials ?? "—"}
                </div>

                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
                    Schedule
                  </div>
                  <h2 className="mt-1 truncate text-2xl font-light tracking-tight text-foreground">
                    {person?.name ?? personName ?? "Unknown"}
                  </h2>
                  <p className="mt-0.5 text-xs font-light text-muted-foreground">
                    {person ? (
                      <>
                        {ROLE_LABEL[person.role]}
                        {person.specialty ? ` · ${person.specialty}` : ""}
                      </>
                    ) : (
                      <span className="text-warning">
                        Not found in roster
                        {personRole ? ` (${ROLE_LABEL[personRole]})` : ""}
                      </span>
                    )}
                  </p>
                </div>

                {/* Close */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* View toggle + range */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1">
                  {(["day", "week", "month"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onChangeView(v)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-mono uppercase tracking-wider transition-colors",
                        v === view
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {range.label}
                </div>
              </div>

              {/* Quick stats */}
              {person && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                  <Stat label={`${stats.total} case${stats.total === 1 ? "" : "s"}`} />
                  {stats.hours > 0 && <Stat label={`~${stats.hours} h`} />}
                  {stats.implants > 0 && (
                    <Stat
                      icon={<Package className="h-3 w-3" />}
                      label={`${stats.implants} implant`}
                    />
                  )}
                  {stats.highRisk > 0 && (
                    <Stat
                      tone="warn"
                      icon={<AlertTriangle className="h-3 w-3" />}
                      label={`${stats.highRisk} ASA III+`}
                    />
                  )}
                  {stats.lines.map((l) => (
                    <Stat key={l} swatch={SERVICE_LINE_COLORS[l]} label={l} />
                  ))}
                </div>
              )}
            </header>

            {/* Card stack — data-scroll-modal flags this as the active scroll
            target so voice "scroll down" targets the modal, not the body
            behind it. */}
            <div data-scroll-modal className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!person ? (
                <EmptyState
                  icon={<UserIcon className="h-10 w-10" strokeWidth={1.3} />}
                  title="No match in roster"
                  hint={`Try saying their full name. Resolved query: "${personName ?? ""}"`}
                />
              ) : cases.length === 0 ? (
                <EmptyState
                  icon={<CalendarIcon className="h-10 w-10" strokeWidth={1.3} />}
                  title={`No cases ${view === "day" ? "today" : view === "week" ? "this week" : "this month"}`}
                  hint={`${person.name} has nothing on the board for ${range.label}.`}
                />
              ) : (
                <ul className="space-y-3">
                  {cases.map((c) => (
                    <PersonCaseCard
                      key={c.id}
                      c={c}
                      viewerRole={person.role}
                      onOpen={
                        onOpenCase ? () => onOpenCase(c.id, `${c.patientName}'s case`) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Pieces
// ──────────────────────────────────────────────────────────────────────────

function Stat({
  label,
  icon,
  tone,
  swatch,
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: "warn";
  swatch?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono uppercase tracking-wider",
        tone === "warn"
          ? "border-warning/40 bg-warning/10 text-warning"
          : "border-border bg-surface-2/60 text-muted-foreground",
      )}
    >
      {swatch && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch }} />}
      {icon}
      {label}
    </span>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <span className="text-muted-foreground/40">{icon}</span>
      <div className="mt-4 text-base font-light text-foreground">{title}</div>
      <div className="mt-1 text-xs font-light text-muted-foreground">{hint}</div>
    </div>
  );
}

function PersonCaseCard({
  c,
  viewerRole,
  onOpen,
}: {
  c: ScheduleCase;
  /** Whose schedule we're viewing — used to render the OTHER team members. */
  viewerRole: PersonRole;
  onOpen?: () => void;
}) {
  const endTime = addMinutes(c.time, c.durationMin);
  const highRisk = c.asaClass === "III" || c.asaClass === "IV" || c.asaClass === "IV-E";
  const dimmed = c.status === "cancelled" || c.status === "completed";

  // Relative time hint ("In 2 h" / "Now" / "1 h ago")
  const relative = formatRelative(c);

  // Show team roles OTHER than the viewer's role (less noise, more signal).
  const teamLines: Array<{ label: string; value: string }> = [];
  if (viewerRole !== "Surgeon") teamLines.push({ label: "Surgeon", value: c.surgeon });
  if (viewerRole !== "Anesthesiologist")
    teamLines.push({ label: "Anes", value: c.anesthesiologist });
  if (viewerRole !== "Scrub Tech") teamLines.push({ label: "Scrub", value: c.scrubTech });
  if (viewerRole !== "Circulator") teamLines.push({ label: "Circ", value: c.circulator });

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn(
          "group w-full rounded-2xl border border-border/60 bg-surface/40 p-5 text-left transition-all",
          onOpen && "hover:border-primary/40 hover:bg-surface/70",
          !onOpen && "cursor-default",
          dimmed && "opacity-65",
        )}
      >
        {/* Top row — time + relative + status + room */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-base tabular-nums text-foreground">
            {c.time}
            <span className="text-muted-foreground/60">–{endTime}</span>
          </span>
          {relative && (
            <span
              className={cn(
                "rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary",
                relative.tone === "now" && "bg-accent/15 text-accent",
                relative.tone === "past" && "bg-surface-2 text-muted-foreground",
              )}
            >
              {relative.text}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
              STATUS_META[c.status].tone,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[c.status].dot)} />
            {STATUS_META[c.status].label}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {c.room}
          </span>
        </div>

        {/* Date (only relevant outside Day view) */}
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
          {formatLongDate(c.date)} · {c.durationMin} min
        </div>

        {/* Procedure */}
        <div
          className={cn(
            "mt-2 text-lg font-light text-foreground",
            dimmed && c.status === "cancelled" && "line-through",
          )}
        >
          {c.procedure}
          {c.side && <span className="text-muted-foreground/70"> · {c.side}</span>}
          <span
            className="ml-2 inline-block rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              backgroundColor: `color-mix(in oklab, ${SERVICE_LINE_COLORS[c.serviceLine]} 18%, transparent)`,
              color: SERVICE_LINE_COLORS[c.serviceLine],
            }}
          >
            {c.procedureShort}
          </span>
        </div>

        {/* Patient */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-light text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <UserIcon className="h-3 w-3" />
            <span className="text-foreground/90">{c.patientName}</span>
            <span>· {c.patientAgeSex}</span>
          </span>
          <span>· {c.patientMrn}</span>
          <span>· {c.anesthesiaType}</span>
          <span className={cn(highRisk && "font-medium text-warning")}>ASA {c.asaClass}</span>
        </div>

        {/* Team (other roles) */}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] font-light">
          {teamLines.map((t) => (
            <div key={t.label} className="contents">
              <dt className="font-mono uppercase tracking-wider text-muted-foreground/60">
                {t.label}
              </dt>
              <dd className="text-foreground/90">{t.value}</dd>
            </div>
          ))}
        </dl>

        {/* Badges row */}
        {(c.firstCase || c.addOn || c.implantsRequired) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.firstCase && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                <Star className="h-3 w-3" />
                First case
              </span>
            )}
            {c.addOn && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                Add-on
              </span>
            )}
            {c.implantsRequired && (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Package className="h-3 w-3" />
                Implants
              </span>
            )}
          </div>
        )}

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

        {/* Notes */}
        {c.notes && (
          <div className="mt-2 text-[11px] font-light italic text-muted-foreground/70">
            {c.notes}
          </div>
        )}
      </button>
    </li>
  );
}

/** Returns a relative-time hint for a case, or null. */
function formatRelative(c: ScheduleCase): { text: string; tone: "future" | "now" | "past" } | null {
  const [y, mo, d] = c.date.split("-").map(Number);
  const [h, mi] = c.time.split(":").map(Number);
  const start = new Date(y, mo - 1, d, h, mi).getTime();
  const end = start + c.durationMin * 60_000;
  const now = Date.now();

  if (now >= start && now <= end) return { text: "In progress", tone: "now" };

  if (now < start) {
    const minsAhead = Math.round((start - now) / 60_000);
    if (minsAhead < 1) return { text: "Starting now", tone: "now" };
    if (minsAhead < 60) return { text: `In ${minsAhead} m`, tone: "future" };
    const hrsAhead = Math.round(minsAhead / 60);
    if (hrsAhead < 24) return { text: `In ${hrsAhead} h`, tone: "future" };
    const daysAhead = Math.round(hrsAhead / 24);
    return { text: `In ${daysAhead} d`, tone: "future" };
  }

  // Past
  const minsAgo = Math.round((now - end) / 60_000);
  if (minsAgo < 60) return { text: `${minsAgo} m ago`, tone: "past" };
  const hrsAgo = Math.round(minsAgo / 60);
  if (hrsAgo < 24) return { text: `${hrsAgo} h ago`, tone: "past" };
  const daysAgo = Math.round(hrsAgo / 24);
  return { text: `${daysAgo} d ago`, tone: "past" };
}
