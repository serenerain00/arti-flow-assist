import { useCallback, useEffect, useRef, useState } from "react";
import { processVoiceCommand, type ArtiToolCall } from "@/server/arti";
import { speakText } from "@/server/elevenlabs";

export type ArtiToolResult =
  | { ok: true; state?: Record<string, unknown> }
  | { ok: false; reason: string };

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";
export type QuadPanelId = "timeout" | "instruments" | "alerts" | "team";
export type ActiveRole = "nurse" | "scrub" | "surgeon" | "anesthesia";

export interface ArtiVoiceCallbacks {
  onWake?: () => void;
  onGoHome: () => void;
  onShowCases: () => void;
  onOpenCase: (query: string) => void;
  onSleep: () => void;
  /** Navigate to the Schedule (calendar) screen. */
  onShowSchedule?: () => void;
  /** Navigate to the Surgeons directory screen. */
  onShowSurgeons?: () => void;
  /** Navigate to today's Patients screen. */
  onShowPatients?: () => void;
  /** Navigate to the OR equipment-tower Consoles screen. */
  onShowConsoles?: () => void;
  /** Focus one console on the tower (camera/pump/shaver/rf/light/image). */
  onFocusConsole?: (id: string) => void;
  /** Navigate to the curated surgical Video Library screen. */
  onShowLibrary?: () => void;
  /**
   * Close whichever overlay is currently topmost. Called when the user
   * says generic "close" / "dismiss" / "close that" with no specific
   * target — the route picks the right thing based on z-order priority.
   */
  onCloseTopmostModal?: () => void;
  /** Filter the Video Library by anatomic region (or "All" to clear). */
  onLibraryFilterCategory?: (category: string) => void;
  /** Set the Video Library search box (empty string clears). */
  onLibrarySearch?: (query: string) => void;
  /** Toggle the Video Library "Animated only" checkbox. */
  onLibrarySetAnimatedOnly?: (enabled: boolean) => void;
  /** Toggle the Video Library "Saved only" filter. */
  onLibrarySetSavedOnly?: (enabled: boolean) => void;
  /** Reset every Video Library filter to defaults. */
  onLibraryClearFilters?: () => void;
  /** Convenience: navigate to the library and apply the saved-only filter. */
  onShowSavedVideos?: () => void;
  /**
   * Save a video to the user's "saved" set. Without args, saves the
   * currently-open how-to video. With `id`, saves that exact library id.
   * With `query`, resolves a video by free-text and saves it.
   */
  onSaveVideo?: (id?: string, query?: string) => ArtiToolResult;
  onUnsaveVideo?: (id?: string, query?: string) => ArtiToolResult;
  onToggleSaveVideo?: (id?: string, query?: string) => ArtiToolResult;
  /** Switch to the calm sunrise screensaver (pre-patient ambient mode). */
  onStartScreensaver?: () => void;
  /** Exit the screensaver back to home. */
  onExitScreensaver?: () => void;
  // ── Journey walkthrough ────────────────────────────────────────────
  onStartJourney?: () => void;
  onExitJourney?: () => void;
  onJourneyPause?: () => void;
  onJourneyResume?: () => void;
  onJourneyNext?: () => void;
  onJourneyPrevious?: () => void;
  /** Open the day detail on the Schedule. `date` is an ISO key YYYY-MM-DD. */
  onShowScheduleDay?: (date: string) => void;
  /** Close the Schedule day-detail drawer without leaving the Schedule screen. */
  onCloseScheduleDay?: () => void;
  /** Schedule a one-shot reminder. `minutes` is from-now delay. */
  onSetReminder?: (text: string, minutes: number) => void;
  /** Cancel all pending reminders. */
  onCancelReminders?: () => void;
  /** Dismiss the currently visible reminder toast(s). */
  onDismissReminderAlert?: () => void;
  /** Set visible service lines on Schedule. Pass full desired list. */
  onScheduleSetServiceLines?: (lines: string[]) => void;
  /** Filter Schedule by surgeon. Empty string = clear surgeon filter. */
  onScheduleSetSurgeon?: (surgeon: string) => void;
  /** Reset all Schedule filters to defaults. */
  onScheduleClearFilters?: () => void;
  /** Open the Person Schedule modal for a specific person. */
  onShowPersonSchedule?: (name: string, role: string) => void;
  /** Change the Person Schedule modal's time scope. */
  onSetPersonScheduleView?: (view: string) => void;
  /** Close the Person Schedule modal. */
  onClosePersonSchedule?: () => void;
  onToggleTimeOutItem?: (id: TimeOutId) => ArtiToolResult;
  onAdjustInstrumentCount?: (item: InstrumentId, delta: number) => ArtiToolResult;
  /** Set an instrument count to an absolute value (replaces the current count). */
  onSetInstrumentCount?: (item: InstrumentId, value: number) => ArtiToolResult;
  onDismissAlert?: (index: number) => ArtiToolResult;
  onOpenQuadView?: () => ArtiToolResult;
  onFocusQuadPanel?: (panel: QuadPanelId) => ArtiToolResult;
  onCloseQuadView?: () => ArtiToolResult;
  onOpenHowToVideo?: (procedure?: string, title?: string, id?: string) => ArtiToolResult;
  /** Open the how-to viewer with the research-papers panel expanded. */
  onOpenResearchPapers?: (procedure?: string, topic?: string) => ArtiToolResult;
  /** Resume video playback. */
  onVideoPlay?: () => ArtiToolResult;
  /** Pause video playback. */
  onVideoPause?: () => ArtiToolResult;
  /** Seek the video by a signed offset (negative = back, positive = forward). */
  onVideoSeek?: (direction: "forward" | "back", seconds: number) => ArtiToolResult;
  onVideoNextChapter?: () => ArtiToolResult;
  onVideoPrevChapter?: () => ArtiToolResult;
  onVideoRestart?: () => ArtiToolResult;
  onVideoSetSpeed?: (rate: number) => ArtiToolResult;
  onVideoShowPapers?: () => ArtiToolResult;
  onVideoHidePapers?: () => ArtiToolResult;
  onVideoOpenPaper?: (q: { index?: number; keyword?: string }) => ArtiToolResult;
  onVideoClosePaper?: () => ArtiToolResult;
  onCloseHowToVideo?: () => ArtiToolResult;
  onShowPreferenceCard?: () => ArtiToolResult;
  /**
   * Open the surgeon preference-card images lightbox. Optional args resolve a
   * specific case (by patient name / 'next' / procedure short-code) when the
   * user asks "show pref card images for the next case" from any screen.
   * Auto-navigates to that case's preop and opens the lightbox.
   */
  onShowPreferenceCardLayoutImages?: (caseQuery?: string, procedure?: string) => ArtiToolResult;
  onSwitchRole?: (role: ActiveRole) => ArtiToolResult;
  onOpenPatientDetails?: () => ArtiToolResult;
  onClosePatientDetails?: () => ArtiToolResult;
  /** Open the pre-op patient video modal on the surgeon panel. */
  onOpenPatientVideo?: () => ArtiToolResult;
  onClosePatientVideo?: () => ArtiToolResult;
  onPlayPatientVideo?: () => ArtiToolResult;
  onPausePatientVideo?: () => ArtiToolResult;
  onRestartPatientVideo?: () => ArtiToolResult;
  onTogglePatientVideoCaptions?: () => ArtiToolResult;
  onMutePatientVideo?: () => ArtiToolResult;
  onUnmutePatientVideo?: () => ArtiToolResult;
  /** Open the PACS-style imaging viewer (patient X-rays / MRI / CT). */
  onOpenXrays?: () => ArtiToolResult;
  onCloseXrays?: () => ArtiToolResult;
  onXraysNextView?: () => ArtiToolResult;
  onXraysPrevView?: () => ArtiToolResult;
  /** Jump to a view by free-text label ("AP", "axillary", "MRI"). */
  onXraysShowView?: (query: string) => ArtiToolResult;
  onXraysZoomIn?: () => ArtiToolResult;
  onXraysZoomOut?: () => ArtiToolResult;
  onXraysResetZoom?: () => ArtiToolResult;
  onToggleOpeningChecklistItem?: (index: number) => ArtiToolResult;
  onToggleMachineCheckItem?: (index: number) => ArtiToolResult;
  onOpenTableLayoutImages?: () => ArtiToolResult;
  onLightboxNext?: () => ArtiToolResult;
  onLightboxPrev?: () => ArtiToolResult;
  onLightboxZoomIn?: () => ArtiToolResult;
  onLightboxZoomOut?: () => ArtiToolResult;
  onCloseLightbox?: () => ArtiToolResult;
  onScroll?: (direction: string, speed: string, continuous: boolean) => ArtiToolResult;
  onStopScroll?: () => ArtiToolResult;
  onUserTranscript?: (text: string) => void;
  onAgentResponse?: (text: string) => void;
  /** Returns a plain-text snapshot of live UI state for Claude's context window. */
  getContext?: () => string;
}

type SpeechRecognitionResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((ev: { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> }) => void)
    | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function executeToolCall(call: ArtiToolCall, cb: ArtiVoiceCallbacks): void {
  const inp = call.input;
  switch (call.name) {
    case "wake":
      cb.onWake?.();
      break;
    case "navigate_home":
      cb.onGoHome();
      break;
    case "navigate_cases":
      cb.onShowCases();
      break;
    case "open_case":
      cb.onOpenCase(String(inp.query ?? ""));
      break;
    case "sleep":
      cb.onSleep();
      break;
    case "navigate_schedule":
      cb.onShowSchedule?.();
      break;
    case "navigate_surgeons":
      cb.onShowSurgeons?.();
      break;
    case "navigate_patients":
      cb.onShowPatients?.();
      break;
    case "navigate_consoles":
      cb.onShowConsoles?.();
      break;
    case "focus_console":
      cb.onFocusConsole?.(String(inp.id ?? ""));
      break;
    case "navigate_library":
      cb.onShowLibrary?.();
      break;
    case "close_topmost_modal":
      cb.onCloseTopmostModal?.();
      break;
    case "library_filter_category":
      cb.onLibraryFilterCategory?.(String(inp.category ?? "All"));
      break;
    case "library_search":
      cb.onLibrarySearch?.(String(inp.query ?? ""));
      break;
    case "library_set_animated_only":
      cb.onLibrarySetAnimatedOnly?.(Boolean(inp.enabled));
      break;
    case "library_set_saved_only":
      cb.onLibrarySetSavedOnly?.(Boolean(inp.enabled));
      break;
    case "library_clear_filters":
      cb.onLibraryClearFilters?.();
      break;
    case "show_saved_videos":
      cb.onShowSavedVideos?.();
      break;
    case "save_video":
      cb.onSaveVideo?.(
        inp.id != null ? String(inp.id) : undefined,
        inp.query != null ? String(inp.query) : undefined,
      );
      break;
    case "unsave_video":
      cb.onUnsaveVideo?.(
        inp.id != null ? String(inp.id) : undefined,
        inp.query != null ? String(inp.query) : undefined,
      );
      break;
    case "toggle_save_video":
      cb.onToggleSaveVideo?.(
        inp.id != null ? String(inp.id) : undefined,
        inp.query != null ? String(inp.query) : undefined,
      );
      break;
    case "start_screensaver":
      cb.onStartScreensaver?.();
      break;
    case "exit_screensaver":
      cb.onExitScreensaver?.();
      break;
    case "start_journey":
      cb.onStartJourney?.();
      break;
    case "exit_journey":
      cb.onExitJourney?.();
      break;
    case "journey_pause":
      cb.onJourneyPause?.();
      break;
    case "journey_resume":
      cb.onJourneyResume?.();
      break;
    case "journey_next":
      cb.onJourneyNext?.();
      break;
    case "journey_previous":
      cb.onJourneyPrevious?.();
      break;
    case "show_schedule_day":
      cb.onShowScheduleDay?.(String(inp.date ?? ""));
      break;
    case "close_schedule_day":
      cb.onCloseScheduleDay?.();
      break;
    case "set_reminder":
      cb.onSetReminder?.(String(inp.text ?? ""), Number(inp.minutes ?? 0));
      break;
    case "cancel_reminders":
      cb.onCancelReminders?.();
      break;
    case "dismiss_reminder_alert":
      cb.onDismissReminderAlert?.();
      break;
    case "schedule_set_service_lines":
      cb.onScheduleSetServiceLines?.(Array.isArray(inp.lines) ? inp.lines.map(String) : []);
      break;
    case "schedule_set_surgeon":
      cb.onScheduleSetSurgeon?.(String(inp.surgeon ?? ""));
      break;
    case "schedule_clear_filters":
      cb.onScheduleClearFilters?.();
      break;
    case "show_person_schedule":
      cb.onShowPersonSchedule?.(String(inp.name ?? ""), String(inp.role ?? ""));
      break;
    case "set_person_schedule_view":
      cb.onSetPersonScheduleView?.(String(inp.view ?? "day"));
      break;
    case "close_person_schedule":
      cb.onClosePersonSchedule?.();
      break;
    case "toggle_timeout_item":
      cb.onToggleTimeOutItem?.(inp.id as TimeOutId);
      break;
    case "adjust_instrument_count":
      cb.onAdjustInstrumentCount?.(inp.item as InstrumentId, Number(inp.delta));
      break;
    case "set_instrument_count":
      cb.onSetInstrumentCount?.(inp.item as InstrumentId, Number(inp.value));
      break;
    case "dismiss_alert":
      cb.onDismissAlert?.(Number(inp.index));
      break;
    case "open_quad_view":
      cb.onOpenQuadView?.();
      break;
    case "focus_quad_panel":
      cb.onFocusQuadPanel?.(inp.panel as QuadPanelId);
      break;
    case "close_quad_view":
      cb.onCloseQuadView?.();
      break;
    case "open_how_to_video":
      cb.onOpenHowToVideo?.(
        inp.procedure != null ? String(inp.procedure) : undefined,
        inp.title != null ? String(inp.title) : undefined,
        inp.id != null ? String(inp.id) : undefined,
      );
      break;
    case "open_research_papers":
      cb.onOpenResearchPapers?.(
        inp.procedure != null ? String(inp.procedure) : undefined,
        inp.topic != null ? String(inp.topic) : undefined,
      );
      break;
    case "video_play":
      cb.onVideoPlay?.();
      break;
    case "video_pause":
      cb.onVideoPause?.();
      break;
    case "video_seek":
      cb.onVideoSeek?.(
        String(inp.direction ?? "back") === "forward" ? "forward" : "back",
        Number(inp.seconds ?? 10),
      );
      break;
    case "video_next_chapter":
      cb.onVideoNextChapter?.();
      break;
    case "video_prev_chapter":
      cb.onVideoPrevChapter?.();
      break;
    case "video_restart":
      cb.onVideoRestart?.();
      break;
    case "video_set_speed":
      cb.onVideoSetSpeed?.(Number(inp.rate ?? 1));
      break;
    case "video_show_papers":
      cb.onVideoShowPapers?.();
      break;
    case "video_hide_papers":
      cb.onVideoHidePapers?.();
      break;
    case "video_open_paper":
      cb.onVideoOpenPaper?.({
        index: inp.index != null ? Number(inp.index) : undefined,
        keyword: inp.keyword != null ? String(inp.keyword) : undefined,
      });
      break;
    case "video_close_paper":
      cb.onVideoClosePaper?.();
      break;
    case "close_how_to_video":
      cb.onCloseHowToVideo?.();
      break;
    case "show_preference_card":
      cb.onShowPreferenceCard?.();
      break;
    case "show_preference_card_layout_images":
      cb.onShowPreferenceCardLayoutImages?.(
        inp.case_query != null ? String(inp.case_query) : undefined,
        inp.procedure != null ? String(inp.procedure) : undefined,
      );
      break;
    case "switch_role":
      cb.onSwitchRole?.(inp.role as ActiveRole);
      break;
    case "open_patient_video":
      cb.onOpenPatientVideo?.();
      break;
    case "close_patient_video":
      cb.onClosePatientVideo?.();
      break;
    case "play_patient_video":
      cb.onPlayPatientVideo?.();
      break;
    case "pause_patient_video":
      cb.onPausePatientVideo?.();
      break;
    case "restart_patient_video":
      cb.onRestartPatientVideo?.();
      break;
    case "toggle_patient_video_captions":
      cb.onTogglePatientVideoCaptions?.();
      break;
    case "mute_patient_video":
      cb.onMutePatientVideo?.();
      break;
    case "unmute_patient_video":
      cb.onUnmutePatientVideo?.();
      break;
    case "open_xrays":
      cb.onOpenXrays?.();
      break;
    case "close_xrays":
      cb.onCloseXrays?.();
      break;
    case "xrays_next_view":
      cb.onXraysNextView?.();
      break;
    case "xrays_prev_view":
      cb.onXraysPrevView?.();
      break;
    case "xrays_show_view":
      cb.onXraysShowView?.(String(inp.query ?? ""));
      break;
    case "xrays_zoom_in":
      cb.onXraysZoomIn?.();
      break;
    case "xrays_zoom_out":
      cb.onXraysZoomOut?.();
      break;
    case "xrays_reset_zoom":
      cb.onXraysResetZoom?.();
      break;
    case "open_patient_details":
      cb.onOpenPatientDetails?.();
      break;
    case "close_patient_details":
      cb.onClosePatientDetails?.();
      break;
    case "toggle_opening_checklist_item":
      cb.onToggleOpeningChecklistItem?.(Number(inp.index));
      break;
    case "toggle_machine_check_item":
      cb.onToggleMachineCheckItem?.(Number(inp.index));
      break;
    case "open_table_layout_images":
      cb.onOpenTableLayoutImages?.();
      break;
    case "lightbox_next":
      cb.onLightboxNext?.();
      break;
    case "lightbox_prev":
      cb.onLightboxPrev?.();
      break;
    case "lightbox_zoom_in":
      cb.onLightboxZoomIn?.();
      break;
    case "lightbox_zoom_out":
      cb.onLightboxZoomOut?.();
      break;
    case "close_lightbox":
      cb.onCloseLightbox?.();
      break;
    case "scroll":
      cb.onScroll?.(
        String(inp.direction ?? "down"),
        String(inp.speed ?? "normal"),
        Boolean(inp.continuous ?? false),
      );
      break;
    case "stop_scroll":
      cb.onStopScroll?.();
      break;
  }
}

