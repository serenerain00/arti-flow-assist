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
 * Headless greeting + listening session on the wake screen.
 *
 * Behavior:
 *  - Speaks "Good morning, {first name}." once on mount.
 *  - Then stays connected and silent, listening for the user to say
 *    something like "show me the dashboard" — at which point the
 *    `goToDashboard` client tool fires and the parent transitions.
 *  - Never auto-transitions. Never re-greets. No reconnect loops.
 *
 * The agent prompt should be configured to call `goToDashboard` when
 * the user asks to proceed/open the dashboard, and otherwise stay quiet.
 */
export function GreetingVoice({ staffName, greeting, onGoToDashboard }: Props) {
  const startedRef = useRef(false);
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
            firstMessage: `${greeting}, ${firstName}. I'm here whenever you're ready. Just say "show me the dashboard" to begin.`,
          },
          tts: { voiceId: "6sFKzaJr574YWVu4UuJF" },
        },
      });
    } catch (err) {
      console.warn("[Arti greeting] failed to start", err);
    }
  }, [conversation, firstName, greeting]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
    return () => {
      try {
        conversation.endSession();
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
