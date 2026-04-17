import { Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { InstrumentId, TimeOutId } from "./AwakeDashboard";

interface VoiceTools {
  openHowToVideo: (title?: string) => string;
  toggleTimeOutItem: (id: TimeOutId) => string;
  adjustInstrumentCount: (item: InstrumentId, delta: number) => string;
  toggleSterileCockpit: (enabled?: boolean) => string;
  dismissAlert: (index: number) => string;
}

interface Props {
  staffName: string;
  tools: VoiceTools;
}

const SUGGESTED = [
  '"Show me the rotator cuff repair video"',
  '"Check off patient identity in the time-out"',
  '"Add two needles to the count"',
  '"Sterile cockpit on"',
];

/**
 * Live voice bar powered by ElevenLabs Conversational AI (WebRTC).
 * Token is fetched server-side from /api/elevenlabs/token to keep the API key secret.
 * Client tools mutate dashboard state on agent request.
 */
export function VoiceBar({ staffName, tools }: Props) {
  const [hint, setHint] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const toolsRef = useRef(tools);
  toolsRef.current = tools;

  const conversation = useConversation({
    onConnect: () => toast.success("Arti is listening"),
    onDisconnect: () => setTranscript(""),
    onError: (err) => {
      console.error("[Arti] conversation error", err);
      toast.error("Voice connection error");
    },
    onMessage: (msg: { source?: string; message?: string }) => {
      // Surface latest user transcript / agent message
      if (msg?.message) setTranscript(msg.message);
    },
    clientTools: {
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
    },
  });

  const isConnected = conversation.status === "connected";
  const isThinking = isConnected && !conversation.isSpeaking && !transcript;

  useEffect(() => {
    if (isConnected) return;
    const i = setInterval(() => setHint((h) => (h + 1) % SUGGESTED.length), 4000);
    return () => clearInterval(i);
  }, [isConnected]);

  const start = useCallback(async () => {
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch("/api/elevenlabs/token");
      if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
      const { signedUrl, error } = (await res.json()) as {
        signedUrl?: string;
        error?: string;
      };
      if (!signedUrl) throw new Error(error ?? "No signed URL received");

      // Note: startSession returns void; the SDK transitions `status` to
      // "connected" asynchronously. Errors arrive via the onError callback.
      conversation.startSession({
        signedUrl,
        connectionType: "websocket",
        overrides: {
          agent: {
            firstMessage: `Good morning, ${staffName.split(" ")[0]}. I'm here whenever you need me.`,
          },
          tts: {
            voiceId: "6sFKzaJr574YWVu4UuJF",
          },
        },
      });
    } catch (err) {
      console.error("[Arti] failed to start session", err);
      toast.error(
        err instanceof Error ? err.message : "Could not start voice session"
      );
      setConnecting(false);
    }
  }, [conversation, staffName]);

  // Once the SDK reports connected, clear the connecting state.
  useEffect(() => {
    if (conversation.status === "connected") setConnecting(false);
  }, [conversation.status]);

  const stop = useCallback(() => {
    conversation.endSession();
  }, [conversation]);

  return (
    <div className="glass relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-4">
      {isConnected && !transcript && !conversation.isSpeaking && (
        <span
          aria-hidden
          className="scan-line pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-transparent via-primary/15 to-transparent"
        />
      )}

      <button
        onClick={isConnected ? stop : start}
        disabled={connecting}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
          isConnected
            ? "bg-primary text-primary-foreground glow-primary"
            : "bg-surface-3 text-muted-foreground hover:bg-surface-3/80",
          connecting && "opacity-60"
        )}
        aria-label={isConnected ? "End conversation with Arti" : "Wake Arti"}
      >
        {connecting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isConnected ? (
          <Mic className="h-5 w-5" />
        ) : (
          <MicOff className="h-5 w-5 opacity-70" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-8 items-center gap-[3px]" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar"
              style={{
                height: "100%",
                animationDelay: `${i * 0.07}s`,
                animationPlayState:
                  isConnected && conversation.isSpeaking ? "running" : "paused",
                opacity: isConnected ? 1 : 0.25,
              }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {isThinking ? (
            <div className="flex items-center gap-2 font-mono text-sm text-primary">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Arti is listening…
            </div>
          ) : transcript ? (
            <div className="truncate text-sm font-light text-foreground">{transcript}</div>
          ) : isConnected ? (
            <div className="text-sm font-light text-muted-foreground">
              {conversation.isSpeaking ? "Arti is speaking…" : "Listening…"}
            </div>
          ) : (
            <div className="text-sm font-light text-muted-foreground">
              Tap the mic to wake Arti.{" "}
              <span key={hint} className="text-foreground/70 animate-fade-in">
                {SUGGESTED[hint]}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-2 lg:flex">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {isConnected ? "Live" : "Idle"}
        </span>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isConnected ? "bg-success animate-pulse" : "bg-muted-foreground/40"
          )}
        />
      </div>
    </div>
  );
}
