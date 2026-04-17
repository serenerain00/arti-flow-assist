import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useConversation } from "@elevenlabs/react";
import type { InstrumentId, TimeOutId } from "./AwakeDashboard";
import type { QuadPanelId } from "./QuadView";

/**
 * Single-source-of-truth ElevenLabs session for the entire Arti wall.
 *
 * Why this exists:
 *  Previously we had TWO separate ElevenLabs sessions — one in GreetingVoice
 *  on the wake screen, another in VoiceBar on the dashboard. The greeting
 *  session would still be speaking when the dashboard mounted and started
 *  its own session, causing the greeting to cut off and audio overlap.
 *
 *  ONE session lives here, started when the user first wakes Arti, used
 *  for the greeting AND for the entire dashboard conversation. It is only
 *  ever ended when the user explicitly puts Arti back to sleep.
 *
 *  ElevenLabs is the sole source of audio. We never play any other voice,
 *  never start a second session, never reconnect mid-conversation.
 */

export interface VoiceTools {
  openHowToVideo: (title?: string) => string;
  toggleTimeOutItem: (id: TimeOutId) => string;
  adjustInstrumentCount: (item: InstrumentId, delta: number) => string;
  toggleSterileCockpit: (enabled?: boolean) => string;
  dismissAlert: (index: number) => string;
  openQuadView: () => string;
  focusQuadPanel: (panel: QuadPanelId) => string;
  closeQuadView: () => string;
  showPreferenceCard: () => string;
  showPatientDetails: () => string;
  goToDashboard: () => string;
}

interface ArtiVoiceContextValue {
  /** Has the session been started (greeting kicked off)? */
  started: boolean;
  /** Is the WebSocket currently connected? */
  connected: boolean;
  /** Is Arti speaking right now? */
  isSpeaking: boolean;
  /** Latest transcript line. */
  transcript: string;
  /** Start the session. Called once from the wake screen with the greeting. */
  start: (firstMessage: string) => Promise<void>;
  /** End the session. Called when going back to sleep. */
  stop: () => void;
  /** Push a contextual update to the live agent (no audio response triggered). */
  sendContext: (text: string) => void;
}

const ArtiVoiceContext = createContext<ArtiVoiceContextValue | null>(null);

export function useArtiVoice() {
  const ctx = useContext(ArtiVoiceContext);
  if (!ctx) throw new Error("useArtiVoice must be used inside <ArtiVoiceProvider>");
  return ctx;
}

interface Props {
  children: ReactNode;
  /** Tool implementations the agent can invoke. Updated via ref so we never resubscribe. */
  tools: VoiceTools;
}

export function ArtiVoiceProvider({ children, tools }: Props) {
  const [started, setStarted] = useState(false);
  const [transcript, setTranscript] = useState("");

  // Live ref so tool changes (e.g. when dashboard state updates) don't
  // require restarting the session.
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  const conversation = useConversation({
    onDisconnect: () => {
      setTranscript("");
      setStarted(false);
    },
    onError: (err) => console.warn("[Arti] conversation error", err),
    onMessage: (msg: { source?: string; message?: string }) => {
      if (msg?.message) setTranscript(msg.message);
    },
    clientTools: {
      goToDashboard: () => toolsRef.current.goToDashboard(),
      openHowToVideo: (params: { title?: string }) =>
        toolsRef.current.openHowToVideo(params?.title),
      toggleTimeOutItem: (params: { id: TimeOutId }) =>
        toolsRef.current.toggleTimeOutItem(params.id),
      adjustInstrumentCount: (params: { item: InstrumentId; delta: number }) =>
        toolsRef.current.adjustInstrumentCount(params.item, Number(params.delta) || 0),
      toggleSterileCockpit: (params: { enabled?: boolean }) =>
        toolsRef.current.toggleSterileCockpit(params?.enabled),
      dismissAlert: (params: { index: number }) =>
        toolsRef.current.dismissAlert(Number(params.index) || 0),
      openQuadView: () => toolsRef.current.openQuadView(),
      focusQuadPanel: (params: { panel: QuadPanelId }) =>
        toolsRef.current.focusQuadPanel(params.panel),
      closeQuadView: () => toolsRef.current.closeQuadView(),
      showPreferenceCard: () => toolsRef.current.showPreferenceCard(),
      showPatientDetails: () => toolsRef.current.showPatientDetails(),
    },
  });

  const startingRef = useRef(false);

  const start = useCallback(
    async (firstMessage: string) => {
      // Hard guard against double-start (StrictMode, accidental re-mounts, etc.).
      if (startingRef.current || started || conversation.status === "connected") return;
      startingRef.current = true;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const res = await fetch("/api/elevenlabs/token");
        if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
        const { signedUrl } = (await res.json()) as { signedUrl?: string };
        if (!signedUrl) throw new Error("No signed URL");

        await conversation.startSession({
          signedUrl,
          connectionType: "websocket",
          overrides: {
            agent: { firstMessage },
            tts: { voiceId: "6sFKzaJr574YWVu4UuJF" },
          },
        });
        setStarted(true);
      } catch (err) {
        console.warn("[Arti] failed to start session", err);
        startingRef.current = false;
      }
    },
    [conversation, started]
  );

  const stop = useCallback(() => {
    try {
      conversation.endSession();
    } catch {
      // no-op
    }
    setStarted(false);
    startingRef.current = false;
  }, [conversation]);

  const sendContext = useCallback(
    (text: string) => {
      if (conversation.status !== "connected") return;
      try {
        conversation.sendContextualUpdate(text);
      } catch (err) {
        console.warn("[Arti] sendContextualUpdate failed", err);
      }
    },
    [conversation]
  );

  // Cleanup on full unmount only.
  useEffect(() => {
    return () => {
      try {
        conversation.endSession();
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: ArtiVoiceContextValue = {
    started,
    connected: conversation.status === "connected",
    isSpeaking: conversation.isSpeaking,
    transcript,
    start,
    stop,
    sendContext,
  };

  return <ArtiVoiceContext.Provider value={value}>{children}</ArtiVoiceContext.Provider>;
}
