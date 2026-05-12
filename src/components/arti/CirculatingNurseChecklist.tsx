import { useState } from "react";
import {
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Check,
  Circle,
  Activity,
  LogOut as Closure,
} from "lucide-react";
import { HandoffNotesPanel } from "./HandoffNotesPanel";
import type { HandoffNotes, HandoffSection } from "./handoffNotes";

export type NursePhase = "pre-incision" | "intra-op" | "closing";

export interface NurseChecklistItem {
  id: string;
  label: string;
  detail?: string;
}

export interface NurseChecklistPhase {
  id: NursePhase;
  label: string;
  icon: import("lucide-react").LucideIcon;
  items: NurseChecklistItem[];
}

export const NURSE_CHECKLIST: NurseChecklistPhase[] = [
  {
    id: "pre-incision",
    label: "Pre-incision",
    icon: ClipboardCheck,
    items: [
      { id: "pre-id", label: "Patient identity verified", detail: "Band + chart" },
      { id: "pre-consent", label: "Surgical consent signed + verified" },
      { id: "pre-allergies", label: "Allergies confirmed and posted" },
      { id: "pre-npo", label: "NPO status verified" },
      { id: "pre-site-mark", label: "Site marked with surgeon" },
      { id: "pre-position", label: "Patient positioned + padded" },
      { id: "pre-prep", label: "Skin prep completed" },
      { id: "pre-abx", label: "Antibiotic given (or N/A)", detail: "Within 60-min window" },
      { id: "pre-scd-warming", label: "SCDs + warming applied" },
      { id: "pre-counts-open", label: "Opening counts with scrub" },
    ],
  },
  {
    id: "intra-op",
    label: "Intra-op",
    icon: Activity,
    items: [
      { id: "io-specimens-ready", label: "Specimen labeling station ready" },
      { id: "io-suction-labeled", label: "Suction containers labeled" },
      { id: "io-fluid-balance", label: "Fluid balance tracking started" },
      { id: "io-family-update", label: "Family updated (post-incision)" },
      { id: "io-implant-log", label: "Implant log started", detail: "If applicable" },
      { id: "io-ebl-tracking", label: "EBL tracking documented" },
    ],
  },
  {
    id: "closing",
    label: "Closing",
    icon: Closure,
    items: [
      { id: "cl-count-raytec", label: "Final raytec count verified" },
      { id: "cl-count-lap", label: "Final lap count verified" },
      { id: "cl-count-needle", label: "Final needle count verified" },
      { id: "cl-specimens-routed", label: "Specimens labeled + routed" },
      { id: "cl-dressing", label: "Dressing applied" },
      { id: "cl-drains", label: "Drains documented" },
      { id: "cl-pacu-handoff", label: "PACU handoff complete" },
      { id: "cl-family-post", label: "Family notified (post-op)" },
      { id: "cl-ehr-closed", label: "Documentation closed in EHR" },
    ],
  },
];

/** All item ids flat, for fast lookup in voice tool handlers. */
export const NURSE_CHECKLIST_ITEM_IDS: string[] = NURSE_CHECKLIST.flatMap((p) =>
  p.items.map((i) => i.id),
);

/** Fuzzy lookup of an item by free-text label / keyword. */
export function findNurseChecklistItem(
  query: string,
): { phase: NursePhase; item: NurseChecklistItem } | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  for (const phase of NURSE_CHECKLIST) {
    for (const item of phase.items) {
      if (item.id === q) return { phase: phase.id, item };
      if (item.label.toLowerCase().includes(q)) return { phase: phase.id, item };
    }
  }
  // Reverse direction — query contains a meaningful word from the label.
  for (const phase of NURSE_CHECKLIST) {
    for (const item of phase.items) {
      const words = item.label.toLowerCase().split(/\s+/);
      if (words.some((w) => w.length >= 4 && q.includes(w))) {
        return { phase: phase.id, item };
      }
    }
  }
  return undefined;
}

interface Props {
  checked: Set<string>;
  onToggle: (id: string) => void;
  handoffNotes: HandoffNotes;
  onSetHandoffNote: (section: HandoffSection, text: string) => void;
}

export function CirculatingNurseChecklist({
  checked,
  onToggle,
  handoffNotes,
  onSetHandoffNote,
}: Props) {
  // Each phase tracks its own expand/collapse so the nurse can keep the
  // current-phase section open while the others stay compact.
  const [expanded, setExpanded] = useState<Record<NursePhase, boolean>>({
    "pre-incision": true,
    "intra-op": false,
    closing: false,
  });

  const overallChecked = NURSE_CHECKLIST.reduce(
    (sum, p) => sum + p.items.filter((i) => checked.has(i.id)).length,
    0,
  );
  const overallTotal = NURSE_CHECKLIST.reduce((sum, p) => sum + p.items.length, 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/80 backdrop-blur-md">
      {/* Top bar — overall progress */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="text-base font-light text-foreground">Circulating nurse checklist</div>
            <div className="text-xs font-light text-muted-foreground">
              Pre-incision · Intra-op · Closing
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-light">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary tabular-nums">
            {overallChecked}/{overallTotal} complete
          </span>
        </div>
      </div>

      {/* Phase sections */}
      <div className="divide-y divide-border/40">
        {NURSE_CHECKLIST.map((phase) => {
          const phaseDone = phase.items.filter((i) => checked.has(i.id)).length;
          const phaseTotal = phase.items.length;
          const isOpen = expanded[phase.id];
          const Icon = phase.icon;

          return (
            <section key={phase.id}>
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [phase.id]: !prev[phase.id] }))}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
                  <span className="text-sm font-light uppercase tracking-wider text-foreground/90">
                    {phase.label}
                  </span>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tabular-nums ${
                    phaseDone === phaseTotal
                      ? "border-success/30 bg-success/15 text-success"
                      : phaseDone > 0
                        ? "border-warning/30 bg-warning/15 text-warning"
                        : "border-border bg-surface-2/60 text-muted-foreground"
                  }`}
                >
                  {phaseDone}/{phaseTotal}
                </span>
              </button>

              {isOpen && (
                <ul className="space-y-1.5 px-5 pb-4 pt-1">
                  {phase.items.map((item) => {
                    const isChecked = checked.has(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onToggle(item.id)}
                          className="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-primary/20 hover:bg-white/[0.03]"
                        >
                          {isChecked ? (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </div>
                          ) : (
                            <Circle
                              className="h-5 w-5 shrink-0 text-muted-foreground/50"
                              strokeWidth={1.7}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-sm ${
                                isChecked ? "text-foreground/55 line-through" : "text-foreground/90"
                              }`}
                            >
                              {item.label}
                            </div>
                            {item.detail ? (
                              <div className="text-[11px] font-light text-muted-foreground">
                                {item.detail}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {/* Handoff notes — embedded in the Closing phase, only visible
                  when the phase is expanded. */}
              {phase.id === "closing" && isOpen && (
                <div className="px-5 pb-4">
                  <HandoffNotesPanel notes={handoffNotes} onSet={onSetHandoffNote} />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
