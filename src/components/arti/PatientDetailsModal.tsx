import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { User, AlertTriangle, Heart, Pill, FileText, Droplets, Scale, Activity } from "lucide-react";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";

interface Props {
  open: boolean;
  onClose: () => void;
  activeCase?: CaseItem;
}

const SeverityBadge = ({ severity }: { severity: string }) => {
  const cls =
    severity === "severe"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : severity === "moderate"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {severity}
    </span>
  );
};

const SectionTitle = ({
  icon: Icon,
  title,
}: {
  icon: import("lucide-react").LucideIcon;
  title: string;
}) => (
  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
    <Icon className="h-3.5 w-3.5" />
    {title}
  </div>
);

export function PatientDetailsModal({ open, onClose, activeCase }: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : PATIENT_CLINICAL["c-002"];
  const c = clinical ?? PATIENT_CLINICAL["c-002"];

  const procedureDisplay = activeCase
    ? `${activeCase.side ? `${activeCase.side} ` : ""}${activeCase.procedure}`
    : "Right Reverse Total Shoulder Arthroplasty";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(95vw,96rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-6 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User className="h-6 w-6" />
            </div>
            <div>
              <div>{activeCase?.patientName ?? "Marcus Chen"}</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {activeCase?.patientAgeSex ?? "62M"} · {activeCase?.patientMrn ?? "MRN-00482916"}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm">
            {procedureDisplay} · {activeCase?.surgeon ?? "Dr. Anika Patel"} · {activeCase?.time ?? "07:30"} AM
          </DialogDescription>
        </DialogHeader>

        <div data-scroll-modal className="min-h-0 flex-1 overflow-y-auto py-6">
          <div className="grid gap-8 md:grid-cols-3">
            {/* ── Column 1: Demographics + Blood + NPO ── */}
            <div className="space-y-8">
              <div>
                <SectionTitle icon={User} title="Demographics" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                  <span className="text-muted-foreground">DOB</span><span>{c.dob}</span>
                  <span className="text-muted-foreground">Sex</span><span>{c.sex}</span>
                  <span className="text-muted-foreground">Height</span><span>{c.height}</span>
                  <span className="text-muted-foreground">Weight</span><span>{c.weight}</span>
                  <span className="text-muted-foreground">BMI</span><span>{c.bmi}</span>
                </div>
              </div>

              <div>
                <SectionTitle icon={Droplets} title="Blood Type" />
                <span className="inline-block rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-2xl font-bold text-destructive">
                  {c.bloodType}
                </span>
              </div>

              <div>
                <SectionTitle icon={Scale} title="NPO Status" />
                <span className="text-sm text-muted-foreground">{c.npo}</span>
              </div>

              <div>
                <SectionTitle icon={FileText} title="Consents" />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {c.consents.map((con) => (
                    <li key={con} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success/60" />
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Column 2: Allergies + Medications ── */}
            <div className="space-y-8">
              <div>
                <SectionTitle icon={AlertTriangle} title="Allergies" />
                {c.allergies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">NKDA — No known drug allergies</p>
                ) : (
                  <div className="space-y-2.5">
                    {c.allergies.map((a) => (
                      <div
                        key={a.agent}
                        className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                          <span className="font-semibold">{a.agent}</span>
                          <SeverityBadge severity={a.severity} />
                        </div>
                        <p className="mt-1 pl-6 text-muted-foreground">{a.reaction}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <SectionTitle icon={Pill} title="Current Medications" />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {c.medications.map((m) => (
                    <li key={m} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <SectionTitle icon={Heart} title="Medical History" />
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {c.conditions.map((cond) => (
                    <li key={cond} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning/50" />
                      {cond}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Column 3: Labs + Notes ── */}
            <div className="space-y-8">
              <div>
                <SectionTitle icon={Activity} title="Pre-Op Labs" />
                <div className="grid grid-cols-2 gap-3">
                  {c.labs.map((l) => (
                    <div
                      key={l.label}
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        l.flag ? "border-warning/30 bg-warning/5" : "border-border/40 bg-surface-2/50"
                      }`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {l.label}
                      </div>
                      <div className={`mt-1 text-base font-medium ${l.flag ? "text-warning" : ""}`}>
                        {l.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SectionTitle icon={FileText} title="Pre-Op Notes" />
                <div className="space-y-2.5">
                  {c.notes.map((n) => (
                    <div
                      key={n}
                      className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
