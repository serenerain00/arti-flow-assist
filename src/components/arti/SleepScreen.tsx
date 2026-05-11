import { useEffect, useMemo, useState } from "react";
import { Moon, Clock4 } from "lucide-react";
import { RippleCanvas } from "./RippleCanvas";
import { ArtiInvoker } from "./ArtiInvoker";
import { TODAY_CASES, type CaseItem } from "./cases";

function getGreeting(d?: Date | null) {
  if (!d) return "Hello";
  const h = d.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface Props {
  phase: "sleep" | "waking" | "greeting";
  staffName: string;
  onWakeRequested: () => void;
  onWakeAnimationComplete: () => void;
  /** Free-form prompt submitted from the greeting screen. */
  onPrompt: (text: string) => void;
}

/**
 * Ambient sleep state. Phase comes from the parent route so transitions
 * are explicit and one-directional.
 *
 * Phases:
 *   sleep     — gentle ripples, faint wordmark, time.
 *   waking    — ripple expands; after 1.1s parent advances to greeting.
 *   greeting  — personalized greeting card. Tap to enter the dashboard.
 *               (Voice was removed — to be rebuilt from scratch.)
 */
export function SleepScreen({
  phase,
  staffName,
  onWakeRequested,
  onWakeAnimationComplete,
  onPrompt,
}: Props) {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    // Tick every second so the ambient sleep clock + relative countdown
    // refresh smoothly. The waking/greeting branches don't need this fast
    // a clock but the cost is negligible.
    const i = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (phase !== "waking") return;
    const t = setTimeout(onWakeAnimationComplete, 1100);
    return () => clearTimeout(t);
  }, [phase, onWakeAnimationComplete]);

  const greeting = getGreeting(time ?? undefined);
  const timeStr = time ? time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

  // Live countdown to the next case so the greeting tagline reads
  // accurately. Picks the case with status="next"; falls back to the
  // first case on today's board. If we can't compute a sensible delta
  // (no upcoming case, or the time is in the past), we drop the line.
  const upcomingTagline = useMemo(() => {
    if (!time) return null;
    const next = TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0];
    if (!next) return null;
    const [h, m] = next.time.split(":").map((n) => Number(n));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const target = new Date(time);
    target.setHours(h, m, 0, 0);
    const diffMin = Math.round((target.getTime() - time.getTime()) / 60_000);
    if (diffMin <= 0) {
      return `Today's first case is about to begin. What can I get you?`;
    }
    if (diffMin >= 90) {
      const hours = Math.round(diffMin / 60);
      return `Today's first case begins in about ${hours} hour${hours === 1 ? "" : "s"}. What can I get you?`;
    }
    return `Today's first case begins in ${diffMin} minute${diffMin === 1 ? "" : "s"}. What can I get you?`;
  }, [time]);

  // Next-case card data for the ambient sleep view.
  const nextCase = useMemo<CaseItem | undefined>(
    () =>
      TODAY_CASES.find((c) => c.status === "next") ??
      TODAY_CASES.find((c) => c.status !== "completed" && c.status !== "cancelled"),
    [],
  );
  const nextCountdown = useMemo(() => {
    if (!time || !nextCase) return null;
    const [h, m] = nextCase.time.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const target = new Date(time);
    target.setHours(h, m, 0, 0);
    const diffMin = Math.round((target.getTime() - time.getTime()) / 60_000);
    if (diffMin === 0) return "now";
    if (diffMin > 0) {
      if (diffMin < 60) return `in ${diffMin} min`;
      const hr = Math.floor(diffMin / 60);
      const rem = diffMin % 60;
      return rem === 0 ? `in ${hr}h` : `in ${hr}h ${rem}m`;
    }
    return `${-diffMin} min ago`;
  }, [time, nextCase]);
  const clockBig = time ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const dateLong = time
    ? time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "";

  // Ambient sleep — single calm screen shown on first load. Matches the
  // Ambient Recovery between-cases look so the OR has one consistent
  // "wall is resting" visual language. Wake by tapping the orb or speaking.
  if (phase === "sleep") {
    return (
      <div
        className="fixed inset-0 z-50 block h-full w-full overflow-hidden bg-[#070b14] text-foreground"
        aria-label="Arti standing by"
      >
        {/* Low-contrast ambient gradient field */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-indigo-500/[0.08] blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-[44rem] w-[44rem] rounded-full bg-sky-400/[0.08] blur-3xl" />
          <div className="absolute left-1/3 top-1/4 h-[26rem] w-[26rem] rounded-full bg-violet-500/[0.05] blur-3xl" />
        </div>

        <div className="relative z-10 flex h-full flex-col px-12 py-10">
          {/* Header chip */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-200">
              <Moon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-indigo-200/80">
              Arti · standing by · OR 326
            </div>
          </div>

          {/* Center column */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
              {dateLong}
            </div>
            <div className="mt-3 text-[9rem] font-extralight leading-none tracking-tight text-foreground/90 tabular-nums">
              {clockBig}
            </div>
            <div className="mt-10 text-lg font-light text-foreground/70">
              {upcomingTagline ?? "Tap the sparkle to begin speaking to Arti."}
            </div>
          </div>

          {/* Bottom rail — next case (no patient data) */}
          {nextCase ? (
            <div className="rounded-3xl border border-white/5 bg-white/[0.015] px-7 py-5 backdrop-blur-sm">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Next case
              </div>
              <div className="mt-2 flex items-end gap-8">
                <div>
                  <div className="text-3xl font-extralight tracking-tight">
                    {nextCase.procedureShort}
                    {nextCase.side ? (
                      <span className="ml-2 text-base text-muted-foreground">
                        · {nextCase.side}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm font-light text-foreground/60">
                    {nextCase.surgeon}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Scheduled
                  </div>
                  <div className="mt-1 text-2xl font-extralight tracking-tight tabular-nums">
                    {nextCase.time}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                    Countdown
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xl font-light text-indigo-200">
                    <Clock4 className="h-4 w-4" strokeWidth={1.7} />
                    {nextCountdown ?? "—"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <ArtiInvoker onSubmit={onPrompt} />
      </div>
    );
  }

  // Waking + greeting still use the original orb / ripple ceremony.
  return (
    <div
      className="group fixed inset-0 z-50 block h-full w-full overflow-hidden bg-background text-left"
      aria-label={phase === "greeting" ? "Talk to Arti" : "Wake Arti"}
    >
      <div className="pointer-events-none absolute inset-0">
        <RippleCanvas intensity={2.2} />
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative flex flex-col items-center">
          <div
            className="ripple-core"
            style={{
              transform: "scale(2.2)",
              transition: "transform 1.6s cubic-bezier(.2,.8,.2,1)",
            }}
          />
          <span
            className="absolute left-1/2 top-1/2 -ml-[300px] -mt-[300px] h-[600px] w-[600px] rounded-full border border-primary/40"
            style={{ animation: "ripple-pulse 3s ease-out forwards" }}
          />
          <span
            className="absolute left-1/2 top-1/2 -ml-[300px] -mt-[300px] h-[600px] w-[600px] rounded-full border border-primary/30"
            style={{ animation: "ripple-pulse 3s ease-out 0.4s forwards" }}
          />

          <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
            {phase === "waking" && (
              <div className="text-2xl font-light text-foreground/60 animate-pulse">◌</div>
            )}

            {phase === "greeting" && (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="animate-greet font-mono text-[11px] uppercase tracking-[0.5em] text-primary"
                  style={{ animationDelay: "0.05s" }}
                >
                  Arti
                </div>

                <h1
                  className="animate-greet text-5xl font-extralight tracking-tight text-foreground md:text-7xl"
                  style={{ animationDelay: "0.2s" }}
                >
                  {greeting},
                </h1>

                <h2
                  className="animate-greet text-5xl font-light tracking-tight text-primary md:text-7xl"
                  style={{ animationDelay: "0.38s" }}
                >
                  {staffName.split(" ")[0]}.
                </h2>

                <p
                  className="animate-greet mt-4 max-w-md text-balance text-sm font-light text-muted-foreground"
                  style={{ animationDelay: "0.58s" }}
                >
                  {upcomingTagline ?? "What can I get you?"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {phase === "greeting" && (
        <ArtiInvoker
          placeholder="Ask Arti anything…"
          onSubmit={onPrompt}
          suggestions={["Show me the case list", "Open the next case", "What's my day look like?"]}
          className="bottom-12"
        />
      )}

      <div className="pointer-events-none absolute bottom-4 left-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
        OR 326 · sterile field calibrated · 21.4°C
      </div>
      <div className="pointer-events-none absolute bottom-4 right-8 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
        Arti v2.1 · waking
      </div>
    </div>
  );
}
