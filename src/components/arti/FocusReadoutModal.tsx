import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  FileCheck2,
  Wind,
  ArrowUpDown,
  Syringe,
  Package,
  Droplets,
} from "lucide-react";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";
import { PREF_CARD } from "./PreferenceCard";
import { CONSOLES } from "./consoles";
import { getIntraopSnapshot } from "./intraop";

export type ReadoutCategory =
  | "allergies"
  | "consents"
  | "anesthesia"
  | "positioning"
  | "antibiotics"
  | "implants"
  | "fluid";

interface Props {
  open: boolean;
  onClose: () => void;
  category: ReadoutCategory | null;
  activeCase?: CaseItem;
}

const CATEGORY_META: Record<
  ReadoutCategory,
  {
    title: string;
    subtitle: string;
    icon: import("lucide-react").LucideIcon;
    tone: string;
    bg: string;
  }
> = {
  allergies: {
    title: "Patient allergies",
    subtitle: "Confirmed sensitivities + reaction severity",
    icon: AlertTriangle,
    tone: "text-warning",
    bg: "bg-warning/15",
  },
  consents: {
    title: "Surgical consents",
    subtitle: "Documents signed and on file",
    icon: FileCheck2,
    tone: "text-success",
    bg: "bg-success/15",
  },
  anesthesia: {
    title: "Anesthesia plan",
    subtitle: "Plan + airway assessment",
    icon: Wind,
    tone: "text-primary",
    bg: "bg-primary/15",
  },
  positioning: {
    title: "Positioning instructions",
    subtitle: "Patient setup + padding",
    icon: ArrowUpDown,
    tone: "text-primary",
    bg: "bg-primary/15",
  },
  antibiotics: {
    title: "Antibiotic status",
    subtitle: "Agent, last dose, redose window",
    icon: Syringe,
    tone: "text-success",
    bg: "bg-success/15",
  },
  implants: {
    title: "Implant log",
    subtitle: "Components planned + opened so far",
    icon: Package,
    tone: "text-accent",
    bg: "bg-accent/15",
  },
  fluid: {
    title: "Fluid totals",
    subtitle: "Irrigation in / out + deficit",
    icon: Droplets,
    tone: "text-primary",
    bg: "bg-primary/15",
  },
};

