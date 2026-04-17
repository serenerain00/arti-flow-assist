import { Clock, MapPin, User } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  cockpitMode: boolean;
  onOpenPatientDetails?: () => void;
}

/**
 * Above-the-fold case identity. Hick's law: the most-needed info is one glance away.
 * Countdown gives temporal anchoring; cockpit mode chip changes the whole frame's tone.
 */
export function CaseHeader({ cockpitMode, onOpenPatientDetails }: Props) {
  const [secs, setSecs] = useState(32 * 60 + 14);
  useEffect(() => {
    const i = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(i);
  }, []);

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-7">
      {cockpitMode && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
      )}

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              Next Case · Pre-Op
            </div>
            <span className="rounded-full border border-border bg-surface-3/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Arthrex VIP plan
            </span>
          </div>

          <h1 className="mt-2 text-4xl font-extralight tracking-tight">
            Reverse Total Shoulder
            <span className="text-muted-foreground/60"> · RSA</span>
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-light text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-primary heartbeat" />
              Marcus Chen · 62M · Right shoulder
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> OR 326
            </span>
            <span>Dr. Anika Patel · Lead surgeon</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {onOpenPatientDetails && (
            <button
              onClick={onOpenPatientDetails}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <User className="h-4 w-4 text-primary" />
              Patient Info
            </button>
          )}
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Incision in
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-mono text-5xl font-thin tabular-nums tracking-tight">
                {mm}:{ss}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
