import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, ClipboardList } from "lucide-react";
import type { Procedure, Surgeon } from "./types";
import { PHASES, PHASE_LABEL, type Dashboard, type Phase } from "./builder/types";
import { cn } from "@/lib/utils";

interface Props {
  procedures: Procedure[];
  surgeons: Surgeon[];
  dashboards: Dashboard[];
  onBack: () => void;
  onOpen: (procedureId: string) => void;
}

function fullName(s: Surgeon | undefined) {
  if (!s) return "(no surgeon)";
  return [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "(unnamed)";
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

export function ProceduresAllList({ procedures, surgeons, dashboards, onBack, onOpen }: Props) {
  const surgeonsById = useMemo(() => {
    const map = new Map<string, Surgeon>();
    for (const s of surgeons) map.set(s.id, s);
    return map;
  }, [surgeons]);

  const sorted = useMemo(
    () =>
      [...procedures].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [procedures],
  );

  return (
    <motion.div
      key="procedures-all"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex h-full w-full flex-col px-10 py-10"
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.7} />
        Settings
      </button>

      <h1 className="mb-6 text-3xl font-extralight tracking-tight">Procedures</h1>

      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/30 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
            <ClipboardList className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-lg font-light text-foreground">No procedures yet</h2>
          <p className="mt-1 max-w-sm text-sm font-light text-muted-foreground">
            Procedures are added inside a surgeon's profile. Open Surgeons → pick one → Procedures.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/40">
          <div className="grid grid-cols-[1.4fr_1fr_auto_auto_auto] items-center gap-4 border-b border-border/60 bg-surface-2/40 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <div>Procedure</div>
            <div>Surgeon</div>
            <div>Category</div>
            <div className="hidden md:block">Dashboard</div>
            <div className="w-6" />
          </div>
          <ul>
            {sorted.map((p) => {
              const dashboard = dashboards.find(
                (d) => !d.isTemplate && d.surgeonId === p.surgeonId && d.procedureId === p.id,
              );
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(p.id)}
                    className="grid w-full grid-cols-[1.4fr_1fr_auto_auto_auto] items-center gap-4 border-b border-border/40 px-5 py-3.5 text-left transition-colors hover:bg-surface-2/40"
                  >
                    <span className="truncate text-sm font-light text-foreground">{p.name}</span>
                    <span className="truncate text-sm font-light text-muted-foreground">
                      {fullName(surgeonsById.get(p.surgeonId))}
                    </span>
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
      )}
    </motion.div>
  );
}
