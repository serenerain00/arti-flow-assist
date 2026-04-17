import { X, Play, Pause, BookmarkPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
}

/**
 * In-context how-to viewer. Reduces context-switching (Miller's law / cognitive load):
 * staff stays oriented to the field while Arti surfaces the exact reference clip.
 */
export function HowToVideoModal({ open, onClose, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-8 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass relative w-full max-w-5xl overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              Medtronix Surgical Library · Pulled by Arti
            </div>
            <h3 className="mt-1 text-xl font-light">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-light text-muted-foreground hover:text-foreground">
              <BookmarkPlus className="h-3.5 w-3.5" /> Save
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

        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            // Generic surgical-feel placeholder loop (publicly hosted sample)
            src="https://cdn.coverr.co/videos/coverr-hands-of-a-doctor-2944/1080p.mp4"
            poster="https://images.unsplash.com/photo-1551076805-e1869033e561?w=1600&q=80"
          />
          <button
            onClick={toggle}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/40 via-transparent to-transparent text-white opacity-0 transition-opacity hover:opacity-100"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground glow-primary">
              {playing ? <Pause className="h-7 w-7" /> : <Play className="ml-0.5 h-7 w-7" />}
            </span>
          </button>

          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/70">
            Step 4 of 9 · Glenoid baseplate placement
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 px-6 py-5 text-sm font-light">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Surgeon
            </div>
            <div className="mt-1">Dr. James Holloway, MD</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Implant
            </div>
            <div className="mt-1">Univers Revers™ · 36mm glenosphere</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Duration
            </div>
            <div className="mt-1 tabular-nums">4:32</div>
          </div>
        </div>
      </div>
    </div>
  );
}
