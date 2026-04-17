import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  User,
  AlertTriangle,
  Heart,
  Pill,
  FileText,
  Droplets,
  Scale,
  Activity,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Demo data — in production from EMR / OR scheduling system
const PATIENT = {
  name: "Marcus Chen",
  mrn: "MRN-00482916",
  dob: "03/14/1963",
  age: "62M",
  sex: "Male",
  height: "5′10″ (178 cm)",
  weight: "192 lbs (87 kg)",
  bmi: "27.6",
  bloodType: "A+",
  procedure: "Right Reverse Total Shoulder Arthroplasty",
  surgeon: "Dr. Anika Patel",
  scheduledTime: "07:30 AM",
  allergies: [
    { agent: "Penicillin", reaction: "Anaphylaxis", severity: "severe" },
    { agent: "Betadine", reaction: "Contact dermatitis", severity: "moderate" },
  ],
  medications: [
    "Lisinopril 10 mg daily",
    "Metformin 500 mg BID",
    "Aspirin 81 mg daily — held 7 days pre-op",
    "Atorvastatin 20 mg QHS",
  ],
  conditions: [
    "Hypertension — controlled",
    "Type 2 Diabetes — A1c 6.8%",
    "Rotator cuff tear (chronic, right shoulder)",
    "Mild OSA — no CPAP",
  ],
  labs: [
    { label: "Hgb", value: "13.2 g/dL", flag: false },
    { label: "Plt", value: "245 K/µL", flag: false },
    { label: "INR", value: "1.0", flag: false },
    { label: "Cr", value: "1.1 mg/dL", flag: false },
    { label: "Glucose", value: "148 mg/dL", flag: true },
    { label: "K+", value: "4.2 mEq/L", flag: false },
  ],
  consents: ["Surgical consent — signed", "Anesthesia consent — signed", "Blood transfusion — declined"],
  notes: [
    "Interscalene nerve block planned — confirm with anesthesia team.",
    "Patient requests minimal narcotics post-op.",
    "Family in waiting room — daughter is healthcare proxy.",
  ],
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  const cls =
    severity === "severe"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : "bg-warning/15 text-warning-foreground border-warning/30";
  return (
    <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}>
      {severity}
    </span>
  );
};

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
    <Icon className="h-3.5 w-3.5" />
    {title}
  </div>
);

export function PatientDetailsModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>
            {PATIENT.name}
            <span className="text-sm font-normal text-muted-foreground">
              {PATIENT.age} · {PATIENT.mrn}
            </span>
          </DialogTitle>
          <DialogDescription>
            {PATIENT.procedure} · {PATIENT.surgeon} · {PATIENT.scheduledTime}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-5 sm:grid-cols-2">
          {/* Demographics */}
          <div>
            <SectionTitle icon={User} title="Demographics" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">DOB</span>
              <span>{PATIENT.dob}</span>
              <span className="text-muted-foreground">Sex</span>
              <span>{PATIENT.sex}</span>
              <span className="text-muted-foreground">Height</span>
              <span>{PATIENT.height}</span>
              <span className="text-muted-foreground">Weight</span>
              <span>{PATIENT.weight}</span>
              <span className="text-muted-foreground">BMI</span>
              <span>{PATIENT.bmi}</span>
            </div>
          </div>

          {/* Blood type & vitals */}
          <div>
            <SectionTitle icon={Droplets} title="Blood Type" />
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1 font-mono text-lg font-bold text-destructive">
                {PATIENT.bloodType}
              </span>
            </div>
            <SectionTitle icon={Scale} title="BMI" />
            <span className="text-sm text-muted-foreground">{PATIENT.bmi} — Overweight</span>
          </div>

          {/* Allergies — CRITICAL */}
          <div className="sm:col-span-2">
            <SectionTitle icon={AlertTriangle} title="Allergies" />
            <div className="space-y-2">
              {PATIENT.allergies.map((a) => (
                <div
                  key={a.agent}
                  className="flex items-center rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm"
                >
                  <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                  <span className="font-medium">{a.agent}</span>
                  <span className="ml-2 text-muted-foreground">— {a.reaction}</span>
                  <SeverityBadge severity={a.severity} />
                </div>
              ))}
            </div>
          </div>

          {/* Medications */}
          <div>
            <SectionTitle icon={Pill} title="Current Medications" />
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PATIENT.medications.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                  {m}
                </li>
              ))}
            </ul>
          </div>

          {/* Conditions */}
          <div>
            <SectionTitle icon={Heart} title="Medical History" />
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PATIENT.conditions.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning/50" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Labs */}
          <div className="sm:col-span-2">
            <SectionTitle icon={Activity} title="Pre-Op Labs" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PATIENT.labs.map((l) => (
                <div
                  key={l.label}
                  className={`rounded-lg border px-3 py-2 text-center text-sm ${
                    l.flag
                      ? "border-warning/30 bg-warning/5"
                      : "border-border/40 bg-surface-2/50"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {l.label}
                  </div>
                  <div className={l.flag ? "font-semibold text-warning-foreground" : ""}>
                    {l.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consents */}
          <div>
            <SectionTitle icon={FileText} title="Consents" />
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PATIENT.consents.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-success/50" />
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* Notes */}
          <div>
            <SectionTitle icon={FileText} title="Pre-Op Notes" />
            <div className="space-y-2">
              {PATIENT.notes.map((n) => (
                <div
                  key={n}
                  className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-muted-foreground"
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
