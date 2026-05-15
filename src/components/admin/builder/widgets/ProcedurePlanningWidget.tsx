import { AirplayIcon, Tablet } from "lucide-react";
import type { WidgetSize } from "../types";

interface Props {
  size: WidgetSize;
}

export function ProcedurePlanningWidget({ size }: Props) {
  return (
    <div className="relative flex h-full w-full flex-col bg-gradient-to-br from-[#0c1424] to-[#0a0f1c]">
      <div className="absolute left-3 top-3 flex items-center gap-2 text-primary/90">
        <AirplayIcon className="h-4 w-4" strokeWidth={1.7} />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
          Planning · reserved
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
            <Tablet className="h-7 w-7" strokeWidth={1.4} />
            <span
              className="absolute -right-1 -top-1 flex h-3 w-3"
              aria-label="AirPlay active"
              title="AirPlay active"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          </div>
          {size !== "small" && (
            <>
              <div className="mt-3 text-sm font-light text-foreground/90">Procedure Planning</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                AirPlay · OR tablet
              </div>
            </>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/70">
        Tablet mirror
      </div>
    </div>
  );
}
