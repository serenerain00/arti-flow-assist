import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Clock, Wrench, ArrowUpDown, Package, Scissors, Compass, BookOpen } from "lucide-react";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";
import { PREF_CARD } from "./PreferenceCard";

interface Props {
  open: boolean;
  onClose: () => void;
  activeCase?: CaseItem;
  /** Opens the full VIP planning modal (Spline + orientation + implant table). */
  onOpenVipPlanning?: () => void;
}

const SectionTitle = ({
  icon: Icon,
  title,
}: {
  icon: import("lucide-react").LucideIcon;
  title: string;
}) => (
  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
    <Icon className="h-3.5 w-3.5" />
    {title}
  </div>
);

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function ProcedureOverviewModal({ open, onClose, activeCase, onOpenVipPlanning }: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;
  const durationMin = activeCase?.durationMin ?? 90;

  const procedureDisplay = activeCase
    ? `${activeCase.side ? `${activeCase.side} ` : ""}${activeCase.procedure}`
    : "Reverse Total Shoulder Arthroplasty";

  const implants = clinical?.implantPlan.length
    ? clinical.implantPlan.map((i) => `${i.component} · ${i.spec}`)
    : PREF_CARD.implants;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(95vw,86rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-6 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <div>Procedure Overview</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {procedureDisplay} · {activeCase?.surgeon ?? "Dr. Anika Patel"}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm">
            Orientation reference for staff new to this procedure.
          </DialogDescription>
        </DialogHeader>

        {/* data-scroll-modal tells the route's scroll voice handler to scroll
            THIS container when the user says "scroll down/up" while the modal
            is open, instead of the page behind it. */}
        <div
          data-scroll-modal
          className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-2 md:grid-cols-2"
        >
          {/* Estimated duration */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
            <SectionTitle icon={Clock} title="Estimated duration" />
            <div className="text-4xl font-extralight tracking-tight">
              {formatDuration(durationMin)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Scheduled block · OR {activeCase?.room ?? "326"} · start {activeCase?.time ?? "—"}
            </div>
          </div>

          {/* Positioning */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
            <SectionTitle icon={ArrowUpDown} title="Positioning" />
            <ul className="space-y-1.5 text-sm font-light">
              <li>
                <span className="text-foreground/70">Position:</span>{" "}
                {PREF_CARD.positioning.position}
              </li>
              <li>
                <span className="text-foreground/70">Arm:</span> {PREF_CARD.positioning.arm}
              </li>
              <li>
                <span className="text-foreground/70">Padding:</span> {PREF_CARD.positioning.padding}
              </li>
            </ul>
          </div>

          {/* Procedure steps — spans both columns; the surgical sequence is
              the orientation reference a new staffer needs most. */}
          {clinical?.procedureSteps?.length ? (
            <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5 md:col-span-2">
              <SectionTitle icon={BookOpen} title="Procedure steps" />
              <ol className="space-y-2">
                {clinical.procedureSteps.map((s) => (
                  <li
                    key={s.step}
                    className="flex items-start gap-4 rounded-xl border border-border/25 bg-surface-2/30 px-4 py-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/10">
                      <span className="font-mono text-[11px] font-semibold text-accent">
                        {s.step}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/90">{s.title}</p>
                      <p className="text-xs font-light text-muted-foreground">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Required equipment */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
            <SectionTitle icon={Wrench} title="Required equipment" />
            <ul className="space-y-1 text-sm font-light">
              {PREF_CARD.instruments.map((it) => (
                <li key={it} className="text-foreground/90">
                  • {it}
                </li>
              ))}
            </ul>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Supplies
            </div>
            <ul className="mt-1 space-y-1 text-sm font-light">
              {PREF_CARD.supplies.map((s) => (
                <li key={s} className="text-foreground/80">
                  • {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Implant summary */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
            <SectionTitle icon={Package} title="Implant summary" />
            <ul className="space-y-1.5 text-sm font-light">
              {implants.map((line) => (
                <li key={line} className="text-foreground/90">
                  • {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Procedure planning reference — Spline 3D model moved to the
              bottom; the procedure steps are the primary orientation tool,
              the model is the visual aid. Full VIP plan one tap away. */}
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 md:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Compass className="h-3.5 w-3.5" />
                Procedure planning reference
              </div>
              {onOpenVipPlanning && (
                <button
                  type="button"
                  onClick={onOpenVipPlanning}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-light uppercase tracking-wider text-primary transition-colors hover:bg-primary/15"
                  title="Open the full VIP planning modal (or say 'Arti, open VIP planning model')"
                >
                  Open full VIP plan
                </button>
              )}
            </div>
            <div className="aspect-[16/7] w-full overflow-hidden rounded-xl bg-black/40">
              <iframe
                src="https://my.spline.design/untitled-e2ebd84b19d8c58cc8a9b2f149b1366e/"
                title={`${activeCase?.procedureShort ?? "RSA"} planning model`}
                frameBorder="0"
                width="100%"
                height="100%"
                allow="autoplay; fullscreen; xr-spatial-tracking"
                className="h-full w-full"
              />
            </div>
            <div className="mt-2 text-[11px] font-light text-muted-foreground">
              Drag to rotate · scroll to zoom. Full plan has planned orientation values + confirmed
              implants.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
