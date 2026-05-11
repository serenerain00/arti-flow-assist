import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Compass, Package, Ruler, CheckCircle2, AlertCircle } from "lucide-react";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";

interface Props {
  open: boolean;
  onClose: () => void;
  activeCase?: CaseItem;
}

// Generic orientation reference — in a real VIP workflow these come from the
// surgeon's pre-op CT plan (Blueprint, VIP, etc.). For the prototype we seed
// representative values so the panel reads like a real plan summary.
const ORIENTATION_DEFAULTS = [
  { label: "Glenoid version", value: "−4°", target: "0° to −10°", inRange: true },
  { label: "Glenoid inclination", value: "+8°", target: "+5° to +10°", inRange: true },
  { label: "Baseplate seating", value: "Flush · superior peg engaged", inRange: true },
  { label: "Humeral retroversion", value: "20°", target: "20° ± 5°", inRange: true },
  { label: "Glenosphere offset", value: "+2 mm lateral", target: "0 to +4 mm", inRange: true },
];

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

export function VipPlanningModal({ open, onClose, activeCase }: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;
  const implants = clinical?.implantPlan ?? [];

  const procedureDisplay = activeCase
    ? `${activeCase.side ? `${activeCase.side} ` : ""}${activeCase.procedureShort}`
    : "RSA";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[95vh] w-[min(98vw,108rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div>VIP Planning Reference</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {procedureDisplay} · pre-op 3D plan · {activeCase?.surgeon ?? "Dr. Anika Patel"}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            Tilt and rotate the model to compare implant orientation against the plan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-2 lg:grid-cols-[1.6fr_1fr]">
          {/* 3D model */}
          <div className="min-h-[24rem] overflow-hidden rounded-2xl border border-accent/20 bg-black/40">
            <iframe
              src="https://my.spline.design/untitled-e2ebd84b19d8c58cc8a9b2f149b1366e/"
              title={`${procedureDisplay} planning model`}
              frameBorder="0"
              width="100%"
              height="100%"
              allow="autoplay; fullscreen; xr-spatial-tracking"
              className="h-full w-full"
            />
          </div>

          {/* Right rail */}
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            {/* Planned orientation */}
            <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
              <SectionTitle icon={Ruler} title="Planned orientation" />
              <ul className="space-y-2 text-sm font-light">
                {ORIENTATION_DEFAULTS.map((o) => (
                  <li key={o.label} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-foreground/85">{o.label}</div>
                      {o.target ? (
                        <div className="text-[11px] text-muted-foreground">Target {o.target}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span className="text-foreground">{o.value}</span>
                      {o.inRange ? (
                        <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.7} />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" strokeWidth={1.7} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Implant plan */}
            <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
              <SectionTitle icon={Package} title="Implant plan" />
              {implants.length ? (
                <ul className="space-y-2 text-sm font-light">
                  {implants.map((i) => (
                    <li
                      key={`${i.component}-${i.spec}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-foreground/90">{i.component}</div>
                        <div className="text-[11px] text-muted-foreground">{i.spec}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          i.confirmed
                            ? "border-success/30 bg-success/15 text-success"
                            : "border-warning/30 bg-warning/15 text-warning"
                        }`}
                      >
                        {i.confirmed ? "Confirmed" : "Pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm font-light text-muted-foreground">
                  No implant plan recorded for this case.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
