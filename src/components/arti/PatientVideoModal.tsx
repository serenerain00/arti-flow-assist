import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Captions,
  CaptionsOff,
  Sparkles,
  Clock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatientVideo, PatientVideoCaption } from "./cases";

/**
 * Imperative handle exposed to AwakeDashboard so voice transport tools
 * (play / pause / restart / toggle captions) can drive the player without
 * lifting state out of the modal.
 */
export interface PatientVideoHandle {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  restart: () => void;
  setCaptions: (on: boolean) => void;
  toggleCaptions: () => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  isOpen: () => boolean;
}

export interface PatientVideoSession {
  /** ISO timestamp of when the modal opened. */
  openedAtIso: string;
  /** ISO timestamp of when the modal closed (null while still open). */
  closedAtIso: string | null;
  /** Highest playback position reached, in seconds. */
  peakWatchedSec: number;
  /** Total wall-clock seconds the modal stayed open. */
  openDurationSec: number;
  /** True once the user reached the end of the clip in this session. */
  completed: boolean;
  /** Who opened it ("Voice · Arti" or "Tap" — whatever the parent passed in). */
  openedBy: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  video: PatientVideo;
  patientName: string;
  /**
   * Fires every time the session log meaningfully changes (open, progress
   * watermark, completion, close). Parent persists this on the case so the
   * surgeon panel can show "viewed at HH:MM, watched 42s of 1:24".
   */
  onSession: (session: PatientVideoSession) => void;
}

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function activeCaption(
  transcript: PatientVideoCaption[],
  currentSec: number,
): PatientVideoCaption | null {
  if (!transcript.length) return null;
  let active: PatientVideoCaption | null = null;
  for (const line of transcript) {
    if (line.startSec <= currentSec) active = line;
    else break;
  }
  return active;
}

