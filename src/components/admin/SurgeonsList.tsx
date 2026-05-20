import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Plus, Trash2, UserPlus } from "lucide-react";
import type { Procedure, Surgeon } from "./types";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface Props {
  surgeons: Surgeon[];
  procedures: Procedure[];
  onBack: () => void;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

function initialsFor(s: Surgeon) {
  const f = s.firstName.trim().charAt(0).toUpperCase();
  const l = s.lastName.trim().charAt(0).toUpperCase();
  return `${f}${l}` || "??";
}

function fullName(s: Surgeon) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "(no name)";
}

export function SurgeonsList({ surgeons, procedures, onBack, onAdd, onOpen, onDelete }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Surgeon | null>(null);
  const sorted = [...surgeons].sort((a, b) =>
    fullName(a).localeCompare(fullName(b), undefined, { sensitivity: "base" }),
  );

  const pendingProcedureCount = pendingDelete
    ? procedures.filter((p) => p.surgeonId === pendingDelete.id).length
    : 0;

  return (
    <motion.div
      key="surgeons-list"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex h-full w-full flex-col px-10 py-10"
    >
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.7} />
          Settings
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add surgeon
        </button>
      </header>

      <h1 className="mb-6 text-3xl font-extralight tracking-tight">Surgeons</h1>

      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/30 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
            <UserPlus className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-lg font-light text-foreground">No surgeons yet</h2>
          <p className="mt-1 max-w-xs text-sm font-light text-muted-foreground">
            Add a surgeon to start configuring procedures and preference cards.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add surgeon
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/40">
          <div className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-4 border-b border-border/60 bg-surface-2/40 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <div>Name</div>
            <div>Email</div>
            <div className="w-6" />
          </div>
          <ul>
            {sorted.map((s) => (
              <li key={s.id} className="group">
                <div className="flex items-center gap-4 border-b border-border/40 px-5 py-3.5 transition-colors hover:bg-surface-2/40">
                  <button
                    type="button"
                    onClick={() => onOpen(s.id)}
                    className="grid min-w-0 flex-1 grid-cols-[1fr_1.4fr] items-center gap-4 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface-2/60 font-mono text-[11px] uppercase tracking-wider text-primary">
                        {initialsFor(s)}
                      </div>
                      <span className="truncate text-sm font-light text-foreground">
                        {fullName(s)}
                      </span>
                    </div>
                    <div className="truncate text-sm font-light text-muted-foreground">
                      {s.email}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(s)}
                    aria-label={`Delete ${fullName(s)}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </button>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete ? fullName(pendingDelete) : "surgeon"}?`}
        description={
          pendingProcedureCount > 0
            ? `This permanently deletes the surgeon along with ${pendingProcedureCount} procedure${pendingProcedureCount === 1 ? "" : "s"} and all of their preference cards and wall dashboards. This cannot be undone.`
            : "This permanently deletes the surgeon. This cannot be undone."
        }
        confirmLabel="Delete surgeon"
        onConfirm={() => {
          if (pendingDelete) onDelete(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </motion.div>
  );
}
