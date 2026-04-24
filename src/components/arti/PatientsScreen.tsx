import { useMemo, useState } from "react";
import { AlertTriangle, Clock, MapPin, Search, User as UserIcon, Users } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import { PatientDetailsModal } from "./PatientDetailsModal";
import {
  PATIENT_CLINICAL,
  STATUS_META,
  TODAY_CASES,
  type CaseItem,
} from "./cases";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
}

/**
 * Today's surgical patients. Vertical cards, sorted by case time. Click any
 * card to open the full patient details modal (chart, allergies, meds,
 * labs, consents, airway, anesthesia plan). High-severity allergies and
 * difficult airway are surfaced on the card itself for at-a-glance triage.
 */
export function PatientsScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onPrompt,
  onSidebarNavigate,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CaseItem | null>(null);

  const sorted = useMemo(
    () => [...TODAY_CASES].sort((a, b) => a.time.localeCompare(b.time)),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.patientName.toLowerCase().includes(q) ||
        c.patientMrn.toLowerCase().includes(q) ||
        c.procedure.toLowerCase().includes(q) ||
        c.procedureShort.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} activeKey="patients" onNavigate={onSidebarNavigate} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
        />

        <main
          data-scroll
          className="relative min-h-0 flex-1 overflow-y-auto px-8 pt-8 pb-40 animate-fade-in"
        >
          {/* Header */}
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
                Patients · Today
              </div>
              <h1 className="mt-2 text-4xl font-extralight tracking-tight text-foreground">
                {sorted.length} patient{sorted.length === 1 ? "" : "s"}
              </h1>
              <p className="mt-1 text-sm font-light text-muted-foreground">
                {todayLabel} · OR 326 · sorted by case time. Tap any card for full chart.
              </p>
            </div>

            <label className="flex w-full max-w-xs items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm font-light text-foreground transition-colors focus-within:border-primary/50">
              <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, MRN, or procedure"
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
            <EmptyState />
          ) : (
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filtered.map((c) => (
                <PatientCard key={c.id} c={c} onClick={() => setSelected(c)} />
              ))}
            </ul>
          )}
        </main>

        <ArtiInvoker
          placeholder="Ask Arti about a patient…"
          onSubmit={onPrompt}
          suggestions={[
            "Open the next case",
            "Who has allergies today?",
            "Back to home",
          ]}
        />
      </div>

      {/* Detail modal */}
      <PatientDetailsModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        activeCase={selected ?? undefined}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Card
// ──────────────────────────────────────────────────────────────────────────

function PatientCard({ c, onClick }: { c: CaseItem; onClick: () => void }) {
  const clinical = PATIENT_CLINICAL[c.id];
  const severeAllergies =
    clinical?.allergies.filter((a) => a.severity === "severe") ?? [];
  const moderateAllergies =
    clinical?.allergies.filter((a) => a.severity === "moderate") ?? [];
  const flaggedLabs = clinical?.labs.filter((l) => l.flag) ?? [];
  const difficultAirway = clinical?.airway.difficult;

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="group w-full rounded-2xl border border-border/60 bg-surface/40 p-5 text-left transition-all hover:border-primary/40 hover:bg-surface/70"
      >
        {/* Top row */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <UserIcon className="h-5 w-5" strokeWidth={1.7} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-light text-foreground">
              {c.patientName}
              <span className="ml-2 text-sm text-muted-foreground/70">{c.patientAgeSex}</span>
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {c.patientMrn}
              {clinical && <span> · DOB {clinical.dob}</span>}
              {clinical && <span> · {clinical.bloodType}</span>}
            </div>
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

        {/* Procedure */}
        <div className="mt-4 text-sm font-light text-foreground">
          {c.procedure}
          {c.side && <span className="text-muted-foreground/70"> · {c.side}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {c.time}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {c.room}
          </span>
          <span>·</span>
          <span>{c.surgeon}</span>
        </div>

        {/* Risk flags */}
        {clinical && (severeAllergies.length || moderateAllergies.length || difficultAirway || flaggedLabs.length) ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {severeAllergies.length > 0 && (
              <Flag tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
                Severe allergy: {severeAllergies.map((a) => a.agent).join(", ")}
              </Flag>
            )}
            {moderateAllergies.length > 0 && (
              <Flag tone="warn">
                {moderateAllergies.map((a) => a.agent).join(", ")}
              </Flag>
            )}
            {difficultAirway && (
              <Flag tone="warn" icon={<AlertTriangle className="h-3 w-3" />}>
                Difficult airway
              </Flag>
            )}
            {flaggedLabs.length > 0 && (
              <Flag tone="warn">
                {flaggedLabs.length} lab{flaggedLabs.length === 1 ? "" : "s"} flagged
              </Flag>
            )}
          </div>
        ) : clinical && clinical.allergies.length === 0 ? (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-success">
            NKDA · No flags
          </div>
        ) : null}
      </button>
    </li>
  );
}

function Flag({
  tone,
  icon,
  children,
}: {
  tone: "warn" | "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-light",
        tone === "danger"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-warning/40 bg-warning/10 text-warning",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/30 px-6 py-16 text-center">
      <Users className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.3} />
      <div className="mt-4 text-base font-light text-foreground">No patients match</div>
      <div className="mt-1 text-xs font-light text-muted-foreground">
        Try a different name, MRN, or procedure.
      </div>
    </div>
  );
}
