import { ChevronRight, FileText, Plus } from "lucide-react";
import type { Procedure } from "./types";
import { PHASES, PHASE_LABEL, type Dashboard, type Phase } from "./builder/types";
import { cn } from "@/lib/utils";

interface Props {
  procedures: Procedure[];
  dashboards: Dashboard[];
  onAdd: () => void;
  onOpen: (id: string) => void;
}

export function ProcedureList({ procedures, dashboards, onAdd, onOpen }: Props) {
  if (procedures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/30 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
          <FileText className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-light text-foreground">No procedures yet</h2>
        <p className="mt-1 max-w-xs text-sm font-light text-muted-foreground">
          Add a procedure to attach preference card images and a written prefcard.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add procedure
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add procedure
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/40">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/60 bg-surface-2/40 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <div>Name</div>
          <div>Category</div>
          <div className="hidden md:block">Dashboard</div>
          <div className="w-6" />
        </div>
        <ul>
          {procedures.map((p) => {
            const dashboard = dashboards.find(
              (d) => !d.isTemplate && d.surgeonId === p.surgeonId && d.procedureId === p.id,
            );
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpen(p.id)}
                  className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border/40 px-5 py-3.5 text-left transition-colors hover:bg-surface-2/40"
                >
                  <span className="truncate text-sm font-light text-foreground">{p.name}</span>
                  <span className="rounded-full border border-border/60 bg-surface-2/60 px-3 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {p.category}
                  </span>
                  <span className="hidden items-center gap-1.5 md:flex">
                    {PHASES.map((phase) => (
                      <PhaseChip
                        key={phase}
                        phase={phase}
                        count={dashboard?.layouts[phase].length ?? 0}
                      />
                    ))}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function PhaseChip({ phase, count }: { phase: Phase; count: number }) {
  const empty = count === 0;
  return (
    <span
      title={`${PHASE_LABEL[phase]} · ${count} widget${count === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        empty
          ? "border-border/60 bg-surface-2/40 text-muted-foreground"
          : "border-primary/40 bg-primary/15 text-primary",
      )}
    >
      {phase === "preop" ? "Pre" : phase === "intraop" ? "Intra" : "Post"} · {count}
    </span>
  );
}
