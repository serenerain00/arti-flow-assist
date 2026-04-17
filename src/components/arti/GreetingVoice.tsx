import { useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";

interface Props {
  staffName: string;
  /**
   * Fires exactly once after Arti finishes speaking the greeting,
   * or after a hard safety timeout if the agent never responds.
   * The parent is responsible for not re-triggering this component.
   */
  onGreetingComplete: () => void;
}

/**
 * Headless one-shot greeting. No UI of its own.
 *
 * Guarantees:
 *  - startSession is called at most once per mount (startedRef guard)
 *  - onGreetingComplete fires at most once (completedRef guard)
 *  - never auto-reconnects on disconnect or error — single-shot only
 *  - on unmount, the session is ended cleanly
 *
 * The parent (route-level state machine) is the only thing that
 * decides when this component mounts/unmounts, which prevents
 * greeting loops on re-renders, modal opens, or reconnects.
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
    onCompleteRef.current();
  }, []);

  const conversation = useConversation({
    onError: (err) => {
      console.warn("[Arti greeting] error — completing", err);
      complete();
    },
    onDisconnect: () => {
      // If we disconnect before ever speaking, just move on — never retry.
      if (!hasSpokenRef.current) complete();
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

      await conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        overrides: {
          agent: {
            // Short, one-line, no follow-up question — Arti must not
            // keep talking after this. The agent prompt should be
            // configured to stay silent until spoken to.
            firstMessage: `Good morning, ${staffName.split(" ")[0]}.`,
          },
          tts: { voiceId: "6sFKzaJr574YWVu4UuJF" },
        },
      });
    } catch (err) {
      console.warn("[Arti greeting] failed to start — completing", err);
      complete();
    }
  }, [conversation, staffName, complete]);

  // Watch isSpeaking: once Arti has spoken and then stops, signal complete.
  // A small tail delay prevents clipping the last syllable on unmount.
  useEffect(() => {
    if (conversation.isSpeaking) {
      hasSpokenRef.current = true;
      return;
    }
    if (hasSpokenRef.current) {
      const t = setTimeout(complete, 450);
      return () => clearTimeout(t);
    }
  }, [conversation.isSpeaking, complete]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();

    // Hard safety net — if connection or speech never happens, advance anyway.
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
