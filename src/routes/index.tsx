import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { HomeDashboard } from "@/components/arti/HomeDashboard";
import { CaseListScreen } from "@/components/arti/CaseListScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";
import {
  IntraopDashboard,
  type IntraopActions,
  type IntraopActionsRef,
} from "@/components/arti/IntraopDashboard";
import { MultiViewScreen } from "@/components/arti/MultiViewScreen";
import { ScheduleScreen } from "@/components/arti/ScheduleScreen";
import { SurgeonsScreen } from "@/components/arti/SurgeonsScreen";
import { SurgeonProfileScreen } from "@/components/arti/SurgeonProfileScreen";
import { TimeOutModal } from "@/components/arti/TimeOutModal";
import { SettingsScreen } from "@/components/arti/SettingsScreen";
import { AdminSettingsScreen } from "@/components/arti/AdminSettingsScreen";
import { SmartSettingsScreen } from "@/components/arti/smart/SmartSettingsScreen";
import {
  DEVICES as SMART_DEVICES,
  type PropertySpec as SmartPropertySpec,
  type SmartDevice,
} from "@/components/arti/smart/devices";
import {
  loadDeviceState as loadSmartDeviceState,
  saveDeviceState as saveSmartDeviceState,
  resetAllDeviceStates as resetAllSmartDeviceStates,
} from "@/components/arti/smart/storage";
import { ResetAllConfirmModal } from "@/components/arti/smart/ResetAllConfirmModal";
import {
  SUPPLY_GROUPS as HOME_SUPPLY_GROUPS,
  OR_STATUS_GROUPS as HOME_OR_GROUPS,
  SEED_COMMS as HOME_COMMS,
  loadHomeTasks,
} from "@/components/arti/dashboard/homeWidgets";
import { PatientsScreen } from "@/components/arti/PatientsScreen";
import { ConsolesScreen } from "@/components/arti/ConsolesScreen";
import { VideoLibraryScreen } from "@/components/arti/VideoLibraryScreen";
import { JourneyScreen } from "@/components/arti/JourneyScreen";
import { ScreensaverScreen } from "@/components/arti/ScreensaverScreen";
import { LoginScreen } from "@/components/arti/LoginScreen";
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
  findLatestVideo,
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
import type {
  PersonRole,
  PersonScheduleView,
  PrefCardImage,
  Surgeon,
} from "@/components/arti/schedule";
import { TODAY_CASES, PATIENT_CLINICAL, type CaseItem } from "@/components/arti/cases";
import {
  getCasesForDate,
  formatLongDate,
  toDateKey,
  summarizeDay,
  SCHEDULE_CASES,
  SURGEONS,
  surgeonHasPrefCards,
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
 * Live mutators the Smart Settings screen exposes so voice tools can
 * reflect state changes in the UI immediately. When the screen is not
 * mounted, the route falls back to localStorage-only writes (Mock OR
 * preview won't update visibly until the user opens the screen).
 */
export interface SmartSettingsActions {
  /** Switch the focused device — must be a valid id from DEVICES. */
  selectDevice: (id: string) => void;
  /** Apply a property change so the screen + Mock OR preview re-render. */
  applyPropertyChange: (deviceId: string, key: string, value: boolean | number | string) => void;
  /** Reload every device's state from storage — called after bulk reset. */
  reloadAllStates: () => void;
}

export type SmartSettingsActionsRef = React.MutableRefObject<SmartSettingsActions | null>;

/**
 * Root that wires the shared voice session in once. We use refs to bridge
 * the agent's tool callbacks (registered up here in the provider) to the
 * actual state setters living inside the dashboard components — that way
 * the provider can be mounted before the inner components initialize, and
 * the agent always talks to the freshest closures.
 */
function ArtiWallRoot() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return <ArtiWallAuthenticated onLogout={() => setIsAuthenticated(false)} />;
}

function ArtiWallAuthenticated({ onLogout }: { onLogout: () => void }) {
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
      | "onShowSettings"
      | "onShowAdminSettings"
      | "onShowSmartSettings"
      | "onSelectSmartDevice"
      | "onSetSmartProperty"
      | "onToggleSmartDevice"
      | "onResetAllSmartDevices"
      | "onCloseTopmostModal"
      | "onLibraryFilterCategory"
      | "onLibrarySearch"
      | "onLibrarySetAnimatedOnly"
      | "onLibrarySetSavedOnly"
      | "onLibraryClearFilters"
      | "onShowSavedVideos"
      | "onSaveVideo"
      | "onUnsaveVideo"
      | "onToggleSaveVideo"
      | "onStartScreensaver"
      | "onExitScreensaver"
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
      | "onOpenSurgeonProfile"
      | "onExpandProcedure"
      | "onCollapseProcedure"
      | "onNextProcedure"
      | "onPreviousProcedure"
      | "onRenamePrefCardImage"
      | "onRemovePrefCardImage"
      | "onPromptPrefCardUpload"
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
      | "onStartCase"
      | "onEndCase"
      | "onShowMultiView"
      | "onCloseMultiView"
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
    onShowSettings: () => {},
    onShowAdminSettings: () => {},
    onShowSmartSettings: () => {},
    onSelectSmartDevice: () => notAvailable(),
    onSetSmartProperty: () => notAvailable(),
    onToggleSmartDevice: () => notAvailable(),
    onResetAllSmartDevices: () => notAvailable(),
    onCloseTopmostModal: () => {},
    onLibraryFilterCategory: () => {},
    onLibrarySearch: () => {},
    onLibrarySetAnimatedOnly: () => {},
    onLibraryClearFilters: () => {},
    onLibrarySetSavedOnly: () => {},
    onShowSavedVideos: () => {},
    onSaveVideo: () => ({ ok: false, reason: "no handler" }),
    onUnsaveVideo: () => ({ ok: false, reason: "no handler" }),
    onToggleSaveVideo: () => ({ ok: false, reason: "no handler" }),
    onStartScreensaver: () => {},
    onExitScreensaver: () => {},
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
    onOpenSurgeonProfile: () => notAvailable(),
    onExpandProcedure: () => notAvailable(),
    onCollapseProcedure: () => notAvailable(),
    onNextProcedure: () => notAvailable(),
    onPreviousProcedure: () => notAvailable(),
    onRenamePrefCardImage: () => notAvailable(),
    onRemovePrefCardImage: () => notAvailable(),
    onPromptPrefCardUpload: () => notAvailable(),
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
    onStartCase: () => notAvailable(),
    onEndCase: () => notAvailable(),
    onShowMultiView: () => notAvailable(),
    onCloseMultiView: () => notAvailable(),
  });

  // Dashboard-only tool bridge. `null` when no dashboard is mounted.
  const dashboardActionsRef = useRef<DashboardActions | null>(null);

  // Smart Settings ref-bridge — populated by SmartSettingsScreen on mount.
  // When the screen is open, voice device-change tools call into it so the
  // UI + Mock OR widget update instantly. When closed, the route falls
  // back to localStorage-only writes.
  const smartSettingsActionsRef = useRef<SmartSettingsActions | null>(null);

  // Intraop-only tool bridge. Populated while the IntraopDashboard is on screen.
  const intraopActionsRef = useRef<IntraopActions | null>(null);

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
      onShowSettings: () => navCallbacksRef.current.onShowSettings?.(),
      onShowAdminSettings: () => navCallbacksRef.current.onShowAdminSettings?.(),
      onShowSmartSettings: () => navCallbacksRef.current.onShowSmartSettings?.(),
      onSelectSmartDevice: (d) =>
        navCallbacksRef.current.onSelectSmartDevice?.(d) ?? notAvailable(),
      onSetSmartProperty: (d, p, v) =>
        navCallbacksRef.current.onSetSmartProperty?.(d, p, v) ?? notAvailable(),
      onToggleSmartDevice: (d, on, p) =>
        navCallbacksRef.current.onToggleSmartDevice?.(d, on, p) ?? notAvailable(),
      onResetAllSmartDevices: (c) =>
        navCallbacksRef.current.onResetAllSmartDevices?.(c) ?? notAvailable(),
      onCloseTopmostModal: () => navCallbacksRef.current.onCloseTopmostModal?.(),
      onLibraryFilterCategory: (c) => navCallbacksRef.current.onLibraryFilterCategory?.(c),
      onLibrarySearch: (q) => navCallbacksRef.current.onLibrarySearch?.(q),
      onLibrarySetAnimatedOnly: (v) => navCallbacksRef.current.onLibrarySetAnimatedOnly?.(v),
      onLibraryClearFilters: () => navCallbacksRef.current.onLibraryClearFilters?.(),
      onLibrarySetSavedOnly: (v) => navCallbacksRef.current.onLibrarySetSavedOnly?.(v),
      onShowSavedVideos: () => navCallbacksRef.current.onShowSavedVideos?.(),
      onSaveVideo: (id, q) => navCallbacksRef.current.onSaveVideo?.(id, q) ?? notAvailable(),
      onUnsaveVideo: (id, q) => navCallbacksRef.current.onUnsaveVideo?.(id, q) ?? notAvailable(),
      onToggleSaveVideo: (id, q) =>
        navCallbacksRef.current.onToggleSaveVideo?.(id, q) ?? notAvailable(),
      onStartScreensaver: () => navCallbacksRef.current.onStartScreensaver?.(),
      onExitScreensaver: () => navCallbacksRef.current.onExitScreensaver?.(),
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
      onOpenSurgeonProfile: (s, p) =>
        navCallbacksRef.current.onOpenSurgeonProfile?.(s, p) ?? notAvailable(),
      onExpandProcedure: (p) => navCallbacksRef.current.onExpandProcedure?.(p) ?? notAvailable(),
      onCollapseProcedure: (p) =>
        navCallbacksRef.current.onCollapseProcedure?.(p) ?? notAvailable(),
      onNextProcedure: () => navCallbacksRef.current.onNextProcedure?.() ?? notAvailable(),
      onPreviousProcedure: () => navCallbacksRef.current.onPreviousProcedure?.() ?? notAvailable(),
      onRenamePrefCardImage: (img, label) =>
        navCallbacksRef.current.onRenamePrefCardImage?.(img, label) ?? notAvailable(),
      onRemovePrefCardImage: (img) =>
        navCallbacksRef.current.onRemovePrefCardImage?.(img) ?? notAvailable(),
      onPromptPrefCardUpload: (proc) =>
        navCallbacksRef.current.onPromptPrefCardUpload?.(proc) ?? notAvailable(),

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
      // Role switch is dual-bridged: pre-op uses dashboardActionsRef,
      // intraop uses intraopActionsRef. Whichever screen is mounted, the
      // call lands. Means the user can say "show me nurse view" on either
      // dashboard and the right thing happens regardless of which tool
      // name (switch_role vs intraop_focus_role) Claude picks.
      onSwitchRole: (role) =>
        dashboardActionsRef.current?.switchRole(role) ??
        intraopActionsRef.current?.focusRole(role) ??
        notAvailable(),
      onOpenPatientDetails: () =>
        dashboardActionsRef.current?.openPatientDetails() ?? notAvailable(),
      onClosePatientDetails: () =>
        dashboardActionsRef.current?.closePatientDetails() ?? notAvailable(),
      onOpenPatientVideo: () => dashboardActionsRef.current?.openPatientVideo() ?? notAvailable(),
      onClosePatientVideo: () => dashboardActionsRef.current?.closePatientVideo() ?? notAvailable(),
      onPlayPatientVideo: () => dashboardActionsRef.current?.playPatientVideo() ?? notAvailable(),
      onPausePatientVideo: () => dashboardActionsRef.current?.pausePatientVideo() ?? notAvailable(),
      onRestartPatientVideo: () =>
        dashboardActionsRef.current?.restartPatientVideo() ?? notAvailable(),
      onTogglePatientVideoCaptions: () =>
        dashboardActionsRef.current?.togglePatientVideoCaptions() ?? notAvailable(),
      onMutePatientVideo: () => dashboardActionsRef.current?.mutePatientVideo() ?? notAvailable(),
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

      // Intraop ("case active") — start/end are route-level (phase change),
      // role/phase/imaging/panel are dashboard-level via intraopActionsRef.
      onStartCase: (q) => navCallbacksRef.current.onStartCase?.(q) ?? notAvailable(),
      onEndCase: () => navCallbacksRef.current.onEndCase?.() ?? notAvailable(),
      onShowMultiView: () => navCallbacksRef.current.onShowMultiView?.() ?? notAvailable(),
      onCloseMultiView: () => navCallbacksRef.current.onCloseMultiView?.() ?? notAvailable(),
      onIntraopFocusRole: (role) =>
        intraopActionsRef.current?.focusRole(role) ??
        dashboardActionsRef.current?.switchRole(role) ??
        notAvailable(),
      onIntraopAdvancePhase: (dir) =>
        intraopActionsRef.current?.advancePhase(dir) ?? notAvailable(),
      onIntraopSetPhase: (phase) => intraopActionsRef.current?.setPhase(phase) ?? notAvailable(),
      onIntraopShowImaging: (modality) =>
        intraopActionsRef.current?.showImaging(modality) ?? notAvailable(),
      onIntraopShowPanel: (panel) => intraopActionsRef.current?.showPanel(panel) ?? notAvailable(),

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
        smartSettingsActionsRef={smartSettingsActionsRef}
        intraopActionsRef={intraopActionsRef}
        dashboardContextRef={dashboardContextRef}
        contextRef={contextRef}
        scrollActionsRef={scrollActionsRef}
        idleResetRef={idleResetRef}
        artiNapSetterRef={artiNapSetterRef}
        artiNapping={artiNapping}
        onLogout={onLogout}
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
  | "intraop"
  | "schedule"
  | "surgeons"
  | "surgeon-profile"
  | "patients"
  | "consoles"
  | "library"
  | "journey"
  | "screensaver"
  | "settings"
  | "admin-settings"
  | "smart-settings";

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
      | "onShowSettings"
      | "onShowAdminSettings"
      | "onShowSmartSettings"
      | "onSelectSmartDevice"
      | "onSetSmartProperty"
      | "onToggleSmartDevice"
      | "onResetAllSmartDevices"
      | "onCloseTopmostModal"
      | "onLibraryFilterCategory"
      | "onLibrarySearch"
      | "onLibrarySetAnimatedOnly"
      | "onLibrarySetSavedOnly"
      | "onLibraryClearFilters"
      | "onShowSavedVideos"
      | "onSaveVideo"
      | "onUnsaveVideo"
      | "onToggleSaveVideo"
      | "onStartScreensaver"
      | "onExitScreensaver"
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
      | "onOpenSurgeonProfile"
      | "onExpandProcedure"
      | "onCollapseProcedure"
      | "onNextProcedure"
      | "onPreviousProcedure"
      | "onRenamePrefCardImage"
      | "onRemovePrefCardImage"
      | "onPromptPrefCardUpload"
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
      | "onStartCase"
      | "onEndCase"
      | "onShowMultiView"
      | "onCloseMultiView"
    >
  >;
  dashboardActionsRef: DashboardActionsRef;
  smartSettingsActionsRef: SmartSettingsActionsRef;
  intraopActionsRef: IntraopActionsRef;
  dashboardContextRef: React.MutableRefObject<() => string>;
  contextRef: React.MutableRefObject<() => string>;
  scrollActionsRef: React.MutableRefObject<{
    onScroll: (direction: string, speed: string, continuous: boolean) => ArtiToolResult;
    onStopScroll: () => ArtiToolResult;
  }>;
  idleResetRef: React.MutableRefObject<() => void>;
  artiNapSetterRef: MutableRefObject<(v: boolean) => void>;
  artiNapping: boolean;
  onLogout: () => void;
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
  smartSettingsActionsRef,
  intraopActionsRef,
  dashboardContextRef,
  contextRef,
  scrollActionsRef,
  idleResetRef,
  artiNapSetterRef,
  artiNapping,
  onLogout,
}: ArtiWallProps) {
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // When a voice command selects a device while Smart Settings isn't open
  // yet, we stash the id here so the screen can adopt it on mount.
  const [pendingSmartDeviceId, setPendingSmartDeviceId] = useState<string | null>(null);

  // Admin Settings unlock state — session-scoped so navigating away from
  // Admin and coming back doesn't re-prompt for the password. Browser
  // refresh remounts ArtiWall and resets this to false.
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // "Are you sure?" modal for the bulk reset of every smart device.
  // Owned by the route so voice + click both control it through the
  // same surface, and so close_topmost_modal can dismiss it.
  const [resetAllConfirmOpen, setResetAllConfirmOpen] = useState(false);

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
  // When true and phase === "intraop", render MultiViewScreen instead of
  // IntraopDashboard. This is a lens over intraop, not its own phase —
  // ending the case clears it implicitly (see onEndCase below).
  const [multiView, setMultiView] = useState(false);
  const [activeCase, setActiveCase] = useState<CaseItem>(
    () => TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0],
  );
  // Which day's detail drawer is open on the Schedule screen. Null = closed.
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | null>(null);

  // Time-out checklist state — lifted up so the case-start modal and the
  // nurse panel share the same source of truth (checks made in either
  // surface immediately reflect in the other).
  const [timeOutChecked, setTimeOutChecked] = useState<Set<TimeOutId>>(() => new Set());
  const handleToggleTimeOutItem = useCallback((id: TimeOutId): ArtiToolResult => {
    setTimeOutChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    return { ok: true };
  }, []);
  // Whether the case-start time-out modal is open. Triggered by start_case
  // (voice) or the Start Case button (click). Continue → setPhase("intraop").
  const [timeOutModalOpen, setTimeOutModalOpen] = useState(false);

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
  const [librarySavedOnly, setLibrarySavedOnly] = useState(false);

  /**
   * Saved videos — persisted across page reloads in localStorage so the
   * surgeon's bookmarks survive a refresh. Voice or tap can mutate this
   * via the toggle handler. Set is the right shape for cheap membership
   * checks during render.
   */
  const [savedVideos, setSavedVideos] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("arti.savedVideos");
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return new Set(parsed);
      }
    } catch {
      /* corrupt or quota-exceeded — start empty */
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("arti.savedVideos", JSON.stringify([...savedVideos]));
    } catch {
      /* ignore quota / private mode failures */
    }
  }, [savedVideos]);

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

  // ── Surgeon profile state ────────────────────────────────────────────────
  // Active surgeon for the SurgeonProfileScreen. Set on card click / voice
  // open_surgeon_profile; cleared when the user navigates away.
  const [activeSurgeonName, setActiveSurgeonName] = useState<string | null>(null);
  // Which procedure card on the profile is expanded. null = let the screen
  // pick the first one.
  const [expandedProcedureSlug, setExpandedProcedureSlug] = useState<string | null>(null);

  // Per-image overrides — applied on top of seed data so seed stays stable
  // and we can still revert. Removed = soft-deleted ids; renames = id→label;
  // uploads = `${surgeonName}::${procedureSlug}` → appended images.
  const [imgRemoved, setImgRemoved] = useState<Set<string>>(() => new Set());
  const [imgRenames, setImgRenames] = useState<Record<string, string>>({});
  const [imgUploads, setImgUploads] = useState<Record<string, PrefCardImage[]>>({});

  const getProcedureImages = useCallback(
    (surgeonName: string, procedureSlug: string): PrefCardImage[] => {
      const surgeon = SURGEONS.find((s) => s.name === surgeonName);
      const proc = surgeon?.procedures?.find((p) => p.slug === procedureSlug);
      if (!proc) return [];
      const uploadKey = `${surgeonName}::${procedureSlug}`;
      const all: PrefCardImage[] = [...proc.seedImages, ...(imgUploads[uploadKey] ?? [])];
      return all
        .filter((img) => !imgRemoved.has(img.id))
        .map((img) => ({ ...img, label: imgRenames[img.id] ?? img.label }));
    },
    [imgRemoved, imgRenames, imgUploads],
  );

  /**
   * Resolve a spoken phrase to a smart device. Tries id, exact name,
   * substring on name, then a numeric variant for "boom 1" / "boom one".
   */
  const resolveSmartDevice = useCallback((phrase: string): SmartDevice | undefined => {
    const q = phrase.trim().toLowerCase();
    if (!q) return undefined;
    // Normalize spelled numbers so "boom one" matches "boom 1".
    const NUM_WORDS: Record<string, string> = {
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
    };
    const norm = q.replace(/\b(one|two|three|four|five)\b/g, (m) => NUM_WORDS[m] ?? m);
    const direct =
      SMART_DEVICES.find((d) => d.id === q) ??
      SMART_DEVICES.find((d) => d.name.toLowerCase() === q) ??
      SMART_DEVICES.find((d) => d.name.toLowerCase().includes(norm)) ??
      SMART_DEVICES.find((d) => d.id.toLowerCase().includes(norm));
    if (direct) return direct;
    // Word-bag fallback: every token of the query has to appear somewhere
    // in the name (covers "first surgical boom" → boom-1 if name says "boom 1").
    const tokens = norm.split(/\s+/).filter(Boolean);
    return SMART_DEVICES.find((d) => {
      const hay = (d.name + " " + d.id + " " + (d.group ?? "")).toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, []);

  /** Resolve a spoken property phrase to one of the device's spec entries. */
  const resolvePropertySpec = useCallback(
    (device: SmartDevice, phrase: string): SmartPropertySpec | undefined => {
      const q = phrase
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
      if (!q) return undefined;
      const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
      // Exact key, then label, then alias map (covers "color temp" → color_temp).
      const ALIAS: Record<string, string> = {
        colortemp: "color_temp",
        colortemperature: "color_temp",
        kelvin: "color_temp",
        spotsize: "spot_size",
        spot: "spot_size",
        temperature: "setpoint",
        temp: "setpoint",
        humidity: "target",
        airflow: "exchanges",
        power: "on",
        lock: "locked",
      };
      const aliased = ALIAS[q] ?? q;
      return (
        device.propertySpecs.find((s) => norm(s.key) === aliased) ??
        device.propertySpecs.find((s) => norm(s.label) === q) ??
        device.propertySpecs.find((s) => norm(s.label).includes(q)) ??
        device.propertySpecs.find((s) => norm(s.key).includes(aliased))
      );
    },
    [],
  );

  /** Coerce + clamp a raw value into the spec's expected type. Returns undefined on failure. */
  const coercePropertyValue = useCallback(
    (
      spec: SmartPropertySpec,
      raw: boolean | number | string,
    ): boolean | number | string | undefined => {
      if (spec.kind === "toggle") {
        if (typeof raw === "boolean") return raw;
        if (typeof raw === "number") return raw !== 0;
        const s = String(raw).trim().toLowerCase();
        if (["true", "on", "yes", "1", "lock", "locked", "open"].includes(s)) return true;
        if (["false", "off", "no", "0", "unlock", "unlocked", "close", "closed"].includes(s)) {
          return false;
        }
        return undefined;
      }
      if (spec.kind === "select") {
        const s = String(raw).trim().toLowerCase();
        const opt =
          spec.options.find((o) => o.value.toLowerCase() === s) ??
          spec.options.find((o) => o.label.toLowerCase() === s) ??
          spec.options.find((o) => o.label.toLowerCase().includes(s));
        return opt?.value;
      }
      // percent or kelvin → numeric, clamped.
      const min = spec.min ?? (spec.kind === "kelvin" ? 2700 : 0);
      const max = spec.max ?? (spec.kind === "kelvin" ? 6500 : 100);
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(n)) return undefined;
      return Math.max(min, Math.min(max, n));
    },
    [],
  );

  /** Resolve a spoken phrase ("Patel", "Dr. Patel", "Anika") to a Surgeon. */
  const resolveSurgeon = useCallback((phrase: string): Surgeon | undefined => {
    const q = phrase.trim().toLowerCase();
    if (!q) return undefined;
    return (
      SURGEONS.find((s) => s.name.toLowerCase() === q) ??
      SURGEONS.find((s) => s.name.toLowerCase().includes(q)) ??
      SURGEONS.find((s) =>
        s.name
          .toLowerCase()
          .split(/\s+/)
          .some((part) => part.replace(/[^\w]/g, "") === q),
      )
    );
  }, []);

  /** Resolve a spoken phrase or 1-based index to an image within the active procedure. */
  const resolveProcedureImage = useCallback(
    (surgeonName: string, procedureSlug: string, target: string): PrefCardImage | undefined => {
      const images = getProcedureImages(surgeonName, procedureSlug);
      if (!images.length) return undefined;
      const t = target.trim().toLowerCase();
      // 1-based index
      const idx = Number(t);
      if (Number.isFinite(idx) && idx >= 1 && idx <= images.length) return images[idx - 1];
      // Exact label match, then substring match
      return (
        images.find((i) => i.label.toLowerCase() === t) ??
        images.find((i) => i.label.toLowerCase().includes(t)) ??
        images.find((i) => t.split(/\s+/).every((w) => i.label.toLowerCase().includes(w)))
      );
    },
    [getProcedureImages],
  );

  const handleOpenSurgeonProfile = useCallback(
    (surgeon: Surgeon, opts?: { procedureSlug?: string }) => {
      setActiveSurgeonName(surgeon.name);
      setExpandedProcedureSlug(opts?.procedureSlug ?? null);
      setPhase("surgeon-profile");
    },
    [],
  );

  const handleRenameProcedureImage = useCallback(
    (procedureSlug: string, imageId: string, newLabel: string) => {
      setImgRenames((prev) => ({ ...prev, [imageId]: newLabel }));
    },
    [],
  );

  const handleRemoveProcedureImage = useCallback((procedureSlug: string, imageId: string) => {
    setImgRemoved((prev) => {
      const next = new Set(prev);
      next.add(imageId);
      return next;
    });
  }, []);

  const handleUploadProcedureImages = useCallback(
    (procedureSlug: string, files: File[]) => {
      if (!activeSurgeonName) return;
      const uploadKey = `${activeSurgeonName}::${procedureSlug}`;
      const additions: PrefCardImage[] = files.map((f, i) => ({
        id: `upload-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        src: URL.createObjectURL(f),
        alt: f.name,
        label: f.name.replace(/\.[^/.]+$/, ""),
        caption: "Uploaded",
      }));
      setImgUploads((prev) => ({
        ...prev,
        [uploadKey]: [...(prev[uploadKey] ?? []), ...additions],
      }));
    },
    [activeSurgeonName],
  );

  const handleOpenProcedureImageLightbox = useCallback(
    (procedureSlug: string, imageIndex: number) => {
      if (!activeSurgeonName) return;
      const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
      const proc = surgeon?.procedures?.find((p) => p.slug === procedureSlug);
      if (!surgeon || !proc) return;
      const images = getProcedureImages(surgeon.name, procedureSlug);
      openLightbox(
        images.map((img) => ({
          src: img.src,
          alt: img.alt,
          label: img.label,
          caption: img.caption,
        })),
        imageIndex,
        `${surgeon.name} · ${proc.name}`,
      );
    },
    [activeSurgeonName, getProcedureImages, openLightbox],
  );

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
    intraop: "intraoperative · case active (live surgery)",
    schedule: "schedule / calendar",
    surgeons: "surgeons directory",
    "surgeon-profile": "surgeon procedure preferences (per-procedure preference cards + images)",
    patients: "patients today",
    consoles: "OR equipment tower / consoles",
    library: "video library",
    journey: "how-it-was-built journey",
    screensaver: "calm sunrise screensaver — pre-patient ambient mode",
    settings: "preferences / settings landing",
    "admin-settings": "admin settings (password-protected)",
    "smart-settings": "smart device controls (lights, displays, environment, audio, doors)",
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
      // Interruption rules — the user can cut Arti off mid-narration. When
      // that happens the previous assistant turn is rewritten in history
      // as `[INTERRUPTED at ~X%] <truncated>...`. Treat that as: the user
      // didn't hear the rest, so DO NOT replay or re-summarize what was
      // already spoken. Address their new request directly. Reference
      // the cut-off content only if they ask ("you were saying…").
      `Interruption rule: history entries prefixed with [INTERRUPTED at ~X%] mean Arti was cut off mid-sentence. The truncated text is roughly what the user heard. Address the new request directly; do not repeat the cut-off response.`,
      `Current screen: ${PHASE_LABEL[phase]}${phase === "intraop" && multiView ? " (multi-view 4-quadrant layout active)" : ""}`,
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
            : resetAllConfirmOpen
              ? "reset-all confirm modal"
              : timeOutModalOpen
                ? "time-out modal"
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
      resetAllConfirmOpen
        ? [
            `Reset-all confirmation modal: OPEN — asking the user to confirm bulk-reset of EVERY smart device.`,
            `  VERB ROUTING ON THIS MODAL:`,
            `    'yes' / 'confirm' / 'do it' / 'reset' / 'go ahead' / 'I'm sure' → reset_all_smart_devices({confirmed: true}). Executes the reset and closes the modal.`,
            `    'no' / 'cancel' / 'never mind' / 'close' / 'back' → close_topmost_modal.`,
            `    Any other smart-settings command should NOT fire while this modal is open — guide the user back to yes/no first.`,
          ].join("\n")
        : `Reset-all confirmation modal: closed`,
      timeOutModalOpen
        ? (() => {
            const all: TimeOutId[] = ["patient", "site", "procedure", "allergies"];
            const pending = all.filter((id) => !timeOutChecked.has(id));
            const allChecked = pending.length === 0;
            return [
              `Time-out modal: OPEN — pre-incision Universal Protocol checklist. The case has NOT started yet — Arti must NEVER respond 'already started' on this screen.`,
              `  Items required (4 total): patient, site, procedure, allergies`,
              `  Confirmed (${timeOutChecked.size}/4): ${[...timeOutChecked].join(", ") || "none"}`,
              `  Pending: ${pending.join(", ") || "none — all four are green"}`,
              `  VERB ROUTING ON THIS SCREEN:`,
              `    'check site' / 'mark patient confirmed' / 'allergies are good' → toggle_timeout_item ({id: "patient"|"site"|"procedure"|"allergies"}). NEVER say 'already done' before calling — call the tool and report the new state.`,
              allChecked
                ? `    'start' / 'start case' / 'continue' / 'go' / 'ready to start' / 'we're ready' → start_case (NO query). ALL 4 ITEMS ARE CONFIRMED — fire the tool; route returns ok:true and transitions to intraop. DO NOT respond 'already started'.`
                : `    'start' / 'start case' / 'continue' / 'go' → start_case will REJECT (only ${timeOutChecked.size}/4 confirmed). Respond by naming the pending items so the user can mark them: ${pending.join(", ")}.`,
              `    'cancel' / 'back' / 'close' → close_topmost_modal (returns to pre-op WITHOUT starting the case).`,
            ].join("\n");
          })()
        : `Time-out modal: closed`,
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
        const activeId =
          howToVideoId ?? (howToProcedure ? findLatestVideo(howToProcedure).id : null);
        const isSaved = activeId ? savedVideos.has(activeId) : false;
        return [
          `How-to video modal: OPEN — "${status.videoTitle}" (${status.procedure}, ${status.surgeon}, ${status.publishedYear})`,
          `  Active video id: ${activeId ?? "(unresolved)"} · saved: ${isSaved ? "YES" : "no"}`,
          `  Playback: ${status.playing ? "playing" : "paused"} at ${fmt(status.currentSec)}/${fmt(status.durationSec)} · ${chapterLine} · ${status.speed}× speed`,
          `  Chapters: ${status.chapters.map((c, i) => `${i + 1}=${c.title}`).join(" · ")}`,
          `  Research panel: ${status.papersPanelOpen ? "OPEN" : "closed"}${status.activePaper ? ` · viewing paper "${status.activePaper.title}"` : ""}`,
          `  Available papers: ${papersList || "none"}`,
          `  Voice tools: video_play, video_pause, video_seek, video_next_chapter, video_prev_chapter, video_restart, video_set_speed, video_show_papers, video_hide_papers, video_open_paper, video_close_paper, save_video, unsave_video, close_how_to_video`,
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
              savedIds: savedVideos,
              savedOnly: librarySavedOnly,
            });
            const head = `Video Library filters — search: ${librarySearch ? `"${librarySearch}"` : "(none)"} · category: ${libraryCategory} · animated only: ${libraryAnimatedOnly ? "on" : "off"} · saved only: ${librarySavedOnly ? "on" : "off"} · saved set size: ${savedVideos.size}`;
            const list =
              filtered.length === 0
                ? "  (no videos match — broaden the filters)"
                : filtered
                    .slice(0, 12)
                    .map(
                      (v, i) =>
                        `  ${i + 1}. id="${v.id}"${savedVideos.has(v.id) ? " ★saved" : ""} · "${v.title}" · ${v.category} · ${v.publishedYear} · procedure="${v.procedure}"`,
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
      // Surgeon-profile screen — exposes the active surgeon, their procedures,
      // the currently-expanded procedure, and that procedure's images so
      // voice rename/remove/upload tools can target by name or 1-based index.
      // Also lists EXACT verb → tool routing so generic 'close' / 'next' /
      // 'previous' don't fall through to close_topmost_modal / open_case.
      (() => {
        if (phase !== "surgeon-profile" || !activeSurgeonName) return "";
        const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
        if (!surgeon) return `Surgeon profile: requested "${activeSurgeonName}" — not found.`;
        const procs = surgeon.procedures ?? [];
        const procList = procs.length
          ? procs
              .map(
                (p, i) =>
                  `    ${i + 1}. slug="${p.slug}" name="${p.name}" — ${p.slug === expandedProcedureSlug ? "EXPANDED" : "collapsed"}`,
              )
              .join("\n")
          : "    (no procedures on file)";
        const expandedProc = procs.find((p) => p.slug === expandedProcedureSlug);
        const expandedImages = expandedProc
          ? getProcedureImages(surgeon.name, expandedProc.slug)
          : [];
        const imageList = expandedProc
          ? expandedImages.length
            ? expandedImages
                .map((img, i) => `      ${i + 1}. id="${img.id}" label="${img.label}"`)
                .join("\n")
            : "      (no images on this procedure)"
          : "";
        const expandedLine = expandedProc
          ? `  CURRENTLY EXPANDED: "${expandedProc.name}" (slug=${expandedProc.slug}). Generic 'close' / 'collapse' / 'close panel' / 'close procedure' on this screen → collapse_procedure (NO 'procedure' arg).`
          : `  CURRENTLY EXPANDED: none. Generic 'close' is a no-op here — there is no overlay to close.`;
        const imagesBlock = expandedProc
          ? `  Images on the expanded procedure (${expandedImages.length}):\n${imageList}`
          : "";
        return [
          `Surgeon profile: OPEN — ${surgeon.name} (${surgeon.specialty}).`,
          `  Procedures on this surgeon (${procs.length}) — match user phrases against EITHER slug OR name:`,
          procList,
          expandedLine,
          imagesBlock,
          ``,
          `  VERB ROUTING ON THIS SCREEN (do NOT fall through to other tools):`,
          `    'open <X>' / 'show <X>' / 'pull up <X>' / 'expand <X>' where X is a slug or procedure name → expand_procedure({procedure: X}). Acronyms like RSA/RCR/ACL/CABG/FESS map to slugs. ALWAYS call this — do not assume "already open".`,
          `    'close' / 'close it' / 'close that' / 'close panel' / 'close procedure' / 'close procedure panel' / 'collapse' / 'collapse it' / 'hide it' → collapse_procedure (omit \`procedure\` for bare 'close', or pass slug/name when user names one). NEVER use close_topmost_modal here.`,
          `    'next' / 'next procedure' / 'next one' / 'show me the next procedure' / 'arti next' → next_procedure (NEVER open_case here — 'next' on this screen means next procedure card, not next OR case).`,
          `    'previous' / 'previous one' / 'go back' / 'previous procedure' → previous_procedure.`,
          `    'upload images' / 'upload a picture' / 'add images for <X>' → prompt_pref_card_upload (pass {procedure: X} if a procedure was named — the route auto-expands it first).`,
          `    'rename <image-or-index> to <new>' → rename_pref_card_image. 'remove <image-or-index>' → remove_pref_card_image.`,
          `    'back to surgeons' / 'show me the directory' → navigate_surgeons.`,
        ].join("\n");
      })(),
      // Home dashboard — surfaces the circulating nurse's live pre-case
      // state so Arti can read it back to her without her having to look
      // at the wall. Covers wrap-up checklist (live from localStorage),
      // communications feed, supply status, and OR readiness. Claude
      // answers narratively from this block — no tool call needed.
      (() => {
        if (phase !== "home") return "";
        const tasks = loadHomeTasks();
        const done = tasks.filter((t) => t.done);
        const left = tasks.filter((t) => !t.done);
        const supplyCounts = HOME_SUPPLY_GROUPS.flatMap((g) => g.items).reduce(
          (acc, it) => {
            acc[it.status] = (acc[it.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        const orCounts = HOME_OR_GROUPS.flatMap((g) => g.items).reduce(
          (acc, it) => {
            acc[it.status] = (acc[it.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        const unreadComms = HOME_COMMS.filter((c) => c.unread).length;
        const fmtItems = (items: Array<{ label: string; status: string; detail?: string }>) =>
          items
            .map((it) => `${it.label}: ${it.status}${it.detail ? ` (${it.detail})` : ""}`)
            .join(" · ");
        return [
          `Home dashboard — Laura's live pre-case state:`,
          ``,
          `  Wrap-up checklist (${done.length}/${tasks.length} done, ${left.length} left):`,
          done.length
            ? `    DONE:\n${done
                .map((t) => `      ✓ ${t.label}${t.detail ? ` — ${t.detail}` : ""}`)
                .join("\n")}`
            : `    DONE: (none yet)`,
          left.length
            ? `    LEFT:\n${left
                .map((t) => `      • ${t.label}${t.detail ? ` — ${t.detail}` : ""}`)
                .join("\n")}`
            : `    LEFT: (all clear)`,
          ``,
          `  Communications (${HOME_COMMS.length} total, ${unreadComms} unread):`,
          ...HOME_COMMS.map(
            (c) => `    ${c.unread ? "[UNREAD] " : ""}${c.source} ${c.time}: "${c.message}"`,
          ),
          ``,
          `  Supply status (${supplyCounts.ready ?? 0} ready · ${
            supplyCounts.pending ?? 0
          } pending · ${supplyCounts.issue ?? 0} missing):`,
          ...HOME_SUPPLY_GROUPS.map((g) => `    ${g.category} — ${fmtItems(g.items)}`),
          ``,
          `  OR readiness (${orCounts.ready ?? 0} ready · ${
            orCounts.pending ?? 0
          } pending · ${orCounts.issue ?? 0} issue):`,
          ...HOME_OR_GROUPS.map((g) => `    ${g.category} — ${fmtItems(g.items)}`),
          ``,
          `  VERB ROUTING — answer these directly from the data above (NO tool call):`,
          `    "what's on my checklist?" / "what's done?" / "what's left?" → read Wrap-up checklist.`,
          `    "what are the latest communications?" / "anything from PACU?" / "what's come in in the last 30 minutes?" → read Communications (filter by source/time as the user asked).`,
          `    "what's the OR readiness?" / "is the room ready?" / "what's still pending?" → read OR readiness.`,
          `    "what supply is missing?" / "any backorders?" / "is the implant here?" → read Supply status.`,
          `    Multi-sentence narration is OK on the home screen — the user is asking for a readout, not a confirmation.`,
        ].join("\n");
      })(),
      // Smart Settings screen — lists every device + property so voice
      // tools can target by name/keyword. Even when the screen isn't
      // mounted, set_smart_property / toggle_smart_device still work; this
      // block is most useful when the user is on the screen.
      (() => {
        if (phase !== "smart-settings") return "";
        const deviceLines = SMART_DEVICES.map((d) => {
          const props = d.propertySpecs
            .map((s) => {
              if (s.kind === "select") {
                return `${s.key} (select: ${s.options.map((o) => o.value).join("|")})`;
              }
              if (s.kind === "kelvin") {
                return `${s.key} (kelvin ${s.min ?? 2700}–${s.max ?? 6500})`;
              }
              if (s.kind === "percent") {
                return `${s.key} (${s.kind} ${s.min ?? 0}–${s.max ?? 100}${s.unit ?? "%"})`;
              }
              return `${s.key} (${s.kind})`;
            })
            .join(", ");
          return `    - id="${d.id}" name="${d.name}" · props: ${props}`;
        }).join("\n");
        return [
          `Smart Settings: OPEN${pendingSmartDeviceId ? ` (selected device id="${pendingSmartDeviceId}")` : ""}.`,
          `  Devices on this screen — voice tools resolve by name OR id:`,
          deviceLines,
          `  VERB ROUTING:`,
          `    'open <device>' / 'show <device> controls' / 'select <device>' → select_smart_device({device}).`,
          `    'dim <device> to 60' / 'set <device> brightness to 80' → set_smart_property({device, property:"brightness", value: 60}).`,
          `    'set <device> color temp to 4000' → set_smart_property({device, property:"color_temp", value: 4000}).`,
          `    'turn on/off <device>' / 'lock the door' → toggle_smart_device({device, on:true|false}).`,
          `    Bare 'set brightness to 50' (no device named) → set_smart_property with device omitted; route uses the currently-selected device.`,
        ].join("\n");
      })(),
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

    // Intraop dashboard live state — phase, vitals, antibiotic timer,
    // implant + supply status. Surfaced only when the intraop screen is
    // mounted so Claude can answer "what phase are we in?", "when is the
    // next antibiotic?", "show implants" with current data.
    if (phase === "intraop") {
      const intraopCtx = intraopActionsRef.current?.getLiveContext();
      if (intraopCtx) lines.push(intraopCtx);
    }

    return lines.join("\n");
  };

  const handleWakeRequested = useCallback(() => {
    setPhase((p) => (p === "sleep" ? "waking" : p));
  }, []);
  const handleWakeAnimationComplete = useCallback(() => {
    setPhase((p) => (p === "waking" ? "greeting" : p));
  }, []);
  const handleSleep = useCallback(() => {
    // Mirror the voice "sleep" path: just nap Arti (dim the sparkle, stop
    // the mic) — do NOT navigate to the sleep screen. The voice handler
    // is registered by ArtiWall on `navCallbacksRef.current.onSleep`, so
    // we route through it to keep both surfaces identical.
    navCallbacksRef.current.onSleep?.();
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
    setTimeOutModalOpen(false);
    setResetAllConfirmOpen(false);
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
        | "calm"
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
        case "calm":
          setPhase("screensaver");
          break;
        case "preferences":
          setPhase("settings");
          break;
      }
    },
    [armIdleTimer, closeOverlays],
  );

  const handleStartScreensaver = useCallback(() => {
    closeOverlays();
    setPhase("screensaver");
  }, [closeOverlays]);

  /** Exit the screensaver back to home — same target as a sidebar tap. */
  const handleExitScreensaver = useCallback(() => {
    setPhase("home");
  }, []);

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

  /**
   * Resolve which library video id is "active" right now. Mirrors the
   * priority HowToVideoModal uses internally so save/unsave acts on the
   * same video the user is looking at.
   */
  const resolveActiveVideoId = (): string | null => {
    if (howToVideoId) return howToVideoId;
    if (howToProcedure) return findLatestVideo(howToProcedure).id;
    return null;
  };

  /**
   * Resolve a save target. Priority: explicit id > free-text query >
   * currently-open video. Returns null if nothing reasonable matches.
   */
  const resolveSaveTarget = (id?: string, query?: string): string | null => {
    if (id) {
      if (PROCEDURE_VIDEOS.some((v) => v.id === id)) return id;
    }
    if (query && query.trim()) return findLatestVideo(query).id;
    return resolveActiveVideoId();
  };

  const handleSaveVideo = (id?: string, query?: string): ArtiToolResult => {
    const target = resolveSaveTarget(id, query);
    if (!target) return { ok: false, reason: "no video to save" };
    setSavedVideos((prev) => {
      if (prev.has(target)) return prev; // already saved — no-op
      const next = new Set(prev);
      next.add(target);
      return next;
    });
    return { ok: true };
  };

  const handleUnsaveVideo = (id?: string, query?: string): ArtiToolResult => {
    const target = resolveSaveTarget(id, query);
    if (!target) return { ok: false, reason: "no video to remove" };
    setSavedVideos((prev) => {
      if (!prev.has(target)) return prev;
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
    return { ok: true };
  };

  const handleToggleSaveVideo = (id?: string, query?: string): ArtiToolResult => {
    const target = resolveSaveTarget(id, query);
    if (!target) return { ok: false, reason: "no video to toggle" };
    setSavedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
    return { ok: true };
  };

  const handleLibrarySetSavedOnly = (enabled: boolean) => {
    closeOverlays();
    setLibrarySavedOnly(enabled);
    setPhase("library");
  };

  /** Convenience: nav to library + show only saved. "Show me my videos." */
  const handleShowSavedVideos = () => {
    closeOverlays();
    setLibrarySearch("");
    setLibraryCategory("All");
    setLibraryAnimatedOnly(false);
    setLibrarySavedOnly(true);
    setPhase("library");
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
    /**
     * Begin the intraop ("case active") view.
     *
     * Resolution rules:
     *   • If a query is given, resolve via findCase. Match wins → start that case.
     *   • If no query and we're already on preop → start the active case.
     *   • If no query and we're already on intraop → no-op (already running).
     *   • Otherwise (home / cases / schedule / etc., no query) → return
     *     { ok: false, reason: "ambiguous" } so the system prompt can ask
     *     "Which case? Marcus Chen is up next." Claude should NOT call
     *     start_case in that situation per the personality rule, but if
     *     it does, we soft-fail rather than silently pick a case.
     */
    onStartCase: (query?: string): ArtiToolResult => {
      if (phase === "intraop") {
        return { ok: true, state: { already: true } };
      }
      // If the time-out modal is already open and all 4 items are confirmed,
      // treat start_case (and bare "continue" / "ready to start") as the
      // Continue button → enter intraop.
      if (timeOutModalOpen) {
        if (timeOutChecked.size === 4) {
          setTimeOutModalOpen(false);
          setPhase("intraop");
          return { ok: true, state: { continued: true } };
        }
        return {
          ok: false,
          reason: `time-out incomplete (${timeOutChecked.size}/4) — confirm remaining items first`,
        };
      }
      // Start-case opens the WHO time-out modal first (Universal Protocol).
      // The user confirms the four checks (voice or click) and hits Continue
      // → that's where setPhase("intraop") happens.
      const q = query?.trim();
      if (q) {
        const match = findCase(q, activeCase.id);
        if (match) {
          closeOverlays();
          setActiveCase(match);
          setPhase("preop");
          setTimeOutModalOpen(true);
          return { ok: true, state: { timeoutOpen: true } };
        }
        return { ok: false, reason: "no matching case" };
      }
      if (phase === "preop") {
        closeOverlays();
        setTimeOutModalOpen(true);
        return { ok: true, state: { timeoutOpen: true } };
      }
      return { ok: false, reason: "ambiguous — ask which case" };
    },
    onEndCase: (): ArtiToolResult => {
      if (phase !== "intraop") return { ok: false, reason: "not in intraop" };
      closeOverlays();
      setMultiView(false);
      setPhase("preop");
      return { ok: true };
    },
    onShowMultiView: (): ArtiToolResult => {
      if (phase !== "intraop") return { ok: false, reason: "case not active" };
      if (multiView) return { ok: true, state: { already: true } };
      closeOverlays();
      setMultiView(true);
      return { ok: true };
    },
    onCloseMultiView: (): ArtiToolResult => {
      if (!multiView) return { ok: false, reason: "multi-view not active" };
      setMultiView(false);
      return { ok: true };
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
    onShowSettings: () => {
      closeOverlays();
      setPhase("settings");
    },
    onShowAdminSettings: () => {
      closeOverlays();
      setPhase("admin-settings");
    },
    onShowSmartSettings: () => {
      closeOverlays();
      setPhase("smart-settings");
    },
    onSelectSmartDevice: (devicePhrase: string): ArtiToolResult => {
      const device = resolveSmartDevice(devicePhrase);
      if (!device) return { ok: false, reason: "device not found" };
      // If Smart Settings is mounted, switch the selection in place.
      if (smartSettingsActionsRef.current) {
        smartSettingsActionsRef.current.selectDevice(device.id);
      } else {
        // Stash for the screen to adopt on mount, then navigate.
        setPendingSmartDeviceId(device.id);
        closeOverlays();
        setPhase("smart-settings");
      }
      return { ok: true, state: { device: device.id, name: device.name } };
    },
    onSetSmartProperty: (
      devicePhrase: string | undefined,
      propertyPhrase: string,
      value: boolean | number | string,
    ): ArtiToolResult => {
      // Resolve target device. If unspecified, try the currently-selected
      // device from the Smart Settings screen (when mounted).
      let device: SmartDevice | undefined;
      if (devicePhrase && devicePhrase.trim()) {
        device = resolveSmartDevice(devicePhrase);
      } else if (pendingSmartDeviceId) {
        device = SMART_DEVICES.find((d) => d.id === pendingSmartDeviceId);
      }
      if (!device) return { ok: false, reason: "device not specified or not found" };
      const spec = resolvePropertySpec(device, propertyPhrase);
      if (!spec) return { ok: false, reason: "property not found on device" };
      const coerced = coercePropertyValue(spec, value);
      if (coerced === undefined) return { ok: false, reason: "invalid value for property" };
      // Persist + (if mounted) live-update the screen.
      const current = loadSmartDeviceState(device);
      const next = { ...current, [spec.key]: coerced };
      saveSmartDeviceState(device, next);
      smartSettingsActionsRef.current?.applyPropertyChange(device.id, spec.key, coerced);
      return {
        ok: true,
        state: { device: device.id, property: spec.key, value: coerced },
      };
    },
    onToggleSmartDevice: (
      devicePhrase: string,
      on: boolean,
      propertyKey?: string,
    ): ArtiToolResult => {
      const device = resolveSmartDevice(devicePhrase);
      if (!device) return { ok: false, reason: "device not found" };
      // Default boolean property is "on", except the door uses "locked".
      const targetKey = propertyKey ?? (device.id === "doors.main" ? "locked" : "on");
      const spec = device.propertySpecs.find((s) => s.key === targetKey && s.kind === "toggle");
      if (!spec) return { ok: false, reason: "no boolean property to toggle" };
      const current = loadSmartDeviceState(device);
      const next = { ...current, [targetKey]: on };
      saveSmartDeviceState(device, next);
      smartSettingsActionsRef.current?.applyPropertyChange(device.id, targetKey, on);
      return { ok: true, state: { device: device.id, [targetKey]: on } };
    },
    onResetAllSmartDevices: (confirmed?: boolean): ArtiToolResult => {
      // Two-step UX: open modal first; only execute on confirmed=true.
      if (!confirmed) {
        setResetAllConfirmOpen(true);
        return { ok: true, state: { phase: "awaiting_confirmation" } };
      }
      // Confirmed — clear every device's localStorage entry, refresh the
      // Smart Settings screen if mounted, close the modal.
      resetAllSmartDeviceStates();
      smartSettingsActionsRef.current?.reloadAllStates();
      setResetAllConfirmOpen(false);
      return { ok: true, state: { phase: "reset_complete" } };
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
      if (resetAllConfirmOpen) {
        setResetAllConfirmOpen(false);
        return;
      }
      if (timeOutModalOpen) {
        setTimeOutModalOpen(false);
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
      setLibrarySavedOnly(false);
    },
    onLibrarySetSavedOnly: handleLibrarySetSavedOnly,
    onShowSavedVideos: handleShowSavedVideos,
    onSaveVideo: handleSaveVideo,
    onUnsaveVideo: handleUnsaveVideo,
    onToggleSaveVideo: handleToggleSaveVideo,
    onStartScreensaver: handleStartScreensaver,
    onExitScreensaver: handleExitScreensaver,
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
    onOpenSurgeonProfile: (surgeonPhrase: string, procedurePhrase?: string): ArtiToolResult => {
      const surgeon = resolveSurgeon(surgeonPhrase);
      if (!surgeon) return { ok: false, reason: "surgeon not found" };
      let slug: string | undefined;
      if (procedurePhrase) {
        const ph = procedurePhrase.toLowerCase();
        const proc = surgeon.procedures?.find(
          (p) =>
            p.slug === ph ||
            p.name.toLowerCase() === ph ||
            p.slug.includes(ph) ||
            p.name.toLowerCase().includes(ph),
        );
        slug = proc?.slug;
      }
      closeOverlays();
      handleOpenSurgeonProfile(surgeon, { procedureSlug: slug });
      return { ok: true, state: { surgeon: surgeon.name, procedure: slug ?? null } };
    },
    onExpandProcedure: (procedurePhrase: string): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName) {
        return { ok: false, reason: "not on surgeon profile" };
      }
      const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
      if (!surgeon) return { ok: false, reason: "surgeon not loaded" };
      const ph = procedurePhrase.trim().toLowerCase();
      const proc = surgeon.procedures?.find(
        (p) =>
          p.slug === ph ||
          p.name.toLowerCase() === ph ||
          p.slug.includes(ph) ||
          p.name.toLowerCase().includes(ph),
      );
      if (!proc) return { ok: false, reason: "procedure not found" };
      setExpandedProcedureSlug(proc.slug);
      // Scroll the card into view so voice users see what they expanded.
      requestAnimationFrame(() => {
        document.getElementById(`procedure-${proc.slug}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return { ok: true, state: { procedure: proc.slug } };
    },
    onCollapseProcedure: (procedurePhrase?: string): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName) {
        return { ok: false, reason: "not on surgeon profile" };
      }
      // Bare "close" with nothing expanded: nothing to do.
      if (!expandedProcedureSlug) {
        return { ok: false, reason: "nothing expanded" };
      }
      // No phrase or phrase matches the currently-expanded card: collapse it.
      const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
      const expanded = surgeon?.procedures?.find((p) => p.slug === expandedProcedureSlug);
      if (!procedurePhrase || !procedurePhrase.trim()) {
        setExpandedProcedureSlug(null);
        return { ok: true, state: { collapsed: expanded?.slug ?? null } };
      }
      const ph = procedurePhrase.trim().toLowerCase();
      const target = surgeon?.procedures?.find(
        (p) =>
          p.slug === ph ||
          p.name.toLowerCase() === ph ||
          p.slug.includes(ph) ||
          p.name.toLowerCase().includes(ph),
      );
      if (!target) return { ok: false, reason: "procedure not found" };
      // Only collapse if the user asked about the currently-expanded one.
      if (target.slug !== expandedProcedureSlug) {
        return { ok: false, reason: `${target.slug} is not currently expanded` };
      }
      setExpandedProcedureSlug(null);
      return { ok: true, state: { collapsed: target.slug } };
    },
    onNextProcedure: (): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName) {
        return { ok: false, reason: "not on surgeon profile" };
      }
      const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
      const procs = surgeon?.procedures ?? [];
      if (procs.length === 0) return { ok: false, reason: "no procedures" };
      const currentIdx = procs.findIndex((p) => p.slug === expandedProcedureSlug);
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % procs.length;
      const next = procs[nextIdx];
      setExpandedProcedureSlug(next.slug);
      requestAnimationFrame(() => {
        document.getElementById(`procedure-${next.slug}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return { ok: true, state: { procedure: next.slug } };
    },
    onPreviousProcedure: (): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName) {
        return { ok: false, reason: "not on surgeon profile" };
      }
      const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
      const procs = surgeon?.procedures ?? [];
      if (procs.length === 0) return { ok: false, reason: "no procedures" };
      const currentIdx = procs.findIndex((p) => p.slug === expandedProcedureSlug);
      const prevIdx =
        currentIdx === -1 ? procs.length - 1 : (currentIdx - 1 + procs.length) % procs.length;
      const prev = procs[prevIdx];
      setExpandedProcedureSlug(prev.slug);
      requestAnimationFrame(() => {
        document.getElementById(`procedure-${prev.slug}`)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return { ok: true, state: { procedure: prev.slug } };
    },
    onRenamePrefCardImage: (imagePhrase: string, newLabel: string): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName || !expandedProcedureSlug) {
        return { ok: false, reason: "no procedure focused" };
      }
      const target = resolveProcedureImage(activeSurgeonName, expandedProcedureSlug, imagePhrase);
      if (!target) return { ok: false, reason: "image not found" };
      const trimmed = newLabel.trim();
      if (!trimmed) return { ok: false, reason: "empty label" };
      handleRenameProcedureImage(expandedProcedureSlug, target.id, trimmed);
      return { ok: true, state: { id: target.id, label: trimmed } };
    },
    onRemovePrefCardImage: (imagePhrase: string): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName || !expandedProcedureSlug) {
        return { ok: false, reason: "no procedure focused" };
      }
      const target = resolveProcedureImage(activeSurgeonName, expandedProcedureSlug, imagePhrase);
      if (!target) return { ok: false, reason: "image not found" };
      handleRemoveProcedureImage(expandedProcedureSlug, target.id);
      return { ok: true, state: { id: target.id } };
    },
    onPromptPrefCardUpload: (procedurePhrase?: string): ArtiToolResult => {
      if (phase !== "surgeon-profile" || !activeSurgeonName) {
        return { ok: false, reason: "not on surgeon profile" };
      }
      // Resolve which procedure to upload into. If the user named one, prefer
      // that and expand it (if needed) before clicking the input. Otherwise
      // use whichever is currently expanded.
      let targetSlug: string | null = expandedProcedureSlug;
      let needsExpand = false;
      if (procedurePhrase && procedurePhrase.trim()) {
        const surgeon = SURGEONS.find((s) => s.name === activeSurgeonName);
        const ph = procedurePhrase.trim().toLowerCase();
        const proc = surgeon?.procedures?.find(
          (p) =>
            p.slug === ph ||
            p.name.toLowerCase() === ph ||
            p.slug.includes(ph) ||
            p.name.toLowerCase().includes(ph),
        );
        if (!proc) return { ok: false, reason: "procedure not found" };
        targetSlug = proc.slug;
        needsExpand = proc.slug !== expandedProcedureSlug;
        if (needsExpand) setExpandedProcedureSlug(proc.slug);
      }
      if (!targetSlug) return { ok: false, reason: "no procedure focused" };

      // The card may have just been expanded — its file input is mounted on
      // the next render. Click via rAF (post-paint) and fall back to a small
      // setTimeout if the input still isn't there.
      const click = () => {
        const card = document.getElementById(`procedure-${targetSlug}`);
        const input = card?.querySelector<HTMLInputElement>('input[type="file"][accept^="image"]');
        if (input) {
          input.click();
          return true;
        }
        return false;
      };
      if (!click()) {
        requestAnimationFrame(() => {
          if (!click()) setTimeout(click, 80);
        });
      }
      return { ok: true, state: { procedure: targetSlug, expanded: needsExpand } };
    },
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
        onLogout={onLogout}
        activeCase={activeCase}
        onBackToCases={() => setPhase("cases")}
        onPrompt={handlePrompt}
        actionsRef={dashboardActionsRef}
        dashboardContextRef={dashboardContextRef}
        onSidebarNavigate={handleSidebarNavigate}
        onOpenLightbox={openLightbox}
        onStartCase={() => {
          closeOverlays();
          setTimeOutModalOpen(true);
        }}
        timeOutChecked={timeOutChecked}
        onToggleTimeOutItem={handleToggleTimeOutItem}
      />
    );
  } else if (phase === "intraop") {
    screen = multiView ? (
      <MultiViewScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        activeCase={activeCase}
        onExitMultiView={() => setMultiView(false)}
        onPrompt={handlePrompt}
        actionsRef={intraopActionsRef}
      />
    ) : (
      <IntraopDashboard
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        activeCase={activeCase}
        onEndCase={() => {
          setMultiView(false);
          setPhase("preop");
        }}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onShowMultiView={() => setMultiView(true)}
        actionsRef={intraopActionsRef}
      />
    );
  } else if (phase === "cases") {
    screen = (
      <CaseListScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
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
        onLogout={onLogout}
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
        onLogout={onLogout}
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
  } else if (phase === "screensaver") {
    screen = <ScreensaverScreen onExit={handleExitScreensaver} onPrompt={handlePrompt} />;
  } else if (phase === "library") {
    screen = (
      <VideoLibraryScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onOpenVideo={handleOpenLibraryVideo}
        search={librarySearch}
        onSearchChange={setLibrarySearch}
        category={libraryCategory}
        onCategoryChange={setLibraryCategory}
        animatedOnly={libraryAnimatedOnly}
        onAnimatedOnlyChange={setLibraryAnimatedOnly}
        savedIds={savedVideos}
        savedOnly={librarySavedOnly}
        onSavedOnlyChange={setLibrarySavedOnly}
        onToggleSave={(id) => handleToggleSaveVideo(id)}
      />
    );
  } else if (phase === "surgeons") {
    screen = (
      <SurgeonsScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onOpenSurgeonProfile={(s) => handleOpenSurgeonProfile(s)}
        onOpenSurgeonSchedule={(name) => handleOpenSurgeonSchedule(name)}
        hasPrefCardImages={(s) => surgeonHasPrefCards(s)}
      />
    );
  } else if (phase === "surgeon-profile") {
    screen = (
      <SurgeonProfileScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        surgeonName={activeSurgeonName ?? ""}
        onBack={() => setPhase("surgeons")}
        onOpenSchedule={(name) => handleOpenSurgeonSchedule(name)}
        imagesFor={(slug) => (activeSurgeonName ? getProcedureImages(activeSurgeonName, slug) : [])}
        onRenameImage={handleRenameProcedureImage}
        onRemoveImage={handleRemoveProcedureImage}
        onUploadImages={handleUploadProcedureImages}
        onOpenImageLightbox={handleOpenProcedureImageLightbox}
        expandedProcedureSlug={expandedProcedureSlug}
        onSetExpandedProcedure={setExpandedProcedureSlug}
      />
    );
  } else if (phase === "schedule") {
    screen = (
      <ScheduleScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
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
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
      />
    );
  } else if (phase === "settings") {
    screen = (
      <SettingsScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onOpenAdmin={() => setPhase("admin-settings")}
      />
    );
  } else if (phase === "admin-settings") {
    screen = (
      <AdminSettingsScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onBack={() => setPhase("settings")}
        onOpenSmartSettings={() => setPhase("smart-settings")}
        unlocked={adminUnlocked}
        onUnlock={() => setAdminUnlocked(true)}
      />
    );
  } else if (phase === "smart-settings") {
    screen = (
      <SmartSettingsScreen
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
        onLogout={onLogout}
        onPrompt={handlePrompt}
        onSidebarNavigate={handleSidebarNavigate}
        onBack={() => setPhase("admin-settings")}
        actionsRef={smartSettingsActionsRef}
        initialDeviceId={pendingSmartDeviceId}
        onInitialDeviceConsumed={() => setPendingSmartDeviceId(null)}
        onOpenResetAll={() => setResetAllConfirmOpen(true)}
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
        saved={(() => {
          const id = howToVideoId ?? (howToProcedure ? findLatestVideo(howToProcedure).id : null);
          return id ? savedVideos.has(id) : false;
        })()}
        onToggleSave={(id) => handleToggleSaveVideo(id)}
      />
      <ImageLightboxModal
        ref={lightboxRef}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title={lightboxTitle}
      />
      <TimeOutModal
        open={timeOutModalOpen}
        activeCase={activeCase}
        patientDob={PATIENT_CLINICAL[activeCase.id]?.dob}
        patientMrn={activeCase.patientMrn}
        allergiesLine={
          PATIENT_CLINICAL[activeCase.id]?.allergies.length
            ? PATIENT_CLINICAL[activeCase.id].allergies
                .map((a) => `${a.agent} (${a.severity})`)
                .join(", ")
            : "NKDA"
        }
        checked={timeOutChecked}
        onToggle={handleToggleTimeOutItem}
        onContinue={() => {
          setTimeOutModalOpen(false);
          setPhase("intraop");
        }}
        onCancel={() => setTimeOutModalOpen(false)}
      />
      <ResetAllConfirmModal
        open={resetAllConfirmOpen}
        onCancel={() => setResetAllConfirmOpen(false)}
        onConfirm={() => {
          resetAllSmartDeviceStates();
          smartSettingsActionsRef.current?.reloadAllStates();
          setResetAllConfirmOpen(false);
        }}
      />
    </div>
  );
}
