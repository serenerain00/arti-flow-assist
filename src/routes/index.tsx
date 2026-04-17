import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { HomeDashboard } from "@/components/arti/HomeDashboard";
import { CaseListScreen } from "@/components/arti/CaseListScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";
import { parseIntent } from "@/components/arti/intent";
import { TODAY_CASES, type CaseItem } from "@/components/arti/cases";
import { ArtiVoiceProvider, useArtiVoiceContext } from "@/hooks/ArtiVoiceContext";
import type {
  ArtiToolResult,
  ArtiVoiceCallbacks,
  InstrumentId,
  QuadPanelId,
  TimeOutId,
} from "@/hooks/useArtiVoice";

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
 * Dashboard-scoped tool handlers. Populated by AwakeDashboard while it is
 * mounted, cleared when it unmounts. The voice agent talks to whichever
 * handlers are currently registered — when a dashboard-only tool is
 * invoked outside of preop, the agent gets a `not available` result and
 * falls back to "I don't have that." per the system prompt.
 */
export interface DashboardActions {
  toggleTimeOutItem: (id: TimeOutId) => ArtiToolResult;
  adjustInstrumentCount: (item: InstrumentId, delta: number) => ArtiToolResult;
  toggleSterileCockpit: (enabled?: boolean) => ArtiToolResult;
  dismissAlert: (index: number) => ArtiToolResult;
  openQuadView: () => ArtiToolResult;
  focusQuadPanel: (panel: QuadPanelId) => ArtiToolResult;
  closeQuadView: () => ArtiToolResult;
  openHowToVideo: (title?: string) => ArtiToolResult;
  showPreferenceCard: () => ArtiToolResult;
  showPreferenceCardLayoutImages: () => ArtiToolResult;
}

export type DashboardActionsRef = React.MutableRefObject<DashboardActions | null>;

/**
 * Root that wires the shared voice session in once. We use refs to bridge
 * the agent's tool callbacks (registered up here in the provider) to the
 * actual state setters living inside the dashboard components — that way
 * the provider can be mounted before the inner components initialize, and
 * the agent always talks to the freshest closures.
 */
function ArtiWallRoot() {
  const navCallbacksRef = useRef<
    Pick<ArtiVoiceCallbacks, "onGoHome" | "onShowCases" | "onOpenCase" | "onSleep">
  >({
    onGoHome: () => {},
    onShowCases: () => {},
    onOpenCase: () => {},
    onSleep: () => {},
  });

  // Dashboard-only tool bridge. `null` when no dashboard is mounted.
  const dashboardActionsRef = useRef<DashboardActions | null>(null);

  const stableCallbacks = useMemo<ArtiVoiceCallbacks>(
    () => ({
      // Nav — always available.
      onGoHome: () => navCallbacksRef.current.onGoHome(),
      onShowCases: () => navCallbacksRef.current.onShowCases(),
      onOpenCase: (q) => navCallbacksRef.current.onOpenCase(q),
      onSleep: () => navCallbacksRef.current.onSleep(),

      // Dashboard tools — gate on the dashboard being mounted. Returning
      // `undefined` here causes the tool wrapper in useArtiVoice to return
      // NOT_AVAILABLE, which the agent reads as "fall back to 'I don't
      // have that.'"
      onToggleTimeOutItem: (id) =>
        dashboardActionsRef.current?.toggleTimeOutItem(id) ?? notAvailable(),
      onAdjustInstrumentCount: (item, delta) =>
        dashboardActionsRef.current?.adjustInstrumentCount(item, delta) ?? notAvailable(),
      onToggleSterileCockpit: (enabled) =>
        dashboardActionsRef.current?.toggleSterileCockpit(enabled) ?? notAvailable(),
      onDismissAlert: (index) => dashboardActionsRef.current?.dismissAlert(index) ?? notAvailable(),
      onOpenQuadView: () => dashboardActionsRef.current?.openQuadView() ?? notAvailable(),
      onFocusQuadPanel: (panel) =>
        dashboardActionsRef.current?.focusQuadPanel(panel) ?? notAvailable(),
      onCloseQuadView: () => dashboardActionsRef.current?.closeQuadView() ?? notAvailable(),
      onOpenHowToVideo: (title) =>
        dashboardActionsRef.current?.openHowToVideo(title) ?? notAvailable(),
      onShowPreferenceCard: () =>
        dashboardActionsRef.current?.showPreferenceCard() ?? notAvailable(),
      onShowPreferenceCardLayoutImages: () =>
        dashboardActionsRef.current?.showPreferenceCardLayoutImages() ?? notAvailable(),
    }),
    [],
  );

  return (
    <ArtiVoiceProvider callbacks={stableCallbacks}>
      <ArtiWall navCallbacksRef={navCallbacksRef} dashboardActionsRef={dashboardActionsRef} />
    </ArtiVoiceProvider>
  );
}

