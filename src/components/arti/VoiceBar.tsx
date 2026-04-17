import { Mic, MicOff, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  onCommand: (cmd: string) => void;
}

const SUGGESTED = [
  '"Show me the rotator cuff repair video"',
  '"Start the time-out"',
  '"What is the current sponge count?"',
  '"Page Dr. Patel"',
];

/**
 * Always-listening voice bar. Mic toggle simulates wake-word capture;
 * preset prompts demonstrate intent → action flow without real STT.
 */
export function VoiceBar({ onCommand }: Props) {
  const [listening, setListening] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState(0);

  useEffect(() => {
    if (!listening) return;
    const i = setInterval(() => setHint((h) => (h + 1) % SUGGESTED.length), 4000);
    return () => clearInterval(i);
  }, [listening]);

  const runCommand = (text: string) => {
    setTranscript(text);
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      onCommand(text);
      setTimeout(() => setTranscript(""), 2400);
    }, 1100);
  };

  return (
    <div className="glass relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4">
      {/* listening scan line */}
      {listening && !transcript && (
        <span
          aria-hidden
          className="scan-line pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-transparent via-primary/15 to-transparent"
        />
      )}

      <button
        onClick={() => setListening((l) => !l)}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
          listening
            ? "bg-primary text-primary-foreground glow-primary"
            : "bg-surface-3 text-muted-foreground"
        )}
        aria-label={listening ? "Mute Arti" : "Unmute Arti"}
      >
        {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        {/* waveform */}
        <div className="flex h-8 items-center gap-[3px]" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar"
              style={{
                height: "100%",
                animationDelay: `${i * 0.07}s`,
                animationPlayState: listening && !thinking ? "running" : "paused",
                opacity: listening ? 1 : 0.25,
              }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {thinking ? (
            <div className="flex items-center gap-2 font-mono text-sm text-primary">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Arti is thinking…
            </div>
          ) : transcript ? (
            <div className="truncate text-sm font-light text-foreground">{transcript}</div>
          ) : listening ? (
            <div className="text-sm font-light text-muted-foreground">
              Try saying{" "}
              <span
                key={hint}
                className="text-foreground/80 animate-fade-in"
              >
                {SUGGESTED[hint]}
              </span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground/60">Microphone muted</div>
          )}
        </div>
      </div>

      <div className="hidden gap-2 lg:flex">
        {SUGGESTED.slice(0, 2).map((s) => (
          <button
            key={s}
            onClick={() => runCommand(s.replace(/"/g, ""))}
            className="rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-xs font-light text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
