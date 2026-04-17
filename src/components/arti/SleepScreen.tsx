import { useEffect, useState } from "react";
import { RippleCanvas } from "./RippleCanvas";
import { GreetingVoice } from "./GreetingVoice";

function getGreeting(d?: Date | null) {
  if (!d) return "Hello";
  const h = d.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Props {
  /** "sleep" | "waking" | "greeting" — owned by the parent so transitions are explicit. */
  phase: "sleep" | "waking" | "greeting";
  staffName: string;
  /** User asked to wake Arti (tap / wake-word). Parent decides whether to honor. */
  onWakeRequested: () => void;
  /** Wake ripple animation has played enough — parent advances to greeting. */
  onWakeAnimationComplete: () => void;
  /** User said "show me the dashboard" — Arti's tool fires this to advance. */
  onGoToDashboard: () => void;
}

/**
 * Ambient sleep state. Owns only its own clock & UI; phase comes from
 * the parent route so we can never accidentally loop sleep → wake → sleep
 * from local state.
 *
 * Phases:
 *   1. sleep    — gentle ripples, faint wordmark, time. Voice OFF.
 *   2. waking   — ripple expands; after 1.1s parent advances to greeting.
 *   3. greeting — Arti speaks once, then parent advances to dashboard.
 */
export function SleepScreen({
  phase,
  staffName,
  onWakeRequested,
  onWakeAnimationComplete,
  onGoToDashboard,
}: Props) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const i = setInterval(() => setTime(new Date()), 1000 * 30);
    return () => clearInterval(i);
  }, []);

  // Wake animation runs for ~1.1s then we hand off to greeting.
  useEffect(() => {
    if (phase !== "waking") return;
    const t = setTimeout(onWakeAnimationComplete, 1100);
    return () => clearTimeout(t);
  }, [phase, onWakeAnimationComplete]);

  const greeting = getGreeting(time ?? undefined);
  const timeStr = time
    ? time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <button
      type="button"
      onClick={onWakeRequested}
      className="group fixed inset-0 z-50 block h-full w-full cursor-pointer overflow-hidden bg-background text-left"
      aria-label="Wake Arti"
    >
      <RippleCanvas intensity={phase === "sleep" ? 0.6 : 2.2} />

      {/* Center mark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          {/* breathing core */}
          <div
            className="ripple-core"
            style={{
              transform: phase === "sleep" ? undefined : "scale(2.2)",
              transition: "transform 1.6s cubic-bezier(.2,.8,.2,1)",
            }}
          />
          {/* expanding rings on wake */}
          {phase !== "sleep" && (
            <>
              <span
                className="absolute left-1/2 top-1/2 -ml-[300px] -mt-[300px] h-[600px] w-[600px] rounded-full border border-primary/40"
                style={{
                  animation: "ripple-pulse 3s ease-out forwards",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 -ml-[300px] -mt-[300px] h-[600px] w-[600px] rounded-full border border-primary/30"
                style={{
                  animation: "ripple-pulse 3s ease-out 0.4s forwards",
                }}
              />
            </>
          )}

          <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
            {phase === "sleep" && (
              <>
                <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-muted-foreground/60">
                  Arti · standing by
                </div>
                <div className="text-7xl font-thin tabular-nums text-foreground/40">
                  {timeStr}
                </div>
                <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  Tap anywhere or say "Hi Arti"
                </div>
              </>
            )}

            {phase === "waking" && (
              <div className="text-2xl font-light text-foreground/60 animate-pulse">
                ◌
              </div>
            )}

            {phase === "greeting" && (
              <div className="flex flex-col items-center gap-4 animate-fade-in">
                {/*
                  GreetingVoice mounts ONCE for the greeting phase.
                  It speaks a single short greeting, then calls
                  onGreetingComplete which advances the parent to dashboard.
                  The dashboard then mounts its own VoiceBar fresh.
                */}
                <GreetingVoice
                  staffName={staffName}
                  onGoToDashboard={onGoToDashboard}
                />
                <div className="font-mono text-[11px] uppercase tracking-[0.5em] text-primary">
                  Arti
                </div>
                <h1 className="text-5xl font-extralight tracking-tight text-foreground md:text-7xl">
                  {greeting},
                </h1>
                <h2 className="text-5xl font-light tracking-tight text-primary md:text-7xl">
                  {staffName.split(" ")[0]}.
                </h2>
                <p className="mt-4 max-w-md text-balance text-sm font-light text-muted-foreground">
                  Today's first case begins in 32 minutes. I have your pre-op plan ready.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Corner metadata — preserved during sleep */}
      <div className="pointer-events-none absolute bottom-8 left-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
        OR 326 · sterile field calibrated · 21.4°C
      </div>
      <div className="pointer-events-none absolute bottom-8 right-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
        Arti v2.1 · {phase === "sleep" ? "standing by" : "waking"}
      </div>
    </button>
  );
}
