import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowUp, Mic, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (text: string) => void;
  placeholder?: string;
  suggestions?: string[];
  /**
   * Optional positioning className. Defaults to a centered floating
   * footer position.
   */
  className?: string;
}

/**
 * Arti's Siri-style invoker. Collapsed state is a small orb in the corner.
 * Clicking it (or pressing "/" or the spacebar while not focused on an input)
 * fluidly expands into a full prompt bar with mic + text input + send.
 *
 * Why a separate component (instead of just hiding/showing PromptBar):
 *   1. The orb is the resting affordance — Arti is "available" but not
 *      consuming visual attention.
 *   2. Open/close needs an actual morph (orb → pill), which is easier with
 *      GSAP's timeline than CSS classes alternating.
 *   3. Voice + keyboard inputs are mutually exclusive UX-wise; this is the
 *      single surface that hosts both.
 */
export function ArtiInvoker({ onSubmit, placeholder, suggestions = [], className }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);

  const orbRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  /* ---------------- keyboard shortcut: "/" to invoke ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable;
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

  /* ---------------- open / close animation ----------------
   * We morph the orb into the panel: orb fades + scales out as the panel
   * scales up from the same anchor with a spring-feeling ease. On close
   * we reverse the timeline.
   */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const orb = orbRef.current;
    if (!panel || !orb) return;

    // Build (or rebuild) the timeline each time `open` flips.
    tlRef.current?.kill();

    if (open) {
      // Initial state — collapsed pill, transparent
      gsap.set(panel, {
        opacity: 0,
        y: 24,
        scale: 0.6,
        transformOrigin: "bottom right",
        pointerEvents: "auto",
      });
      gsap.set(orb, { opacity: 1, scale: 1 });

      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.to(orb, { opacity: 0, scale: 0.6, duration: 0.25, ease: "power2.in" }, 0)
        .to(panel, { opacity: 1, duration: 0.35 }, 0.05)
        .to(panel, { y: 0, scale: 1, duration: 0.85 }, 0.05)
        .from(
          panel.querySelectorAll<HTMLElement>("[data-stagger]"),
          { y: 12, opacity: 0, duration: 0.5, stagger: 0.05, ease: "power3.out" },
          0.2,
        );
      tlRef.current = tl;

      // Focus input after the panel is mostly in place
      const focusT = setTimeout(() => inputRef.current?.focus(), 220);
      return () => clearTimeout(focusT);
    } else {
      gsap.set(orb, { pointerEvents: "auto" });
      const tl = gsap.timeline({ defaults: { ease: "power3.inOut" } });
      tl.to(panel, { opacity: 0, y: 16, scale: 0.7, duration: 0.3 }, 0)
        .set(panel, { pointerEvents: "none" })
        .to(orb, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.6)" }, 0.1);
      tlRef.current = tl;
    }
  }, [open]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
    setOpen(false);
  };

  const toggleListening = () => {
    setListening((v) => !v);
    // Demo behavior — real Web Speech wiring can replace this later.
    if (!listening) {
      setTimeout(() => setListening(false), 2400);
    }
  };

  return (
    <div className={cn("pointer-events-none absolute bottom-0 right-0 z-40 p-6", className)}>
      <div className="relative flex items-end justify-end">
        {/* Collapsed orb */}
        <button
          ref={orbRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Talk to Arti"
          className="pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/80 backdrop-blur-xl transition-shadow hover:shadow-[var(--shadow-glow)]"
          style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-2))" }}
        >
          {/* Pulse ring */}
          <span className="pointer-events-none absolute inset-0 rounded-full border border-primary/30 [animation:ripple-pulse_3s_ease-out_infinite]" />
          {/* Inner orb */}
          <span
            className="absolute inset-1.5 rounded-full"
            style={{ background: "var(--gradient-primary)", opacity: 0.85 }}
          />
          <Sparkles className="relative h-5 w-5 text-white" strokeWidth={1.8} />
          {/* Hint */}
          <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-full border border-border bg-surface/90 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
            Ask Arti · /
          </span>
        </button>

        {/* Expanded panel — absolutely positioned over the orb so the morph
            scales in place. Anchored to bottom-right, expands leftward. */}
        <div
          ref={panelRef}
          className="pointer-events-none absolute bottom-0 right-0 flex w-[min(36rem,calc(100vw-3rem))] flex-col items-end gap-3"
          style={{ opacity: 0 }}
        >
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2" data-stagger>
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
            data-stagger
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
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
              onChange={(e) => setValue(e.target.value)}
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
