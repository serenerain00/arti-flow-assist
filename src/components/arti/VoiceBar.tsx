import { Mic, MicOff, Sparkles, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { InstrumentId, TimeOutId } from "./AwakeDashboard";
import type { QuadPanelId } from "./QuadView";

interface VoiceTools {
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
}

interface Props {
  staffName: string;
  tools: VoiceTools;
  /** Auto-start session on mount (e.g. straight from sleep wake) */
  autoStart?: boolean;
  /** Initial context fed to Arti once connected (case info, etc.) */
  initialContext?: string;
  /** Live context that re-fires sendContextualUpdate when it changes */
  liveContext?: string;
}

const SUGGESTED = [
  '"Show me the rotator cuff repair video"',
  '"Check off patient identity in the time-out"',
  '"Add two needles to the count"',
  '"Open quad view"',
  '"Focus alerts"',
];

/**
 * Live voice bar powered by ElevenLabs Conversational AI (WebSocket).
 * Token is fetched server-side from /api/elevenlabs/token to keep the API key secret.
 * Client tools mutate dashboard state on agent request.
 */
export function VoiceBar({
  staffName,
  tools,
  autoStart = false,
  initialContext,
  liveContext,
}: Props) {
  const [hint, setHint] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  const autoStartedRef = useRef(false);
  const initialContextSentRef = useRef(false);
  // Tracks whether the user has explicitly turned Arti off via the mic button.
  // Only an explicit stop should keep Arti silent — every other disconnect
  // (network blip, tab visibility, agent timeout) auto-reconnects.
  const userStoppedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const conversation = useConversation({
    onConnect: () => {
      setConnecting(false);
      toast.success("Arti is listening");
    },
    onDisconnect: () => {
      setTranscript("");
      initialContextSentRef.current = false;
      // If the user didn't intentionally stop, try to come back online.
      if (!userStoppedRef.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!userStoppedRef.current) startRef.current();
        }, 800);
      }
    },
    onError: (err) => {
      console.error("[Arti] conversation error", err);
      // Don't toast on every transient error — only surface if user is offline-ish.
      // Reconnect logic in onDisconnect will handle recovery.
    },
    onMessage: (msg: { source?: string; message?: string }) => {
      if (msg?.message) setTranscript(msg.message);
    },
    clientTools: {
      openHowToVideo: (params: { title?: string }) => {
        console.log("[Arti tool] openHowToVideo", params);
        return toolsRef.current.openHowToVideo(params?.title);
      },
      toggleTimeOutItem: (params: { id: TimeOutId }) => {
        console.log("[Arti tool] toggleTimeOutItem", params);
        return toolsRef.current.toggleTimeOutItem(params.id);
      },
      adjustInstrumentCount: (params: { item: InstrumentId; delta: number }) => {
        console.log("[Arti tool] adjustInstrumentCount", params);
        return toolsRef.current.adjustInstrumentCount(params.item, Number(params.delta) || 0);
      },
      toggleSterileCockpit: (params: { enabled?: boolean }) => {
        console.log("[Arti tool] toggleSterileCockpit", params);
        return toolsRef.current.toggleSterileCockpit(params?.enabled);
      },
      dismissAlert: (params: { index: number }) => {
        console.log("[Arti tool] dismissAlert", params);
        return toolsRef.current.dismissAlert(Number(params.index) || 0);
      },
      openQuadView: () => {
        console.log("[Arti tool] openQuadView");
        return toolsRef.current.openQuadView();
      },
      focusQuadPanel: (params: { panel: QuadPanelId }) => {
        console.log("[Arti tool] focusQuadPanel", params);
        return toolsRef.current.focusQuadPanel(params.panel);
      },
      closeQuadView: () => {
        console.log("[Arti tool] closeQuadView");
        return toolsRef.current.closeQuadView();
      },
      showPreferenceCard: () => {
        console.log("[Arti tool] showPreferenceCard");
        return toolsRef.current.showPreferenceCard();
      },
      showPatientDetails: () => {
        console.log("[Arti tool] showPatientDetails");
        return toolsRef.current.showPatientDetails();
      },
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
    // Guard: don't start if already connected/connecting
    if (conversation.status === "connected") return;
    userStoppedRef.current = false;
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

      await conversation.startSession({
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
      // Schedule a retry unless user explicitly stopped
      if (!userStoppedRef.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (!userStoppedRef.current) startRef.current();
        }, 2000);
      }
    }
  }, [conversation, staffName]);

  // Keep a ref to the latest start fn so reconnect timers can call it
  // without stale closures.
  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Auto-start once on mount if requested
  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    start();
  }, [autoStart, start]);

  // Push initial context once connected
  useEffect(() => {
    if (!isConnected || initialContextSentRef.current || !initialContext) return;
    initialContextSentRef.current = true;
    try {
      conversation.sendContextualUpdate(initialContext);
    } catch (err) {
      console.warn("[Arti] sendContextualUpdate (initial) failed", err);
    }
  }, [isConnected, initialContext, conversation]);

  // Re-push live context whenever it changes
  useEffect(() => {
    if (!isConnected || !liveContext) return;
    try {
      conversation.sendContextualUpdate(liveContext);
    } catch (err) {
      console.warn("[Arti] sendContextualUpdate (live) failed", err);
    }
  }, [isConnected, liveContext, conversation]);

  // When the tab becomes visible again, ensure Arti is back online
  // (browsers can suspend AudioContext / drop WS on background tabs).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (userStoppedRef.current) return;
      if (conversation.status !== "connected") {
        startRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [conversation.status]);

  // Cleanup any pending reconnect on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    // Mark intent so onDisconnect doesn't auto-reconnect.
    userStoppedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    conversation.endSession();
    toast("Arti is off");
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