const notAvailable = (): ArtiToolResult => ({ ok: false, reason: "dashboard not mounted" });

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
  navCallbacksRef: React.MutableRefObject<
    Pick<ArtiVoiceCallbacks, "onGoHome" | "onShowCases" | "onOpenCase" | "onSleep">
  >;
  dashboardActionsRef: DashboardActionsRef;
}

function ArtiWall({ navCallbacksRef, dashboardActionsRef }: ArtiWallProps) {
  const [phase, setPhase] = useState<ArtiPhase>("sleep");
  const [activeCase, setActiveCase] = useState<CaseItem>(
    () => TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0],
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
        text.includes(c.procedureShort.toLowerCase()),
    );
  }, []);

  /**
   * Single entry point for free-form prompts from any screen. Routes intent
   * to phase changes and, where possible, invokes the matching dashboard
   * tool directly so typing "dismiss alert 2" works without voice.
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
        case "toggle-timeout":
          dashboardActionsRef.current?.toggleTimeOutItem(intent.id);
          return;
        case "adjust-count":
          dashboardActionsRef.current?.adjustInstrumentCount(intent.item, intent.delta);
          return;
        case "toggle-cockpit":
          dashboardActionsRef.current?.toggleSterileCockpit(intent.enabled);
          return;
        case "open-quad":
          dashboardActionsRef.current?.openQuadView();
          return;
        case "focus-quad":
          dashboardActionsRef.current?.focusQuadPanel(intent.panel);
          return;
        case "close-quad":
          dashboardActionsRef.current?.closeQuadView();
          return;
        case "show-pref-card":
          dashboardActionsRef.current?.showPreferenceCard();
          return;
        case "show-pref-images":
          dashboardActionsRef.current?.showPreferenceCardLayoutImages();
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
    [findCase, dashboardActionsRef],
  );

  const handleSelectCase = useCallback((c: CaseItem) => {
    setActiveCase(c);
    setPhase("preop");
  }, []);

  /**
   * Voice nav callbacks. Dashboard-only tools are registered in the bridge
   * by AwakeDashboard itself — those don't need to live here.
   */
  navCallbacksRef.current = {
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
  };

  /**
   * Auto-greet: a single short utterance when Arti wakes. The Arti system
   * prompt bans filler ("How can I help?") and caps responses at one
   * sentence — we keep this first message to the same standard.
   * Falls back silently if voice isn't available.
   */
  const v = useArtiVoiceContext();
  const greetedRef = useRef<number>(0);
  useEffect(() => {
    if (phase !== "greeting" || !v) return;
    const stamp = Date.now();
    if (greetedRef.current && stamp - greetedRef.current < 30_000) return;
    greetedRef.current = stamp;

    const hour = new Date().getHours();
    const tod = hour < 5 ? "Evening" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    const nextCase = TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0];
    const firstName = staff.name.split(" ")[0];
    const side = nextCase.side ? `${nextCase.side.toLowerCase()} ` : "";
    const firstMessage = `${tod}, ${firstName}. ${nextCase.patientName} is up — ${side}${nextCase.procedureShort}.`;

    void v.startSession({ firstMessage });
    // We intentionally only run this when phase becomes 'greeting'.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
        onPrompt={handlePrompt}
        actionsRef={dashboardActionsRef}
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
