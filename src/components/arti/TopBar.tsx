import { useEffect, useState } from "react";
import { Volume2, Shield, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  cockpitMode: boolean;
  onToggleCockpit: () => void;
}

/**
 * Ambient OR vitals strip — noise meter, temp, sterile field, cockpit mode toggle.
 * "Sterile cockpit" silences non-critical alerts during critical case steps
 * (FAA-derived safety pattern adopted by surgical teams).
 */
export function TopBar({ staffName, staffRole, initials, cockpitMode, onToggleCockpit }: Props) {
  const [time, setTime] = useState(new Date());
  const [noise, setNoise] = useState(42);

  useEffect(() => {
    const i = setInterval(() => {
      setTime(new Date());
      // Drift the noise meter for ambient realism
      setNoise((n) => Math.max(28, Math.min(74, n + (Math.random() - 0.5) * 6)));
    }, 1500);
    return () => clearInterval(i);
  }, []);

  const noiseColor = noise > 65 ? "text-warning" : noise > 55 ? "text-foreground" : "text-success";

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface/40 px-8 py-4">
      <div className="flex items-center gap-8">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Operating Room 326
          </div>
          <div className="mt-0.5 text-2xl font-extralight tabular-nums">
            {time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            <span className="ml-3 text-sm font-light text-muted-foreground">
              {time.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Noise meter — addresses communication breakdown / cognitive load */}
        <div className="glass flex items-center gap-3 rounded-full px-4 py-2">
          <Volume2 className={cn("h-4 w-4", noiseColor)} />
          <div className="flex h-2 w-24 items-center gap-[2px]">
            {Array.from({ length: 12 }).map((_, i) => {
              const active = (i + 1) * 6 < noise;
              return (
                <span
                  key={i}
                  className={cn(
                    "h-full flex-1 rounded-sm transition-colors",
                    active
                      ? i > 8
                        ? "bg-warning"
                        : i > 6
                          ? "bg-foreground/70"
                          : "bg-success"
                      : "bg-surface-3",
                  )}
                />
              );
            })}
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(noise)} dB
          </span>
        </div>

        <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm font-light">
          <Thermometer className="h-4 w-4 text-muted-foreground" />
          <span className="tabular-nums">21.4°C</span>
        </div>

        {/* Sterile cockpit — psychology: explicit mode reduces salient interruptions */}
        <button
          onClick={onToggleCockpit}
          className={cn(
            "glass flex items-center gap-2 rounded-full px-4 py-2 text-sm font-light transition-colors",
            cockpitMode && "border-primary/50 text-primary",
          )}
          aria-pressed={cockpitMode}
        >
          <Shield className="h-4 w-4" />
          Sterile Cockpit
          <span
            className={cn(
              "ml-1 inline-block h-1.5 w-1.5 rounded-full",
              cockpitMode ? "bg-primary" : "bg-muted-foreground/40",
            )}
          />
        </button>

        <div className="ml-2 flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-light leading-tight">{staffName}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {staffRole}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
