import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArtiVoiceContext } from "@/hooks/ArtiVoiceContext";
import { JOURNEY } from "./journey/script";
import { StageVisual } from "./journey/StageVisual";
import { ArtiInvoker } from "./ArtiInvoker";

interface Props {
  /** Set by the route when voice tools fire. Drives the state machine. */
  paused: boolean;
  onPausedChange: (v: boolean) => void;
  /** External voice "next" / "previous" — bumps stage by ±1. */
  externalStageDelta: number;
  /** Reset to 0 when a new journey starts. */
  startKey: number;
  /**
   * Pre-fetched stage-0 narration audio. The route kicks off the
   * ElevenLabs request the moment start_journey fires; by the time the
   * screen mounts the network roundtrip is mostly done, so we play the
   * primer directly instead of issuing a fresh fetch — saves ~400-500 ms
   * before the first audible word.
   */
  primer: Promise<{ audioBase64: string }> | null;
  /** Free-text prompt handler — wired into the floating ArtiInvoker so
   * the user can voice / type commands during the journey. */
  onPrompt: (text: string) => void;
  /** Called when the user says "exit" or the journey ends naturally. */
  onExit: () => void;
}

/**
 * Cinematic walkthrough of how Arti was built. Auto-plays a 7-stage
 * narrated journey with GSAP-choreographed visuals per stage. Designed
 * to be triggered by voice ("show me how this was created") and
 * controllable by voice ("pause" / "resume" / "next" / "exit") — but
 * also has on-screen taps for manual control.
 *
 * Architecture notes:
 *   • Stage advances are driven by the v.speak() promise resolving.
 *     When narration ends, we bump stage by 1. After the last stage,
 *     we wait 3 s then fire onExit.
 *   • Pause cancels the in-flight advance via a ref-tracked promise
 *     ID — when the promise resolves but the ID has been invalidated,
 *     the resolution callback bails out instead of advancing.
 *   • Resume replays the current stage's narration from the start
 *     (we don't track sub-second progress — replaying a 5-7 s chunk
 *     is acceptable UX).
 *   • External stage deltas (voice "next" / "previous") are applied
 *     as a single bump and reset to 0 by the parent.
 */
