import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";

interface Props {
  staffName: string;
}

/**
 * Headless component that connects to ElevenLabs and lets Arti speak the
 * greeting on the wake/greeting screen — no UI of its own. The session
 * ends when this component unmounts (i.e. when we transition to the
 * dashboard, where a fresh VoiceBar takes over).
 *
 * Note: a quick reconnect on dashboard mount is intentional — gives the
 * user a clean handoff and avoids juggling shared session state.
 */
export function GreetingVoice({ staffName }: Props) {
  const startedRef = useRef(false);
  const [, setStarted] = useState(false);

  const conversation = useConversation({
    onError: (err) => console.warn("[Arti greeting] error", err),
  });

  const start = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/token");
      if (!res.ok) return;
      const { signedUrl } = (await res.json()) as { signedUrl?: string };
      if (!signedUrl) return;

      conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        overrides: {
          agent: {
            firstMessage: `Good morning, ${staffName.split(" ")[0]}.`,
          },
          tts: { voiceId: "6sFKzaJr574YWVu4UuJF" },
        },
      });
    } catch (err) {
      console.warn("[Arti greeting] failed to start", err);
    }
  }, [conversation, staffName]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
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
