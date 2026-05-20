import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Stethoscope, Trash2 } from "lucide-react";
import { SurgeonInfoForm, type SurgeonDraft } from "./SurgeonInfoForm";
import { ProcedureList } from "./ProcedureList";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import type { Procedure, Surgeon } from "./types";
import type { Dashboard } from "./builder/types";
import { cn } from "@/lib/utils";

type Tab = "info" | "procedures";

interface Props {
  surgeon: Surgeon;
  procedures: Procedure[];
  dashboards: Dashboard[];
  onBack: () => void;
  onSave: (draft: SurgeonDraft) => void;
  onAddProcedure: () => void;
  onOpenProcedure: (id: string) => void;
  onDeleteProcedure: (id: string) => void;
  onDelete: () => void;
}

function fullName(s: Surgeon) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ").trim() || "Surgeon";
}

export function SurgeonDetail({
  surgeon,
  procedures,
  dashboards,
  onBack,
  onSave,
  onAddProcedure,
  onOpenProcedure,
  onDeleteProcedure,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<Tab>("info");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<SurgeonDraft>({
    firstName: surgeon.firstName,
    lastName: surgeon.lastName,
    email: surgeon.email,
    loginEnabled: surgeon.loginEnabled,
  });
  const [valid, setValid] = useState(true);
  const [dirty, setDirty] = useState(false);

  // After AdminShell propagates the save, the surgeon prop's updatedAt
  // changes; reset dirty so the Save button disables until the next edit.
  useEffect(() => {
    setDirty(false);
  }, [surgeon.updatedAt]);

  const handleChange = useCallback(
    (next: SurgeonDraft, isValid: boolean) => {
      setDraft(next);
      setValid(isValid);
      setDirty(
        next.firstName !== surgeon.firstName ||
          next.lastName !== surgeon.lastName ||
          next.email !== surgeon.email ||
          next.loginEnabled !== surgeon.loginEnabled,
      );
    },
    [surgeon],
  );

  const canSave = tab === "info" && valid && dirty;

  return (
    <motion.div
      key={`surgeon-detail-${surgeon.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full px-10 py-10"
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={1.7} />
        Surgeons
      </button>

      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
            <Stethoscope className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            {fullName(surgeon)} <span className="text-muted-foreground">- Settings</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.7} />
            Delete
          </button>
          {tab === "info" && (
            <button
              type="button"
              onClick={() => canSave && onSave(draft)}
              disabled={!canSave}
              className={cn(
                "rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all",
                canSave
                  ? "hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
                  : "cursor-not-allowed opacity-40",
              )}
            >
              Save
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-border/60">
        <nav className="flex gap-8">
          <TabButton label="Info" active={tab === "info"} onClick={() => setTab("info")} />
          <TabButton
            label="Procedures"
            active={tab === "procedures"}
            onClick={() => setTab("procedures")}
          />
        </nav>
      </div>

      <div className="pt-8">
        {tab === "info" ? (
          <SurgeonInfoForm key={surgeon.id} surgeon={surgeon} onChange={handleChange} />
        ) : (
          <ProcedureList
            procedures={procedures}
            dashboards={dashboards}
            onAdd={onAddProcedure}
            onOpen={onOpenProcedure}
            onDelete={onDeleteProcedure}
          />
        )}
      </div>

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${fullName(surgeon)}?`}
        description={
          procedures.length > 0
            ? `This permanently deletes the surgeon along with ${procedures.length} procedure${procedures.length === 1 ? "" : "s"} and all of their preference cards and wall dashboards. This cannot be undone.`
            : "This permanently deletes the surgeon. This cannot be undone."
        }
        confirmLabel="Delete surgeon"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete();
        }}
      />
    </motion.div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
