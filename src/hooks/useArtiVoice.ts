import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { getElevenLabsConversationToken } from "@/server/elevenlabs";

/**
 * Voice control for Arti.
 *
 * Two layers:
 *   1. A lightweight always-on Web Speech recognizer that ONLY listens for
 *      a wake phrase ("hey arti", "hi arti", "okay arti"). No audio leaves
 *      the device until the wake phrase fires. This keeps cost + latency
 *      low — full conversational agents are too expensive to leave
 *      streaming continuously.
 *   2. An ElevenLabs Conversational AI session (WebRTC) that opens after
 *      wake or when the user taps the mic. The agent can call client tools
 *      to drive the wall.
 *
 * The agent's API key never reaches the browser — we mint a short-lived
 * conversation token via a server function.
 *
 * Client tool names here MUST match the tool IDs configured on the
 * ElevenLabs agent. They follow the camelCase naming in the Arti system
 * prompt so the LLM's tool calls route 1:1.
 */

/** Result shape every tool callback returns. */
export type ArtiToolResult =
  | { ok: true; state?: Record<string, unknown> }
  /**
   * Action couldn't be performed — agent should fall back to
   * "I don't have that." per the Arti system prompt. `reason` is advisory
   * (e.g., "not on preop screen", "critical alert", "unknown panel").
   */
  | { ok: false; reason: string };

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";
export type QuadPanelId = "timeout" | "instruments" | "alerts" | "team";

export interface ArtiVoiceCallbacks {
  // ---- Navigation / phase ----
  onGoHome: () => void;
  onShowCases: () => void;
  onOpenCase: (query: string) => void;
  onSleep: () => void;

  // ---- Dashboard tools (only valid while on the preop dashboard) ----
  /** Toggle a time-out checklist item. */
  onToggleTimeOutItem?: (id: TimeOutId) => ArtiToolResult;
  /** Adjust an instrument count by `delta` (positive = add). */
  onAdjustInstrumentCount?: (item: InstrumentId, delta: number) => ArtiToolResult;
  /** Toggle sterile cockpit mode. `enabled` explicit override when given. */
  onToggleSterileCockpit?: (enabled?: boolean) => ArtiToolResult;
  /** Dismiss a non-critical alert by index. Critical alerts are refused. */
  onDismissAlert?: (index: number) => ArtiToolResult;
  onOpenQuadView?: () => ArtiToolResult;
  onFocusQuadPanel?: (panel: QuadPanelId) => ArtiToolResult;
  onCloseQuadView?: () => ArtiToolResult;
  onOpenHowToVideo?: (title?: string) => ArtiToolResult;
  onShowPreferenceCard?: () => ArtiToolResult;
  onShowPreferenceCardLayoutImages?: () => ArtiToolResult;

  // ---- Observability (optional) ----
  onUserTranscript?: (text: string) => void;
  onAgentResponse?: (text: string) => void;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string; message?: string }) => void) | null;
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

const WAKE_PATTERN = /\b(hey|hi|hello|okay|ok)[\s,]+arti\b/i;

/** Default failure when a dashboard tool is called while not on preop. */
const NOT_AVAILABLE: ArtiToolResult = { ok: false, reason: "not available in current view" };

/** Serialize a tool result for the ElevenLabs SDK (string-return contract). */
function serialize(r: ArtiToolResult): string {
  return JSON.stringify(r);
}

/**
 * Narrow unknown tool args into strings/numbers safely. ElevenLabs passes
 * args as loosely-typed objects; we defensively coerce rather than trust.
 */
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

