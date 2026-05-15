import { ScanLine } from "lucide-react";
import type { WidgetSize } from "../types";

interface Props {
  size: WidgetSize;
}

export function PacsWidget({ size }: Props) {
  return (
    <div className="relative flex h-full w-full flex-col bg-black">
      <div className="absolute left-3 top-3 flex items-center gap-2 text-white/70">
        <ScanLine className="h-4 w-4" strokeWidth={1.7} />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em]">PACS · reserved</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/40">
            <ScanLine className="h-7 w-7" strokeWidth={1.4} />
          </div>
          {size !== "small" && (
            <>
              <div className="mt-3 text-sm font-light text-white/80">PACS Imaging</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                Xray · MRI · CT
              </div>
            </>
          )}
        </div>
      </div>
      <div className="absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
        OR feed
      </div>
    </div>
  );
}
