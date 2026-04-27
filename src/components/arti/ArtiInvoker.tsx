import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArtiVoiceContext } from "@/hooks/ArtiVoiceContext";

interface Props {
  onSubmit: (text: string) => void;
  onWake?: () => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}

export function ArtiInvoker({ onSubmit, onWake, placeholder, suggestions = [], className }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const v = useArtiVoiceContext();
  const vRef = useRef(v);
  vRef.current = v;
  const listening = !!v && v.listening;
  const napping = v?.artiNapping ?? false;

  const resetCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpen(false), 15_000);
  }, []);

  useEffect(() => {
    if (open) resetCloseTimer();
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [open, resetCloseTimer]);

  useEffect(() => {
    if (v?.isSpeaking) resetCloseTimer();
  }, [v?.isSpeaking, resetCloseTimer]);

  // Focus input after panel opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (!open && !isTyping && (e.key === "/" || (e.key === " " && e.shiftKey))) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    resetCloseTimer();
  };

  const unlockAudio = () => {
    const a = new Audio();
    a.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQAEABAAZGF0YQQAAAA=";
    a.play().catch(() => {});
  };

  const toggleListening = () => {
    const voice = vRef.current;
    if (!voice) return;
    unlockAudio();
    if (voice.isSpeaking) { voice.stopSpeaking(); return; }
    if (voice.listening) { voice.stopListening(); } else { voice.startListening(); }
  };

  return (
    // `fixed` so the invoker escapes the screen's stacking context. z-[100]
    // sits above every modal in the app (highest is PersonScheduleModal at
    // z-[81]), which is intentional — Arti must remain reachable while a
    // modal is open so the user can voice/type follow-up commands without
    // dismissing what they're looking at.
    <div className={cn("pointer-events-none fixed bottom-0 right-0 z-[100] p-6", className)}>
      <div className="relative flex items-end justify-end">

        {/* Collapsed orb — fades out when panel opens, dims when napping */}
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            onWake?.();
            if (napping) vRef.current?.wakeArti();
            setOpen(true);
            if (vRef.current && !vRef.current.listening) vRef.current.startListening();
          }}
          aria-label="Talk to Arti"
          style={{
            opacity: open ? 0 : napping ? 0.35 : 1,
            transform: open ? "scale(0.7)" : "scale(1)",
            pointerEvents: open ? "none" : "auto",
            filter: napping ? "grayscale(1)" : undefined,
            transition: open
              ? "opacity 0.18s ease, transform 0.18s ease"
              : "opacity 0.5s ease, filter 0.5s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            background: "linear-gradient(135deg, var(--surface), var(--surface-2))",
          }}
          className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur-xl hover:shadow-[var(--shadow-glow)]"
        >
          {listening && (
            <span className={cn(
              "pointer-events-none absolute inset-0 rounded-full border",
              v?.isSpeaking
                ? "border-primary/70 [animation:ripple-pulse_0.9s_ease-out_infinite]"
                : "border-primary/55 [animation:ripple-pulse_1.6s_ease-out_infinite]",
            )} />
          )}
          <span
            className="absolute inset-1.5 rounded-full"
            style={{ background: "var(--gradient-primary)", opacity: napping ? 0.4 : 0.85 }}
          />
          <Sparkles className="relative h-5 w-5 text-white" strokeWidth={1.8} />
          <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-full border border-border bg-surface/90 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            {napping ? "Arti is napping · tap to wake" : v?.isSpeaking ? "Arti speaking" : listening ? "Listening · tap to pause" : "Tap to wake Arti"}
          </span>
        </button>

        {/* Expanded panel — CSS transition, no GSAP, React state drives everything */}
        <div
          style={{
            width: open ? "min(36rem, calc(100vw - 3rem))" : "3.5rem",
            opacity: open ? 1 : 0,
            overflow: "hidden",
            pointerEvents: open ? "auto" : "none",
            transition: open
              ? "width 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease 0.05s"
              : "width 0.3s cubic-bezier(0.87,0,0.13,1), opacity 0.15s ease",
          }}
          className="absolute bottom-0 right-0 flex max-w-[calc(100vw-3rem)] flex-col items-end gap-3"
        >
          {suggestions.length > 0 && (
            <div
              style={{
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(6px)",
                transition: open ? "opacity 0.3s ease 0.25s, transform 0.3s ease 0.25s" : "none",
              }}
              className="flex flex-wrap items-center justify-center gap-2"
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-border bg-surface-2/70 px-3.5 py-1.5 text-xs font-light text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); submit(value); }}
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(6px)",
              transition: open ? "opacity 0.3s ease 0.3s, transform 0.3s ease 0.3s" : "none",
            }}
            className="group flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-surface/85 px-2 py-2 shadow-[var(--shadow-elevated)] backdrop-blur-xl transition-colors focus-within:border-primary/60"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                listening
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
              aria-label={listening ? "Stop listening" : "Speak to Arti"}
            >
              {listening && (
                <span className="absolute inset-0 rounded-full border border-primary/40 [animation:ripple-pulse_1.4s_ease-out_infinite]" />
              )}
              <Mic className="h-4 w-4" strokeWidth={1.7} />
            </button>

            <input
              ref={inputRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); resetCloseTimer(); }}
              placeholder={listening ? "Listening…" : (placeholder ?? "Ask Arti…")}
              className="min-w-0 flex-1 bg-transparent px-1 text-sm font-light text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>

            <button
              type="submit"
              disabled={!value.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
              aria-label="Send"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
