import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Circle,
  FlaskConical,
  Pill,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PATIENT_CLINICAL } from "./cases";
import type { CaseItem } from "./cases";

const MACHINE_CHECK = [
  { item: "O₂ flush valve", done: true },
  { item: "Vaporizer filled (Sevo)", done: true },
  { item: "Circuit leak test passed", done: true },
  { item: "Backup ventilation (Ambu)", done: true },
  { item: "Suction functional", done: true },
  { item: "Emergency drugs drawn up", done: false },
  { item: "Warming blanket active", done: false },
];

const ALLERGY_TIER: Record<string, string> = {
  severe: "border-destructive/50 bg-destructive/10 text-destructive",
  moderate: "border-warning/40 bg-warning/[0.08] text-warning",
  mild: "border-border bg-surface-2/50 text-muted-foreground",
};

function PanelLabel({
  icon: Icon,
  children,
  color = "text-warning",
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em]", color)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {children}
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

interface Props {
  activeCase?: CaseItem;
}

export function AnesthesiaPanel({ activeCase }: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : PATIENT_CLINICAL["c-002"];
  const c = clinical ?? PATIENT_CLINICAL["c-002"];

  const machineComplete = MACHINE_CHECK.filter((i) => i.done).length;
  const machinePct = (machineComplete / MACHINE_CHECK.length) * 100;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 animate-fade-in">
      {/* ── Left (2 cols) ── */}
      <div className="space-y-4 xl:col-span-2">
        {/* Allergies — always first, never hidden */}
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-5">
          <PanelLabel icon={AlertTriangle} color="text-destructive">
            Allergies · Patient Safety
          </PanelLabel>
          {c.allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">NKDA — No known drug allergies</p>
          ) : (
            <div className="space-y-2">
              {c.allergies.map((a) => (
                <div
                  key={a.agent}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3",
                    ALLERGY_TIER[a.severity] ?? ALLERGY_TIER.mild,
                  )}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold">{a.agent}</span>
                    <span className="ml-2 text-xs opacity-70">→ {a.reaction}</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest opacity-60">
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anesthesia Plan */}
        <Panel>
          <PanelLabel icon={Wind}>Anesthesia Plan</PanelLabel>
          <p className="text-sm font-light text-foreground/85">{c.anesthesiaPlan}</p>
        </Panel>

        {/* Current Medications */}
        <Panel>
          <PanelLabel icon={Pill}>Current Medications</PanelLabel>
          <div className="space-y-2">
            {c.medications.map((med) => (
              <div
                key={med}
                className="rounded-xl border border-border/30 bg-surface-2/40 px-4 py-2.5 text-sm font-light text-foreground/90"
              >
                {med}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Right column ── */}
      <div className="space-y-4">
        {/* Patient at a glance */}
        <Panel>
          <PanelLabel icon={Activity}>Patient</PanelLabel>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Name", activeCase?.patientName ?? "Marcus Chen"],
              ["DOB", c.dob],
              ["Age / Sex", activeCase?.patientAgeSex ?? c.sex],
              ["Weight", c.weight],
              ["Height", c.height],
              ["Blood type", c.bloodType],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="font-light text-foreground/85">{val}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-border/40 bg-surface-2/50 px-3 py-2 text-xs text-muted-foreground">
            {c.npo}
          </div>
        </Panel>

        {/* Airway */}
        <Panel>
          <PanelLabel icon={Wind}>Airway Assessment</PanelLabel>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Mallampati</p>
              <p className="font-light text-foreground/85">{c.airway.mallampati}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Classification</p>
              <p className="font-light text-foreground/85">{c.airway.difficult ? "Difficult" : "Standard"}</p>
            </div>
          </div>
          <div
            className={cn(
              "mt-3 rounded-xl border px-3 py-2 text-center text-xs font-light",
              c.airway.difficult
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-success/30 bg-success/[0.06] text-success",
            )}
          >
            {c.airway.difficult
              ? "Anticipated difficult airway"
              : "No anticipated airway difficulty"}
          </div>
        </Panel>

        {/* Pre-op Labs */}
        <Panel>
          <PanelLabel icon={FlaskConical}>Pre-op Labs</PanelLabel>
          <div className="space-y-1.5">
            {c.labs.map((lab) => (
              <div
                key={lab.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  lab.flag
                    ? "border border-warning/20 bg-warning/[0.06]"
                    : "border border-transparent bg-surface-2/40",
                )}
              >
                <span className="w-18 shrink-0 text-xs text-muted-foreground">{lab.label}</span>
                <span className={cn("flex-1 font-mono font-semibold", lab.flag ? "text-warning" : "text-foreground/85")}>
                  {lab.value}
                </span>
                {lab.flag && <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />}
              </div>
            ))}
          </div>
        </Panel>

        {/* Machine Check */}
        <Panel>
          <PanelLabel icon={CheckCircle}>Machine Check</PanelLabel>
          <div className="space-y-2">
            {MACHINE_CHECK.map((item) => (
              <div key={item.item} className="flex items-center gap-3 text-sm">
                {item.done ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-success" strokeWidth={1.8} />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/30" strokeWidth={1.8} />
                )}
                <span className={item.done ? "text-foreground/55 line-through" : "text-foreground/90"}>
                  {item.item}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Completed</span>
              <span className="font-mono">
                {machineComplete}/{MACHINE_CHECK.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3/60">
              <div
                className="h-full rounded-full bg-warning transition-all duration-700"
                style={{ width: `${machinePct}%` }}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
