import { useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";

interface Props {
  staffName: string;
  /** Time-of-day greeting, e.g. "Good morning". Must match on-screen text. */
  greeting: string;
  /**
   * Fires when the user explicitly asks to go to the dashboard
   * (e.g. "show me the dashboard", "open the dashboard", "let's go").
   * Triggered via the `goToDashboard` client tool.
   */
  onGoToDashboard: () => void;
}

/**
 * Module-level guard. React StrictMode (and any incidental parent re-render
 * that remounts this component) would otherwise cause us to:
 *   1. open a second WebSocket to ElevenLabs (we saw this in network logs)
 *   2. call endSession() on the FIRST one during cleanup, killing the live
 *      audio mid-sentence and dropping the client-tool listener
 *
 * By holding the "we already started" flag outside React's lifecycle, the
 * second mount becomes a no-op and the original session keeps streaming.
 */
let sessionStarted = false;

/**
 * Headless greeting + listening session on the wake screen.
 *
 * Behavior:
 *  - Speaks the greeting once on first mount.
 *  - Stays connected and listens for "show me the dashboard" — at which
 *    point the `goToDashboard` client tool fires and the parent transitions.
 *  - Never auto-transitions. Never re-greets. No reconnect loops.
 *  - We intentionally do NOT call endSession() on unmount, because StrictMode
 *    unmounts immediately after first mount in development. The session ends
 *    naturally when the user navigates to the dashboard (parent unmounts the
 *    whole sleep tree) or closes the tab.
 */
export function GreetingVoice({ staffName, greeting, onGoToDashboard }: Props) {
  const onGoRef = useRef(onGoToDashboard);
  onGoRef.current = onGoToDashboard;

  const conversation = useConversation({
    onError: (err) => console.warn("[Arti greeting] error", err),
    clientTools: {
      goToDashboard: () => {
        onGoRef.current();
        return "Opening the dashboard.";
      },
    },
  });

  const firstName = staffName.split(" ")[0];

  const start = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/token");
      if (!res.ok) return;
      const { signedUrl } = (await res.json()) as { signedUrl?: string };
      if (!signedUrl) return;

      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        overrides: {
          agent: {
            firstMessage: `${greeting}, ${firstName}. Today's first case begins in 32 minutes, and I have your pre-op plan ready — just say "show me the dashboard" whenever you'd like to begin.`,
          },
          tts: { voiceId: "6sFKzaJr574YWVu4UuJF" },
        },
      });
    } catch (err) {
      console.warn("[Arti greeting] failed to start", err);
      // Allow a retry on next mount if startup itself failed.
      sessionStarted = false;
    }
  }, [conversation, firstName, greeting]);

  useEffect(() => {
    if (sessionStarted) return;
    sessionStarted = true;
    start();
    // No cleanup: see module-level comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
