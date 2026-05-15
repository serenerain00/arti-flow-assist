import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FileText, LayoutGrid, Plus, Stethoscope, Trash2 } from "lucide-react";
import { SaveDialog } from "./SaveDialog";
import { PHASE_LABEL, PHASES, type Dashboard, type Phase } from "./types";
import type { Procedure, Surgeon } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  dashboards: Dashboard[];
  surgeons: Surgeon[];
  procedures: Procedure[];
  onOpen: (dashboardId: string) => void;
  onCreateTemplate: (name: string) => void;
  onDelete: (dashboardId: string) => void;
}

type Tab = "all" | "procedure" | "template";

export function DashboardsList({
  dashboards,
  surgeons,
  procedures,
  onOpen,
  onCreateTemplate,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [newOpen, setNewOpen] = useState(false);

  const surgeonsById = useMemo(() => {
    const m = new Map<string, Surgeon>();
    for (const s of surgeons) m.set(s.id, s);
    return m;
  }, [surgeons]);
  const proceduresById = useMemo(() => {
    const m = new Map<string, Procedure>();
    for (const p of procedures) m.set(p.id, p);
    return m;
  }, [procedures]);

  const filtered = useMemo(() => {
    const list = dashboards.filter((d) => {
      if (tab === "all") return true;
      if (tab === "template") return d.isTemplate;
      return !d.isTemplate;
    });
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [dashboards, tab]);

  return (
    <motion.div
      key="dashboards-list"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex h-full w-full flex-col px-10 py-10"
    >
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
            Builder
          </div>
          <h1 className="mt-2 text-3xl font-extralight tracking-tight">Dashboards</h1>
          <p className="mt-2 max-w-xl text-sm font-light text-muted-foreground">
            Build a wall layout per procedure, or save reusable templates. Open a dashboard to edit,
            drag widgets onto the canvas, save changes automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          New template
        </button>
      </header>

      <nav className="mb-6 flex gap-1 rounded-full border border-border/60 bg-surface-2/40 p-1 self-start">
        {(
          [
            { key: "all", label: "All" },
            { key: "procedure", label: "Procedure-tied" },
            { key: "template", label: "Templates" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/30 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
            <LayoutGrid className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h2 className="mt-4 text-lg font-light text-foreground">
            {tab === "template" ? "No templates yet" : "No dashboards yet"}
          </h2>
          <p className="mt-1 max-w-sm text-sm font-light text-muted-foreground">
            {tab === "template"
              ? "Create a template to reuse layouts across procedures."
              : "Open a procedure from Surgeons or Procedures and build its dashboard, or start a template."}
          </p>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            New template
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/40">
          <ul>
            {filtered.map((d) => (
              <DashboardRow
                key={d.id}
                dashboard={d}
                surgeon={d.surgeonId ? surgeonsById.get(d.surgeonId) : undefined}
                procedure={d.procedureId ? proceduresById.get(d.procedureId) : undefined}
                onOpen={() => onOpen(d.id)}
                onDelete={() => onDelete(d.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <SaveDialog
        open={newOpen}
        onCancel={() => setNewOpen(false)}
        onSave={(name) => {
          setNewOpen(false);
          onCreateTemplate(name);
        }}
      />
    </motion.div>
  );
}

function DashboardRow({
  dashboard,
  surgeon,
  procedure,
  onOpen,
  onDelete,
}: {
  dashboard: Dashboard;
  surgeon?: Surgeon;
  procedure?: Procedure;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const counts: Record<Phase, number> = {
    preop: dashboard.layouts.preop.length,
    intraop: dashboard.layouts.intraop.length,
    postop: dashboard.layouts.postop.length,
  };

  return (
    <li className="group">
      <div className="flex items-center gap-4 border-b border-border/40 px-5 py-3.5 transition-colors hover:bg-surface-2/40">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface-2/60 text-primary">
            {dashboard.isTemplate ? (
              <FileText className="h-4 w-4" strokeWidth={1.7} />
            ) : (
              <Stethoscope className="h-4 w-4" strokeWidth={1.7} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-light text-foreground">{dashboard.name}</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {dashboard.isTemplate
                ? "Template"
                : surgeon && procedure
                  ? `${surgeon.firstName} ${surgeon.lastName} · ${procedure.name}`
                  : "Procedure dashboard"}
            </div>
          </div>
          <div className="hidden items-center gap-1.5 md:flex">
            {PHASES.map((phase) => (
              <PhaseChip key={phase} phase={phase} count={counts[phase]} />
            ))}
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${dashboard.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/20 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />
      </div>
    </li>
  );
}

function PhaseChip({ phase, count }: { phase: Phase; count: number }) {
  const empty = count === 0;
  return (
    <span
      title={`${PHASE_LABEL[phase]} · ${count} widget${count === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
        empty
          ? "border-border/60 bg-surface-2/40 text-muted-foreground"
          : "border-primary/40 bg-primary/15 text-primary",
      )}
    >
      {PHASE_LABEL[phase]} · {count}
    </span>
  );
}
