import { PHASE_LABEL, PHASES, type Phase, type PhaseLayouts } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  active: Phase;
  layouts: PhaseLayouts;
  onChange: (phase: Phase) => void;
}

export function PhaseTabs({ active, layouts, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface/30 px-6 py-3">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
        Phase
      </span>
      {PHASES.map((phase) => {
        const count = layouts[phase].length;
        const isActive = active === phase;
        return (
          <button
            key={phase}
            type="button"
            onClick={() => onChange(phase)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-light transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-surface-2/40 text-foreground hover:bg-surface-2",
            )}
          >
            {PHASE_LABEL[phase]}
            <span
              className={cn(
                "rounded-full px-1.5 font-mono text-[9px] uppercase tracking-wider",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-surface-3/60 text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
