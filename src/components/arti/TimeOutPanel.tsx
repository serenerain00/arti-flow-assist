import { Check, AlertTriangle, User2, MapPin, Stethoscope, FileWarning } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * WHO Surgical Safety Checklist — "Time-Out" phase.
 * Mitigates wrong-site / wrong-patient / wrong-procedure (Universal Protocol).
 * Each item demands explicit verbal confirmation by a named role — closed-loop.
 */
const ITEMS = [
  {
    id: "patient",
    icon: User2,
    label: "Patient identity confirmed",
    detail: "Marcus Chen · DOB 1962-04-17 · MRN 0044-2918",
    confirmer: "Circulator",
  },
  {
    id: "site",
    icon: MapPin,
    label: "Surgical site marked & verified",
    detail: "Right shoulder · marked by Dr. Patel · visible in field",
    confirmer: "Surgeon",
  },
  {
    id: "procedure",
    icon: Stethoscope,
    label: "Procedure agreed",
    detail: "Reverse Total Shoulder Arthroplasty (RSA)",
    confirmer: "Surgeon",
  },
  {
    id: "allergies",
    icon: FileWarning,
    label: "Allergies & antibiotic prophylaxis",
    detail: "Allergies: Penicillin. Cefazolin 2g given 14 min ago.",
    confirmer: "Anesthesia",
    warning: true,
  },
];

interface Props {
  onComplete?: () => void;
  checked?: Set<string>;
  onToggle?: (id: string) => void;
}

export function TimeOutPanel({ onComplete, checked: checkedProp, onToggle }: Props) {
  const [internal, setInternal] = useState<Set<string>>(new Set());
  const checked = checkedProp ?? internal;

  const toggle = (id: string) => {
    if (onToggle) {
      onToggle(id);
      return;
    }
    setInternal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === ITEMS.length) onComplete?.();
      return next;
    });
  };

  const progress = (checked.size / ITEMS.length) * 100;


  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Universal Protocol · Time-Out
          </div>
          <h2 className="mt-1 text-2xl font-light">Confirm before incision</h2>
          <p className="mt-1 text-xs font-light text-muted-foreground">
            Every item must be verbalized aloud and confirmed by the named role.
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-thin tabular-nums">
            {checked.size}
            <span className="text-muted-foreground/50">/{ITEMS.length}</span>
          </div>
          <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {ITEMS.map((it) => {
          const isChecked = checked.has(it.id);
          return (
            <li key={it.id}>
              <button
                onClick={() => toggle(it.id)}
                className={cn(
                  "group flex w-full items-start gap-4 rounded-xl border border-transparent bg-surface-2/40 p-4 text-left transition-all",
                  "hover:border-border hover:bg-surface-2",
                  isChecked && "border-success/30 bg-success/5"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isChecked
                      ? "bg-success text-success-foreground"
                      : it.warning
                        ? "bg-warning/15 text-warning"
                        : "bg-surface-3 text-muted-foreground"
                  )}
                >
                  {isChecked ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : it.warning ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <it.icon className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-light">{it.label}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {it.confirmer}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-light text-muted-foreground">
                    {it.detail}
                  </div>
                </div>

                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isChecked ? "border-success bg-success" : "border-muted-foreground/40"
                  )}
                >
                  {isChecked && (
                    <Check className="h-3.5 w-3.5 text-success-foreground" strokeWidth={3} />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
