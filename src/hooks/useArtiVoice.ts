import { useCallback, useEffect, useRef, useState } from "react";
import { processVoiceCommand, type ArtiToolCall } from "@/server/arti";
import { speakText } from "@/server/elevenlabs";

export type ArtiToolResult =
  | { ok: true; state?: Record<string, unknown> }
  | { ok: false; reason: string };

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";
export type QuadPanelId = "timeout" | "instruments" | "alerts" | "team";
export type ActiveRole = "nurse" | "scrub" | "surgeon" | "anesthesia";

export interface ArtiVoiceCallbacks {
  onWake?: () => void;
  onGoHome: () => void;
  onShowCases: () => void;
  onOpenCase: (query: string) => void;
  onSleep: () => void;
  onToggleTimeOutItem?: (id: TimeOutId) => ArtiToolResult;
  onAdjustInstrumentCount?: (item: InstrumentId, delta: number) => ArtiToolResult;
  onToggleSterileCockpit?: (enabled?: boolean) => ArtiToolResult;
  onDismissAlert?: (index: number) => ArtiToolResult;
  onOpenQuadView?: () => ArtiToolResult;
  onFocusQuadPanel?: (panel: QuadPanelId) => ArtiToolResult;
  onCloseQuadView?: () => ArtiToolResult;
  onOpenHowToVideo?: (title?: string) => ArtiToolResult;
  onShowPreferenceCard?: () => ArtiToolResult;
  onShowPreferenceCardLayoutImages?: () => ArtiToolResult;
  onSwitchRole?: (role: ActiveRole) => ArtiToolResult;
  onOpenPatientDetails?: () => ArtiToolResult;
  onClosePatientDetails?: () => ArtiToolResult;
  onToggleOpeningChecklistItem?: (index: number) => ArtiToolResult;
  onOpenTableLayoutImages?: () => ArtiToolResult;
  onLightboxNext?: () => ArtiToolResult;
  onLightboxPrev?: () => ArtiToolResult;
  onCloseLightbox?: () => ArtiToolResult;
  onScroll?: (direction: string, speed: string, continuous: boolean) => ArtiToolResult;
  onStopScroll?: () => ArtiToolResult;
  onUserTranscript?: (text: string) => void;
  onAgentResponse?: (text: string) => void;
  /** Returns a plain-text snapshot of live UI state for Claude's context window. */
  getContext?: () => string;
}

type SpeechRecognitionResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function executeToolCall(call: ArtiToolCall, cb: ArtiVoiceCallbacks): void {
  const inp = call.input;
  switch (call.name) {
    case "wake":                       cb.onWake?.(); break;
    case "navigate_home":              cb.onGoHome(); break;
    case "navigate_cases":             cb.onShowCases(); break;
    case "open_case":                  cb.onOpenCase(String(inp.query ?? "")); break;
    case "sleep":                      cb.onSleep(); break;
    case "toggle_timeout_item":        cb.onToggleTimeOutItem?.(inp.id as TimeOutId); break;
    case "adjust_instrument_count":    cb.onAdjustInstrumentCount?.(inp.item as InstrumentId, Number(inp.delta)); break;
    case "toggle_sterile_cockpit":     cb.onToggleSterileCockpit?.(inp.enabled == null ? undefined : Boolean(inp.enabled)); break;
    case "dismiss_alert":              cb.onDismissAlert?.(Number(inp.index)); break;
    case "open_quad_view":             cb.onOpenQuadView?.(); break;
    case "focus_quad_panel":           cb.onFocusQuadPanel?.(inp.panel as QuadPanelId); break;
    case "close_quad_view":            cb.onCloseQuadView?.(); break;
    case "open_how_to_video":          cb.onOpenHowToVideo?.(inp.title != null ? String(inp.title) : undefined); break;
    case "show_preference_card":       cb.onShowPreferenceCard?.(); break;
    case "show_preference_card_layout_images": cb.onShowPreferenceCardLayoutImages?.(); break;
    case "switch_role":                cb.onSwitchRole?.(inp.role as ActiveRole); break;
    case "open_patient_details":       cb.onOpenPatientDetails?.(); break;
    case "close_patient_details":      cb.onClosePatientDetails?.(); break;
    case "toggle_opening_checklist_item": cb.onToggleOpeningChecklistItem?.(Number(inp.index)); break;
    case "open_table_layout_images":   cb.onOpenTableLayoutImages?.(); break;
    case "lightbox_next":              cb.onLightboxNext?.(); break;
    case "lightbox_prev":              cb.onLightboxPrev?.(); break;
    case "close_lightbox":             cb.onCloseLightbox?.(); break;
    case "scroll":                     cb.onScroll?.(String(inp.direction ?? "down"), String(inp.speed ?? "normal"), Boolean(inp.continuous ?? false)); break;
    case "stop_scroll":                cb.onStopScroll?.(); break;
  }
}

