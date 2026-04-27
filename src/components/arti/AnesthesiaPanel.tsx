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

/** Canonical list of machine-check items. Indices are stable and used by
 * the toggle_machine_check_item voice tool — DO NOT reorder. */
export const MACHINE_CHECK_ITEMS = [
  "O₂ flush valve",
  "Vaporizer filled (Sevo)",
  "Circuit leak test passed",
  "Backup ventilation (Ambu)",
  "Suction functional",
  "Emergency drugs drawn up",
  "Warming blanket active",
] as const;

/** Default checked state — first five items are done at start of day. */
export const MACHINE_CHECK_INITIAL_DONE: number[] = [0, 1, 2, 3, 4];

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
  icon: import("lucide-react").LucideIcon;
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
  /** Indices of completed machine-check items. */
  machineCheckDone?: Set<number>;
  /** Toggle one item by index. If omitted, the rows render but aren't clickable. */
  onToggleMachineCheck?: (index: number) => void;
}

export function AnesthesiaPanel({
  activeCase,
  machineCheckDone,
  onToggleMachineCheck,
}: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : PATIENT_CLINICAL["c-002"];
  const c = clinical ?? PATIENT_CLINICAL["c-002"];

  const done = machineCheckDone ?? new Set(MACHINE_CHECK_INITIAL_DONE);
  const machineComplete = done.size;
  const machinePct = (machineComplete / MACHINE_CHECK_ITEMS.length) * 100;

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
          <div className="space-y-1">
            {MACHINE_CHECK_ITEMS.map((label, i) => {
              const isDone = done.has(i);
              const interactive = !!onToggleMachineCheck;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onToggleMachineCheck?.(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                    interactive && "hover:bg-surface-2/50",
                    !interactive && "cursor-default",
                  )}
                >
                  {isDone ? (
                    <CheckCircle
                      className="h-4 w-4 shrink-0 text-success"
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Circle
                      className="h-4 w-4 shrink-0 text-muted-foreground/30"
                      strokeWidth={1.8}
                    />
                  )}
                  <span
                    className={
                      isDone ? "text-foreground/55 line-through" : "text-foreground/90"
                    }
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Completed</span>
              <span className="font-mono">
                {machineComplete}/{MACHINE_CHECK_ITEMS.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3/60">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  machineComplete === MACHINE_CHECK_ITEMS.length ? "bg-success" : "bg-warning",
                )}
                style={{ width: `${machinePct}%` }}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
