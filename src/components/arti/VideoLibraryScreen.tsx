import { useMemo, useState } from "react";
import { BookmarkCheck, BookmarkPlus, BookOpen, Play, Search, Sparkles, X } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import {
  PROCEDURE_VIDEOS,
  filterLibrary,
  youtubeThumbnail,
  type ProcedureVideo,
  type VideoCategory,
} from "./videoLibrary";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Open a specific library video in the how-to modal. */
  onOpenVideo: (videoId: string) => void;
  // ── Controlled filter state (lifted to route so voice tools can drive
  // the same controls the user can click) ──
  search: string;
  onSearchChange: (q: string) => void;
  category: VideoCategory | "All";
  onCategoryChange: (c: VideoCategory | "All") => void;
  animatedOnly: boolean;
  onAnimatedOnlyChange: (v: boolean) => void;
  /** Set of saved video ids for the bookmark badge + saved-only filter. */
  savedIds: ReadonlySet<string>;
  savedOnly: boolean;
  onSavedOnlyChange: (v: boolean) => void;
  /** Toggle save state for a single video (used by per-card bookmark button). */
  onToggleSave: (videoId: string) => void;
}

const CATEGORIES: Array<{ id: VideoCategory | "All"; label: string }> = [
  { id: "All", label: "All" },
  { id: "Shoulder", label: "Shoulder" },
  { id: "Knee", label: "Knee" },
  { id: "Hip", label: "Hip" },
  { id: "Foot/Ankle", label: "Foot / Ankle" },
  { id: "Hand/Wrist", label: "Hand / Wrist" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first" },
  { id: "category", label: "By region" },
  { id: "title", label: "A → Z" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

/**
 * Curated surgical-technique video library. Surgeons can scan thumbnails,
 * filter by anatomic region, search by title / surgeon / procedure, and
 * tap a card to open it in the existing in-OR how-to viewer (with the
 * voice transport + research panel intact).
 *
 * Design principles applied:
 *   • Thumbnails first — surgeons recognize procedures faster from frames
 *     than from text.
 *   • One-key filters — category chips collapse the list immediately, no
 *     dropdown gymnastics.
 *   • Search and chips compose — search narrows whatever filter is active.
 *   • Year + animated badges — the two attributes that matter most for
 *     "is this trustworthy and up to date?".
 *   • Generous tap targets — gloved hands can hit the cards without
 *     hunting for a small "play" button.
 */
export function VideoLibraryScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onPrompt,
  onSidebarNavigate,
  onOpenVideo,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  animatedOnly,
  onAnimatedOnlyChange,
  savedIds,
  savedOnly,
  onSavedOnlyChange,
  onToggleSave,
}: Props) {
  // Sort is local-only — voice doesn't currently drive sort, so no need
  // to lift it. Searching/filtering lifts because that's what users say.
  const [sort, setSort] = useState<SortId>("newest");

  const filtered = useMemo<ProcedureVideo[]>(() => {
    const out = filterLibrary({ search, category, animatedOnly, savedIds, savedOnly });
    if (sort === "newest") return [...out].sort((a, b) => b.publishedYear - a.publishedYear);
    if (sort === "category") return [...out].sort((a, b) => a.category.localeCompare(b.category));
    return [...out].sort((a, b) => a.title.localeCompare(b.title));
  }, [search, category, animatedOnly, savedIds, savedOnly, sort]);

  const counts = useMemo(() => {
    const out: Record<VideoCategory | "All", number> = {
      All: PROCEDURE_VIDEOS.length,
      Shoulder: 0,
      Knee: 0,
      Hip: 0,
      "Foot/Ankle": 0,
      "Hand/Wrist": 0,
    };
    for (const v of PROCEDURE_VIDEOS) out[v.category] += 1;
    return out;
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} activeKey="library" onNavigate={onSidebarNavigate} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar staffName={staffName} staffRole={staffRole} initials={initials} />

        <main data-scroll className="min-h-0 flex-1 overflow-y-auto px-8 py-6 animate-fade-in">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                <BookOpen className="h-3 w-3" />
                Surgical video library
              </div>
              <h1 className="mt-2 text-2xl font-light">
                {PROCEDURE_VIDEOS.length} curated technique videos
              </h1>
              <div className="mt-1 text-sm font-light text-muted-foreground">
                Verified embeddable · animated and live demos · refreshed{" "}
                {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
              </div>
            </div>

            {/* Sort dropdown — compact, right-aligned */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2/60 p-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
                    sort === opt.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Controls row: search + category chips + animated toggle ── */}
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search procedure, surgeon, or channel…"
                className="w-full rounded-full border border-border bg-surface-2/60 py-2.5 pl-11 pr-10 text-sm font-light text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Saved-only toggle */}
              <button
                type="button"
                onClick={() => onSavedOnlyChange(!savedOnly)}
                aria-pressed={savedOnly}
                title={savedOnly ? "Show all videos" : "Show only my saved videos"}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  savedOnly
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface-2/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {savedOnly ? (
                  <BookmarkCheck className="h-3 w-3" />
                ) : (
                  <BookmarkPlus className="h-3 w-3" />
                )}
                Saved {savedIds.size > 0 && <span className="tabular-nums">· {savedIds.size}</span>}
              </button>

              {/* Animated-only toggle */}
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-2/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40">
                <input
                  type="checkbox"
                  checked={animatedOnly}
                  onChange={(e) => onAnimatedOnlyChange(e.target.checked)}
                  className="h-3 w-3 cursor-pointer accent-primary"
                />
                <Sparkles className="h-3 w-3" />
                Animated only
              </label>
            </div>
          </div>

          {/* Category chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCategoryChange(c.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-light transition-colors",
                  category === c.id
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {c.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
                    category === c.id
                      ? "bg-primary/30 text-primary-foreground"
                      : "bg-surface-3 text-muted-foreground",
                  )}
                >
                  {counts[c.id]}
                </span>
              </button>
            ))}
          </div>

          {/* ── Result count ─────────────────────────────────────────── */}
          <div className="mt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>
              Showing {filtered.length} of {PROCEDURE_VIDEOS.length} videos
            </span>
            {(search || category !== "All" || animatedOnly || savedOnly) && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  onCategoryChange("All");
                  onAnimatedOnlyChange(false);
                  onSavedOnlyChange(false);
                }}
                className="text-primary hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Card grid ────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="mt-12 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-2/30 px-6 py-16 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {savedOnly && savedIds.size === 0 ? "No saved videos yet" : "No matches"}
              </div>
              <div className="max-w-md text-sm font-light text-muted-foreground">
                {savedOnly && savedIds.size === 0
                  ? "Open a video and tap Save (or say \"save this video\") to bookmark it."
                  : "Try a broader search term, or clear the filters above."}
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  saved={savedIds.has(v.id)}
                  onOpen={() => onOpenVideo(v.id)}
                  onToggleSave={() => onToggleSave(v.id)}
                />
              ))}
            </div>
          )}

          <div className="h-24" />
        </main>
      </div>

      <ArtiInvoker
        placeholder="Search the library or ask Arti for a video…"
        onSubmit={onPrompt}
        suggestions={[
          "Show me my videos",
          "Save this video",
          "Find rotator cuff videos",
          "Open the meniscus animation",
        ]}
      />
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  saved,
  onOpen,
  onToggleSave,
}: {
  video: ProcedureVideo;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const currentYear = new Date().getFullYear();
  const isFresh = video.publishedYear >= currentYear - 1;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-surface-2/40 text-left transition-all",
        saved ? "border-primary/45" : "border-border",
        "hover:border-primary/50 hover:bg-surface-2 hover:shadow-[0_0_30px_-10px_rgb(34_211_238/0.4)]",
        "focus-within:ring-2 focus-within:ring-primary/40",
      )}
    >
      {/* Card-wide click-to-open. Save button below intercepts its own clicks. */}
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-0"
        aria-label={`Open ${video.title}`}
      />

      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <img
          src={youtubeThumbnail(video.youtubeId)}
          alt={video.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {/* Play scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
            <Play className="ml-0.5 h-6 w-6" />
          </span>
        </div>
        {/* Per-card bookmark button — z-10 so it sits above the click overlay */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save video"}
          title={saved ? "Saved · tap to remove" : "Save to your videos"}
          className={cn(
            "absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors",
            saved
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/30 bg-black/50 text-white/85 hover:border-primary/60 hover:text-white",
          )}
        >
          {saved ? (
            <BookmarkCheck className="h-4 w-4" />
          ) : (
            <BookmarkPlus className="h-4 w-4" />
          )}
        </button>
        {/* Top-right badges */}
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5">
          {isFresh && (
            <span className="rounded-full bg-cyan-500/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-black">
              New
            </span>
          )}
          {video.isAnimated && (
            <span className="flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/90 backdrop-blur-sm">
              <Sparkles className="h-2.5 w-2.5" />
              Animated
            </span>
          )}
        </div>
        {/* Bottom-left chip: category + year */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85 backdrop-blur-sm">
          <span>{video.category}</span>
          <span className="text-white/50">·</span>
          <span className="tabular-nums">{video.publishedYear}</span>
        </div>
      </div>

      {/* Card body — pointer-events-none so the underlying click overlay
          handles taps; bookmark button above re-enables its own pointer events. */}
      <div className="pointer-events-none relative flex flex-1 flex-col gap-1.5 px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
          {video.channel}
        </div>
        <div className="line-clamp-2 text-sm font-light leading-snug text-foreground">
          {video.title}
        </div>
        <div className="mt-auto pt-1 text-[11px] font-light text-muted-foreground line-clamp-1">
          {video.surgeon}
        </div>
      </div>
    </div>
  );
}