export function useArtiVoice(callbacks: ArtiVoiceCallbacks) {
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  }, [callbacks]);

  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionActiveRef = useRef(false);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  // Ref to the active Audio element so stopSpeaking() can cut TTS mid-sentence.
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  // Stored resolve for the current speak() Promise — lets stopSpeaking() settle
  // it immediately so processingRef is always released even on interrupt.
  const speakResolveRef = useRef<(() => void) | null>(null);
  // Rolling conversation history — last 8 messages (4 pairs) sent to Claude.
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  // Blocks voice input briefly after TTS ends to prevent capturing reverb/echo.
  const postSpeechCooldownRef = useRef(false);

  // Safely restart recognition after TTS — clears dead ref instead of silent swallow.
  const restartRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // rec is unrecoverable — clear it so startListening creates a fresh instance.
      recognitionRef.current = null;
      setListening(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = "";
      activeAudioRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    postSpeechCooldownRef.current = false;
    // Settle the pending speak() Promise so the finally{} in handleTranscript
    // always runs and processingRef is released even when interrupted.
    if (speakResolveRef.current) {
      speakResolveRef.current();
      speakResolveRef.current = null;
    }
    restartRecognition();
  }, [restartRecognition]);

  const speak = useCallback(async (text: string) => {
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    // Stop the recognizer before TTS so restartRecognition() after playback
    // sees it in a known-stopped state. Without this, continuous recognition
    // keeps running through TTS and rec.start() below throws "already started",
    // which the catch used to treat as fatal — orphaning the live rec and
    // leaving the mic unrecoverable after the first response.
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    try {
      const { audioBase64 } = await speakText({ data: { text } });
      await new Promise<void>((resolve, reject) => {
        speakResolveRef.current = resolve;
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        activeAudioRef.current = audio;
        const cleanup = () => {
          speakResolveRef.current = null;
          if (activeAudioRef.current === audio) activeAudioRef.current = null;
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        };
        audio.onended = () => {
          cleanup();
          postSpeechCooldownRef.current = true;
          setTimeout(() => { postSpeechCooldownRef.current = false; }, 500);
          restartRecognition();
          resolve();
        };
        audio.onerror = () => {
          cleanup();
          restartRecognition();
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch(reject);
      });
    } catch (err) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      activeAudioRef.current = null;
      speakResolveRef.current = null;
      // We aborted the rec before TTS — if TTS fails, restart it so the
      // mic doesn't stay dead on the next utterance.
      restartRecognition();
      console.error("[arti-voice] TTS error", err);
    }
  }, [restartRecognition]);

  // voiceInput=true  → must contain wake word OR be within the 10s follow-up window.
  // voiceInput=false → typed text; always processed (no wake word required).
  const handleTranscript = useCallback(
    async (transcript: string, voiceInput = false) => {
      if (voiceInput) {
        // Block while Arti's TTS is playing — mic picks up speaker output.
        if (isSpeakingRef.current) {
          console.log("[arti-voice] ignored (Arti speaking):", transcript);
          return;
        }
        if (postSpeechCooldownRef.current) {
          console.log("[arti-voice] ignored (post-speech cooldown):", transcript);
          return;
        }
        const hasWakeWord = /\b(?:art|ard)(?:i[ey]?|y)\b/i.test(transcript);
        if (!hasWakeWord && !sessionActiveRef.current) {
          console.log("[arti-voice] ignored (no wake word):", transcript);
          return;
        }
      }
      if (processingRef.current) {
        console.log("[arti-voice] ignored (busy):", transcript);
        return;
      }
      processingRef.current = true;

      try {
        cbRef.current.onUserTranscript?.(transcript);

        const context = cbRef.current.getContext?.() ?? "";
        let response = "";
        let toolCalls: ArtiToolCall[] = [];

        try {
          const result = await processVoiceCommand({
            data: { transcript, context, history: historyRef.current },
          });
          response = result.response;
          toolCalls = result.toolCalls;
          console.log("[arti-voice] tools:", toolCalls.map(t => t.name), "response:", response);
        } catch (err) {
          console.error("[arti-voice] Claude error", err);
          response = "I don't have that.";
        }

        for (const call of toolCalls) {
          console.log("[arti-voice] executing tool:", call.name);
          executeToolCall(call, cbRef.current);
        }

        if (response) {
          cbRef.current.onAgentResponse?.(response);
          historyRef.current = [
            ...historyRef.current,
            { role: "user" as const, content: transcript },
            { role: "assistant" as const, content: response },
          ].slice(-8);
          await speak(response);
        }

        const isSleep = toolCalls.some(t => t.name === "sleep");
        if (!isSleep && (response || toolCalls.length > 0)) {
          sessionActiveRef.current = true;
          if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
          sessionTimerRef.current = setTimeout(() => { sessionActiveRef.current = false; }, 30_000);
        }

        if (isSleep) {
          recognitionRef.current?.abort();
          recognitionRef.current = null;
          setListening(false);
          sessionActiveRef.current = false;
          historyRef.current = [];
          if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
        }
      } finally {
        // Always release the lock — prevents permanent "busy" state if a
        // network hang or unhandled error stops execution before completion.
        processingRef.current = false;
      }
    },
    [speak],
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    // Chrome sometimes splits one phrase into multiple final segments
    // (e.g. "Arti open" + "Marcus Chen's case"). Buffer them within a
    // short window so Claude always receives the complete phrase.
    let finalBuffer = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushBuffer = () => {
      flushTimer = null;
      const transcript = finalBuffer.trim();
      finalBuffer = "";
      if (transcript) {
        console.log("[arti-voice] heard:", transcript);
        void handleTranscript(transcript, true);
      }
    };

    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        finalBuffer += " " + ev.results[i][0].transcript;
      }
      if (finalBuffer.trim()) {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flushBuffer, 250);
      }
    };

    rec.onerror = (ev) => {
      const code = ev?.error ?? "unknown";
      if (code === "not-allowed" || code === "audio-capture") {
        // Fatal — mic permission denied, stop entirely.
        setError("Microphone access denied.");
        recognitionRef.current = null;
        setListening(false);
        return;
      }
      // Transient errors (aborted, network, no-speech, etc.) — leave
      // recognitionRef set so the onend handler restarts automatically.
    };

    rec.onend = () => {
      if (!recognitionRef.current) {
        setListening(false);
        return;
      }
      // If TTS is playing, Chrome can't restart the mic yet.
      // speak() will restart recognition once audio finishes.
      if (isSpeakingRef.current) return;
      try {
        rec.start();
      } catch {
        // rec entered a broken/unrecoverable state — clear the dead reference
        // so the next startListening() call creates a fresh instance instead
        // of seeing a non-null ref and returning early.
        recognitionRef.current = null;
        setListening(false);
      }
    };

    try {
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err) {
      recognitionRef.current = null;
      console.warn("[arti-voice] could not start recognizer", err);
    }
  }, [handleTranscript]);

  const startListeningWrapped = useCallback(() => {
    // Belt-and-suspenders: if a prior Claude call hung and left processingRef
    // locked, reset it when the user explicitly opens a new session.
    processingRef.current = false;
    // Only refresh the session window when one was already open — don't create
    // a session from nothing. Cold orb taps still require the wake word so
    // ambient speech on the sleep/greeting screen never fires unintended commands.
    if (sessionActiveRef.current) {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => { sessionActiveRef.current = false; }, 30_000);
    }
    startListening();
  }, [startListening]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  // Explicitly open a session window so the wake word isn't required for the
  // next 30 s. Used when navigating to an active screen without a voice command.
  const activateSession = useCallback(() => {
    sessionActiveRef.current = true;
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => { sessionActiveRef.current = false; }, 180_000);
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    listening,
    isSpeaking,
    error,
    speak,
    stopSpeaking,
    sendCommand: handleTranscript,
    startListening: startListeningWrapped,
    stopListening,
    activateSession,
    wakeWordSupported: typeof window !== "undefined" && getSpeechRecognitionCtor() !== null,
  };
}
