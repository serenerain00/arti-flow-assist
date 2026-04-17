import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { HomeDashboard } from "@/components/arti/HomeDashboard";
import { CaseListScreen } from "@/components/arti/CaseListScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";
import { parseIntent } from "@/components/arti/intent";
import { TODAY_CASES, type CaseItem } from "@/components/arti/cases";
import {
  ArtiVoiceProvider,
  useArtiVoiceContext,
} from "@/hooks/ArtiVoiceContext";
import type { ArtiVoiceCallbacks } from "@/hooks/useArtiVoice";

export const Route = createFileRoute("/")({
  component: ArtiWallRoot,
  head: () => ({
    meta: [
      { title: "Arti Wall · Intelligent OR Companion" },
      {
        name: "description",
        content:
          "Arti Wall — an ambient LED display for the operating room. Pre-case time-outs, instrument counts, and guidance designed to reduce cognitive load and prevent never-events.",
      },
    ],
  }),
});

/**
 * Root that wires the shared voice session in once. We use a ref to bridge
 * the agent's tool callbacks (registered up here in the provider) to the
 * actual state setters living inside ArtiWall — that way the provider can
 * be mounted before the inner component initializes.
 */
function ArtiWallRoot() {
  const callbacksRef = useRef<ArtiVoiceCallbacks>({
    onGoHome: () => {},
    onShowCases: () => {},
    onOpenCase: () => {},
    onSleep: () => {},
  });
  const stableCallbacks = useMemo<ArtiVoiceCallbacks>(
    () => ({
      onGoHome: () => callbacksRef.current.onGoHome(),
      onShowCases: () => callbacksRef.current.onShowCases(),
      onOpenCase: (q) => callbacksRef.current.onOpenCase(q),
      onSleep: () => callbacksRef.current.onSleep(),
    }),
    [],
  );

  return (
    <ArtiVoiceProvider callbacks={stableCallbacks}>
      <ArtiWall callbacksRef={callbacksRef} />
    </ArtiVoiceProvider>
  );
}

/**
 * Top-level state machine for the Arti wall:
 *   sleep → waking → greeting → home → cases → preop
 *
 * Transitions are driven by a tiny intent parser over a free-text prompt
 * (see ./components/arti/intent.ts). The sleep tap also wakes Arti so a
 * silent gesture works.
 */
type ArtiPhase = "sleep" | "waking" | "greeting" | "home" | "cases" | "preop";

interface ArtiWallProps {
  callbacksRef: React.MutableRefObject<ArtiVoiceCallbacks>;
}

function ArtiWall({ callbacksRef }: ArtiWallProps) {
  const [phase, setPhase] = useState<ArtiPhase>("sleep");
  const [activeCase, setActiveCase] = useState<CaseItem>(
    () => TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0]
  );

  const staff = { name: "Melissa Quinn", role: "Circulating Nurse", initials: "MQ" };

  const handleWakeRequested = useCallback(() => {
    setPhase((p) => (p === "sleep" ? "waking" : p));
  }, []);
  const handleWakeAnimationComplete = useCallback(() => {
    setPhase((p) => (p === "waking" ? "greeting" : p));
  }, []);
  const handleSleep = useCallback(() => {
    setPhase("sleep");
  }, []);

  const findCase = useCallback((q: string): CaseItem | undefined => {
    const text = q.toLowerCase();
    if (/\bnext\b/.test(text)) {
      return TODAY_CASES.find((c) => c.status === "next") ?? undefined;
    }
    return TODAY_CASES.find(
      (c) =>
        text.includes(c.patientName.toLowerCase()) ||
        text.includes(c.patientName.split(" ")[0].toLowerCase()) ||
        text.includes(c.procedureShort.toLowerCase())
    );
  }, []);

  /**
   * Single entry point for free-form prompts from any screen. Routes intent
   * to phase changes. Unknown intents from greeting drop into Home so the
   * user always lands somewhere useful.
   */
  const handlePrompt = useCallback(
    (text: string) => {
      const intent = parseIntent(text);

      switch (intent.kind) {
        case "wake":
          setPhase((p) => (p === "sleep" ? "waking" : p === "waking" ? p : "greeting"));
          return;
        case "sleep":
          setPhase("sleep");
          return;
        case "show-cases":
          setPhase("cases");
          return;
        case "open-case": {
          const match = findCase(intent.query);
          if (match) {
            setActiveCase(match);
            setPhase("preop");
          } else {
            setPhase("cases");
          }
          return;
        }
        case "go-home":
          setPhase("home");
          return;
        case "unknown":
        default:
          // Sleep → unknown text still wakes him.
          setPhase((p) => {
            if (p === "sleep") return "waking";
            if (p === "greeting") return "home";
            return p;
          });
          return;
      }
    },
    [findCase]
  );

  const handleSelectCase = useCallback((c: CaseItem) => {
    setActiveCase(c);
    setPhase("preop");
  }, []);

  /**
   * Voice tool callbacks. The agent invokes these via ElevenLabs client
   * tools to navigate the wall hands-free. Memoized so the conversation
   * session doesn't see a new identity on every render.
   */
  const voice = useMemo<ArtiVoiceCallbacks>(
    () => ({
      onGoHome: () => setPhase("home"),
      onShowCases: () => setPhase("cases"),
      onOpenCase: (query: string) => {
        const match = findCase(query);
        if (match) {
          setActiveCase(match);
          setPhase("preop");
        } else {
          setPhase("cases");
        }
      },
      onSleep: () => setPhase("sleep"),
    }),
    [findCase]
  );

  /**
   * Each phase mounts a different full-screen component. We wrap them in
   * AnimatePresence so swapping phases plays a smooth zoom+fade cross-fade
   * instead of an instant cut. `mode="wait"` would feel laggy at this scale,
   * so we let outgoing/incoming overlap with absolute positioning.
   */
  const screenTransition = {
    type: "tween" as const,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    duration: 0.55,
  };
  const screenVariants = {
    initial: { opacity: 0, scale: 1.04, filter: "blur(8px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.97, filter: "blur(6px)" },
  };

  let screen: React.ReactNode;
  if (phase === "preop") {
    screen = (
      <AwakeDashboard
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        activeCase={activeCase}
        onBackToCases={() => setPhase("cases")}
      />
    );
  } else if (phase === "cases") {
    screen = (
      <CaseListScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onBackHome={() => setPhase("home")}
        onSelectCase={handleSelectCase}
        onPrompt={handlePrompt}
        voice={voice}
      />
    );
  } else if (phase === "home") {
    screen = (
      <HomeDashboard
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onPrompt={handlePrompt}
        voice={voice}
      />
    );
  } else {
    screen = (
      <SleepScreen
        phase={phase}
        staffName={staff.name}
        onWakeRequested={handleWakeRequested}
        onWakeAnimationComplete={handleWakeAnimationComplete}
        onPrompt={handlePrompt}
        voice={voice}
      />
    );
  }

  // Group sleep/waking/greeting under one key so the SleepScreen doesn't
  // remount mid-wake animation; phase-internal transitions stay smooth.
  const screenKey =
    phase === "sleep" || phase === "waking" || phase === "greeting" ? "sleep" : phase;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={screenKey}
          variants={screenVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={screenTransition}
          className="absolute inset-0"
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
