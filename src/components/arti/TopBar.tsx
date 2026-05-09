import { useEffect, useState } from "react";
import { Moon, Thermometer, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  /**
   * Optional one-tap "send Arti to sleep" button. When provided, a Moon
   * pill renders to the right of the room/patient vitals strip — saves
   * the user from having to use voice or dig into the sidebar menu.
   */
  onSleep?: () => void;
}

/**
 * Ambient OR vitals strip — noise meter, room temperature, staff identity.
 */
export function TopBar({ staffName, staffRole, initials, onSleep }: Props) {
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

        {/* Quick-sleep — one tap puts Arti into standby without voice. */}
        {onSleep && (
          <button
            type="button"
            onClick={onSleep}
            className="glass group flex h-10 items-center gap-2 rounded-full px-4 text-xs font-light uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            title="Send Arti to sleep (or say 'arti, sleep')"
            aria-label="Send Arti to sleep"
          >
            <Moon className="h-4 w-4" strokeWidth={1.7} />
            Sleep
          </button>
        )}

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