export function JourneyScreen({
  paused,
  onPausedChange,
  externalStageDelta,
  startKey,
  primer,
  onPrompt,
  onExit,
}: Props) {
  const v = useArtiVoiceContext();
  // Hold v in a ref so effects can call v.speak() / v.stopSpeaking()
  // WITHOUT re-running every time the parent re-renders. The voice hook
  // returns a fresh object each render — putting `v` in an effect's deps
  // causes the effect cleanup to fire on every parent render, which in
  // turn would kill in-flight TTS audio (bug fix: silent journey screen).
  const vRef = useRef(v);
  vRef.current = v;
  const [stage, setStage] = useState(0);
  // Token refs invalidate in-flight speak promises when stage / paused
  // changes mid-narration.
  const tokenRef = useRef(0);
  const lastDeltaRef = useRef(0);
  // Track which stage the primer was consumed for — only stage 0 of the
  // current journey instance uses it; subsequent stages do a normal
  // v.speak(). startKey changing means a new journey starts, so primer
  // is fresh again.
  const primerConsumedForKeyRef = useRef<number>(-1);
  // Dedup guard: the (startKey, stage) pair for which speak() has
  // already been initiated. Prevents repeat TTS calls when the parent
  // re-renders and inadvertently re-runs our narration effect (or when
  // React strict mode invokes effects twice in dev). Without this, we
  // get layered audio streams as each effect run kicks off its own
  // ElevenLabs fetch that lands at slightly different times.
  const startedRef = useRef<{ key: number; stage: number } | null>(null);
  // Ref to the current stage's progress-bar fill <span>, used by the
  // animation-frame loop below to drive scaleX directly without React
  // re-renders. Re-attaches on each stage change because the rendered
  // tree assigns this ref only to the active stage's bar.
  const currentBarRef = useRef<HTMLSpanElement | null>(null);

  // External voice nav (next / previous): apply delta exactly once.
  useEffect(() => {
    if (externalStageDelta === lastDeltaRef.current) return;
    const diff = externalStageDelta - lastDeltaRef.current;
    lastDeltaRef.current = externalStageDelta;
    setStage((s) => Math.max(0, Math.min(JOURNEY.length - 1, s + diff)));
  }, [externalStageDelta]);

  // Reset to stage 0 when a fresh journey starts. The narration effect's
  // own `++tokenRef` on its next run handles invalidation of any in-flight
  // .then() from the previous journey instance — bumping here too would
  // double-bump under React 19 strict-mode mount-cleanup-mount, leaving
  // myToken behind and bailing the auto-advance for stage 0.
  useEffect(() => {
    setStage(0);
  }, [startKey]);

  // ── Mic + state management for the journey ─────────────────────────────
  //
  // CRITICAL: this effect is declared BEFORE the narration effect so it
  // runs first on every (re)render. We need to:
  //   (a) clear the dedup signature on resume, BEFORE narration's bail
  //       check would otherwise short-circuit replay of the current stage;
  //   (b) put the recognizer in the right state BEFORE narration calls
  //       voice.stopSpeaking() — which would otherwise call
  //       restartRecognition() against a still-live rec.
  //
  // Why mic OFF during narration: Arti's own narration plays through the
  // speakers, gets captured by the mic, and SpeechRecognition transcribes
  // it. When the audio ends (isSpeakingRef → false), the buffered transcript
  // flushes to handleTranscript, Claude treats it as a user prompt, and
  // Arti starts a conversational response that hijacks the journey audio
  // channel. The screenshot showed this exact loop. stopListening() nulls
  // recognitionRef so every restartRecognition() during the journey is a
  // no-op.
  //
  // Why mic ON during pause: lets the user voice "resume", "next",
  // "previous", "exit". The wake-word session is still active from the
  // start_journey command.
  const wasPausedRef = useRef(paused);
  const prevStartKeyRef = useRef(startKey);
  useEffect(() => {
    const resumed = wasPausedRef.current && !paused;
    const newKey = prevStartKeyRef.current !== startKey;
    if (resumed || newKey) startedRef.current = null;
    wasPausedRef.current = paused;
    prevStartKeyRef.current = startKey;

    if (paused) {
      tokenRef.current += 1;
      vRef.current?.stopSpeaking();
      vRef.current?.startListening();
    } else {
      vRef.current?.stopListening();
    }
  }, [paused, startKey]);

  // Narration loop. Speaks the current stage. When speak() resolves
  // naturally (audio onended), bump to next stage. When pause / external
  // nav invalidates the token, bail.
  //
  // The `started` ref guards against React strict-mode double-invoke in
  // dev: the effect runs → cleanup → effect again. Without the guard,
  // both runs fire v.speak() and we get two TTS streams playing on top
  // of each other. With it, only the FIRST run for a given (stage, paused)
  // pair fires speak; the second run sees started=true and bails.
  // playAudio also has its own cancel-prev-audio guard for back-to-back
  // stage transitions; this is just an additional layer.
  useEffect(() => {
    if (paused) return;
    const text = JOURNEY[stage]?.narration ?? "";
    if (!text) return;

    // Skip if speak() has already been initiated for this exact
    // (startKey, stage) pair. Catches strict-mode double-invoke AND
    // any redundant re-runs that the dep list might cause.
    const already =
      startedRef.current &&
      startedRef.current.key === startKey &&
      startedRef.current.stage === stage;
    if (already) return;
    startedRef.current = { key: startKey, stage };

    const myToken = ++tokenRef.current;
    const voice = vRef.current;
    if (!voice) return;

    voice.stopSpeaking();
    // Pre-emptively kill the mic for the upcoming fetch + playback. Without
    // this, the previous stage's audio.onended just restarted the recognizer
    // and we sit with a live mic for the ~300–500 ms ElevenLabs round-trip
    // — long enough for lingering speaker reverb of the prior stage to be
    // transcribed and self-trigger journey_pause / journey_next, etc.
    voice.prepareToSpeak();

    // Stage 0: use the route's pre-fetched audio if available. If the
    // primer rejects (network blip, ElevenLabs hiccup, env var missing)
    // we fall back to a fresh v.speak() so the user STILL hears
    // narration. Without this catch, primer rejections vanish into an
    // unhandled-promise warning and the journey screen sits silent.
    const useprimer = stage === 0 && primer && primerConsumedForKeyRef.current !== startKey;
    const playPromise: Promise<void> = useprimer
      ? (async () => {
          primerConsumedForKeyRef.current = startKey;
          try {
            const { audioBase64 } = await primer!;
            await vRef.current!.playAudio(audioBase64);
          } catch {
            await vRef.current!.speak(text);
          }
        })()
      : vRef.current!.speak(text);

    void playPromise.then(() => {
      if (myToken !== tokenRef.current) return;
      if (stage < JOURNEY.length - 1) {
        setStage((s) => s + 1);
      } else {
        setTimeout(() => {
          if (myToken === tokenRef.current) onExit();
        }, 3000);
      }
    });

    // NOTE: deliberately NO cleanup-time tokenRef bump here. React 19
    // strict-mode in dev runs every effect twice on mount: run → cleanup
    // → run. A cleanup bump means the .then() that fires when stage 0's
    // audio finishes sees myToken (1) ≠ tokenRef (2) and bails — so
    // setStage(1) never fires and the journey hangs after the first
    // narration. Stage transitions are already invalidated by the next
    // run's `++tokenRef.current`; pause and unmount handle invalidation
    // explicitly in their own effects below.
    //
    // NOTE: `v` and `onExit` intentionally excluded from deps. We read v
    // through vRef so we don't re-run on parent re-renders, which would
    // kill in-flight audio. onExit is captured by closure; if the route
    // ever swapped it mid-journey, the stale closure is harmless (it
    // just navigates back to sleep).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused, primer, startKey]);

  // Stop speaking on real unmount only. Reading v through vRef means this
  // cleanup does NOT fire when the parent re-renders (which would kill the
  // audio mid-stage). DO NOT bump tokenRef here — React 19 strict-mode
  // dev runs this cleanup once between mount-cycle effect passes, and an
  // extra bump there pushes tokenRef past the narration's myToken so the
  // first stage's auto-advance bails. Worst-case on real unmount the
  // resolving audio promise fires setStage on an unmounted component and
  // logs a React warning — acceptable; not a real bug.
  useEffect(() => {
    return () => {
      vRef.current?.stopSpeaking();
    };
  }, []);

  // Drive the current stage's progress bar from the active TTS audio's
  // playback position. Uses rAF + ref-direct DOM writes so the 30+ Hz
  // updates don't trigger React re-renders. Re-runs only when stage
  // changes (new ref to drive) or paused toggles (skip ticks while paused
  // to leave the bar frozen at its last position).
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    const tick = () => {
      const el = currentBarRef.current;
      if (el) {
        const p = vRef.current?.getAudioProgress?.() ?? 0;
        el.style.transform = `scaleX(${p})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, paused]);

  const current = JOURNEY[stage];
  const progress = ((stage + 1) / JOURNEY.length) * 100;

  const handleNext = () => {
    if (stage < JOURNEY.length - 1) setStage(stage + 1);
    else onExit();
  };
  const handlePrev = () => {
    if (stage > 0) setStage(stage - 1);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Ambient backdrop glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[10%] bottom-[15%] h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute left-[10%] top-[20%] h-[300px] w-[300px] rounded-full bg-cyan-400/8 blur-3xl" />
      </div>

      {/* Top bar — progress + dots */}
      <header className="absolute left-0 right-0 top-0 z-10 px-10 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            How Arti was built
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-surface-2/40 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/50 hover:text-foreground"
            aria-label="Exit journey"
          >
            <X className="h-3 w-3" />
            Exit
          </button>
        </div>

        {/* Progress bars — past stages render full, the current stage fills
            in real-time from the active TTS audio's playback position
            (see audio-progress rAF effect below), future stages stay empty. */}
        <div className="mt-5 flex items-center gap-2">
          {JOURNEY.map((s, i) => {
            const isPast = i < stage;
            const isCurrent = i === stage;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(i)}
                className={cn(
                  "relative h-1.5 flex-1 overflow-hidden rounded-full",
                  isPast || isCurrent ? "bg-primary/15" : "bg-foreground/15 hover:bg-foreground/25",
                )}
                aria-label={`Stage ${i + 1}: ${s.title}`}
              >
                <span
                  ref={isCurrent ? currentBarRef : null}
                  className={cn(
                    "absolute inset-0 origin-left rounded-full bg-primary",
                    !isCurrent && "transition-transform duration-300 ease-out",
                  )}
                  style={{
                    transform: `scaleX(${isPast ? 1 : isCurrent ? 0 : 0})`,
                  }}
                />
              </button>
            );
          })}
        </div>
        {/* Sub-progress within current stage */}
        <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
          Stage {stage + 1} of {JOURNEY.length} · {Math.round(progress)}%
        </div>
      </header>

      {/* Stage visual */}
      <main className="relative h-full w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
            transition={{ type: "tween", duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <StageVisual stage={current} active={!paused} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom control bar */}
      <footer className="absolute left-0 right-0 bottom-0 z-10 flex flex-col items-center px-10 py-8">
        <div className="flex items-center gap-3 rounded-full border border-border/60 bg-surface-2/60 px-3 py-2 backdrop-blur-md">
          <button
            type="button"
            onClick={handlePrev}
            disabled={stage === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-30"
            aria-label="Previous stage"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onPausedChange(!paused)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary transition-transform hover:scale-105"
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="ml-0.5 h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label="Next stage"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Voice <span className="text-primary">›</span> "pause" · "resume" · "next" · "previous" ·
          "exit"
        </div>
      </footer>

      {/* Floating sparkle orb / chat input — kept on the journey screen so
          the user has the same voice + text affordance as everywhere else
          in the app, plus a visual reminder that Arti is listening. */}
      <ArtiInvoker
        placeholder="Ask Arti anything…"
        onSubmit={onPrompt}
        suggestions={["Pause", "Next stage", "Exit journey"]}
      />
    </div>
  );
}
