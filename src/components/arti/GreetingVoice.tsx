import { useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";

interface Props {
  staffName: string;
  /** Fires once Arti has finished speaking the greeting (or on hard timeout). */
  onGreetingComplete?: () => void;
}

/**
 * Headless component that connects to ElevenLabs and lets Arti speak the
 * greeting on the wake/greeting screen — no UI of its own.
 *
 * Calls onGreetingComplete after Arti finishes speaking (detected via
 * isSpeaking transitioning true -> false), so the parent can transition
 * to the dashboard without cutting the audio off mid-sentence.
 *
 * A safety timeout fires onGreetingComplete after 12s in case the agent
 * never connects or never speaks.
 */
export function GreetingVoice({ staffName, onGreetingComplete }: Props) {
  const startedRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onGreetingComplete);
  onCompleteRef.current = onGreetingComplete;

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.();
  }, []);

  const conversation = useConversation({
    onError: (err) => {
      console.warn("[Arti greeting] error", err);
      complete();
    },
  });

  const start = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch("/api/elevenlabs/token");
      if (!res.ok) {
        complete();
        return;
      }
      const { signedUrl } = (await res.json()) as { signedUrl?: string };
      if (!signedUrl) {
        complete();
        return;
      }

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
      complete();
    }
  }, [conversation, staffName, complete]);

  // Watch isSpeaking: once Arti has spoken and then stops, signal complete.
  useEffect(() => {
    if (conversation.isSpeaking) {
      hasSpokenRef.current = true;
    } else if (hasSpokenRef.current) {
      // Small delay so the tail of the audio isn't clipped on unmount.
      const t = setTimeout(complete, 400);
      return () => clearTimeout(t);
    }
  }, [conversation.isSpeaking, complete]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();

    // Hard safety net — if nothing happens in 12s, move on anyway.
    const safety = setTimeout(complete, 12000);

    return () => {
      clearTimeout(safety);
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