export function useArtiVoice(callbacks: ArtiVoiceCallbacks) {
  // Keep callbacks in a ref so the conversation tools always see the latest
  // closures without forcing a session reconnect on every render.
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  }, [callbacks]);

  const [sessionStatus, setSessionStatus] = useState<"idle" | "connecting" | "connected" | "error">(
    "idle",
  );
  const [wakeListening, setWakeListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setSessionStatus("connected"),
    onDisconnect: () => setSessionStatus("idle"),
    onError: (err: unknown) => {
      console.error("[arti-voice] conversation error", err);
      setError(err instanceof Error ? err.message : "Voice session error");
      setSessionStatus("error");
    },
    onMessage: (msg: unknown) => {
      const m = msg as {
        type?: string;
        message?: string;
        source?: string;
        user_transcription_event?: { user_transcript?: string };
        agent_response_event?: { agent_response?: string };
      };
      if (m.type === "user_transcript" && m.user_transcription_event?.user_transcript) {
        cbRef.current.onUserTranscript?.(m.user_transcription_event.user_transcript);
      } else if (m.type === "agent_response" && m.agent_response_event?.agent_response) {
        cbRef.current.onAgentResponse?.(m.agent_response_event.agent_response);
      } else if (m.source === "user" && m.message) {
        cbRef.current.onUserTranscript?.(m.message);
      } else if (m.source === "ai" && m.message) {
        cbRef.current.onAgentResponse?.(m.message);
      }
    },
    // Tool handlers are intentionally terse — the agent's system prompt
    // caps responses at one short sentence, and verbose tool returns just
    // bloat the LLM context. Returns are JSON-stringified ArtiToolResults
    // (ok flag + optional reason) so the SDK's string-return contract is
    // satisfied while the agent still gets structured context.
    clientTools: {
      // ---- Navigation ----
      goHome: () => {
        cbRef.current.onGoHome();
        return serialize({ ok: true });
      },
      showCases: () => {
        cbRef.current.onShowCases();
        return serialize({ ok: true });
      },
      openCase: (params: Record<string, unknown>) => {
        cbRef.current.onOpenCase(asString(params?.query) ?? "");
        return serialize({ ok: true });
      },
      sleep: () => {
        cbRef.current.onSleep();
        return serialize({ ok: true });
      },

      // ---- Dashboard ----
      toggleTimeOutItem: (params: Record<string, unknown>) => {
        const id = asString(params?.id) as TimeOutId | undefined;
        if (!id || !["patient", "site", "procedure", "allergies"].includes(id)) {
          return serialize({ ok: false, reason: "unknown checklist item" });
        }
        return serialize(cbRef.current.onToggleTimeOutItem?.(id) ?? NOT_AVAILABLE);
      },
      adjustInstrumentCount: (params: Record<string, unknown>) => {
        const item = asString(params?.item) as InstrumentId | undefined;
        const delta = asNumber(params?.delta);
        if (!item || !["raytec", "lap", "needle", "blade", "clamps"].includes(item)) {
          return serialize({ ok: false, reason: "unknown instrument" });
        }
        if (delta === undefined || delta === 0) {
          return serialize({ ok: false, reason: "delta required" });
        }
        return serialize(cbRef.current.onAdjustInstrumentCount?.(item, delta) ?? NOT_AVAILABLE);
      },
      toggleSterileCockpit: (params: Record<string, unknown>) => {
        const enabled = asBool(params?.enabled);
        return serialize(cbRef.current.onToggleSterileCockpit?.(enabled) ?? NOT_AVAILABLE);
      },
      dismissAlert: (params: Record<string, unknown>) => {
        const index = asNumber(params?.index);
        if (index === undefined || index < 0) {
          return serialize({ ok: false, reason: "index required" });
        }
        return serialize(cbRef.current.onDismissAlert?.(index) ?? NOT_AVAILABLE);
      },
      openQuadView: () => {
        return serialize(cbRef.current.onOpenQuadView?.() ?? NOT_AVAILABLE);
      },
      focusQuadPanel: (params: Record<string, unknown>) => {
        const panel = asString(params?.panel) as QuadPanelId | undefined;
        if (!panel || !["timeout", "instruments", "alerts", "team"].includes(panel)) {
          return serialize({ ok: false, reason: "unknown panel" });
        }
        return serialize(cbRef.current.onFocusQuadPanel?.(panel) ?? NOT_AVAILABLE);
      },
      closeQuadView: () => {
        return serialize(cbRef.current.onCloseQuadView?.() ?? NOT_AVAILABLE);
      },
      openHowToVideo: (params: Record<string, unknown>) => {
        const title = asString(params?.title);
        return serialize(cbRef.current.onOpenHowToVideo?.(title) ?? NOT_AVAILABLE);
      },
      showPreferenceCard: () => {
        return serialize(cbRef.current.onShowPreferenceCard?.() ?? NOT_AVAILABLE);
      },
      showPreferenceCardLayoutImages: () => {
        return serialize(cbRef.current.onShowPreferenceCardLayoutImages?.() ?? NOT_AVAILABLE);
      },
    },
  });

  /* ------------------------- conversation control ------------------------- */

  const startSession = useCallback(
    async (opts?: { firstMessage?: string; promptAddition?: string }) => {
      if (sessionStatus === "connecting" || sessionStatus === "connected") return;
      setError(null);
      setSessionStatus("connecting");
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const { token } = await getElevenLabsConversationToken();
        // Overrides let us personalize Arti's greeting per session. The
        // matching toggles ("First message" + "System prompt") MUST be
        // enabled in the ElevenLabs agent's Security tab for these to
        // take effect — otherwise the SDK silently ignores them.
        const overrides =
          opts?.firstMessage || opts?.promptAddition
            ? {
                agent: {
                  ...(opts.firstMessage ? { firstMessage: opts.firstMessage } : {}),
                  ...(opts.promptAddition ? { prompt: { prompt: opts.promptAddition } } : {}),
                },
              }
            : undefined;
        await conversation.startSession({
          conversationToken: token,
          connectionType: "webrtc",
          ...(overrides ? { overrides } : {}),
        });
      } catch (err) {
        console.error("[arti-voice] failed to start session", err);
        setError(err instanceof Error ? err.message : "Could not start voice session");
        setSessionStatus("error");
      }
    },
    [conversation, sessionStatus],
  );

  const endSession = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("[arti-voice] error ending session", err);
    }
    setSessionStatus("idle");
  }, [conversation]);

  /* ----------------------------- wake word -------------------------------- */

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeEnabledRef = useRef(false);

  const stopWakeWord = useCallback(() => {
    wakeEnabledRef.current = false;
    setWakeListening(false);
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, []);

  const startWakeWord = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      return;
    }
    if (recognitionRef.current) return;
    wakeEnabledRef.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev) => {
      let heard = "";
      for (let i = 0; i < ev.results.length; i++) {
        const alt = ev.results[i][0];
        if (alt?.transcript) heard += " " + alt.transcript;
      }
      if (WAKE_PATTERN.test(heard)) {
        // Stop the local recognizer (it conflicts with the WebRTC mic
        // capture used by ElevenLabs) and hand off to the agent.
        stopWakeWord();
        void startSession();
      }
    };
    rec.onerror = (ev) => {
      const code = ev?.error ?? "unknown";
      // Fatal errors that mean we should stop trying — most importantly
      // "not-allowed" (mic permission denied) and "service-not-allowed".
      // Without this guard, onend kept restarting the recognizer in a
      // tight loop and prevented the WebRTC session from ever grabbing
      // the mic.
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        console.warn("[arti-voice] wake recognizer disabled:", code);
        wakeEnabledRef.current = false;
        setWakeListening(false);
        return;
      }
      if (code !== "no-speech" && code !== "aborted") {
        console.warn("[arti-voice] wake recognizer error:", code);
      }
    };
    rec.onend = () => {
      if (wakeEnabledRef.current) {
        try {
          rec.start();
        } catch {
          /* already started — ignore */
        }
      } else {
        setWakeListening(false);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setWakeListening(true);
    } catch (err) {
      console.warn("[arti-voice] could not start wake recognizer", err);
    }
  }, [startSession, stopWakeWord]);

  useEffect(() => {
    return () => {
      stopWakeWord();
      try {
        const p = conversation.endSession() as unknown;
        if (p && typeof (p as Promise<unknown>).then === "function") {
          (p as Promise<unknown>).catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAgentSpeaking = conversation.isSpeaking ?? false;
  const isConnected = sessionStatus === "connected";

  return {
    sessionStatus,
    isConnected,
    isAgentSpeaking,
    wakeListening,
    error,
    startSession,
    endSession,
    startWakeWord,
    stopWakeWord,
    wakeWordSupported: typeof window !== "undefined" && getSpeechRecognitionCtor() !== null,
  };
}
