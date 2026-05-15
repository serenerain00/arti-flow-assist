import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  X,
} from "lucide-react";
import { PROCEDURE_CATEGORIES, type PrefCardImage, type Procedure, type Surgeon } from "./types";
import { PrefCardImages } from "./PrefCardImages";
import { PrefCardWysiwyg } from "./PrefCardWysiwyg";
import { PHASES, PHASE_LABEL, type Dashboard, type Phase } from "./builder/types";
import { cn } from "@/lib/utils";

type Section = "info" | "images" | "form" | "dashboard";

interface Props {
  procedure: Procedure;
  surgeon?: Surgeon;
  images: PrefCardImage[];
  dashboard?: Dashboard;
  onBack: () => void;
  onPatch: (patch: Partial<Procedure>) => void;
  onAddImages: (images: PrefCardImage[]) => void;
  onRemoveImage: (id: string) => void;
  onRenameImage: (id: string, name: string) => void;
  onOpenDashboard: () => void;
}

function surgeonTitle(s?: Surgeon) {
  if (!s) return null;
  const full = `${s.firstName} ${s.lastName}`.trim();
  if (!full) return null;
  return `Dr. ${full}`;
}

const SECTIONS: Array<{ key: Section; label: string; icon: typeof Info }> = [
  { key: "info", label: "General Info", icon: Info },
  { key: "images", label: "Preference Card Images", icon: ImageIcon },
  { key: "form", label: "Preference Card Form", icon: FileText },
  { key: "dashboard", label: "Wall Dashboard", icon: LayoutGrid },
];

export function ProcedureDetail({
  procedure,
  surgeon,
  images,
  dashboard,
  onBack,
  onPatch,
  onAddImages,
  onRemoveImage,
  onRenameImage,
  onOpenDashboard,
}: Props) {
  const [section, setSection] = useState<Section>("info");

  // Local mirror so typing is snappy; flush back to parent on blur or
  // after a short debounce, since the parent persists to localStorage.
  const [name, setName] = useState(procedure.name);
  const [category, setCategory] = useState(procedure.category);
  const [laterality, setLaterality] = useState(procedure.laterality);

  useEffect(() => setName(procedure.name), [procedure.id, procedure.name]);
  useEffect(() => setCategory(procedure.category), [procedure.id, procedure.category]);
  useEffect(() => setLaterality(procedure.laterality), [procedure.id, procedure.laterality]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const patch: Partial<Procedure> = {};
      if (name !== procedure.name) patch.name = name;
      if (category !== procedure.category) patch.category = category;
      if (laterality !== procedure.laterality) patch.laterality = laterality;
      if (Object.keys(patch).length > 0) onPatch(patch);
    }, 350);
    return () => window.clearTimeout(id);
  }, [
    name,
    category,
    laterality,
    procedure.name,
    procedure.category,
    procedure.laterality,
    onPatch,
  ]);

  const procedureImages = useMemo(
    () => images.filter((i) => i.procedureId === procedure.id),
    [images, procedure.id],
  );

  return (
    <motion.div
      key={`procedure-detail-${procedure.id}`}
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
        Procedures
      </button>

      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
            <FileText className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <div>
            {surgeonTitle(surgeon) && (
              <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
                {surgeonTitle(surgeon)}
              </div>
            )}
            <h1 className="mt-1 text-2xl font-light tracking-tight text-foreground">
              {name.trim() || "Untitled procedure"}
            </h1>
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Changes save automatically
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[14rem_1fr] gap-6">
        <nav className="flex flex-col gap-1.5">
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-left text-sm font-light transition-colors",
                  active
                    ? "border-primary/40 bg-primary text-primary-foreground"
                    : "border-border/60 bg-surface-2/40 text-foreground hover:bg-surface-2/80",
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          {section === "info" && (
            <div className="rounded-2xl border border-border/60 bg-surface/40 p-8">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                General Information
              </h2>

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[2fr_auto] md:items-start">
                <div className="space-y-6">
                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Procedure Name <span className="text-primary">*</span>
                    </span>
                    <div className="relative mt-2">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        className="w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2.5 pr-9 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
                      />
                      {name.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setName("")}
                          aria-label="Clear name"
                          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface-3/60 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
                        >
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </label>

                  <label className="block">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Category
                    </span>
                    <div className="relative mt-2">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full appearance-none rounded-md border border-border/60 bg-surface-2/60 px-3 py-2.5 pr-9 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
                      >
                        {PROCEDURE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        strokeWidth={1.7}
                      />
                    </div>
                  </label>
                </div>

                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Laterality
                  </span>
                  <div className="mt-2 inline-flex overflow-hidden rounded-md border border-border/60">
                    <button
                      type="button"
                      onClick={() => setLaterality(false)}
                      className={cn(
                        "px-5 py-2 text-sm font-medium transition-colors",
                        !laterality
                          ? "bg-surface-3/80 text-foreground"
                          : "bg-surface-2/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setLaterality(true)}
                      className={cn(
                        "px-5 py-2 text-sm font-medium transition-colors",
                        laterality
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      On
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "images" && (
            <PrefCardImages
              procedureId={procedure.id}
              images={procedureImages}
              onAddImages={onAddImages}
              onRemoveImage={onRemoveImage}
              onRenameImage={onRenameImage}
            />
          )}

          {section === "form" && (
            <PrefCardWysiwyg
              value={procedure.prefCardHtml}
              onChange={(html) => onPatch({ prefCardHtml: html })}
            />
          )}

          {section === "dashboard" && (
            <DashboardSection dashboard={dashboard} onOpen={onOpenDashboard} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DashboardSection({ dashboard, onOpen }: { dashboard?: Dashboard; onOpen: () => void }) {
  const counts: Record<Phase, number> = {
    preop: dashboard?.layouts.preop.length ?? 0,
    intraop: dashboard?.layouts.intraop.length ?? 0,
    postop: dashboard?.layouts.postop.length ?? 0,
  };
  const total = counts.preop + counts.intraop + counts.postop;

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            Wall Dashboard
          </h2>
          <p className="mt-3 text-sm font-light text-muted-foreground">
            {dashboard
              ? "Dashboard exists for this procedure. Open the builder to add or rearrange widgets across phases."
              : "No dashboard yet for this procedure. Opening the builder will create one and pre-place the reserved PACS and Procedure Planning widgets."}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />
          Build
          <ChevronRight className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {PHASES.map((phase) => {
          const c = counts[phase];
          const empty = c === 0;
          return (
            <div
              key={phase}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                empty ? "border-border/60 bg-surface-2/40" : "border-primary/40 bg-primary/10",
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {PHASE_LABEL[phase]}
              </div>
              <div
                className={cn(
                  "mt-2 text-2xl font-extralight tabular-nums",
                  empty ? "text-muted-foreground" : "text-primary",
                )}
              >
                {c}
              </div>
              <div className="mt-0.5 text-xs font-light text-muted-foreground">
                widget{c === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>

      {total > 0 && (
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Total · {total} widgets
        </div>
      )}
    </div>
  );
}
