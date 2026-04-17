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
 *      to navigate the wall (go_home, show_cases, open_case, sleep).
 *
 * The agent's API key never reaches the browser — we mint a short-lived
 * conversation token via a server function.
 */

export interface ArtiVoiceCallbacks {
  onGoHome: () => void;
  onShowCases: () => void;
  onOpenCase: (query: string) => void;
  onSleep: () => void;
  /** Called whenever the user finishes a spoken utterance. */
  onUserTranscript?: (text: string) => void;
  /** Called whenever the agent finishes a spoken response. */
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

export function useArtiVoice(callbacks: ArtiVoiceCallbacks) {
  // Keep callbacks in a ref so the conversation tools always see the latest
  // closures without forcing a session reconnect on every render.
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  }, [callbacks]);

  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
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
    clientTools: {
      go_home: () => {
        cbRef.current.onGoHome();
        return "Navigated home";
      },
      show_cases: () => {
        cbRef.current.onShowCases();
        return "Showing today's cases";
      },
      open_case: (params: { query?: string }) => {
        cbRef.current.onOpenCase(params?.query ?? "");
        return `Opening case: ${params?.query ?? "next"}`;
      },
      sleep: () => {
        cbRef.current.onSleep();
        return "Going to sleep";
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
        const overrides = opts?.firstMessage || opts?.promptAddition
          ? {
              agent: {
                ...(opts.firstMessage ? { firstMessage: opts.firstMessage } : {}),
                ...(opts.promptAddition
                  ? { prompt: { prompt: opts.promptAddition } }
                  : {}),
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
      // Browser doesn't support Web Speech — silently skip.
      return;
    }
    if (recognitionRef.current) return;
    wakeEnabledRef.current = true;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev) => {
      // Scan all results for the wake phrase.
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
      console.warn("[arti-voice] wake recognizer error", ev);
    };
    rec.onend = () => {
      // Browsers stop continuous recognition after silence; restart if we
      // still want to listen.
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

  // Tear down on unmount.
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
    /** 'idle' | 'connecting' | 'connected' | 'error' */
    sessionStatus,
    isConnected,
    isAgentSpeaking,
    wakeListening,
    error,
    startSession,
    endSession,
    startWakeWord,
    stopWakeWord,
    /** True if browser supports Web Speech wake word. */
    wakeWordSupported: typeof window !== "undefined" && getSpeechRecognitionCtor() !== null,
  };
}