const Row = ({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-border/30 py-2 last:border-b-0">
    <div className="text-xs font-light uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-right text-base font-light ${tone ?? "text-foreground"}`}>{value}</div>
  </div>
);

const SeverityChip = ({ severity }: { severity: string }) => {
  const cls =
    severity === "severe"
      ? "border-destructive/40 bg-destructive/15 text-destructive"
      : severity === "moderate"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-muted-foreground/30 bg-muted/40 text-muted-foreground";
  return (
    <span
      className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {severity}
    </span>
  );
};

export function FocusReadoutModal({ open, onClose, category, activeCase }: Props) {
  if (!category) return null;
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;
  const snapshot = activeCase ? getIntraopSnapshot(activeCase.id) : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(95vw,80rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-5 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${meta.bg} ${meta.tone}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div>{meta.title}</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {meta.subtitle}
                {activeCase ? ` · ${activeCase.patientName} · ${activeCase.procedureShort}` : ""}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            {category === "allergies"
              ? "Severe reactions shown first. Verify against the patient band before incision."
              : category === "consents"
                ? "Confirm each document is signed and posted before the time-out."
                : category === "anesthesia"
                  ? "Difficult-airway flags are highlighted in red."
                  : category === "positioning"
                    ? "Beach chair setup with arm holder + axillary roll."
                    : category === "antibiotics"
                      ? "Redose interval is 4 hours from last administered dose."
                      : category === "implants"
                        ? "Status reflects what's confirmed and what's been opened on the field."
                        : "Pump telemetry — bag remaining and total dispensed."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {category === "allergies" && (
            <div className="rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              {clinical?.allergies.length ? (
                <ul className="space-y-3">
                  {[...clinical.allergies]
                    .sort((a, b) => {
                      const rank = { severe: 0, moderate: 1, mild: 2 } as Record<string, number>;
                      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
                    })
                    .map((a) => (
                      <li
                        key={a.agent}
                        className="flex items-start justify-between gap-4 rounded-xl border border-border/30 bg-surface-2/40 p-4"
                      >
                        <div>
                          <div className="text-lg font-light text-foreground">{a.agent}</div>
                          <div className="text-sm font-light text-muted-foreground">
                            {a.reaction}
                          </div>
                        </div>
                        <SeverityChip severity={a.severity} />
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="text-base font-light text-success">
                  NKDA — no known drug allergies.
                </div>
              )}
            </div>
          )}

          {category === "consents" && (
            <div className="rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              {clinical?.consents.length ? (
                <ul className="space-y-2">
                  {clinical.consents.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-3 rounded-xl border border-success/20 bg-success/[0.04] p-3 text-sm font-light text-foreground/90"
                    >
                      <FileCheck2
                        className="mt-0.5 h-4 w-4 shrink-0 text-success"
                        strokeWidth={1.8}
                      />
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-base font-light text-warning">
                  No consents recorded yet for this case.
                </div>
              )}
            </div>
          )}

          {category === "anesthesia" && (
            <div className="space-y-4 rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              <Row label="Plan" value={clinical?.anesthesiaPlan ?? "—"} />
              <Row
                label="Airway · Mallampati"
                value={
                  <>
                    {clinical?.airway.mallampati ?? "—"}
                    {clinical?.airway.difficult ? (
                      <span className="ml-2 rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        Difficult airway
                      </span>
                    ) : null}
                  </>
                }
              />
              <Row label="NPO" value={clinical?.npo ?? "—"} />
              <Row
                label="Allergies (quick reference)"
                value={
                  clinical?.allergies.length
                    ? clinical.allergies.map((a) => `${a.agent} (${a.severity})`).join(", ")
                    : "NKDA"
                }
              />
            </div>
          )}

          {category === "positioning" && (
            <div className="space-y-4 rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              <Row label="Position" value={PREF_CARD.positioning.position} />
              <Row label="Arm" value={PREF_CARD.positioning.arm} />
              <Row label="Padding" value={PREF_CARD.positioning.padding} />
            </div>
          )}

          {category === "antibiotics" && (
            <div className="space-y-4 rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              {snapshot ? (
                <>
                  <Row label="Agent" value={snapshot.antibiotic.agent} />
                  <Row label="Last dose" value={snapshot.antibiotic.lastDose} />
                  <Row
                    label="Next due"
                    value={
                      <span
                        className={
                          snapshot.antibiotic.dueInMinutes < 0
                            ? "text-warning"
                            : snapshot.antibiotic.dueInMinutes < 30
                              ? "text-warning"
                              : "text-foreground"
                        }
                      >
                        {snapshot.antibiotic.dueInMinutes < 0
                          ? `Overdue by ${Math.abs(snapshot.antibiotic.dueInMinutes)} min`
                          : `In ${snapshot.antibiotic.dueInMinutes} min`}
                      </span>
                    }
                  />
                </>
              ) : (
                <div className="text-base font-light text-muted-foreground">
                  Cefazolin 2 g IV — pre-op dose pending.
                </div>
              )}
            </div>
          )}

          {category === "implants" && (
            <div className="rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              <ul className="space-y-2">
                {(snapshot?.implants ?? []).map((i) => (
                  <li
                    key={`${i.component}-${i.spec}`}
                    className="flex items-start justify-between gap-4 rounded-xl border border-border/30 bg-surface-2/40 p-3"
                  >
                    <div>
                      <div className="text-base font-light text-foreground">{i.component}</div>
                      <div className="text-xs font-light text-muted-foreground">{i.spec}</div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        i.status === "verified"
                          ? "border-success/40 bg-success/15 text-success"
                          : i.status === "scanned" || i.status === "staged"
                            ? "border-warning/40 bg-warning/15 text-warning"
                            : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {i.status}
                    </span>
                  </li>
                ))}
                {snapshot && snapshot.implants.length === 0 ? (
                  <li className="text-sm font-light text-muted-foreground">
                    No implants planned for this case.
                  </li>
                ) : null}
                {!snapshot && clinical?.implantPlan.length ? (
                  <>
                    {clinical.implantPlan.map((i) => (
                      <li
                        key={`${i.component}-${i.spec}`}
                        className="flex items-start justify-between gap-4 rounded-xl border border-border/30 bg-surface-2/40 p-3"
                      >
                        <div>
                          <div className="text-base font-light text-foreground">{i.component}</div>
                          <div className="text-xs font-light text-muted-foreground">{i.spec}</div>
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            i.confirmed
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-warning/40 bg-warning/15 text-warning"
                          }`}
                        >
                          {i.confirmed ? "Confirmed" : "Unconfirmed"}
                        </span>
                      </li>
                    ))}
                  </>
                ) : null}
              </ul>
            </div>
          )}

          {category === "fluid" && (
            <div className="space-y-4 rounded-2xl border border-border/40 bg-surface-2/30 p-6">
              {(() => {
                const pump = CONSOLES.find((c) => c.id === "pump");
                const pressure = pump?.telemetry.find((t) =>
                  t.label.toLowerCase().includes("pressure"),
                )?.value;
                const flow = pump?.telemetry.find((t) =>
                  t.label.toLowerCase().includes("flow"),
                )?.value;
                const bag = pump?.telemetry.find((t) => t.label.toLowerCase().includes("saline"));
                return (
                  <>
                    <Row label="Pressure setpoint" value={pressure ?? "—"} />
                    <Row label="Flow rate" value={flow ?? "—"} />
                    <Row
                      label="Saline bag"
                      value={bag ? `${bag.value}${bag.detail ? ` — ${bag.detail}` : ""}` : "—"}
                    />
                    <Row label="Estimated deficit" value="~250 mL" tone="text-warning" />
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
