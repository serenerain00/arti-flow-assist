import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileWarning,
  MapPin,
  Stethoscope,
  User2,
  X,
} from "lucide-react";
import type { CaseItem } from "./cases";
import type { TimeOutId } from "./AwakeDashboard";
import { cn } from "@/lib/utils";

/**
 * WHO Surgical Safety Checklist — pre-incision Time-Out, presented as a
 * full-screen modal triggered by Start Case. The four items mirror the
 * nurse's TimeOutPanel exactly (same ids, same labels) so checks made
 * here flow directly into the dashboard's state and vice-versa.
 */

const ITEMS: Array<{
  id: TimeOutId;
  icon: typeof User2;
  label: string;
  confirmer: string;
  warning?: boolean;
}> = [
  {
    id: "patient",
    icon: User2,
    label: "Patient identity confirmed",
    confirmer: "Circulator",
  },
  {
    id: "site",
    icon: MapPin,
    label: "Surgical site marked & verified",
    confirmer: "Surgeon",
  },
  {
    id: "procedure",
    icon: Stethoscope,
    label: "Procedure agreed",
    confirmer: "Surgeon",
  },
  {
    id: "allergies",
    icon: FileWarning,
    label: "Allergies & antibiotic prophylaxis",
    confirmer: "Anesthesia",
    warning: true,
  },
];

interface Props {
  open: boolean;
  /** The case being started — used to render the per-item details. */
  activeCase?: CaseItem;
  /** Live patient details strings (DOB, MRN, allergies, etc.). */
  patientDob?: string;
  patientMrn?: string;
  allergiesLine?: string;
  antibioticLine?: string;
  checked: Set<TimeOutId>;
  onToggle: (id: TimeOutId) => void;
  /** All four items confirmed → user clicks Continue → enter intraop. */
  onContinue: () => void;
  /** Cancel and close the modal without changing phase. */
  onCancel: () => void;
}

export function TimeOutModal({
  open,
  activeCase,
  patientDob,
  patientMrn,
  allergiesLine,
  antibioticLine,
  checked,
  onToggle,
  onContinue,
  onCancel,
}: Props) {
  // Esc closes the modal without continuing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const allChecked = checked.size === ITEMS.length;
  const progress = (checked.size / ITEMS.length) * 100;

  const detailFor = (id: TimeOutId): string => {
    if (!activeCase) return "—";
    switch (id) {
      case "patient":
        return [
          activeCase.patientName,
          patientDob ? `DOB ${patientDob}` : null,
          patientMrn ? `MRN ${patientMrn}` : `MRN ${activeCase.patientMrn}`,
        ]
          .filter(Boolean)
          .join(" · ");
      case "site":
        return [
          activeCase.side ? `${activeCase.side} side` : "Side not on chart",
          `marked by ${activeCase.surgeon}`,
          "visible in field",
        ].join(" · ");
      case "procedure":
        return `${activeCase.procedure}${activeCase.side ? ` (${activeCase.side})` : ""}`;
      case "allergies":
        return [
          allergiesLine ? `Allergies: ${allergiesLine}` : "Allergies: NKDA",
          antibioticLine ?? "Antibiotic prophylaxis confirmed pre-incision",
        ].join(" · ");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="timeout-modal"
          role="dialog"
          aria-modal
          aria-label="Pre-incision time-out"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex flex-col bg-background/96 backdrop-blur-2xl"
        >
          {/* Header */}
          <header className="flex items-start justify-between gap-6 px-10 pt-8 pb-4 shrink-0">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-primary">
                Universal Protocol · Pre-Incision Time-Out
              </div>
              <h1 className="mt-3 text-4xl font-extralight tracking-tight text-foreground">
                Confirm before incision
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-light text-muted-foreground">
                Each item must be verbalized aloud and confirmed by the named role. Check off via
                voice (<span className="italic">"check site"</span>) or click. The case starts only
                after all four are green.
              </p>
            </div>

            <div className="flex flex-col items-end gap-3">
              <div className="text-right">
                <div className="font-mono text-5xl font-thin tabular-nums text-foreground">
                  {checked.size}
                  <span className="text-muted-foreground/40">/{ITEMS.length}</span>
                </div>
                <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <button
                onClick={onCancel}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all hover:border-white/30 hover:text-white"
                aria-label="Cancel and close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Active case banner */}
          {activeCase && (
            <div className="mx-10 mb-5 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-3.5">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                  Now starting
                </span>
                <span className="text-base font-light text-foreground">
                  {activeCase.patientName}
                </span>
                <span className="text-sm font-light text-muted-foreground">
                  {activeCase.procedure}
                  {activeCase.side ? ` · ${activeCase.side}` : ""}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {activeCase.surgeon} · OR {activeCase.room} · {activeCase.time}
                </span>
              </div>
            </div>
          )}

          {/* Items */}
          <main className="min-h-0 flex-1 overflow-y-auto px-10 pb-6">
            <ul className="mx-auto flex max-w-5xl flex-col gap-4">
              {ITEMS.map((it) => {
                const isChecked = checked.has(it.id);
                const Icon = it.icon;
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => onToggle(it.id)}
                      className={cn(
                        "group flex w-full items-start gap-5 rounded-2xl border bg-surface/60 p-5 text-left transition-all",
                        "hover:border-primary/40 hover:bg-surface/80",
                        isChecked
                          ? "border-success/50 bg-success/10 hover:border-success/70 hover:bg-success/15"
                          : "border-border/60",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-colors",
                          isChecked
                            ? "bg-success text-success-foreground"
                            : it.warning
                              ? "bg-warning/15 text-warning"
                              : "bg-surface-3 text-muted-foreground",
                        )}
                      >
                        {isChecked ? (
                          <Check className="h-7 w-7" strokeWidth={2.5} />
                        ) : it.warning ? (
                          <AlertTriangle className="h-6 w-6" />
                        ) : (
                          <Icon className="h-6 w-6" strokeWidth={1.5} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xl font-light text-foreground">{it.label}</span>
                          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {it.confirmer}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm font-light text-muted-foreground">
                          {detailFor(it.id)}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isChecked ? "border-success bg-success" : "border-muted-foreground/40",
                        )}
                      >
                        {isChecked && (
                          <Check className="h-5 w-5 text-success-foreground" strokeWidth={3} />
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </main>

          {/* Footer */}
          <footer className="flex items-center justify-between gap-6 border-t border-border/40 bg-surface/40 px-10 py-5 shrink-0">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-5 py-2.5 text-sm font-light text-foreground transition-all hover:border-foreground/30"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
              Cancel · Back to pre-op
            </button>

            <div className="text-xs font-light italic text-muted-foreground">
              {allChecked ? (
                <span className="text-success">All four items confirmed.</span>
              ) : (
                `${ITEMS.length - checked.size} item${
                  ITEMS.length - checked.size === 1 ? "" : "s"
                } remaining before incision.`
              )}
            </div>

            <button
              onClick={onContinue}
              disabled={!allChecked}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium uppercase tracking-wider transition-all",
                allChecked
                  ? "bg-success text-success-foreground hover:bg-success/90 hover:shadow-[0_0_24px_-4px_var(--success)]"
                  : "cursor-not-allowed bg-surface-3 text-muted-foreground/60",
              )}
              title={allChecked ? "Start the case" : "Confirm all four items first"}
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              Start Case
            </button>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