export function useArtiVoice(callbacks: ArtiVoiceCallbacks) {
  const cbRef = useRef(callbacks);
  useEffect(() => {
    cbRef.current = callbacks;
  }, [callbacks]);

  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionActiveRef = useRef(false);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  // Ref to the active Audio element so stopSpeaking() can cut TTS mid-sentence.
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  // 0–1 progress of the active TTS playback. Polled by callers (e.g. the
  // journey screen's progress bars) via getAudioProgress() — kept as a ref
  // (not state) so timeupdate-driven updates don't force re-renders at
  // 30+ Hz throughout the app.
  const audioProgressRef = useRef(0);
  // Stored resolve for the current speak() Promise — lets stopSpeaking() settle
  // it immediately so processingRef is always released even on interrupt.
  const speakResolveRef = useRef<(() => void) | null>(null);
  // Rolling conversation history — last 8 messages (4 pairs) sent to Claude.
  const historyRef = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  // Blocks voice input briefly after TTS ends to prevent capturing reverb/echo.
  const postSpeechCooldownRef = useRef(false);

  // Safely restart recognition after TTS — clears dead ref instead of silent swallow.
  const restartRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch {
      // rec is unrecoverable — clear it so startListening creates a fresh instance.
      recognitionRef.current = null;
      setListening(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = "";
      activeAudioRef.current = null;
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    postSpeechCooldownRef.current = false;
    // Settle the pending speak() Promise so the finally{} in handleTranscript
    // always runs and processingRef is released even when interrupted.
    if (speakResolveRef.current) {
      speakResolveRef.current();
      speakResolveRef.current = null;
    }
    restartRecognition();
  }, [restartRecognition]);

  // Plays pre-fetched MP3 base64 audio. Split out from speak() so the TTS
  // network call can be kicked off in parallel with tool execution — by the
  // time tools finish their state updates, the MP3 bytes are usually ready.
  const playAudio = useCallback(
    async (audioBase64: string) => {
      // Cancel any audio still playing from a prior speak() call. Without
      // this, concurrent speak() invocations (React strict-mode double-
      // invoke, rapid back-to-back stage transitions, leftover speech from
      // a previous turn) leak overlapping audio streams — both Audio
      // elements stay live because we only overwrite the ref. We pause +
      // clear the previous element AND resolve its pending promise so its
      // caller can clean up too.
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
        activeAudioRef.current = null;
      }
      if (speakResolveRef.current) {
        speakResolveRef.current();
        speakResolveRef.current = null;
      }

      isSpeakingRef.current = true;
      setIsSpeaking(true);
      audioProgressRef.current = 0;
      // Stop the recognizer before audio plays so restartRecognition() after
      // playback sees it in a known-stopped state. Without this, continuous
      // recognition keeps running through TTS and rec.start() below throws
      // "already started", which the catch used to treat as fatal —
      // orphaning the live rec and leaving the mic unrecoverable after the
      // first response.
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      try {
        await new Promise<void>((resolve, reject) => {
          speakResolveRef.current = resolve;
          const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
          activeAudioRef.current = audio;
          const cleanup = () => {
            speakResolveRef.current = null;
            if (activeAudioRef.current === audio) activeAudioRef.current = null;
            isSpeakingRef.current = false;
            setIsSpeaking(false);
          };
          audio.ontimeupdate = () => {
            if (audio.duration && !isNaN(audio.duration)) {
              audioProgressRef.current = audio.currentTime / audio.duration;
            }
          };
          audio.onended = () => {
            audioProgressRef.current = 1;
            cleanup();
            // 250 ms cooldown is enough to clear speaker reverb at typical
            // OR-display volume; the previous 500 ms felt sluggish in
            // back-to-back turns.
            postSpeechCooldownRef.current = true;
            setTimeout(() => {
              postSpeechCooldownRef.current = false;
            }, 250);
            restartRecognition();
            resolve();
          };
          audio.onerror = () => {
            cleanup();
            restartRecognition();
            reject(new Error("Audio playback failed"));
          };
          audio.play().catch(reject);
        });
      } catch (err) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        activeAudioRef.current = null;
        speakResolveRef.current = null;
        restartRecognition();
        console.error("[arti-voice] Audio error", err);
      }
    },
    [restartRecognition],
  );

  /**
   * Announce that speech is imminent — sets isSpeakingRef + aborts the
   * recognizer NOW, before any network fetch starts.
   *
   * Why: the speakText fetch takes ~300-500 ms. Without this, SR stays
   * active during that window. When the audio finally plays, the speaker
   * output echoes into the mic, SR transcribes a fragment of Arti's
   * own narration ("...pause, fast, and quiet"), Claude interprets it
   * as a command, and fires spurious tools (e.g. journey_pause mid-
   * narration). Setting the flag synchronously closes that window.
   */
  const prepareToSpeak = useCallback(() => {
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    // Reset progress so the previous stage's "ended at 1" value doesn't
    // leak into the gap before the new stage's audio begins playing.
    audioProgressRef.current = 0;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      // Block SR before the fetch — see prepareToSpeak comment.
      prepareToSpeak();
      try {
        const { audioBase64 } = await speakText({ data: { text } });
        await playAudio(audioBase64);
      } catch (err) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        activeAudioRef.current = null;
        speakResolveRef.current = null;
        // TTS request failed — make sure the mic is restored so the next
        // utterance still gets through.
        restartRecognition();
        console.error("[arti-voice] TTS error", err);
      }
    },
    [playAudio, prepareToSpeak, restartRecognition],
  );

  // voiceInput=true  → must contain wake word OR be within the 10s follow-up window.
  // voiceInput=false → typed text; always processed (no wake word required).
  const handleTranscript = useCallback(
    async (transcript: string, voiceInput = false) => {
      if (voiceInput) {
        // Block while Arti's TTS is playing — mic picks up speaker output.
        if (isSpeakingRef.current) {
          console.log("[arti-voice] ignored (Arti speaking):", transcript);
          return;
        }
        if (postSpeechCooldownRef.current) {
          console.log("[arti-voice] ignored (post-speech cooldown):", transcript);
          return;
        }
        // Wake-word matcher. Browser SpeechRecognition routinely mishears
        // "Arti" as "already" (especially after "hi"/"hey") and sometimes
        // "hardy", so both are accepted as equivalents. Trade-off: a
        // genuine "already" said at session start ("patient is already
        // prepped") will wake Arti — we accept that since once a session
        // is active the wake word isn't required for follow-ups, and the
        // 60s idle timer puts Arti back to sleep on its own.
        const hasWakeWord = /\b(?:(?:art|ard)(?:i[ey]?|y)|already|hardy)\b/i.test(transcript);
        if (!hasWakeWord && !sessionActiveRef.current) {
          console.log("[arti-voice] ignored (no wake word):", transcript);
          return;
        }
      }
      if (processingRef.current) {
        console.log("[arti-voice] ignored (busy):", transcript);
        return;
      }
      processingRef.current = true;

      try {
        cbRef.current.onUserTranscript?.(transcript);

        const context = cbRef.current.getContext?.() ?? "";
        let response = "";
        let toolCalls: ArtiToolCall[] = [];

        try {
          const result = await processVoiceCommand({
            data: { transcript, context, history: historyRef.current },
          });
          response = result.response;
          toolCalls = result.toolCalls;
          console.log(
            "[arti-voice] tools:",
            toolCalls.map((t) => t.name),
            "response:",
            response,
          );
        } catch (err) {
          console.error("[arti-voice] Claude error", err);
          response = "I don't have that.";
        }

        // Kick off the TTS request in parallel with tool execution. The
        // ElevenLabs roundtrip is ~300–500 ms; tool execution is ~5–50 ms of
        // synchronous React state updates. Overlapping them shaves the tool
        // execution time off perceived latency, and means audio starts the
        // moment tools finish instead of after a serial network call.
        const ttsPromise = response ? speakText({ data: { text: response } }) : null;

        for (const call of toolCalls) {
          console.log("[arti-voice] executing tool:", call.name);
          executeToolCall(call, cbRef.current);
        }

        if (response) {
          cbRef.current.onAgentResponse?.(response);
          historyRef.current = [
            ...historyRef.current,
            { role: "user" as const, content: transcript },
            { role: "assistant" as const, content: response },
          ].slice(-8);
          try {
            const { audioBase64 } = await ttsPromise!;
            await playAudio(audioBase64);
          } catch (err) {
            console.error("[arti-voice] TTS error", err);
            restartRecognition();
          }
        }

        const isSleep = toolCalls.some((t) => t.name === "sleep");
        if (!isSleep && (response || toolCalls.length > 0)) {
          sessionActiveRef.current = true;
          if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
          sessionTimerRef.current = setTimeout(() => {
            sessionActiveRef.current = false;
          }, 30_000);
        }

        if (isSleep) {
          recognitionRef.current?.abort();
          recognitionRef.current = null;
          setListening(false);
          sessionActiveRef.current = false;
          historyRef.current = [];
          if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
        }
      } finally {
        // Always release the lock — prevents permanent "busy" state if a
        // network hang or unhandled error stops execution before completion.
        processingRef.current = false;
      }
    },
    [playAudio, restartRecognition],
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    // Chrome sometimes splits one phrase into multiple final segments
    // (e.g. "Arti open" + "Marcus Chen's case"). Buffer them within a
    // short window so Claude always receives the complete phrase.
    let finalBuffer = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushBuffer = () => {
      flushTimer = null;
      const transcript = finalBuffer.trim();
      finalBuffer = "";
      if (transcript) {
        console.log("[arti-voice] heard:", transcript);
        void handleTranscript(transcript, true);
      }
    };

    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        finalBuffer += " " + ev.results[i][0].transcript;
      }
      if (finalBuffer.trim()) {
        if (flushTimer) clearTimeout(flushTimer);
        // 120 ms is short enough that simple commands ("play", "pause") feel
        // instant, but long enough to still combine Chrome's occasional
        // multi-segment final result splits within ~100 ms. Longer pauses
        // (where the user actually paused mid-phrase) flush separately —
        // which is what we want.
        flushTimer = setTimeout(flushBuffer, 120);
      }
    };

    rec.onerror = (ev) => {
      const code = ev?.error ?? "unknown";
      if (code === "not-allowed" || code === "audio-capture") {
        // Fatal — mic permission denied, stop entirely.
        setError("Microphone access denied.");
        recognitionRef.current = null;
        setListening(false);
        return;
      }
      // Transient errors (aborted, network, no-speech, etc.) — leave
      // recognitionRef set so the onend handler restarts automatically.
    };

    rec.onend = () => {
      if (!recognitionRef.current) {
        setListening(false);
        return;
      }
      // If TTS is playing, Chrome can't restart the mic yet.
      // speak() will restart recognition once audio finishes.
      if (isSpeakingRef.current) return;
      try {
        rec.start();
      } catch {
        // rec entered a broken/unrecoverable state — clear the dead reference
        // so the next startListening() call creates a fresh instance instead
        // of seeing a non-null ref and returning early.
        recognitionRef.current = null;
        setListening(false);
      }
    };

    try {
      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err) {
      recognitionRef.current = null;
      console.warn("[arti-voice] could not start recognizer", err);
    }
  }, [handleTranscript]);

  const startListeningWrapped = useCallback(() => {
    // Belt-and-suspenders: if a prior Claude call hung and left processingRef
    // locked, reset it when the user explicitly opens a new session.
    processingRef.current = false;
    // Only refresh the session window when one was already open — don't create
    // a session from nothing. Cold orb taps still require the wake word so
    // ambient speech on the sleep/greeting screen never fires unintended commands.
    if (sessionActiveRef.current) {
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = setTimeout(() => {
        sessionActiveRef.current = false;
      }, 30_000);
    }
    startListening();
  }, [startListening]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  // Explicitly open a session window so the wake word isn't required for the
  // next 30 s. Used when navigating to an active screen without a voice command.
  const activateSession = useCallback(() => {
    sessionActiveRef.current = true;
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      sessionActiveRef.current = false;
    }, 180_000);
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    listening,
    isSpeaking,
    error,
    speak,
    /** Play pre-fetched MP3 base64 audio. Used by callers that want to
     * pre-warm TTS (e.g. journey screen pre-fetches stage 0 narration
     * before the screen mounts). */
    playAudio,
    /** Synchronously block SR + mark speaking before a TTS fetch starts.
     * Prevents the mic from transcribing Arti's own audio echo during the
     * fetch window (which would otherwise self-trigger commands). */
    prepareToSpeak,
    /** 0–1 playback position of the active TTS audio. Returns 0 while
     * preparing or between stages, 1 the instant the audio ends. Read in
     * an animation frame loop — does not trigger re-renders. */
    getAudioProgress: () => audioProgressRef.current,
    stopSpeaking,
    sendCommand: handleTranscript,
    startListening: startListeningWrapped,
    stopListening,
    activateSession,
    wakeWordSupported: typeof window !== "undefined" && getSpeechRecognitionCtor() !== null,
  };
}
