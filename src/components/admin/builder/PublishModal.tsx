import { useEffect, useRef } from "react";
import gsap from "gsap";
import { CheckCircle2, ExternalLink, X } from "lucide-react";

interface Props {
  open: boolean;
  dashboardName: string;
  onPreview: () => void;
  onClose: () => void;
}

export function PublishModal({ open, dashboardName, onPreview, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !cardRef.current || !overlayRef.current) return;
    gsap.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.18, ease: "power2.out" },
    );
    gsap.fromTo(
      cardRef.current,
      { scale: 0.92, opacity: 0, y: 12 },
      { scale: 1, opacity: 1, y: 0, duration: 0.36, ease: "back.out(1.4)" },
    );
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-popover p-6 shadow-2xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-success">
            Published
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-success/40 bg-success/15 text-success">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-light tracking-tight text-foreground">
              {dashboardName}
            </h2>
            <p className="mt-1.5 text-sm font-light text-muted-foreground">
              Your dashboard is published and ready to display on the OR wall. Preview it in a new
              tab to see exactly how it will render on the wall display.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border/60 bg-surface-2/60 px-4 py-2 text-sm font-light text-foreground transition-colors hover:bg-surface-2"
          >
            Done
          </button>
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            Preview in new tab
          </button>
        </div>
      </div>
    </div>
  );
}
