import { Mic, MicOff, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useArtiVoice } from "./ArtiVoiceProvider";
import { cn } from "@/lib/utils";

/**
 * Presentational voice bar. Reads state from the shared ArtiVoiceProvider —
 * does NOT own a session, never starts a second one. The mic button only
 * stops the existing session (going back to sleep would be the more typical
 * way to end it). It cannot re-start because there's no fresh greeting to
 * speak — that's the wake screen's job.
 */
const SUGGESTED = [
  '"Show me the rotator cuff repair video"',
  '"Check off patient identity in the time-out"',
  '"Add two needles to the count"',
  '"Open quad view"',
  '"Focus alerts"',
];

export function VoiceBar() {
  const { connected, isSpeaking, transcript, stop } = useArtiVoice();
  const [hint, setHint] = useState(0);

  useEffect(() => {
    if (connected) return;
    const i = setInterval(() => setHint((h) => (h + 1) % SUGGESTED.length), 4500);
    return () => clearInterval(i);
  }, [connected]);

  const hasTranscript = connected && transcript.length > 0;
  const isActive = (connected && isSpeaking) || hasTranscript;

  return (
    <div className="glass relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4">
      <button
        onClick={connected ? stop : undefined}
        disabled={!connected}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
          connected
            ? "bg-primary text-primary-foreground glow-primary"
            : "bg-surface-3 text-muted-foreground/60 cursor-default"
        )}
        aria-label={connected ? "Turn Arti off" : "Arti is offline"}
      >
        {connected ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 opacity-70" />}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-8 items-center gap-[3px]" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar"
              style={{
                height: "100%",
                animationDelay: `${i * 0.07}s`,
                animationPlayState: isActive ? "running" : "paused",
                opacity: isActive ? 1 : connected ? 0.35 : 0.2,
              }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {hasTranscript ? (
            <div className="truncate text-sm font-light text-foreground">{transcript}</div>
          ) : isSpeaking ? (
            <div className="flex items-center gap-2 font-mono text-sm text-primary">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Arti is speaking…
            </div>
          ) : connected ? (
            <div className="text-sm font-light text-muted-foreground">Ready when you are.</div>
          ) : (
            <div className="text-sm font-light text-muted-foreground">
              Arti is asleep.{" "}
              <span key={hint} className="text-foreground/70 animate-fade-in">
                {SUGGESTED[hint]}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {connected ? "Live" : "Idle"}
        </span>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            connected
              ? isActive
                ? "bg-success animate-pulse"
                : "bg-success/60"
              : "bg-muted-foreground/40"
          )}
        />
      </div>
    </div>
  );
}