export const PatientVideoModal = forwardRef<PatientVideoHandle, Props>(function PatientVideoModal(
  { open, onClose, video, patientName, onSession },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  // Default muted so the browser always lets us autoplay — the OR team
  // unmutes via the on-screen button or voice ("unmute"). Without this,
  // browsers reject programmatic .play() that doesn't carry a fresh user
  // gesture, and the voice "play" command silently fails.
  const [muted, setMuted] = useState(true);

  // Session-tracking refs — kept in refs so we can emit on close without
  // depending on stale closure values, and so React state updates don't
  // re-trigger the open effect.
  const openedAtRef = useRef<Date | null>(null);
  const peakWatchedRef = useRef(0);
  const completedRef = useRef(false);

  const emit = useCallback(() => {
    const opened = openedAtRef.current;
    if (!opened) return;
    const now = new Date();
    onSession({
      openedAtIso: opened.toISOString(),
      closedAtIso: open ? null : now.toISOString(),
      peakWatchedSec: peakWatchedRef.current,
      openDurationSec: Math.max(0, Math.round((now.getTime() - opened.getTime()) / 1000)),
      completed: completedRef.current,
      openedBy: "Voice · Arti",
    });
  }, [open, onSession]);

  // Open / close lifecycle. Emit a single "opened" event on open, and a
  // final "closed" event on close. Reset the tracking so re-open starts
  // a fresh session.
  useEffect(() => {
    if (open) {
      openedAtRef.current = new Date();
      peakWatchedRef.current = 0;
      completedRef.current = false;
      setCurrentSec(0);
      setPlaying(false);
      // Emit synchronously so the surgeon panel reflects the open state
      // before the user can navigate away.
      onSession({
        openedAtIso: openedAtRef.current.toISOString(),
        closedAtIso: null,
        peakWatchedSec: 0,
        openDurationSec: 0,
        completed: false,
        openedBy: "Voice · Arti",
      });
      return;
    }
    // Modal is closing — flush a final session entry.
    if (openedAtRef.current) {
      emit();
      openedAtRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard escape closes the modal.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  /**
   * Try to play() the video. Browsers reject unmuted programmatic .play()
   * that doesn't carry a fresh user gesture (voice commands don't qualify).
   * If that happens, fall back to muted playback so something happens — the
   * staff can then unmute. Returns the final muted state actually applied.
   */
  const safePlay = useCallback(async (): Promise<boolean> => {
    const el = videoRef.current;
    if (!el) return muted;
    try {
      await el.play();
      return el.muted;
    } catch {
      // Retry with muted — always allowed.
      el.muted = true;
      setMuted(true);
      try {
        await el.play();
      } catch {
        /* even muted blocked — leave the overlay play button visible */
      }
      return true;
    }
  }, [muted]);

  // Autoplay on open — runs after <video> mounts. The element has the
  // `muted` attribute so this is unconditionally allowed.
  useEffect(() => {
    if (!open) return;
    setMuted(true); // re-arm muted state every time the modal opens
    const id = window.setTimeout(() => {
      void safePlay();
    }, 120);
    return () => window.clearTimeout(id);
  }, [open, safePlay]);

  useImperativeHandle(
    ref,
    (): PatientVideoHandle => ({
      play: () => {
        void safePlay();
      },
      pause: () => {
        const el = videoRef.current;
        if (el) el.pause();
      },
      togglePlay: () => {
        const el = videoRef.current;
        if (!el) return;
        if (el.paused) void safePlay();
        else el.pause();
      },
      restart: () => {
        const el = videoRef.current;
        if (!el) return;
        el.currentTime = 0;
        void safePlay();
      },
      setCaptions: (on) => setCaptionsOn(on),
      toggleCaptions: () => setCaptionsOn((v) => !v),
      mute: () => {
        const el = videoRef.current;
        if (el) el.muted = true;
        setMuted(true);
      },
      unmute: () => {
        const el = videoRef.current;
        if (!el) return;
        el.muted = false;
        setMuted(false);
        // If unmute was requested while paused, resume.
        if (el.paused) void safePlay();
      },
      toggleMute: () => {
        const el = videoRef.current;
        if (!el) return;
        const next = !el.muted;
        el.muted = next;
        setMuted(next);
        if (!next && el.paused) void safePlay();
      },
      isOpen: () => open,
    }),
    [open, safePlay],
  );

  // Auto-scroll the transcript so the active caption stays in view.
  useEffect(() => {
    if (!transcriptOpen) return;
    const container = transcriptScrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>("[data-active='true']");
    if (active) active.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentSec, transcriptOpen]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  const restart = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = 0;
    void el.play();
  }, []);

  const seekToCaption = useCallback((startSec: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = startSec;
    void el.play();
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const t = el.currentTime;
    setCurrentSec(t);
    if (t > peakWatchedRef.current) peakWatchedRef.current = t;
  }, []);

  const handleEnded = useCallback(() => {
    completedRef.current = true;
    setPlaying(false);
    emit();
  }, [emit]);

  const handlePlay = useCallback(() => setPlaying(true), []);
  const handlePause = useCallback(() => setPlaying(false), []);

  const caption = captionsOn ? activeCaption(video.transcript, currentSec) : null;
  const progressPct =
    video.durationSec > 0 ? Math.min(100, (currentSec / video.durationSec) * 100) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="patient-video-root"
          role="dialog"
          aria-modal
          aria-label={`Pre-op video from ${patientName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative flex max-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div data-scroll-modal className="flex min-w-0 flex-1 flex-col overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    <span>Pre-op patient message</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Recorded {video.recordedAt}</span>
                  </div>
                  <h3 className="mt-1 truncate text-xl font-light">{patientName}</h3>
                  <div className="mt-1 flex items-center gap-3 text-[11px] font-light text-muted-foreground">
                    <span>{video.summary}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const el = videoRef.current;
                      if (!el) return;
                      const next = !el.muted;
                      el.muted = next;
                      setMuted(next);
                      if (!next && el.paused) void safePlay();
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-light transition-colors",
                      muted
                        ? "border-warning/60 bg-warning/10 text-warning"
                        : "border-primary/60 bg-primary/10 text-foreground",
                    )}
                    aria-pressed={!muted}
                    title={muted ? "Unmute audio" : "Mute audio"}
                  >
                    {muted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    {muted ? "Muted" : "Audio on"}
                  </button>
                  <button
                    onClick={() => setCaptionsOn((v) => !v)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      captionsOn
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                    aria-pressed={captionsOn}
                    title={captionsOn ? "Hide closed captions" : "Show closed captions"}
                  >
                    {captionsOn ? (
                      <Captions className="h-3.5 w-3.5" />
                    ) : (
                      <CaptionsOff className="h-3.5 w-3.5" />
                    )}
                    CC
                  </button>
                  <button
                    onClick={() => setTranscriptOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-light transition-colors",
                      transcriptOpen
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Transcript
                  </button>
                  <button
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Video area */}
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  src={video.src}
                  poster={video.poster}
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover"
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onEnded={handleEnded}
                  muted={muted}
                  autoPlay
                  playsInline
                />
                {/* Click overlay */}
                <button
                  onClick={togglePlay}
                  className="group absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/30 via-transparent to-transparent text-white"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  <span
                    className={cn(
                      "flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary transition-opacity",
                      playing ? "opacity-0 group-hover:opacity-100" : "opacity-90",
                    )}
                  >
                    {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
                  </span>
                </button>

                {/* Muted-audio prompt — visible while the video is playing
                    silently so staff know they can enable audio. Tapping it
                    counts as a fresh user gesture, so unmute always works. */}
                {playing && muted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const el = videoRef.current;
                      if (!el) return;
                      el.muted = false;
                      setMuted(false);
                    }}
                    className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-warning/60 bg-warning/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-warning shadow-lg backdrop-blur-sm transition-colors hover:bg-warning/25"
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    Muted — tap or say "unmute"
                  </button>
                )}

                {/* Closed-caption overlay */}
                {caption && (
                  <div className="pointer-events-none absolute inset-x-6 bottom-6 flex justify-center">
                    <span className="rounded-md bg-black/75 px-3 py-1.5 text-center text-base font-light leading-snug text-white shadow-lg backdrop-blur-sm">
                      {caption.text}
                    </span>
                  </div>
                )}
              </div>

              {/* Progress + transport */}
              <div className="px-6 pt-4">
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="absolute left-0 top-0 h-full bg-primary"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span>{fmtClock(currentSec)}</span>
                  <span>{fmtClock(video.durationSec)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-6 py-4">
                <button
                  onClick={restart}
                  title="Restart"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary transition-transform hover:scale-105"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </button>
                <div className="ml-auto flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Watched {fmtClock(peakWatchedRef.current)} /{" "}
                    {fmtClock(video.durationSec)}
                  </span>
                  {completedRef.current && (
                    <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-success">
                      full play
                    </span>
                  )}
                </div>
              </div>

              {/* AI insights */}
              <div className="border-t border-border bg-surface-2/40 px-6 py-4">
                <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-accent/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI-extracted insights
                </div>
                <ul className="space-y-1.5">
                  {video.aiInsights.map((insight, i) => (
                    <li
                      key={i}
                      className="flex gap-2 rounded-xl border border-border/40 bg-surface-3/40 px-3 py-2 text-xs font-light leading-relaxed text-foreground/85"
                    >
                      <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Voice hints */}
              <div className="border-t border-border bg-surface-2/60 px-6 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Voice <span className="text-primary">›</span> "open patient video" · "close patient
                video" · "show captions"
              </div>
            </div>

            {/* Transcript pane */}
            {transcriptOpen && (
              <aside
                ref={transcriptScrollRef}
                data-scroll-modal
                className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface-2/60"
              >
                <div className="sticky top-0 z-10 border-b border-border bg-surface-2/95 px-5 py-4 backdrop-blur">
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    Transcript
                  </div>
                  <div className="mt-0.5 text-sm font-light text-foreground/80">
                    {patientName} · {fmtClock(video.durationSec)}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 px-3 py-3">
                  {video.transcript.map((line, i) => {
                    const next = video.transcript[i + 1];
                    const endSec = next ? next.startSec : video.durationSec;
                    const isActive = currentSec >= line.startSec && currentSec < endSec;
                    return (
                      <button
                        key={`${line.startSec}-${i}`}
                        onClick={() => seekToCaption(line.startSec)}
                        data-active={isActive}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left transition-colors",
                          isActive
                            ? "border-primary/50 bg-primary/[0.08] text-foreground"
                            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                          {fmtClock(line.startSec)}
                        </div>
                        <div className="mt-0.5 text-sm font-light leading-snug">{line.text}</div>
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
