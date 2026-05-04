import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  X,
  Play,
  Pause,
  BookmarkPlus,
  BookmarkCheck,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Gauge,
  FileText,
  PanelRightOpen,
  PanelRightClose,
  ExternalLink,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  findLatestVideo,
  resolvePaper,
  PROCEDURE_VIDEOS,
  RESEARCH_PAPERS,
  type ProcedureVideo,
  type ResearchPaper,
} from "./videoLibrary";

// ── YouTube IFrame API typing ─────────────────────────────────────────────
//
// Loose typing for the YT.Player surface we actually use. Avoids pulling
// in @types/youtube (one less dep) and documents exactly which methods
// the modal touches.
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (videoId: string) => void;
  mute: () => void;
  destroy: () => void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data?: number;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTPlayerEvent) => void;
    onStateChange?: (e: YTPlayerEvent) => void;
    onError?: (e: YTPlayerEvent) => void;
  };
}

interface YTApi {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YTApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTApi> | null = null;

/** Inject the YouTube IFrame API script once and resolve when YT is ready. */
function loadYouTubeApi(): Promise<YTApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("ssr"));
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTApi>((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

// ── Public types ──────────────────────────────────────────────────────────

/** Public imperative handle — drives all voice transport & paper actions. */
export interface HowToVideoHandle {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  /** Jump by N seconds relative to current position (negative = back). */
  seekRelative: (seconds: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  restart: () => void;
  setSpeed: (rate: number) => void;
  showPapers: () => void;
  hidePapers: () => void;
  togglePapers: () => void;
  openPaper: (q: { id?: string; index?: number; keyword?: string }) => boolean;
  closePaper: () => void;
  getStatus: () => VideoModalStatus;
}

export interface VideoModalStatus {
  open: boolean;
  videoTitle: string;
  procedure: string;
  surgeon: string;
  channel: string;
  publishedYear: number;
  watchUrl: string;
  playing: boolean;
  speed: number;
  currentSec: number;
  durationSec: number;
  currentChapterIndex: number | null;
  chapters: Array<{ index: number; title: string; position: number }>;
  papersPanelOpen: boolean;
  activePaper: {
    id: string;
    title: string;
    authors: string;
    journal: string;
    year: number;
  } | null;
  papers: Array<{
    id: string;
    title: string;
    authors: string;
    journal: string;
    year: number;
  }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Legacy: free-text title used to resolve a video. */
  title?: string;
  /** Preferred: free-text procedure / keyword used to resolve a video. */
  procedure?: string;
  /**
   * Direct library-id override. When set, opens that exact video and skips
   * keyword resolution. Used by the Video Library cards so a click opens
   * the specific video the user picked, not just the best fuzzy match.
   */
  videoId?: string;
  /** When true, modal opens with research papers panel expanded. */
  initialPapersOpen?: boolean;
  /**
   * When set, modal opens with this paper expanded (id|index|keyword
   * resolved against the active video's papers).
   */
  initialPaperQuery?: string;
  /** True when the currently-resolved video is in the user's saved set. */
  saved?: boolean;
  /** Toggle the active video's saved state. */
  onToggleSave?: (videoId: string) => void;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

function paperPool(video: ProcedureVideo): ResearchPaper[] {
  return video.paperIds
    .map((id) => RESEARCH_PAPERS.find((p) => p.id === id))
    .filter((p): p is ResearchPaper => Boolean(p));
}

/**
 * In-context how-to viewer. Voice-first: every command issued through
 * Arti maps onto an imperative method. The modal also exposes
 * getStatus() so the route's live-context builder can describe what's
 * playing without lifting state up.
 */
export const HowToVideoModal = forwardRef<HowToVideoHandle, Props>(function HowToVideoModal(
  {
    open,
    onClose,
    title,
    procedure,
    videoId,
    initialPapersOpen,
    initialPaperQuery,
    saved,
    onToggleSave,
  }: Props,
  ref,
) {
  const playerContainerId = useId().replace(/[:]/g, "-") + "-yt";
  const playerRef = useRef<YTPlayer | null>(null);
  const playerReadyRef = useRef(false);

  // Resolve which video to show. Priority: explicit videoId > procedure
  // keyword > legacy title. Lets library cards open exact videos while
  // voice commands still flow through fuzzy keyword resolution.
  const video = useMemo<ProcedureVideo>(() => {
    if (videoId) {
      const direct = PROCEDURE_VIDEOS.find((v) => v.id === videoId);
      if (direct) return direct;
    }
    return findLatestVideo(procedure ?? title ?? undefined);
  }, [videoId, procedure, title]);

  const papers = useMemo<ResearchPaper[]>(() => paperPool(video), [video]);

  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [papersOpen, setPapersOpen] = useState<boolean>(Boolean(initialPapersOpen));
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  /**
   * Set when YT.Player onError fires. The most common causes are
   *   2  → invalid videoId
   *   5  → HTML5 player error
   *   100 → video removed / made private
   *   101 / 150 → owner disabled embedding (or video age-restricted)
   * In any of these cases we can't recover; we render a fallback card with
   * a "Watch on YouTube" link instead of leaving the user staring at a
   * blank black box.
   */
  const [embedError, setEmbedError] = useState(false);

  // Always-fresh refs so imperative methods don't need to be memoized on
  // every state change to read the latest values.
  const currentSecRef = useRef(currentSec);
  currentSecRef.current = currentSec;
  const durationSecRef = useRef(durationSec);
  durationSecRef.current = durationSec;

  // ── Player lifecycle ─────────────────────────────────────────────────
  // Initialize the YT player when the modal first opens. Switch videos
  // via loadVideoById when the resolved video changes while open.
  useEffect(() => {
    if (!open) return;
    let disposed = false;

    void loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        const el = document.getElementById(playerContainerId);
        if (!el) return;

        if (playerRef.current) {
          // Player already exists — just swap the video.
          try {
            playerRef.current.loadVideoById(video.youtubeId);
          } catch {
            /* ignore */
          }
          return;
        }

        playerRef.current = new YT.Player(el, {
          videoId: video.youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (e) => {
              playerReadyRef.current = true;
              try {
                e.target.mute(); // muted autoplay always works
                e.target.playVideo();
                setDurationSec(e.target.getDuration() || 0);
              } catch {
                /* ignore */
              }
            },
            onStateChange: (e) => {
              if (typeof e.data !== "number") return;
              if (e.data === 1)
                setPlaying(true); // PLAYING
              else if (e.data === 2 || e.data === 0 || e.data === 5) setPlaying(false);
              // Update duration on first play (sometimes 0 in onReady).
              try {
                const d = e.target.getDuration();
                if (d && d > 0) setDurationSec(d);
              } catch {
                /* ignore */
              }
            },
            onError: () => {
              playerReadyRef.current = false;
              setEmbedError(true);
            },
          },
        });
      })
      .catch(() => {
        /* ignore — script load failure */
      });

    return () => {
      disposed = true;
    };
  }, [open, video.youtubeId, playerContainerId]);

  // Tear down the player when the modal closes (frees the iframe + audio).
  useEffect(() => {
    if (open) return;
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      playerReadyRef.current = false;
      setCurrentSec(0);
      setDurationSec(0);
      setPlaying(false);
    }
  }, [open]);

  // Poll currentTime — YouTube IFrame API doesn't emit timeupdate.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p || !playerReadyRef.current) return;
      try {
        const t = p.getCurrentTime();
        if (Number.isFinite(t)) setCurrentSec(t);
        if (durationSecRef.current === 0) {
          const d = p.getDuration();
          if (d && d > 0) setDurationSec(d);
        }
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearInterval(id);
  }, [open]);

  // Reset internal state when the modal reopens or papers config changes.
  useEffect(() => {
    if (!open) return;
    setSpeed(1);
    setEmbedError(false); // Reset error so the new video gets a clean shot.
    setPapersOpen(Boolean(initialPapersOpen) || Boolean(initialPaperQuery));
    if (initialPaperQuery) {
      const found = resolvePaper(papers, { keyword: initialPaperQuery });
      setActivePaperId(found?.id ?? null);
    } else {
      setActivePaperId(null);
    }
  }, [open, video.id, initialPapersOpen, initialPaperQuery, papers]);

  // Keyboard escape — same affordance as the legacy modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const currentChapterIndex = useMemo<number | null>(() => {
    if (!video.chapters.length || durationSec <= 0) return null;
    let idx = 0;
    for (let i = 0; i < video.chapters.length; i++) {
      if (video.chapters[i].position * durationSec <= currentSec) idx = i;
      else break;
    }
    return idx;
  }, [video.chapters, currentSec, durationSec]);

  // Wrap player calls so a not-ready player never throws.
  const safe = useCallback(<T,>(fn: (p: YTPlayer) => T): T | undefined => {
    const p = playerRef.current;
    if (!p || !playerReadyRef.current) return undefined;
    try {
      return fn(p);
    } catch {
      return undefined;
    }
  }, []);

  const seekToSec = useCallback(
    (sec: number) => {
      const d = durationSecRef.current;
      if (d <= 0) return;
      const clamped = Math.max(0, Math.min(sec, d));
      safe((p) => p.seekTo(clamped, true));
      setCurrentSec(clamped);
    },
    [safe],
  );

  const seekToFraction = useCallback(
    (fraction: number) => {
      const d = durationSecRef.current;
      if (d <= 0) return;
      seekToSec(fraction * d);
    },
    [seekToSec],
  );

  // Always-fresh chapter index from refs — never use the closure-captured
  // `currentChapterIndex` inside imperative methods or rapid click handlers
  // because state may not have flushed between calls.
  const liveChapterIndex = useCallback((): number => {
    const d = durationSecRef.current;
    if (d <= 0 || !video.chapters.length) return 0;
    const cur = currentSecRef.current;
    let idx = 0;
    for (let i = 0; i < video.chapters.length; i++) {
      if (video.chapters[i].position * d <= cur) idx = i;
      else break;
    }
    return idx;
  }, [video.chapters]);

  // ── Imperative API ───────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    (): HowToVideoHandle => ({
      play: () => safe((p) => p.playVideo()),
      pause: () => safe((p) => p.pauseVideo()),
      togglePlay: () =>
        safe((p) => {
          const state = p.getPlayerState();
          if (state === 1) p.pauseVideo();
          else p.playVideo();
        }),
      seekRelative: (seconds: number) => {
        if (!Number.isFinite(seconds)) return;
        seekToSec(currentSecRef.current + seconds);
      },
      nextChapter: () => {
        if (!video.chapters.length) return;
        const i = liveChapterIndex();
        if (i >= video.chapters.length - 1) return; // already at last chapter
        seekToFraction(video.chapters[i + 1].position);
      },
      prevChapter: () => {
        if (!video.chapters.length) return;
        const i = liveChapterIndex();
        // Voice-first: always step back one chapter (no snap-to-start trick).
        // If we're already on chapter 0, seek to the very start so the user
        // gets visible feedback.
        const target = i > 0 ? video.chapters[i - 1] : video.chapters[0];
        seekToFraction(target.position);
      },
      restart: () => seekToSec(0),
      setSpeed: (rate: number) => {
        if (!Number.isFinite(rate) || rate <= 0) return;
        safe((p) => p.setPlaybackRate(rate));
        setSpeed(rate);
      },
      showPapers: () => setPapersOpen(true),
      hidePapers: () => {
        setPapersOpen(false);
        setActivePaperId(null);
      },
      togglePapers: () =>
        setPapersOpen((p) => {
          if (p) setActivePaperId(null);
          return !p;
        }),
      openPaper: (q) => {
        const found = resolvePaper(papers, q);
        if (!found) return false;
        setActivePaperId(found.id);
        setPapersOpen(true);
        return true;
      },
      closePaper: () => setActivePaperId(null),
      getStatus: (): VideoModalStatus => ({
        open,
        videoTitle: video.title,
        procedure: video.procedure,
        surgeon: video.surgeon,
        channel: video.channel,
        publishedYear: video.publishedYear,
        watchUrl: video.watchUrl,
        playing,
        speed,
        currentSec,
        durationSec,
        currentChapterIndex,
        chapters: video.chapters.map((c, i) => ({
          index: i,
          title: c.title,
          position: c.position,
        })),
        papersPanelOpen: papersOpen,
        activePaper: activePaperId
          ? (() => {
              const p = papers.find((pp) => pp.id === activePaperId);
              return p
                ? {
                    id: p.id,
                    title: p.title,
                    authors: p.authors,
                    journal: p.journal,
                    year: p.year,
                  }
                : null;
            })()
          : null,
        papers: papers.map((p) => ({
          id: p.id,
          title: p.title,
          authors: p.authors,
          journal: p.journal,
          year: p.year,
        })),
      }),
    }),
    [
      video,
      papers,
      currentChapterIndex,
      open,
      playing,
      speed,
      currentSec,
      durationSec,
      papersOpen,
      activePaperId,
      seekToSec,
      seekToFraction,
      liveChapterIndex,
      safe,
    ],
  );

  const togglePlay = () =>
    safe((p) => {
      const state = p.getPlayerState();
      if (state === 1) p.pauseVideo();
      else p.playVideo();
    });

  const cycleSpeed = () => {
    const idx = PLAYBACK_SPEEDS.indexOf(speed as (typeof PLAYBACK_SPEEDS)[number]);
    const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
    safe((p) => p.setPlaybackRate(next));
    setSpeed(next);
  };

  const seekProgressBar = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekToFraction(Math.max(0, Math.min(1, pct)));
  };

  const activePaper = activePaperId ? (papers.find((p) => p.id === activePaperId) ?? null) : null;

  const progressPct = durationSec > 0 ? (currentSec / durationSec) * 100 : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="howto-root"
          role="dialog"
          aria-modal
          aria-label={video.title}
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
              {/* ── Header ───────────────────────────────────────────── */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                    <span>{video.channel}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Pulled by Arti</span>
                  </div>
                  <h3 className="mt-1 truncate text-xl font-light">{video.title}</h3>
                  <div className="mt-1 flex items-center gap-3 text-[11px] font-light text-muted-foreground">
                    <span>{video.surgeon}</span>
                    <span>·</span>
                    <span>{video.affiliation}</span>
                    <span>·</span>
                    <span className="tabular-nums">Published {video.publishedYear}</span>
                    <a
                      href={video.watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-1 text-primary hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" /> YouTube
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPapersOpen((p) => !p)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-light transition-colors",
                      papersOpen
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    aria-pressed={papersOpen}
                    title={papersOpen ? "Hide research" : "Show research"}
                  >
                    {papersOpen ? (
                      <PanelRightClose className="h-3.5 w-3.5" />
                    ) : (
                      <PanelRightOpen className="h-3.5 w-3.5" />
                    )}
                    {papersOpen ? "Hide research" : `Research (${papers.length})`}
                  </button>
                  <button
                    onClick={() => onToggleSave?.(video.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      saved
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                    aria-pressed={Boolean(saved)}
                    title={saved ? "Remove from saved" : "Save to your videos"}
                  >
                    {saved ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <BookmarkPlus className="h-3.5 w-3.5" />
                    )}
                    {saved ? "Saved" : "Save"}
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

              {/* ── Video area ───────────────────────────────────────── */}
              <div className="relative aspect-video bg-black">
                {/* The YouTube IFrame API replaces this div with the iframe on init. */}
                <div id={playerContainerId} className="absolute inset-0 h-full w-full" />

                {/* Click-to-toggle overlay (subtle so the video is visible). */}
                {!embedError && (
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
                      {playing ? (
                        <Pause className="h-7 w-7" />
                      ) : (
                        <Play className="ml-0.5 h-7 w-7" />
                      )}
                    </span>
                  </button>
                )}

                {/* Embed-error fallback. Renders when YouTube refuses to embed
                    (age gate, embedding disabled, removed video). Gives the
                    user a clean way to escape — open the video in a new tab,
                    or close the modal and pick a different one. */}
                {embedError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center backdrop-blur-md">
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-rose-300">
                      Embed unavailable
                    </div>
                    <div className="max-w-md text-base font-light text-white/85">
                      This video can't play here — the uploader has disabled embedding or restricted
                      playback for this domain.
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={video.watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/15 px-4 py-2 text-xs font-light text-primary hover:bg-primary/25"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Watch on YouTube
                      </a>
                      <button
                        onClick={onClose}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-light text-white/70 hover:bg-white/5 hover:text-white"
                      >
                        Close · pick another
                      </button>
                    </div>
                  </div>
                )}

                {/* Chapter pill: tells the user what they're looking at. */}
                {currentChapterIndex !== null && (
                  <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/85 backdrop-blur-sm">
                    <span className="rounded-full bg-primary/30 px-1.5 py-0.5 text-primary-foreground">
                      Step {currentChapterIndex + 1} of {video.chapters.length}
                    </span>
                    <span className="truncate normal-case tracking-normal">
                      {video.chapters[currentChapterIndex].title}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Progress + chapter ticks ────────────────────────── */}
              <div className="px-6 pt-4">
                <button
                  type="button"
                  onClick={seekProgressBar}
                  aria-label="Seek"
                  className="relative block h-3 w-full cursor-pointer items-center"
                  style={{ background: "transparent" }}
                >
                  <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-surface-3" />
                  <span
                    className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
                    style={{ width: `${progressPct}%` }}
                  />
                </button>
                {/* Chapter ticks — each is a wide invisible hit-area centered on a thin tick. */}
                <div className="relative -mt-3 h-3 w-full">
                  {video.chapters.map((ch, i) => {
                    const left = ch.position * 100;
                    const isActive = currentChapterIndex === i;
                    return (
                      <button
                        key={ch.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          seekToFraction(ch.position);
                        }}
                        aria-label={`Jump to ${ch.title}`}
                        className="group absolute top-0 -translate-x-1/2 px-2 py-0.5"
                        style={{ left: `${left}%` }}
                      >
                        <span
                          className={cn(
                            "block h-3 w-[3px] rounded-sm transition-colors",
                            isActive
                              ? "bg-primary-foreground"
                              : "bg-foreground/40 group-hover:bg-foreground/80",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono tabular-nums text-muted-foreground">
                  <span>{fmtTime(currentSec)}</span>
                  <span>{fmtTime(durationSec)}</span>
                </div>
              </div>

              {/* ── Transport row ──────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 px-6 py-4">
                <div className="flex items-center gap-2">
                  <TransportButton onClick={() => seekToSec(0)} title="Restart" aria="Restart">
                    <RotateCcw className="h-4 w-4" />
                  </TransportButton>
                  <TransportButton
                    onClick={() => seekToSec(currentSec - 10)}
                    title="Rewind 10 s"
                    aria="Rewind 10 seconds"
                  >
                    <ChevronsBack />
                  </TransportButton>
                  <button
                    onClick={togglePlay}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary transition-transform hover:scale-105"
                    aria-label={playing ? "Pause" : "Play"}
                    title={playing ? "Pause" : "Play"}
                  >
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                  </button>
                  <TransportButton
                    onClick={() => seekToSec(currentSec + 10)}
                    title="Forward 10 s"
                    aria="Forward 10 seconds"
                  >
                    <ChevronsForward />
                  </TransportButton>
                </div>

                <div className="flex items-center gap-2">
                  <TransportButton
                    onClick={() => {
                      if (!video.chapters.length) return;
                      const i = liveChapterIndex();
                      const target = i > 0 ? video.chapters[i - 1] : video.chapters[0];
                      seekToFraction(target.position);
                    }}
                    title="Previous chapter"
                    aria="Previous chapter"
                  >
                    <SkipBack className="h-4 w-4" />
                  </TransportButton>
                  <TransportButton
                    onClick={() => {
                      if (!video.chapters.length) return;
                      const i = liveChapterIndex();
                      if (i >= video.chapters.length - 1) return;
                      seekToFraction(video.chapters[i + 1].position);
                    }}
                    title="Next chapter"
                    aria="Next chapter"
                  >
                    <SkipForward className="h-4 w-4" />
                  </TransportButton>
                  <button
                    onClick={cycleSpeed}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-mono tabular-nums text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    title="Change playback speed"
                    aria-label="Change playback speed"
                  >
                    <Gauge className="h-3.5 w-3.5" />
                    {speed}×
                  </button>
                </div>
              </div>

              {/* ── Chapter list (compact) ──────────────────────────── */}
              <div className="border-t border-border bg-surface-2/40 px-6 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Chapters
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {video.chapters.map((ch, i) => (
                    <button
                      key={ch.title}
                      onClick={() => seekToFraction(ch.position)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-light transition-colors",
                        i === currentChapterIndex
                          ? "border-primary/60 bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      <span className="font-mono tabular-nums text-[10px] text-muted-foreground/80">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="ml-1.5">{ch.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Voice hints footer ─────────────────────────────── */}
              <div className="border-t border-border bg-surface-2/60 px-6 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Voice <span className="text-primary">›</span> "play" · "pause" · "rewind 10" ·
                "forward 30" · "next chapter" · "show research" · "open paper one" · "close video"
              </div>
            </div>

            {/* ── Research papers panel ──────────────────────────────── */}
            {papersOpen && (
              <aside
                data-scroll-modal
                className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface-2/60"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                      Related research
                    </div>
                    <div className="mt-0.5 text-sm font-light text-foreground">
                      {video.procedure}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPapersOpen(false);
                      setActivePaperId(null);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    aria-label="Hide research"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </button>
                </div>

                {activePaper ? (
                  <PaperDetail paper={activePaper} onBack={() => setActivePaperId(null)} />
                ) : (
                  <PaperList papers={papers} onOpen={(id) => setActivePaperId(id)} />
                )}
              </aside>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ── Sub-components ─────────────────────────────────────────────────────

function TransportButton({
  onClick,
  title,
  aria,
  children,
}: {
  onClick: () => void;
  title: string;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={aria}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function ChevronsBack() {
  return (
    <span className="flex items-center font-mono text-[10px] tabular-nums">
      <ChevronLeft className="-mr-1 h-3.5 w-3.5" />
      <ChevronLeft className="h-3.5 w-3.5" />
      <span className="ml-0.5">10</span>
    </span>
  );
}

function ChevronsForward() {
  return (
    <span className="flex items-center font-mono text-[10px] tabular-nums">
      <span className="mr-0.5">10</span>
      <ChevronRight className="h-3.5 w-3.5" />
      <ChevronRight className="-ml-1 h-3.5 w-3.5" />
    </span>
  );
}

function PaperList({ papers, onOpen }: { papers: ResearchPaper[]; onOpen: (id: string) => void }) {
  if (!papers.length) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-xs font-light text-muted-foreground">
        No related papers indexed for this procedure yet.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Tap or say "open paper [number]"
      </div>
      {papers.map((p, i) => (
        <button
          key={p.id}
          onClick={() => onOpen(p.id)}
          className="group flex flex-col gap-1 rounded-2xl border border-border bg-surface-3/40 p-4 text-left transition-colors hover:border-primary/50 hover:bg-surface-3"
        >
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="truncate">{p.journal}</span>
            <span>·</span>
            <span className="tabular-nums">{p.year}</span>
          </div>
          <div className="text-sm font-light leading-snug text-foreground group-hover:text-foreground">
            {p.title}
          </div>
          <div className="text-[11px] font-light text-muted-foreground line-clamp-1">
            {p.authors}
          </div>
          <div className="text-[11px] font-light text-muted-foreground line-clamp-2">
            {p.summary}
          </div>
        </button>
      ))}
    </div>
  );
}

function PaperDetail({ paper, onBack }: { paper: ResearchPaper; onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
      <button
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Back to all papers
      </button>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-primary">
        <FileText className="h-3.5 w-3.5" />
        <span>{paper.journal}</span>
        <span className="text-muted-foreground">·</span>
        <span className="tabular-nums text-muted-foreground">{paper.year}</span>
      </div>
      <h4 className="text-base font-light leading-snug">{paper.title}</h4>
      <div className="text-[11px] font-light text-muted-foreground">{paper.authors}</div>
      <div className="rounded-2xl border border-border bg-surface-3/40 p-4 text-sm font-light leading-relaxed text-foreground/90">
        {paper.summary}
      </div>
      <div className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          PMID {paper.pmid} · DOI {paper.doi}
        </span>
        <a
          href={paper.pubmedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-primary hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" /> Open on PubMed
        </a>
      </div>
      <div className="mt-auto rounded-2xl border border-dashed border-border px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Voice <span className="text-primary">›</span> "close paper" · "back to papers" · "hide
        research"
      </div>
    </div>
  );
}

// Re-export so existing call sites that imported PROCEDURE_VIDEOS by name keep working.
export { PROCEDURE_VIDEOS };
