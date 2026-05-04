import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { HomeDashboard } from "@/components/arti/HomeDashboard";
import { CaseListScreen } from "@/components/arti/CaseListScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";
import { ScheduleScreen } from "@/components/arti/ScheduleScreen";
import { SurgeonsScreen } from "@/components/arti/SurgeonsScreen";
import { PatientsScreen } from "@/components/arti/PatientsScreen";
import { ConsolesScreen } from "@/components/arti/ConsolesScreen";
import { VideoLibraryScreen } from "@/components/arti/VideoLibraryScreen";
import { JourneyScreen } from "@/components/arti/JourneyScreen";
import { JOURNEY } from "@/components/arti/journey/script";
import { speakText } from "@/server/elevenlabs";
import {
  CONSOLES,
  findConsole,
  summarizeConsoles,
  type ConsoleId,
} from "@/components/arti/consoles";
import {
  filterLibrary,
  PROCEDURE_VIDEOS,
  type VideoCategory,
} from "@/components/arti/videoLibrary";
import { ReminderToast, type FiredReminder } from "@/components/arti/ReminderToast";
import { PersonScheduleModal } from "@/components/arti/PersonScheduleModal";
import { HowToVideoModal, type HowToVideoHandle } from "@/components/arti/HowToVideoModal";
import {
  ImageLightboxModal,
  type LightboxHandle,
  type LightboxImage,
} from "@/components/arti/ImageLightboxModal";
import { PREF_CARD_IMAGES } from "@/components/arti/PreferenceCard";
import { SCRUB_LIGHTBOX_IMAGES } from "@/components/arti/ScrubTechPanel";
import type { PersonRole, PersonScheduleView } from "@/components/arti/schedule";
import { TODAY_CASES, PATIENT_CLINICAL, type CaseItem } from "@/components/arti/cases";
import {
  getCasesForDate,
  formatLongDate,
  toDateKey,
  summarizeDay,
  SCHEDULE_CASES,
  type ServiceLine,
} from "@/components/arti/schedule";
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
  setInstrumentCount: (item: InstrumentId, value: number) => ArtiToolResult;
  dismissAlert: (index: number) => ArtiToolResult;
  openQuadView: () => ArtiToolResult;
  focusQuadPanel: (panel: QuadPanelId) => ArtiToolResult;
  closeQuadView: () => ArtiToolResult;
  showPreferenceCard: () => ArtiToolResult;
  switchRole: (role: ActiveRole) => ArtiToolResult;
  openPatientDetails: () => ArtiToolResult;
  closePatientDetails: () => ArtiToolResult;
  openPatientVideo: () => ArtiToolResult;
  closePatientVideo: () => ArtiToolResult;
  playPatientVideo: () => ArtiToolResult;
  pausePatientVideo: () => ArtiToolResult;
  restartPatientVideo: () => ArtiToolResult;
  togglePatientVideoCaptions: () => ArtiToolResult;
  mutePatientVideo: () => ArtiToolResult;
  unmutePatientVideo: () => ArtiToolResult;
  openXrays: () => ArtiToolResult;
  closeXrays: () => ArtiToolResult;
  xraysNextView: () => ArtiToolResult;
  xraysPrevView: () => ArtiToolResult;
  xraysShowView: (query: string) => ArtiToolResult;
  xraysZoomIn: () => ArtiToolResult;
  xraysZoomOut: () => ArtiToolResult;
  xraysResetZoom: () => ArtiToolResult;
  toggleOpeningChecklistItem: (index: number) => ArtiToolResult;
  toggleMachineCheckItem: (index: number) => ArtiToolResult;
  /**
   * Close whichever dashboard-scoped overlay is currently topmost
   * (patient details > quad view). Returns the name of what was closed,
   * or null if nothing was open. Called by the route's
   * close_topmost_modal handler after route-level overlays are checked.
   */
  closeTopmostDashboardOverlay: () => string | null;
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
    Pick<
      ArtiVoiceCallbacks,
      | "onWake"
      | "onGoHome"
      | "onShowCases"
      | "onOpenCase"
      | "onSleep"
      | "onShowSchedule"
      | "onShowSurgeons"
      | "onShowPatients"
      | "onShowConsoles"
      | "onFocusConsole"
      | "onShowLibrary"
      | "onCloseTopmostModal"
      | "onLibraryFilterCategory"
      | "onLibrarySearch"
      | "onLibrarySetAnimatedOnly"
      | "onLibraryClearFilters"
      | "onStartJourney"
      | "onExitJourney"
      | "onJourneyPause"
      | "onJourneyResume"
      | "onJourneyNext"
      | "onJourneyPrevious"
      | "onShowScheduleDay"
      | "onCloseScheduleDay"
      | "onSetReminder"
      | "onCancelReminders"
      | "onDismissReminderAlert"
      | "onScheduleSetServiceLines"
      | "onScheduleSetSurgeon"
      | "onScheduleClearFilters"
      | "onShowPersonSchedule"
      | "onSetPersonScheduleView"
      | "onClosePersonSchedule"
      | "onOpenHowToVideo"
      | "onOpenResearchPapers"
      | "onVideoPlay"
      | "onVideoPause"
      | "onVideoSeek"
      | "onVideoNextChapter"
      | "onVideoPrevChapter"
      | "onVideoRestart"
      | "onVideoSetSpeed"
      | "onVideoShowPapers"
      | "onVideoHidePapers"
      | "onVideoOpenPaper"
      | "onVideoClosePaper"
      | "onCloseHowToVideo"
      | "onShowPreferenceCardLayoutImages"
      | "onOpenTableLayoutImages"
      | "onLightboxNext"
      | "onLightboxPrev"
      | "onLightboxZoomIn"
      | "onLightboxZoomOut"
      | "onCloseLightbox"
    >
  >({
    onWake: () => {},
    onGoHome: () => {},
    onShowCases: () => {},
    onOpenCase: () => {},
    onSleep: () => {},
    onShowSchedule: () => {},
    onShowSurgeons: () => {},
    onShowPatients: () => {},
    onShowConsoles: () => {},
    onFocusConsole: () => {},
    onShowLibrary: () => {},
    onCloseTopmostModal: () => {},
    onLibraryFilterCategory: () => {},
    onLibrarySearch: () => {},
    onLibrarySetAnimatedOnly: () => {},
    onLibraryClearFilters: () => {},
    onStartJourney: () => {},
    onExitJourney: () => {},
    onJourneyPause: () => {},
    onJourneyResume: () => {},
    onJourneyNext: () => {},
    onJourneyPrevious: () => {},
    onShowScheduleDay: () => {},
    onCloseScheduleDay: () => {},
    onSetReminder: () => {},
    onCancelReminders: () => {},
    onDismissReminderAlert: () => {},
    onScheduleSetServiceLines: () => {},
    onScheduleSetSurgeon: () => {},
    onScheduleClearFilters: () => {},
    onShowPersonSchedule: () => {},
    onSetPersonScheduleView: () => {},
    onClosePersonSchedule: () => {},
    onOpenHowToVideo: () => notAvailable(),
    onOpenResearchPapers: () => notAvailable(),
    onVideoPlay: () => notAvailable(),
    onVideoPause: () => notAvailable(),
    onVideoSeek: () => notAvailable(),
    onVideoNextChapter: () => notAvailable(),
    onVideoPrevChapter: () => notAvailable(),
    onVideoRestart: () => notAvailable(),
    onVideoSetSpeed: () => notAvailable(),
    onVideoShowPapers: () => notAvailable(),
    onVideoHidePapers: () => notAvailable(),
    onVideoOpenPaper: () => notAvailable(),
    onVideoClosePaper: () => notAvailable(),
    onCloseHowToVideo: () => notAvailable(),
    onShowPreferenceCardLayoutImages: () => notAvailable(),
    onOpenTableLayoutImages: () => notAvailable(),
    onLightboxNext: () => notAvailable(),
    onLightboxPrev: () => notAvailable(),
    onLightboxZoomIn: () => notAvailable(),
    onLightboxZoomOut: () => notAvailable(),
    onCloseLightbox: () => notAvailable(),
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
      onShowSchedule: () => navCallbacksRef.current.onShowSchedule?.(),
      onShowSurgeons: () => navCallbacksRef.current.onShowSurgeons?.(),
      onShowPatients: () => navCallbacksRef.current.onShowPatients?.(),
      onShowConsoles: () => navCallbacksRef.current.onShowConsoles?.(),
      onFocusConsole: (id) => navCallbacksRef.current.onFocusConsole?.(id),
      onShowLibrary: () => navCallbacksRef.current.onShowLibrary?.(),
      onCloseTopmostModal: () => navCallbacksRef.current.onCloseTopmostModal?.(),
      onLibraryFilterCategory: (c) => navCallbacksRef.current.onLibraryFilterCategory?.(c),
      onLibrarySearch: (q) => navCallbacksRef.current.onLibrarySearch?.(q),
      onLibrarySetAnimatedOnly: (v) => navCallbacksRef.current.onLibrarySetAnimatedOnly?.(v),
      onLibraryClearFilters: () => navCallbacksRef.current.onLibraryClearFilters?.(),
      onStartJourney: () => navCallbacksRef.current.onStartJourney?.(),
      onExitJourney: () => navCallbacksRef.current.onExitJourney?.(),
      onJourneyPause: () => navCallbacksRef.current.onJourneyPause?.(),
      onJourneyResume: () => navCallbacksRef.current.onJourneyResume?.(),
      onJourneyNext: () => navCallbacksRef.current.onJourneyNext?.(),
      onJourneyPrevious: () => navCallbacksRef.current.onJourneyPrevious?.(),
      onShowScheduleDay: (date) => navCallbacksRef.current.onShowScheduleDay?.(date),
      onCloseScheduleDay: () => navCallbacksRef.current.onCloseScheduleDay?.(),
      onSetReminder: (text, minutes) => navCallbacksRef.current.onSetReminder?.(text, minutes),
      onCancelReminders: () => navCallbacksRef.current.onCancelReminders?.(),
      onDismissReminderAlert: () => navCallbacksRef.current.onDismissReminderAlert?.(),
      onScheduleSetServiceLines: (lines) =>
        navCallbacksRef.current.onScheduleSetServiceLines?.(lines),
      onScheduleSetSurgeon: (s) => navCallbacksRef.current.onScheduleSetSurgeon?.(s),
      onScheduleClearFilters: () => navCallbacksRef.current.onScheduleClearFilters?.(),
      onShowPersonSchedule: (n, r) => navCallbacksRef.current.onShowPersonSchedule?.(n, r),
      onSetPersonScheduleView: (v) => navCallbacksRef.current.onSetPersonScheduleView?.(v),
      onClosePersonSchedule: () => navCallbacksRef.current.onClosePersonSchedule?.(),

      onToggleTimeOutItem: (id) =>
        dashboardActionsRef.current?.toggleTimeOutItem(id) ?? notAvailable(),
      onAdjustInstrumentCount: (item, delta) =>
        dashboardActionsRef.current?.adjustInstrumentCount(item, delta) ?? notAvailable(),
      onSetInstrumentCount: (item, value) =>
        dashboardActionsRef.current?.setInstrumentCount(item, value) ?? notAvailable(),
      onDismissAlert: (index) => dashboardActionsRef.current?.dismissAlert(index) ?? notAvailable(),
      onOpenQuadView: () => dashboardActionsRef.current?.openQuadView() ?? notAvailable(),
      onFocusQuadPanel: (panel) =>
        dashboardActionsRef.current?.focusQuadPanel(panel) ?? notAvailable(),
      onCloseQuadView: () => dashboardActionsRef.current?.closeQuadView() ?? notAvailable(),
      onOpenHowToVideo: (procedure, title, id) =>
        navCallbacksRef.current.onOpenHowToVideo?.(procedure, title, id) ?? notAvailable(),
      onOpenResearchPapers: (procedure, topic) =>
        navCallbacksRef.current.onOpenResearchPapers?.(procedure, topic) ?? notAvailable(),
      onVideoPlay: () => navCallbacksRef.current.onVideoPlay?.() ?? notAvailable(),
      onVideoPause: () => navCallbacksRef.current.onVideoPause?.() ?? notAvailable(),
      onVideoSeek: (direction, seconds) =>
        navCallbacksRef.current.onVideoSeek?.(direction, seconds) ?? notAvailable(),
      onVideoNextChapter: () => navCallbacksRef.current.onVideoNextChapter?.() ?? notAvailable(),
      onVideoPrevChapter: () => navCallbacksRef.current.onVideoPrevChapter?.() ?? notAvailable(),
      onVideoRestart: () => navCallbacksRef.current.onVideoRestart?.() ?? notAvailable(),
      onVideoSetSpeed: (rate) => navCallbacksRef.current.onVideoSetSpeed?.(rate) ?? notAvailable(),
      onVideoShowPapers: () => navCallbacksRef.current.onVideoShowPapers?.() ?? notAvailable(),
      onVideoHidePapers: () => navCallbacksRef.current.onVideoHidePapers?.() ?? notAvailable(),
      onVideoOpenPaper: (q) => navCallbacksRef.current.onVideoOpenPaper?.(q) ?? notAvailable(),
      onVideoClosePaper: () => navCallbacksRef.current.onVideoClosePaper?.() ?? notAvailable(),
      onCloseHowToVideo: () => navCallbacksRef.current.onCloseHowToVideo?.() ?? notAvailable(),
      onShowPreferenceCard: () =>
        dashboardActionsRef.current?.showPreferenceCard() ?? notAvailable(),
      onSwitchRole: (role) => dashboardActionsRef.current?.switchRole(role) ?? notAvailable(),
      onOpenPatientDetails: () =>
        dashboardActionsRef.current?.openPatientDetails() ?? notAvailable(),
      onClosePatientDetails: () =>
        dashboardActionsRef.current?.closePatientDetails() ?? notAvailable(),
      onOpenPatientVideo: () =>
        dashboardActionsRef.current?.openPatientVideo() ?? notAvailable(),
      onClosePatientVideo: () =>
        dashboardActionsRef.current?.closePatientVideo() ?? notAvailable(),
      onPlayPatientVideo: () =>
        dashboardActionsRef.current?.playPatientVideo() ?? notAvailable(),
      onPausePatientVideo: () =>
        dashboardActionsRef.current?.pausePatientVideo() ?? notAvailable(),
      onRestartPatientVideo: () =>
        dashboardActionsRef.current?.restartPatientVideo() ?? notAvailable(),
      onTogglePatientVideoCaptions: () =>
        dashboardActionsRef.current?.togglePatientVideoCaptions() ?? notAvailable(),
      onMutePatientVideo: () =>
        dashboardActionsRef.current?.mutePatientVideo() ?? notAvailable(),
      onUnmutePatientVideo: () =>
        dashboardActionsRef.current?.unmutePatientVideo() ?? notAvailable(),
      onOpenXrays: () => dashboardActionsRef.current?.openXrays() ?? notAvailable(),
      onCloseXrays: () => dashboardActionsRef.current?.closeXrays() ?? notAvailable(),
      onXraysNextView: () => dashboardActionsRef.current?.xraysNextView() ?? notAvailable(),
      onXraysPrevView: () => dashboardActionsRef.current?.xraysPrevView() ?? notAvailable(),
      onXraysShowView: (q) => dashboardActionsRef.current?.xraysShowView(q) ?? notAvailable(),
      onXraysZoomIn: () => dashboardActionsRef.current?.xraysZoomIn() ?? notAvailable(),
      onXraysZoomOut: () => dashboardActionsRef.current?.xraysZoomOut() ?? notAvailable(),
      onXraysResetZoom: () => dashboardActionsRef.current?.xraysResetZoom() ?? notAvailable(),
      onToggleOpeningChecklistItem: (index) =>
        dashboardActionsRef.current?.toggleOpeningChecklistItem(index) ?? notAvailable(),
      onToggleMachineCheckItem: (index) =>
        dashboardActionsRef.current?.toggleMachineCheckItem(index) ?? notAvailable(),
      onShowPreferenceCardLayoutImages: (caseQuery, procedure) =>
        navCallbacksRef.current.onShowPreferenceCardLayoutImages?.(caseQuery, procedure) ??
        notAvailable(),
      onOpenTableLayoutImages: () =>
        navCallbacksRef.current.onOpenTableLayoutImages?.() ?? notAvailable(),
      onLightboxNext: () => navCallbacksRef.current.onLightboxNext?.() ?? notAvailable(),
      onLightboxPrev: () => navCallbacksRef.current.onLightboxPrev?.() ?? notAvailable(),
      onLightboxZoomIn: () => navCallbacksRef.current.onLightboxZoomIn?.() ?? notAvailable(),
      onLightboxZoomOut: () => navCallbacksRef.current.onLightboxZoomOut?.() ?? notAvailable(),
      onCloseLightbox: () => navCallbacksRef.current.onCloseLightbox?.() ?? notAvailable(),
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
type ArtiPhase =
  | "sleep"
  | "waking"
  | "greeting"
  | "home"
  | "cases"
  | "preop"
  | "schedule"
  | "surgeons"
  | "patients"
  | "consoles"
  | "library"
  | "journey";

interface ArtiWallProps {
  navCallbacksRef: React.MutableRefObject<
    Pick<
      ArtiVoiceCallbacks,
      | "onWake"
      | "onGoHome"
      | "onShowCases"
      | "onOpenCase"
      | "onSleep"
      | "onShowSchedule"
      | "onShowSurgeons"
      | "onShowPatients"
      | "onShowConsoles"
      | "onFocusConsole"
      | "onShowLibrary"
      | "onCloseTopmostModal"
      | "onLibraryFilterCategory"
      | "onLibrarySearch"
      | "onLibrarySetAnimatedOnly"
      | "onLibraryClearFilters"
      | "onStartJourney"
      | "onExitJourney"
      | "onJourneyPause"
      | "onJourneyResume"
      | "onJourneyNext"
      | "onJourneyPrevious"
      | "onShowScheduleDay"
      | "onCloseScheduleDay"
      | "onSetReminder"
      | "onCancelReminders"
      | "onDismissReminderAlert"
      | "onScheduleSetServiceLines"
      | "onScheduleSetSurgeon"
      | "onScheduleClearFilters"
      | "onShowPersonSchedule"
      | "onSetPersonScheduleView"
      | "onClosePersonSchedule"
      | "onOpenHowToVideo"
      | "onOpenResearchPapers"
      | "onVideoPlay"
      | "onVideoPause"
      | "onVideoSeek"
      | "onVideoNextChapter"
      | "onVideoPrevChapter"
      | "onVideoRestart"
      | "onVideoSetSpeed"
      | "onVideoShowPapers"
      | "onVideoHidePapers"
      | "onVideoOpenPaper"
      | "onVideoClosePaper"
      | "onCloseHowToVideo"
      | "onShowPreferenceCardLayoutImages"
      | "onOpenTableLayoutImages"
      | "onLightboxNext"
      | "onLightboxPrev"
      | "onLightboxZoomIn"
      | "onLightboxZoomOut"
      | "onCloseLightbox"
    >
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

// Canonical list of service lines — used both as default filter and as the
// set of valid values that voice-driven filter changes are narrowed to.
const ALL_SERVICE_LINES: ServiceLine[] = [
  "Orthopedics",
  "Cardiothoracic",
  "General",
  "Spine",
  "ENT",
];

function getScrollTarget(): HTMLElement {
  // Modal scroll containers take precedence — when an overlay is mounted,
  // "scroll down" should target the modal contents, not the body behind it.
  // We pick the LAST modal container in DOM order (latest-opened wins) since
  // multiple modals can be in the tree at once.
  const modals = document.querySelectorAll<HTMLElement>("[data-scroll-modal]");
  for (let i = modals.length - 1; i >= 0; i--) {
    const el = modals[i];
    if (el.scrollHeight > el.clientHeight) return el;
  }
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

function ArtiWall({
  navCallbacksRef,
  dashboardActionsRef,
  dashboardContextRef,
  contextRef,
  scrollActionsRef,
  idleResetRef,
  artiNapSetterRef,
  artiNapping,
}: ArtiWallProps) {
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep scroll handlers current on every render — stableCallbacks delegates through the ref.
  scrollActionsRef.current = {
    onScroll: (direction, speed, continuous) => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      const el = getScrollTarget();
      if (direction === "top") {
        el.scrollTo({ top: 0, behavior: "smooth" });
        return { ok: true };
      }
      if (direction === "bottom") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        return { ok: true };
      }
      const pxPerFrame = SCROLL_SPEED_PX[speed] ?? SCROLL_SPEED_PX.normal;
      const sign = direction === "down" ? 1 : -1;
      if (continuous) {
        scrollIntervalRef.current = setInterval(() => {
          el.scrollBy(0, sign * pxPerFrame);
        }, 16);
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
  // Which day's detail drawer is open on the Schedule screen. Null = closed.
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);

  // Schedule filter state — lifted up from ScheduleScreen so voice tools can
  // drive it. Service lines default to all visible; surgeon "all" = no filter.
  const [activeScheduleLines, setActiveScheduleLines] = useState<Set<ServiceLine>>(
    () => new Set(ALL_SERVICE_LINES),
  );
  const [scheduleSurgeonFilter, setScheduleSurgeonFilter] = useState<string | "all">("all");

  // Focused console on the OR-tower screen. Driven by voice (focus_console)
  // OR by a tap on the 3D tower / detail panel. Null = no explicit focus
  // (the screen falls back to whichever console is currently 'active').
  const [focusedConsoleId, setFocusedConsoleId] = useState<ConsoleId | null>(null);

  // Video Library filter state — lifted from VideoLibraryScreen so voice
  // tools (library_search / library_filter_category / library_clear_filters)
  // can drive the same controls the user can click. The screen itself is
  // controlled by these props.
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryCategory, setLibraryCategory] = useState<VideoCategory | "All">("All");
  const [libraryAnimatedOnly, setLibraryAnimatedOnly] = useState(false);

  // Journey walkthrough state. `journeyPaused` toggled by voice / button.
  // `journeyStageDelta` is a monotonically-increasing counter the voice
  // tools bump for next/previous; the screen reads the delta and applies
  // a single stage change. `journeyStartKey` resets to a new value each
  // time start_journey fires so the screen knows to restart from stage 0.
  const [journeyPaused, setJourneyPaused] = useState(false);
  const [journeyStageDelta, setJourneyStageDelta] = useState(0);
  const [journeyStartKey, setJourneyStartKey] = useState(0);
  // Stage-0 narration audio pre-fetched at start_journey time so the
  // screen can play it immediately on mount instead of waiting for a
  // fresh ElevenLabs round-trip (~400-500 ms saved).
  const [journeyPrimer, setJourneyPrimer] = useState<Promise<{
    audioBase64: string;
  }> | null>(null);

  /**
   * Stable journey-exit handler. Critical that this is useCallback —
   * passing an inline arrow function as JourneyScreen's `onExit` makes
   * the prop unstable, which re-triggers the screen's narration useEffect
   * on every parent re-render and stacks overlapping TTS streams. Refs
   * + setState dispatchers in the body are themselves stable across
   * renders, so the empty-deps array is correct.
   */
  const handleExitJourney = useCallback(() => {
    vForSleepRef.current?.stopSpeaking();
    setJourneyPaused(false);
    setPhase("sleep");
  }, []);

  // Person Schedule modal — overlay that shows one person's cases.
  interface PersonScheduleState {
    open: boolean;
    name: string | null;
    role: PersonRole | null;
    view: PersonScheduleView;
  }
  const [personSchedule, setPersonSchedule] = useState<PersonScheduleState>({
    open: false,
    name: null,
    role: null,
    view: "day",
  });

  // ── How-to video modal ───────────────────────────────────────────────────
  // Lifted to the route level so videos and research are reachable from any
  // screen (home, cases, preop, schedule, surgeons, patients) — not just
  // preop. Imperative ref drives all voice transport (play/pause/seek/etc.).
  const [howToOpen, setHowToOpen] = useState(false);
  const [howToProcedure, setHowToProcedure] = useState<string | undefined>(undefined);
  // Direct library override — when set, the modal opens that exact video
  // and skips findLatestVideo's keyword resolution. Cleared when the modal
  // closes, or when a non-library open (voice "show me a rotator cuff
  // video") sets a fresh procedure.
  const [howToVideoId, setHowToVideoId] = useState<string | undefined>(undefined);
  const [howToInitialPapersOpen, setHowToInitialPapersOpen] = useState(false);
  const [howToInitialPaperQuery, setHowToInitialPaperQuery] = useState<string | undefined>(
    undefined,
  );
  const videoModalRef = useRef<HowToVideoHandle>(null);

  // ── Image lightbox (preference card / table layout / case-specific) ─────
  // Lifted to the route so voice tools work from any screen — surgeons can
  // ask for preference-card images on the next case from home / cases /
  // schedule, not just preop.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxTitle, setLightboxTitle] = useState<string>("Surgical Setup");
  const lightboxRef = useRef<LightboxHandle>(null);

  const openLightbox = useCallback((images: LightboxImage[], index = 0, title?: string) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    if (title) setLightboxTitle(title);
    setLightboxOpen(true);
  }, []);

  // ── Reminders ────────────────────────────────────────────────────────────
  // Pending reminders are scheduled one-shot via setTimeout. When a reminder
  // fires we (1) move it to firedReminders so the toast component renders
  // it, and (2) ask v.speak() to announce it. Toast auto-dismisses after
  // 30 s or on tap. State is in-memory only — not persisted.
  interface PendingReminder {
    id: string;
    text: string;
    dueAt: number;
  }
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [firedReminders, setFiredReminders] = useState<FiredReminder[]>([]);
  const reminderTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const staff = { name: "Melissa Quinn", role: "Circulating Nurse", initials: "MQ" };

  // ── Idle-sleep timer ─────────────────────────────────────────────────────
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const v = useArtiVoiceContext();

  // Ref mirror of pendingReminders so armIdleTimer can read the live list
  // without re-creating the callback on every reminder change.
  const pendingRemindersRef = useRef<PendingReminder[]>([]);
  pendingRemindersRef.current = pendingReminders;

  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(async () => {
      if (!v) return;
      // Don't nap while the user is waiting on a pending reminder — silence
      // here is expected (they're waiting for Arti to fire). Re-arm instead
      // so we'll re-check in another minute; once the reminder fires the
      // list will empty and normal nap behavior resumes.
      if (pendingRemindersRef.current.length > 0) {
        idleResetRef.current();
        return;
      }
      await v.speak("I haven't heard from you in almost a minute, I'm going to take a nap.");
      artiNapSetterRef.current(true);
      v.stopListening();
    }, 60_000);
  }, [v, artiNapSetterRef, idleResetRef]);

  // Expose armIdleTimer through the ref so stableCallbacks can reset on user activity.
  idleResetRef.current = armIdleTimer;

  // Arm the timer whenever Arti is awake and not napping; clear it otherwise.
  useEffect(() => {
    if (phase === "sleep" || artiNapping) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    armIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [phase, artiNapping, armIdleTimer]);

  const vForSleepRef = useRef(v);
  vForSleepRef.current = v;
  // Stop mic ONLY on the initial sleep phase (app startup, before the user
  // has interacted). On subsequent returns to sleep — e.g. journey auto-exit,
  // idle timeout, manual "go to sleep" — leave the mic live so the user can
  // wake Arti by voice without having to walk up and tap the orb. This is
  // an OR wall-display, not a phone: the user's hands are usually busy.
  const userHasEngagedRef = useRef(false);
  useEffect(() => {
    if (phase === "sleep" && !userHasEngagedRef.current) {
      vForSleepRef.current?.stopListening();
    }
    if (phase !== "sleep") userHasEngagedRef.current = true;
  }, [phase]);
  // Auto-start mic and open session window whenever navigating to an active screen,
  // AND recover if the mic dies mid-session (e.g. SpeechRecognition restart error).
  // startListening() is idempotent — safe to call when already running.
  // Once the user has engaged once, also keep the mic live on sleep so they
  // can wake Arti by voice.
  const isListening = v?.listening ?? false;
  useEffect(() => {
    if (phase === "waking" || artiNapping) return;
    if (phase === "sleep" && !userHasEngagedRef.current) return;
    // JourneyScreen owns the mic during phase === "journey": it must be
    // OFF during narration (Arti's own audio bleeds back through the mic
    // and self-triggers commands) and ON during pause. Skipping here
    // prevents this auto-start fight with the journey screen.
    if (phase === "journey") return;
    vForSleepRef.current?.startListening();
    if (phase !== "sleep") vForSleepRef.current?.activateSession();
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
    schedule: "schedule / calendar",
    surgeons: "surgeons directory",
    patients: "patients today",
    consoles: "OR equipment tower / consoles",
    library: "video library",
    journey: "how-it-was-built journey",
  };

  // Keep contextRef current so Claude always gets a fresh state snapshot.
  contextRef.current = () => {
    const board = TODAY_CASES.map(
      (c) =>
        `  - ${c.patientName} · ${c.procedure} (${c.procedureShort}) · ${c.status}${c.side ? ` · ${c.side} side` : ""} · ${c.surgeon} · ${c.time}`,
    ).join("\n");

    const now = new Date();
    const h = now.getHours();
    const timeGreeting =
      h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    // Look up the team for the active case from the schedule (same id). If
    // it isn't on the schedule, fall back so the preop view still has a
    // team Arti can reference. The full schedule itself lives in the server's
    // cached system prompt — we don't resend it per turn.
    const activeScheduleEntry = SCHEDULE_CASES.find((c) => c.id === activeCase.id);

    // Patient basics — always available regardless of which screen is open,
    // so "what's her blood type?" works from home / cases / schedule, not
    // just preop. The full chart (meds, labs, consents, airway, steps) is
    // still added by the dashboard context when on preop.
    const activeClinical = PATIENT_CLINICAL[activeCase.id];
    const activeAllergiesLine = activeClinical
      ? activeClinical.allergies.length
        ? activeClinical.allergies.map((a) => `${a.agent} (${a.severity})`).join(", ")
        : "NKDA"
      : "unknown";

    const lines = [
      `Staff: ${staff.name}, ${staff.role}`,
      `Current time: ${timeStr} — use "${timeGreeting}" for any greeting`,
      `Today is ${formatLongDate(toDateKey(now))} (${toDateKey(now)})`,
      `Current screen: ${PHASE_LABEL[phase]}`,
      // Emphasized active-case marker so Haiku anchors on the latest
      // loaded case rather than drifting to a stale name from history.
      `>>> ACTIVE CASE (use this name): ${activeCase.patientName} · ${activeCase.procedure}${activeCase.side ? ` (${activeCase.side})` : ""} · MRN ${activeCase.patientMrn} · ${activeCase.time} · OR ${activeCase.room} · ${activeCase.status}`,
      activeScheduleEntry
        ? `Active case team — Surgeon: ${activeScheduleEntry.surgeon} · Anesthesiologist: ${activeScheduleEntry.anesthesiologist} · Scrub Tech: ${activeScheduleEntry.scrubTech} · Circulator: ${activeScheduleEntry.circulator} · Anesthesia type: ${activeScheduleEntry.anesthesiaType} · ASA ${activeScheduleEntry.asaClass}`
        : `Active case team — Surgeon: ${activeCase.surgeon} (team not on schedule)`,
      // Patient basics — full detail only on preop where the chart is
      // visible and clinical questions are common; lean elsewhere.
      activeClinical
        ? phase === "preop"
          ? `Active case patient basics — Blood type: ${activeClinical.bloodType} · DOB: ${activeClinical.dob} · Sex: ${activeClinical.sex} · Height: ${activeClinical.height} · Weight: ${activeClinical.weight} · BMI: ${activeClinical.bmi} · NPO: ${activeClinical.npo} · Allergies: ${activeAllergiesLine}`
          : `Active case patient basics — Blood type: ${activeClinical.bloodType} · NPO: ${activeClinical.npo} · Allergies: ${activeAllergiesLine}`
        : `Active case patient basics — chart not available`,
      `Today's board:\n${board}`,
      pendingReminders.length
        ? `Pending reminders (${pendingReminders.length}):\n${pendingReminders
            .map((r) => {
              const minsLeft = Math.max(0, Math.round((r.dueAt - Date.now()) / 60_000));
              return `  - "${r.text}" in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}`;
            })
            .join("\n")}`
        : `Pending reminders: none`,
      firedReminders.length
        ? `Reminder alert showing (${firedReminders.length}): ${firedReminders
            .map((r) => `"${r.text}"`)
            .join(
              ", ",
            )} — "close alert" / "dismiss" / "got it" → dismiss_reminder_alert (highest close precedence)`
        : `Reminder alerts: none visible`,
      personSchedule.open
        ? `Person schedule modal: OPEN — viewing ${personSchedule.role} ${personSchedule.name} (${personSchedule.view} view). "switch to [name]" → show_person_schedule. "show me her week/month/today" → set_person_schedule_view. "close" → close_person_schedule.`
        : `Person schedule modal: closed`,
      // One-line topmost-overlay hint for close_topmost_modal disambiguation.
      (() => {
        const which =
          firedReminders.length > 0
            ? "reminder toast"
            : personSchedule.open
              ? "person schedule modal"
              : howToOpen
                ? "how-to video modal"
                : lightboxOpen
                  ? "image lightbox"
                  : selectedScheduleDate && phase === "schedule"
                    ? "schedule day drawer"
                    : null;
        return which
          ? `TOPMOST: ${which} — generic 'close' → close_topmost_modal.`
          : `TOPMOST: none route-level (check dashboard block for patient details / quad view).`;
      })(),
      // Journey-mode hint — when on the journey screen, pause/next/exit
      // route to journey_* tools, NOT video_pause / open_case / etc.
      phase === "journey"
        ? `JOURNEY MODE — narration walkthrough is active${journeyPaused ? " (PAUSED)" : ""}. Voice routing on this screen: 'pause'/'stop'/'arti pause' → journey_pause · 'resume'/'continue'/'play' → journey_resume · 'next'/'skip' → journey_next · 'previous'/'back' → journey_previous · 'exit'/'I'm done'/'back to sleep' → exit_journey. Do NOT call video_pause / open_case / library_* on this screen — those don't apply to the journey.`
        : "",
      (() => {
        if (!howToOpen) return `How-to video modal: closed`;
        const status = videoModalRef.current?.getStatus();
        if (!status) return `How-to video modal: OPEN`;
        const fmt = (s: number) => {
          const m = Math.floor(s / 60);
          const sec = Math.floor(s % 60);
          return `${m}:${sec.toString().padStart(2, "0")}`;
        };
        const chapterLine =
          status.currentChapterIndex !== null
            ? `chapter ${status.currentChapterIndex + 1}/${status.chapters.length} "${status.chapters[status.currentChapterIndex].title}"`
            : "no active chapter";
        const papersList = status.papers
          .map((p, i) => `${i + 1}=${p.title.slice(0, 60)} (${p.journal} ${p.year})`)
          .join("; ");
        return [
          `How-to video modal: OPEN — "${status.videoTitle}" (${status.procedure}, ${status.surgeon}, ${status.publishedYear})`,
          `  Playback: ${status.playing ? "playing" : "paused"} at ${fmt(status.currentSec)}/${fmt(status.durationSec)} · ${chapterLine} · ${status.speed}× speed`,
          `  Chapters: ${status.chapters.map((c, i) => `${i + 1}=${c.title}`).join(" · ")}`,
          `  Research panel: ${status.papersPanelOpen ? "OPEN" : "closed"}${status.activePaper ? ` · viewing paper "${status.activePaper.title}"` : ""}`,
          `  Available papers: ${papersList || "none"}`,
          `  Voice tools: video_play, video_pause, video_seek, video_next_chapter, video_prev_chapter, video_restart, video_set_speed, video_show_papers, video_hide_papers, video_open_paper, video_close_paper, close_how_to_video`,
        ].join("\n");
      })(),
      lightboxOpen
        ? `Image lightbox: OPEN — "${lightboxTitle}" (${lightboxIndex + 1} of ${lightboxImages.length}). "next image" / "previous image" / "zoom in" / "zoom out" / "close" are valid commands.`
        : `Image lightbox: closed`,
      // OR equipment tower status — always included so Arti can answer
      // "is the fluid pump connected?" / "what's the camera console doing?"
      // from any screen. Detailed telemetry only when the user is
      // actually on the consoles screen — otherwise lean one-liners to
      // keep the live context (and Claude turn-1 latency) tight.
      summarizeConsoles(focusedConsoleId, { verbose: phase === "consoles" }),
      // Library filter state + the actual filtered result list. The result
      // list is the key piece — when the user says "open it" / "play that
      // one" / "open the video", Claude reads this block, sees there's a
      // single matching video, and passes its `id` to open_how_to_video.
      // No more keyword-resolution gambling on terse deictic references.
      phase === "library"
        ? (() => {
            const filtered = filterLibrary({
              search: librarySearch,
              category: libraryCategory,
              animatedOnly: libraryAnimatedOnly,
            });
            const head = `Video Library filters — search: ${librarySearch ? `"${librarySearch}"` : "(none)"} · category: ${libraryCategory} · animated only: ${libraryAnimatedOnly ? "on" : "off"}`;
            const list =
              filtered.length === 0
                ? "  (no videos match — broaden the filters)"
                : filtered
                    .slice(0, 12)
                    .map(
                      (v, i) =>
                        `  ${i + 1}. id="${v.id}" · "${v.title}" · ${v.category} · ${v.publishedYear} · procedure="${v.procedure}"`,
                    )
                    .join("\n");
            const guidance =
              filtered.length === 1
                ? `\n  → ONLY ONE video shown. If user says "open it" / "play it" / "open the video" / "show me that" — call open_how_to_video with id="${filtered[0].id}".`
                : filtered.length > 1
                  ? `\n  → ${filtered.length} videos shown. If user says "open it" / "play that" without naming one, ask which (or pick #1 if their tone is decisive).`
                  : "";
            return `${head}\nFiltered library (${filtered.length} of ${PROCEDURE_VIDEOS.length} match):\n${list}${guidance}`;
          })()
        : "",
      phase === "consoles" && focusedConsoleId
        ? `Focused console on tower: ${focusedConsoleId}. Telemetry detail panel is showing.`
        : "",
    ];

    // Schedule filter state — always included so Arti knows the current
    // filters and can compute additive changes like "also show spine".
    lines.push(
      `Schedule filters — Service lines: ${
        activeScheduleLines.size === ALL_SERVICE_LINES.length
          ? "All"
          : [...activeScheduleLines].join(", ") || "None"
      } · Surgeon: ${scheduleSurgeonFilter === "all" ? "All" : scheduleSurgeonFilter}`,
    );

    // Schedule-specific context (only relevant when on the schedule screen).
    if (phase === "schedule") {
      if (selectedScheduleDate) {
        const dayCases = getCasesForDate(selectedScheduleDate);
        const sum = summarizeDay(selectedScheduleDate);
        lines.push(
          `Schedule day detail open: ${formatLongDate(selectedScheduleDate)} (${selectedScheduleDate}) — ${sum.total} cases`,
          dayCases.length
            ? `Cases on ${selectedScheduleDate} (with full team):\n${dayCases
                .map(
                  (c) =>
                    `  - ${c.time} ${c.room} · ${c.patientName} (${c.patientAgeSex}) · ${c.procedureShort}${c.side ? ` ${c.side}` : ""} · Surgeon: ${c.surgeon} · Anesthesiologist: ${c.anesthesiologist} · Scrub Tech: ${c.scrubTech} · Circulator: ${c.circulator} · ${c.anesthesiaType} · ASA ${c.asaClass} · ${c.status}`,
                )
                .join("\n")}`
            : "No cases scheduled.",
        );
      } else {
        lines.push(
          "Schedule screen open. No day selected. Say 'show me [date]' to open a day detail.",
        );
      }
    }

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

  /**
   * Resolve a free-text case query, matching how OR staff actually speak:
   *
   *   • "next" / "next case" / "next one" / "next up" / "what's next"
   *     → the case with status="next" (the upcoming surgical case).
   *     Surgeons mean "the next one in the room" — independent of which
   *     case they're currently viewing on the wall.
   *   • "after [name]" / "case after this" / "the one after that"
   *     → SEQUENTIAL forward from the active case in TODAY_CASES order.
   *   • "previous" / "prior" / "last" / "before"
   *     → SEQUENTIAL backward from the active case.
   *   • "first" / "first case" → first row in TODAY_CASES.
   *   • Otherwise: patient name / procedure short fallback.
   */
  const findCase = useCallback((q: string, activeCaseId?: string): CaseItem | undefined => {
    const text = q.toLowerCase();

    // Sequential forward — explicit "after" keyword required so plain
    // "next case" doesn't accidentally walk past the upcoming case.
    if (activeCaseId && /\bafter\b/.test(text)) {
      const idx = TODAY_CASES.findIndex((c) => c.id === activeCaseId);
      if (idx >= 0 && idx < TODAY_CASES.length - 1) return TODAY_CASES[idx + 1];
    }

    // Sequential backward.
    if (activeCaseId && /\b(?:previous|prior|last|before)\b/.test(text)) {
      const idx = TODAY_CASES.findIndex((c) => c.id === activeCaseId);
      if (idx > 0) return TODAY_CASES[idx - 1];
    }

    // First case in the schedule.
    if (/\bfirst\b/.test(text)) return TODAY_CASES[0];

    // "next" without "after" → upcoming-status case. Common-room phrasing.
    if (/\bnext\b/.test(text)) {
      return TODAY_CASES.find((c) => c.status === "next") ?? undefined;
    }

    // Patient name / procedure short fallback.
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
   * Close every route-level overlay before navigating somewhere new.
   *
   * Why: the lightbox / how-to video / person-schedule modal all live in
   * the route's stacking order ABOVE the screen. If the user navigates
   * (sidebar tap or voice) without closing the modal first, the modal
   * keeps rendering on top of the new screen — and the live context
   * still says "lightbox: OPEN", which makes Haiku refuse follow-up
   * commands that don't match the modal's tool surface ("filter by
   * knee" vs "next image"). Closing on every nav keeps state in sync
   * with what the user perceives.
   *
   * NOT called from the modal-OPENING handlers
   * (handleShowPreferenceCardLayoutImages, handleOpenLibraryVideo,
   * handleOpenHowToVideo, handleShowPersonSchedule) — those need the
   * overlay state to STAY true after they navigate.
   */
  const closeOverlays = useCallback(() => {
    setLightboxOpen(false);
    setHowToOpen(false);
    setPersonSchedule((prev) => (prev.open ? { ...prev, open: false } : prev));
  }, []);

  // Shared sidebar click handler — used by every screen that renders <Sidebar>.
  const handleSidebarNavigate = useCallback(
    (
      key:
        | "home"
        | "case"
        | "schedule"
        | "surgeons"
        | "patients"
        | "consoles"
        | "library"
        | "preferences",
    ) => {
      armIdleTimer();
      closeOverlays();
      switch (key) {
        case "home":
          setPhase("home");
          break;
        case "case":
          setPhase("cases");
          break;
        case "schedule":
          setSelectedScheduleDate(null);
          setPhase("schedule");
          break;
        case "surgeons":
          setPhase("surgeons");
          break;
        case "patients":
          setPhase("patients");
          break;
        case "consoles":
          setPhase("consoles");
          break;
        case "library":
          setPhase("library");
          break;
        case "preferences":
          // not yet implemented — ignore
          break;
      }
    },
    [armIdleTimer, closeOverlays],
  );

  const handleSetReminder = useCallback((text: string, minutes: number) => {
    if (!text || !Number.isFinite(minutes) || minutes <= 0) return;
    const id = `rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dueAt = Date.now() + minutes * 60_000;
    setPendingReminders((prev) => [...prev, { id, text, dueAt }]);
    const timer = setTimeout(() => {
      reminderTimersRef.current.delete(id);
      setPendingReminders((prev) => prev.filter((r) => r.id !== id));
      setFiredReminders((prev) => [...prev, { id, text, firedAt: Date.now() }]);
      void vForSleepRef.current?.speak(`Reminder — ${text}`);
    }, minutes * 60_000);
    reminderTimersRef.current.set(id, timer);
  }, []);

  const handleCancelReminders = useCallback(() => {
    for (const t of reminderTimersRef.current.values()) clearTimeout(t);
    reminderTimersRef.current.clear();
    setPendingReminders([]);
  }, []);

  const handleDismissFiredReminder = useCallback((id: string) => {
    setFiredReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleDismissAllFiredReminders = useCallback(() => {
    setFiredReminders([]);
  }, []);

  const handleScheduleSetServiceLines = useCallback((lines: string[]) => {
    const valid = lines.filter((l): l is ServiceLine =>
      (ALL_SERVICE_LINES as string[]).includes(l),
    );
    setActiveScheduleLines(new Set(valid));
  }, []);

  const handleScheduleSetSurgeon = useCallback((surgeon: string) => {
    const trimmed = surgeon.trim();
    setScheduleSurgeonFilter(trimmed ? trimmed : "all");
  }, []);

  const handleScheduleClearFilters = useCallback(() => {
    setActiveScheduleLines(new Set(ALL_SERVICE_LINES));
    setScheduleSurgeonFilter("all");
  }, []);

  const isPersonRole = (s: string): s is PersonRole =>
    s === "Surgeon" || s === "Anesthesiologist" || s === "Scrub Tech" || s === "Circulator";
  const isPersonView = (s: string): s is PersonScheduleView =>
    s === "day" || s === "week" || s === "month";

  const handleShowPersonSchedule = useCallback((name: string, role: string) => {
    if (!name || !isPersonRole(role)) return;
    setPersonSchedule((prev) => ({
      open: true,
      name,
      role,
      // Preserve current view if a modal is already open (the user is just
      // switching person); reset to "day" when opening fresh.
      view: prev.open ? prev.view : "day",
    }));
  }, []);

  const handleSetPersonScheduleView = useCallback((view: string) => {
    if (!isPersonView(view)) return;
    setPersonSchedule((prev) => (prev.open ? { ...prev, view } : prev));
  }, []);

  const handleClosePersonSchedule = useCallback(() => {
    setPersonSchedule((prev) => ({ ...prev, open: false }));
  }, []);

  // Click a surgeon card → open the PersonScheduleModal pre-filtered to them.
  const handleOpenSurgeonSchedule = useCallback(
    (name: string) => {
      handleShowPersonSchedule(name, "Surgeon");
    },
    [handleShowPersonSchedule],
  );

  // Clean up any pending timers on unmount.
  useEffect(() => {
    const map = reminderTimersRef.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const handleOpenCaseFromSchedule = useCallback(
    (caseId: string, query: string) => {
      // Prefer a direct ID match against TODAY_CASES; fall back to fuzzy match
      // (same logic as the voice onOpenCase callback) so Schedule cases from
      // other days still route sensibly through the case-list screen.
      const byId = TODAY_CASES.find((c) => c.id === caseId);
      if (byId) {
        setActiveCase(byId);
        setPhase("preop");
        return;
      }
      const match = findCase(query);
      if (match) {
        setActiveCase(match);
        setPhase("preop");
      } else {
        setPhase("cases");
      }
    },
    [findCase],
  );

  // ── How-to video voice handlers ──────────────────────────────────────────
  // Defined inline (no useCallback needed — the navCallbacksRef rebinds every
  // render, which is the same pattern used by the schedule / reminder
  // handlers above).
  const handleOpenHowToVideo = (
    procedure?: string,
    title?: string,
    id?: string,
  ): ArtiToolResult => {
    // Priority: id > procedure > title. id skips findLatestVideo entirely
    // so when Claude reads a "Filtered library" block in live context,
    // "open it" / "play it" lands on the exact filtered video.
    if (id) {
      // Validate the id exists. Bad ids (model hallucinated) fall through to
      // procedure / title resolution rather than opening the wrong video.
      const exists = PROCEDURE_VIDEOS.some((v) => v.id === id);
      if (exists) {
        setHowToVideoId(id);
        setHowToProcedure(undefined);
      } else {
        setHowToVideoId(undefined);
        setHowToProcedure(procedure ?? title);
      }
    } else {
      setHowToVideoId(undefined);
      setHowToProcedure(procedure ?? title);
    }
    setHowToInitialPapersOpen(false);
    setHowToInitialPaperQuery(undefined);
    setHowToOpen(true);
    return { ok: true };
  };
  const handleOpenResearchPapers = (procedure?: string, topic?: string): ArtiToolResult => {
    setHowToVideoId(undefined);
    setHowToProcedure(procedure);
    setHowToInitialPapersOpen(true);
    setHowToInitialPaperQuery(topic);
    setHowToOpen(true);
    return { ok: true };
  };
  /** Library card click — open that exact video, no keyword resolution. */
  const handleOpenLibraryVideo = (videoId: string) => {
    setHowToVideoId(videoId);
    setHowToProcedure(undefined);
    setHowToInitialPapersOpen(false);
    setHowToInitialPaperQuery(undefined);
    setHowToOpen(true);
  };
  const requireVideoOpen = (): ArtiToolResult | null =>
    howToOpen ? null : { ok: false, reason: "video modal not open" };
  const handleVideoPlay = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.play();
    return { ok: true };
  };
  const handleVideoPause = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.pause();
    return { ok: true };
  };
  const handleVideoSeek = (direction: "forward" | "back", seconds: number): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    const sec = Number.isFinite(seconds) && seconds > 0 ? seconds : 10;
    videoModalRef.current?.seekRelative(direction === "back" ? -sec : sec);
    return { ok: true };
  };
  const handleVideoNextChapter = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.nextChapter();
    return { ok: true };
  };
  const handleVideoPrevChapter = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.prevChapter();
    return { ok: true };
  };
  const handleVideoRestart = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.restart();
    return { ok: true };
  };
  const handleVideoSetSpeed = (rate: number): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    if (!Number.isFinite(rate) || rate <= 0) return { ok: false, reason: "invalid speed" };
    videoModalRef.current?.setSpeed(rate);
    return { ok: true };
  };
  const handleVideoShowPapers = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.showPapers();
    return { ok: true };
  };
  const handleVideoHidePapers = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.hidePapers();
    return { ok: true };
  };
  const handleVideoOpenPaper = (q: { index?: number; keyword?: string }): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    const ok = videoModalRef.current?.openPaper(q) ?? false;
    return ok ? { ok: true } : { ok: false, reason: "paper not found" };
  };
  const handleVideoClosePaper = (): ArtiToolResult => {
    const guard = requireVideoOpen();
    if (guard) return guard;
    videoModalRef.current?.closePaper();
    return { ok: true };
  };
  const handleCloseHowToVideo = (): ArtiToolResult => {
    setHowToOpen(false);
    return { ok: true };
  };

  // ── Image lightbox handlers ──────────────────────────────────────────────
  const handleShowPreferenceCardLayoutImages = (
    caseQuery?: string,
    procedure?: string,
  ): ArtiToolResult => {
    // Resolve which case the user means: explicit query → next case → active.
    const query = (caseQuery ?? procedure ?? "").trim();
    const match = query ? findCase(query) : undefined;
    if (match) {
      setActiveCase(match);
      setPhase("preop");
    } else if (phase !== "preop") {
      // No specific case asked for and we're not on preop — load the active
      // case's preop screen so the wall reflects the case being shown.
      setPhase("preop");
    }
    openLightbox(PREF_CARD_IMAGES, 0, "Preference card");
    return { ok: true };
  };

  const handleOpenTableLayoutImages = (): ArtiToolResult => {
    openLightbox(SCRUB_LIGHTBOX_IMAGES, 0, "Table layout");
    return { ok: true };
  };

  const requireLightboxOpen = (): ArtiToolResult | null =>
    lightboxOpen ? null : { ok: false, reason: "lightbox not open" };
  const handleLightboxNext = (): ArtiToolResult => {
    const guard = requireLightboxOpen();
    if (guard) return guard;
    lightboxRef.current?.scrollNext();
    return { ok: true };
  };
  const handleLightboxPrev = (): ArtiToolResult => {
    const guard = requireLightboxOpen();
    if (guard) return guard;
    lightboxRef.current?.scrollPrev();
    return { ok: true };
  };
  const handleLightboxZoomIn = (): ArtiToolResult => {
    const guard = requireLightboxOpen();
    if (guard) return guard;
    lightboxRef.current?.zoomIn();
    return { ok: true };
  };
  const handleLightboxZoomOut = (): ArtiToolResult => {
    const guard = requireLightboxOpen();
    if (guard) return guard;
    lightboxRef.current?.zoomOut();
    return { ok: true };
  };
  const handleCloseLightbox = (): ArtiToolResult => {
    setLightboxOpen(false);
    return { ok: true };
  };

  /**
   * Voice nav callbacks. Dashboard-only tools are registered in the bridge
   * by AwakeDashboard itself — those don't need to live here.
   */
  navCallbacksRef.current = {
    onWake: () => {
      setPhase((p) => (p === "sleep" ? "waking" : p));
    },
    onGoHome: () => {
      closeOverlays();
      setPhase("home");
    },
    onShowCases: () => {
      closeOverlays();
      setPhase("cases");
    },
    onOpenCase: (query: string) => {
      closeOverlays();
      // Pass active case id so "next" / "previous" walk TODAY_CASES order
      // relative to the loaded case rather than always returning the
      // status="next" entry.
      const match = findCase(query, activeCase.id);
      if (match) {
        setActiveCase(match);
        setPhase("preop");
      } else {
        setPhase("cases");
      }
    },
    onSleep: () => {
      artiNapSetterRef.current(true);
      vForSleepRef.current?.stopListening();
    },
    onShowSchedule: () => {
      closeOverlays();
      setSelectedScheduleDate(null);
      setPhase("schedule");
    },
    onShowSurgeons: () => {
      closeOverlays();
      setPhase("surgeons");
    },
    onShowPatients: () => {
      closeOverlays();
      setPhase("patients");
    },
    onShowConsoles: () => {
      // Clear any prior focus when entering the screen so it picks up the
      // current ACTIVE device by default (matches ConsolesScreen behavior).
      closeOverlays();
      setFocusedConsoleId(null);
      setPhase("consoles");
    },
    onFocusConsole: (id: string) => {
      // Voice may pass the canonical id directly (e.g. "pump") or a free-text
      // synonym; resolve via findConsole. If it's already on the consoles
      // screen we don't change phase; otherwise we navigate there too.
      const direct = (CONSOLES.find((c) => c.id === id)?.id ?? null) as ConsoleId | null;
      const match = direct ?? findConsole(id)?.id ?? null;
      if (!match) return;
      closeOverlays();
      setFocusedConsoleId(match);
      setPhase("consoles");
    },
    onShowLibrary: () => {
      closeOverlays();
      setPhase("library");
    },
    /**
     * Universal close — picks the topmost overlay and closes it. Priority
     * order top→bottom (matches what the user perceives as "the thing in
     * front"):
     *   1. Reminder toast (highest z, smallest viewport footprint)
     *   2. Person schedule modal (z-81)
     *   3. How-to video modal (z-50)
     *   4. Image lightbox (z-50)
     *   5. Schedule day drawer (when on schedule screen)
     *   6. Dashboard-scoped (x-rays > patient video > patient details > quad view) — delegated
     * No-op when nothing is open. Voice tool description tells Claude to
     * prefer this over the specific close_* tools for generic "close".
     */
    onCloseTopmostModal: () => {
      if (firedReminders.length > 0) {
        setFiredReminders([]);
        return;
      }
      if (personSchedule.open) {
        setPersonSchedule((prev) => ({ ...prev, open: false }));
        return;
      }
      if (howToOpen) {
        setHowToOpen(false);
        return;
      }
      if (lightboxOpen) {
        setLightboxOpen(false);
        return;
      }
      if (selectedScheduleDate && phase === "schedule") {
        setSelectedScheduleDate(null);
        return;
      }
      // Dashboard overlays last — patient details / quad view.
      const closed = dashboardActionsRef.current?.closeTopmostDashboardOverlay();
      if (closed) return;
      // Nothing was open — silent no-op (the tool description tells
      // Claude to never refuse a 'close' command, so just absorb it).
    },
    onLibraryFilterCategory: (c: string) => {
      // Coerce to a valid category, defaulting to "All" for unknown input.
      const valid: Array<VideoCategory | "All"> = [
        "All",
        "Shoulder",
        "Knee",
        "Hip",
        "Foot/Ankle",
        "Hand/Wrist",
      ];
      const next = (valid as string[]).includes(c) ? (c as VideoCategory | "All") : "All";
      closeOverlays();
      setLibraryCategory(next);
      setPhase("library");
    },
    onLibrarySearch: (q: string) => {
      closeOverlays();
      setLibrarySearch(q);
      setPhase("library");
    },
    onLibrarySetAnimatedOnly: (enabled: boolean) => {
      closeOverlays();
      setLibraryAnimatedOnly(enabled);
      setPhase("library");
    },
    onLibraryClearFilters: () => {
      closeOverlays();
      setLibrarySearch("");
      setLibraryCategory("All");
      setLibraryAnimatedOnly(false);
    },
    // ── Journey walkthrough ──────────────────────────────────────────
    onStartJourney: () => {
      // Cancel any audio still playing from prior turns so it can't bleed
      // into the journey's first stage.
      vForSleepRef.current?.stopSpeaking();
      // Block SR + mark speaking BEFORE the fetch starts. Without this, the
      // ~400-500ms primer-fetch window leaves the mic open; speakers' echo
      // of stage-0 narration gets transcribed and Claude fires journey_pause
      // mid-sentence. See useArtiVoice.prepareToSpeak.
      vForSleepRef.current?.prepareToSpeak?.();
      closeOverlays();
      setJourneyPaused(false);
      setJourneyStartKey((k) => k + 1); // tells screen to reset to stage 0
      setJourneyStageDelta(0);
      // Pre-fetch the stage-0 narration audio NOW (before phase change /
      // screen mount). By the time JourneyScreen mounts and reads the
      // primer prop, the ElevenLabs round-trip is mostly complete — the
      // first audible word lands inside the 1-second target.
      setJourneyPrimer(speakText({ data: { text: JOURNEY[0].narration } }));
      setPhase("journey");
    },
    onExitJourney: () => {
      // Stop any narration and return to sleep — feels like the user is
      // walking away from a presentation.
      vForSleepRef.current?.stopSpeaking();
      setJourneyPaused(false);
      setPhase("sleep");
    },
    onJourneyPause: () => setJourneyPaused(true),
    onJourneyResume: () => setJourneyPaused(false),
    onJourneyNext: () => setJourneyStageDelta((d) => d + 1),
    onJourneyPrevious: () => setJourneyStageDelta((d) => d - 1),
    onShowScheduleDay: (date: string) => {
      if (!date) return;
      closeOverlays();
      setSelectedScheduleDate(date);
      setPhase("schedule");
    },
    onCloseScheduleDay: () => {
      // Only close the drawer — don't change the phase.
      setSelectedScheduleDate(null);
    },
    onSetReminder: handleSetReminder,
    onCancelReminders: handleCancelReminders,
    onDismissReminderAlert: handleDismissAllFiredReminders,
    onScheduleSetServiceLines: handleScheduleSetServiceLines,
    onScheduleSetSurgeon: handleScheduleSetSurgeon,
    onScheduleClearFilters: handleScheduleClearFilters,
    onShowPersonSchedule: handleShowPersonSchedule,
    onSetPersonScheduleView: handleSetPersonScheduleView,
    onClosePersonSchedule: handleClosePersonSchedule,
    onOpenHowToVideo: handleOpenHowToVideo,
    onOpenResearchPapers: handleOpenResearchPapers,
    onVideoPlay: handleVideoPlay,
    onVideoPause: handleVideoPause,
    onVideoSeek: handleVideoSeek,
    onVideoNextChapter: handleVideoNextChapter,
    onVideoPrevChapter: handleVideoPrevChapter,
    onVideoRestart: handleVideoRestart,
    onVideoSetSpeed: handleVideoSetSpeed,
    onVideoShowPapers: handleVideoShowPapers,
    onVideoHidePapers: handleVideoHidePapers,
    onVideoOpenPaper: handleVideoOpenPaper,
    onVideoClosePaper: handleVideoClosePaper,
    onCloseHowToVideo: handleCloseHowToVideo,
    onShowPreferenceCardLayoutImages: handleShowPreferenceCardLayoutImages,
    onOpenTableLayoutImages: handleOpenTableLayoutImages,
    onLightboxNext: handleLightboxNext,
    onLightboxPrev: handleLightboxPrev,
    onLightboxZoomIn: handleLightboxZoomIn,
    onLightboxZoomOut: handleLightboxZoomOut,
    onCloseLightbox: handleCloseLightbox,
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
        onSidebarNavigate={handleSidebarNavigate}
        onOpenLightbox={openLightbox}
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
        onSidebarNavigate={handleSidebarNavigate}
      />
    );
  } else if (phase === "patients") {
    screen = (
      <PatientsScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
      />
    );
  } else if (phase === "consoles") {
    screen = (
      <ConsolesScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        focusedId={focusedConsoleId}
        onFocusChange={setFocusedConsoleId}
      />
    );
  } else if (phase === "journey") {
    screen = (
      <JourneyScreen
        paused={journeyPaused}
        onPausedChange={setJourneyPaused}
        externalStageDelta={journeyStageDelta}
        startKey={journeyStartKey}
        primer={journeyPrimer}
        onPrompt={handlePrompt}
        onExit={handleExitJourney}
      />
    );
  } else if (phase === "library") {
    screen = (
      <VideoLibraryScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onOpenVideo={handleOpenLibraryVideo}
        search={librarySearch}
        onSearchChange={setLibrarySearch}
        category={libraryCategory}
        onCategoryChange={setLibraryCategory}
        animatedOnly={libraryAnimatedOnly}
        onAnimatedOnlyChange={setLibraryAnimatedOnly}
      />
    );
  } else if (phase === "surgeons") {
    screen = (
      <SurgeonsScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onOpenSurgeonSchedule={handleOpenSurgeonSchedule}
      />
    );
  } else if (phase === "schedule") {
    screen = (
      <ScheduleScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onBackHome={() => setPhase("home")}
        onPrompt={handlePrompt}
        selectedDate={selectedScheduleDate}
        onSelectDate={setSelectedScheduleDate}
        onOpenCase={handleOpenCaseFromSchedule}
        onSidebarNavigate={handleSidebarNavigate}
        activeLines={activeScheduleLines}
        onActiveLinesChange={setActiveScheduleLines}
        surgeonFilter={scheduleSurgeonFilter}
        onSurgeonFilterChange={setScheduleSurgeonFilter}
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
        onSidebarNavigate={handleSidebarNavigate}
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
      <ReminderToast reminders={firedReminders} onDismiss={handleDismissFiredReminder} />
      <PersonScheduleModal
        open={personSchedule.open}
        personName={personSchedule.name}
        personRole={personSchedule.role}
        view={personSchedule.view}
        onClose={handleClosePersonSchedule}
        onChangeView={handleSetPersonScheduleView}
        onOpenCase={handleOpenCaseFromSchedule}
      />
      <HowToVideoModal
        ref={videoModalRef}
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        procedure={howToProcedure}
        videoId={howToVideoId}
        initialPapersOpen={howToInitialPapersOpen}
        initialPaperQuery={howToInitialPaperQuery}
      />
      <ImageLightboxModal
        ref={lightboxRef}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={lightboxTitle}
      />
    </div>
  );
}
