import { useCallback, useEffect, useRef, useState } from "react";

// Minimal type surface for the browser SpeechRecognition API — TS lib doesn't
// ship these by default. Mirrors the parts we touch (continuous mode, results
// stream, lifecycle handlers).
interface SpeechRecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

const WAKE_PATTERN = /\bhey\s+arti\b/i;
const ACTIVE_WINDOW_MS = 5000;

interface UseWakeWordOpts {
  /** When false, the hook does not start listening. Use to gate by edit/preview mode. */
  enabled: boolean;
  /** Called when the wake word is detected (or activateManually is called). */
  onActivate?: () => void;
  /** Called when the 5-second window expires with no further speech. */
  onDeactivate?: () => void;
}

interface UseWakeWordReturn {
  /** True while Arti is currently in the listening window. */
  active: boolean;
  /** True if the browser supports SpeechRecognition at all. */
  supported: boolean;
  /** Forces Arti into the listening window (for the mic button). */
  activateManually: () => void;
  /** Ends the listening window immediately (mic-to-deactivate). */
  deactivate: () => void;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useWakeWord({
  enabled,
  onActivate,
  onDeactivate,
}: UseWakeWordOpts): UseWakeWordReturn {
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stoppingRef = useRef(false);
  const deactivateTimerRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const armDeactivateTimer = useCallback(() => {
    if (deactivateTimerRef.current !== null) {
      window.clearTimeout(deactivateTimerRef.current);
    }
    deactivateTimerRef.current = window.setTimeout(() => {
      setActive(false);
      onDeactivate?.();
    }, ACTIVE_WINDOW_MS);
  }, [onDeactivate]);

  const activate = useCallback(() => {
    setActive((prev) => {
      if (!prev) onActivate?.();
      return true;
    });
    armDeactivateTimer();
  }, [onActivate, armDeactivateTimer]);

  // Mic button entry point — same effect as a wake word, but bypasses STT.
  const activateManually = useCallback(() => {
    activate();
  }, [activate]);

  // Allow a click to end the listening window early (mic toggle off).
  const deactivate = useCallback(() => {
    if (deactivateTimerRef.current !== null) {
      window.clearTimeout(deactivateTimerRef.current);
      deactivateTimerRef.current = null;
    }
    setActive((prev) => {
      if (prev) onDeactivate?.();
      return false;
    });
  }, [onDeactivate]);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    setSupported(!!Ctor);
    if (!Ctor || !enabled) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let combined = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        combined += `${r[0].transcript} `;
      }
      if (WAKE_PATTERN.test(combined)) {
        activate();
      } else if (activeRef.current) {
        // Any new speech inside the active window — re-arm the timer.
        armDeactivateTimer();
      }
    };

    recognition.onerror = (e) => {
      // 'no-speech' and 'aborted' are routine — silence is normal. Surface
      // permission failures to console so the user knows why nothing happens.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        console.warn(`[wake-word] mic permission denied: ${e.error}`);
      }
    };

    recognition.onend = () => {
      // Browser auto-stops recognition periodically; reboot it unless we're
      // intentionally tearing down.
      if (!stoppingRef.current && recognitionRef.current) {
        try {
          recognition.start();
        } catch {
          // start() throws if already running — safe to swallow.
        }
      }
    };

    try {
      recognition.start();
    } catch {
      // ignore — usually already-running
    }

    return () => {
      stoppingRef.current = true;
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognitionRef.current = null;
      stoppingRef.current = false;
      if (deactivateTimerRef.current !== null) {
        window.clearTimeout(deactivateTimerRef.current);
        deactivateTimerRef.current = null;
      }
    };
  }, [enabled, activate, armDeactivateTimer]);

  return { active, supported, activateManually, deactivate };
}
