import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { HomeDashboard } from "@/components/arti/HomeDashboard";
import { CaseListScreen } from "@/components/arti/CaseListScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";
import { TODAY_CASES, type CaseItem } from "@/components/arti/cases";
import { ArtiVoiceProvider, useArtiVoiceContext } from "@/hooks/ArtiVoiceContext";
import type {
  ActiveRole,
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
  switchRole: (role: ActiveRole) => ArtiToolResult;
  openPatientDetails: () => ArtiToolResult;
  closePatientDetails: () => ArtiToolResult;
  toggleOpeningChecklistItem: (index: number) => ArtiToolResult;
  openTableLayoutImages: () => ArtiToolResult;
  lightboxNext: () => ArtiToolResult;
  lightboxPrev: () => ArtiToolResult;
  closeLightbox: () => ArtiToolResult;
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
    Pick<ArtiVoiceCallbacks, "onWake" | "onGoHome" | "onShowCases" | "onOpenCase" | "onSleep">
  >({
    onWake: () => {},
    onGoHome: () => {},
    onShowCases: () => {},
    onOpenCase: () => {},
    onSleep: () => {},
  });

  // Dashboard-only tool bridge. `null` when no dashboard is mounted.
  const dashboardActionsRef = useRef<DashboardActions | null>(null);

  // Live context builder — always returns fresh state, referenced via ref
  // so stableCallbacks never needs to change.
  const contextRef = useRef<() => string>(() => "Phase: sleep");

  // Dashboard contributes its own live state to the context snapshot.
  const dashboardContextRef = useRef<() => string>(() => "");

  // Scroll control — delegated from stableCallbacks to live ArtiWall closures.
  const scrollActionsRef = useRef<{
    onScroll: (direction: string, speed: string, continuous: boolean) => ArtiToolResult;
    onStopScroll: () => ArtiToolResult;
  }>({
    onScroll: () => ({ ok: false, reason: "not ready" }),
    onStopScroll: () => ({ ok: false, reason: "not ready" }),
  });

  // Idle-timer reset — called by stableCallbacks on any user activity or agent response.
  const idleResetRef = useRef<() => void>(() => {});

  // Arti napping state — true when Arti is in standby on the current screen
  // (idle timeout or "sleep" voice command). Does NOT change the app phase/screen.
  const [artiNapping, setArtiNapping] = useState(false);
  // Ref so ArtiWall can set napping without a prop callback chain.
  const artiNapSetterRef = useRef<(v: boolean) => void>(() => {});
  artiNapSetterRef.current = setArtiNapping;

  const stableCallbacks = useMemo<ArtiVoiceCallbacks>(
    () => ({
      onWake: () => navCallbacksRef.current.onWake?.(),
      onGoHome: () => navCallbacksRef.current.onGoHome(),
      onShowCases: () => navCallbacksRef.current.onShowCases(),
      onOpenCase: (q) => navCallbacksRef.current.onOpenCase(q),
      onSleep: () => navCallbacksRef.current.onSleep(),

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
      onSwitchRole: (role) =>
        dashboardActionsRef.current?.switchRole(role) ?? notAvailable(),
      onOpenPatientDetails: () =>
        dashboardActionsRef.current?.openPatientDetails() ?? notAvailable(),
      onClosePatientDetails: () =>
        dashboardActionsRef.current?.closePatientDetails() ?? notAvailable(),
      onToggleOpeningChecklistItem: (index) =>
        dashboardActionsRef.current?.toggleOpeningChecklistItem(index) ?? notAvailable(),
      onOpenTableLayoutImages: () =>
        dashboardActionsRef.current?.openTableLayoutImages() ?? notAvailable(),
      onLightboxNext: () =>
        dashboardActionsRef.current?.lightboxNext() ?? notAvailable(),
      onLightboxPrev: () =>
        dashboardActionsRef.current?.lightboxPrev() ?? notAvailable(),
      onCloseLightbox: () =>
        dashboardActionsRef.current?.closeLightbox() ?? notAvailable(),
      onScroll: (direction, speed, continuous) =>
        scrollActionsRef.current.onScroll(direction, speed, continuous),
      onStopScroll: () => scrollActionsRef.current.onStopScroll(),
      onUserTranscript: () => idleResetRef.current(),
      onAgentResponse: () => idleResetRef.current(),

      getContext: () => contextRef.current(),
    }),
    [],
  );

  return (
    <ArtiVoiceProvider
      callbacks={stableCallbacks}
      artiNapping={artiNapping}
      wakeArti={() => setArtiNapping(false)}
    >
      <ArtiWall
        navCallbacksRef={navCallbacksRef}
        dashboardActionsRef={dashboardActionsRef}
        dashboardContextRef={dashboardContextRef}
        contextRef={contextRef}
        scrollActionsRef={scrollActionsRef}
        idleResetRef={idleResetRef}
        artiNapSetterRef={artiNapSetterRef}
        artiNapping={artiNapping}
      />
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
    Pick<ArtiVoiceCallbacks, "onWake" | "onGoHome" | "onShowCases" | "onOpenCase" | "onSleep">
  >;
  dashboardActionsRef: DashboardActionsRef;
  dashboardContextRef: React.MutableRefObject<() => string>;
  contextRef: React.MutableRefObject<() => string>;
  scrollActionsRef: React.MutableRefObject<{
    onScroll: (direction: string, speed: string, continuous: boolean) => ArtiToolResult;
    onStopScroll: () => ArtiToolResult;
  }>;
  idleResetRef: React.MutableRefObject<() => void>;
  artiNapSetterRef: MutableRefObject<(v: boolean) => void>;
  artiNapping: boolean;
}

// px-per-frame for continuous scroll
const SCROLL_SPEED_PX: Record<string, number> = { slow: 2, normal: 5, fast: 12 };

function getScrollTarget(): HTMLElement {
  // Prefer the explicitly marked container if it actually has overflow.
  const marked = document.querySelector<HTMLElement>("[data-scroll]");
  if (marked && marked.scrollHeight > marked.clientHeight) return marked;
  // Fallback: first scrollable ancestor of the marked element, or body/documentElement.
  if (marked) {
    let el: HTMLElement | null = marked.parentElement;
    while (el && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
  }
  return document.body.scrollHeight > document.body.clientHeight
    ? document.body
    : document.documentElement;
}

function ArtiWall({ navCallbacksRef, dashboardActionsRef, dashboardContextRef, contextRef, scrollActionsRef, idleResetRef, artiNapSetterRef, artiNapping }: ArtiWallProps) {
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep scroll handlers current on every render — stableCallbacks delegates through the ref.
  scrollActionsRef.current = {
    onScroll: (direction, speed, continuous) => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      const el = getScrollTarget();
      if (direction === "top") { el.scrollTo({ top: 0, behavior: "smooth" }); return { ok: true }; }
      if (direction === "bottom") { el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); return { ok: true }; }
      const pxPerFrame = SCROLL_SPEED_PX[speed] ?? SCROLL_SPEED_PX.normal;
      const sign = direction === "down" ? 1 : -1;
      if (continuous) {
        scrollIntervalRef.current = setInterval(() => { el.scrollBy(0, sign * pxPerFrame); }, 16);
      } else {
        // Scroll ~40% of the element's visible height so the jump feels meaningful
        // regardless of screen size.
        el.scrollBy({ top: sign * Math.round(el.clientHeight * 0.4), behavior: "smooth" });
      }
      return { ok: true };
    },
    onStopScroll: () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      return { ok: true };
    },
  };
  const [phase, setPhase] = useState<ArtiPhase>("sleep");
  const [activeCase, setActiveCase] = useState<CaseItem>(
    () => TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0],
  );

  const staff = { name: "Melissa Quinn", role: "Circulating Nurse", initials: "MQ" };

  // ── Idle-sleep timer ─────────────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const v = useArtiVoiceContext();

  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(async () => {
      if (!v) return;
      await v.speak("I haven't heard from you in almost a minute, I'm going to take a nap.");
      artiNapSetterRef.current(true);
      v.stopListening();
    }, 60_000);
  }, [v, artiNapSetterRef]);

  // Expose armIdleTimer through the ref so stableCallbacks can reset on user activity.
  idleResetRef.current = armIdleTimer;

  // Arm the timer whenever Arti is awake and not napping; clear it otherwise.
  useEffect(() => {
    if (phase === "sleep" || artiNapping) {
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
      return;
    }
    armIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [phase, artiNapping, armIdleTimer]);

  const vForSleepRef = useRef(v);
  vForSleepRef.current = v;
  // Stop mic on initial sleep phase (app startup).
  useEffect(() => {
    if (phase === "sleep") vForSleepRef.current?.stopListening();
  }, [phase]);
  // Auto-start mic and open session window whenever navigating to an active screen,
  // AND recover if the mic dies mid-session (e.g. SpeechRecognition restart error).
  // startListening() is idempotent — safe to call when already running.
  const isListening = v?.listening ?? false;
  useEffect(() => {
    if (phase === "sleep" || phase === "waking" || artiNapping) return;
    vForSleepRef.current?.startListening();
    vForSleepRef.current?.activateSession();
  }, [phase, artiNapping, isListening]);
  // Stop mic when Arti naps mid-session (stays on current screen).
  useEffect(() => {
    if (artiNapping) vForSleepRef.current?.stopListening();
  }, [artiNapping]);
  // ─────────────────────────────────────────────────────────────────────────

  const PHASE_LABEL: Record<ArtiPhase, string> = {
    sleep: "sleep / standby",
    waking: "waking up",
    greeting: "greeting screen",
    home: "home dashboard",
    cases: "case list",
    preop: "pre-op / surgical dashboard",
  };

  // Keep contextRef current so Claude always gets a fresh state snapshot.
  contextRef.current = () => {
    const board = TODAY_CASES.map(
      (c) => `  - ${c.patientName} · ${c.procedure} (${c.procedureShort}) · ${c.status}${c.side ? ` · ${c.side} side` : ""} · ${c.surgeon} · ${c.time}`,
    ).join("\n");

    const now = new Date();
    const h = now.getHours();
    const timeGreeting = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const lines = [
      `Staff: ${staff.name}, ${staff.role}`,
      `Current time: ${timeStr} — use "${timeGreeting}" for any greeting`,
      `Current screen: ${PHASE_LABEL[phase]}`,
      `Active case: ${activeCase.patientName} · ${activeCase.procedure}${activeCase.side ? ` · ${activeCase.side} side` : ""} · ${activeCase.patientMrn} · ${activeCase.surgeon} · OR ${activeCase.room}`,
      `Today's board:\n${board}`,
      `Navigation available: home dashboard, case list, pre-op dashboard, sleep`,
    ];

    // Add live dashboard state when on the surgical screen.
    const dashCtx = dashboardContextRef.current();
    if (dashCtx) lines.push(dashCtx);

    return lines.join("\n");
  };

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

  /** Single entry point for free-form prompts from any screen — routed through Claude. */
  const handlePrompt = useCallback(
    (text: string) => {
      armIdleTimer();
      setPhase((p) => {
        if (p === "sleep") return "waking";
        if (p === "greeting") return "home";
        return p;
      });
      void v?.sendCommand(text);
    },
    [v, armIdleTimer],
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
    onWake: () => {
      setPhase((p) => p === "sleep" ? "waking" : p);
    },
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
    onSleep: () => { artiNapSetterRef.current(true); vForSleepRef.current?.stopListening(); },
  };

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
        dashboardContextRef={dashboardContextRef}
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
