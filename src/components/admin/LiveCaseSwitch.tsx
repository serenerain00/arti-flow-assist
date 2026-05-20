import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  onToggle: () => void;
}

export function LiveCaseSwitch({ active, onToggle }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-28 right-5 z-50 flex items-center gap-3">
      <div
        className={cn(
          "pointer-events-auto inline-flex items-center gap-3 rounded-full border bg-popover/80 px-4 py-2 shadow-xl backdrop-blur-md transition-colors",
          active ? "border-success/50" : "border-border/60",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
            active ? "bg-success/15 text-success" : "bg-surface-2/60 text-muted-foreground",
          )}
        >
          <Activity className="h-3.5 w-3.5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
            Case in progress
          </div>
          <div
            className={cn(
              "text-xs font-light",
              active ? "text-success" : "text-muted-foreground",
            )}
          >
            {active ? "Live" : "Off"}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={onToggle}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border/60 transition-colors",
            active ? "bg-success/80" : "bg-surface-3/60",
          )}
          aria-label="Toggle live case"
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full bg-foreground/90 shadow transition-transform",
              active ? "translate-x-6" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
    </div>
  );
}
