import { ArrowLeft, Clock, MapPin, User } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";

import { TODAY_CASES, STATUS_META, type CaseItem } from "./cases";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onBackHome: () => void;
  onSelectCase: (c: CaseItem) => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
}

/**
 * Today's case list. The temporal spine of the OR — each row is a case
 * with status, patient identifiers, procedure, and surgeon. Tapping a row
 * (or asking Arti to "open Marcus Chen's case") drops into the Pre-Op view.
 */
export function CaseListScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onBackHome,
  onSelectCase,
  onPrompt,
  onSidebarNavigate,
}: Props) {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} activeKey="case" onNavigate={onSidebarNavigate} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
          cockpitMode={false}
          onToggleCockpit={() => {}}
        />

        <main data-scroll className="min-h-0 flex-1 overflow-y-auto px-8 py-6 animate-fade-in">
          <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-end justify-between gap-6">
            <div>
              <button
                onClick={onBackHome}
                className="mb-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Home
              </button>
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                Today's Schedule · {today}
              </div>
              <h1 className="mt-1 text-4xl font-extralight tracking-tight">
                {TODAY_CASES.length} cases
                <span className="text-muted-foreground/60"> · OR 326</span>
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-4 text-right">
              {(["completed", "next", "scheduled"] as const).map((k) => {
                const count = TODAY_CASES.filter((c) => c.status === k).length;
                return (
                  <div key={k}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      {STATUS_META[k].label}
                    </div>
                    <div className="mt-1 text-3xl font-thin tabular-nums">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cases list */}
          <div className="mt-8 space-y-3">
            {TODAY_CASES.map((c, idx) => (
              <CaseRow key={c.id} c={c} index={idx} onSelect={() => onSelectCase(c)} />
            ))}
          </div>

          <div className="h-32" />
          </div>
        </main>

        <ArtiInvoker
          placeholder="Ask Arti to open a case…"
          onSubmit={onPrompt}
          suggestions={["Open Marcus Chen's case", "Next case", "Go home"]}
        />
      </div>
    </div>
  );
}

function CaseRow({ c, index, onSelect }: { c: CaseItem; index: number; onSelect: () => void }) {
  const meta = STATUS_META[c.status];
  const isUpNext = c.status === "next";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative grid w-full grid-cols-[88px_1fr_auto] items-center gap-6 rounded-2xl border bg-surface/40 px-6 py-5 text-left transition-all",
        "hover:border-primary/40 hover:bg-surface/70",
        isUpNext ? "border-primary/40 shadow-[var(--shadow-glow)]" : "border-border",
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Time block */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {c.time}
        </div>
        <div className="mt-1 font-mono text-[11px] text-muted-foreground/70">{c.durationMin}m</div>
      </div>

      {/* Patient + procedure */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
              meta.tone,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot, isUpNext && "heartbeat")} />
            {meta.label}
          </span>
          <span className="rounded-full border border-border bg-surface-2/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {c.procedureShort}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-xl font-light tracking-tight text-foreground">{c.patientName}</h3>
          <span className="text-sm font-light text-muted-foreground/80">
            {c.patientAgeSex} · {c.side} · {c.patientMrn}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-light text-muted-foreground">
          <span>{c.procedure}</span>
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> {c.surgeon}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {c.room}
          </span>
        </div>
      </div>

      {/* Right meta */}
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
            Start
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5 font-mono text-sm tabular-nums text-foreground/80">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {c.time}
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50 transition-colors group-hover:text-primary">
          Open →
        </div>
      </div>
    </button>
  );
}
