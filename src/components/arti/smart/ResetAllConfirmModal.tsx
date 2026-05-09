import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, X } from "lucide-react";

interface Props {
  open: boolean;
  /** User confirmed — execute the reset and close. */
  onConfirm: () => void;
  /** User cancelled — close without resetting. */
  onCancel: () => void;
}

/**
 * "Are you sure?" before bulk-resetting every smart device. Mounts at the
 * route level so voice + click both control it without coupling to the
 * Smart Settings screen.
 */
export function ResetAllConfirmModal({ open, onConfirm, onCancel }: Props) {
  // Esc cancels.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reset-all-confirm"
          role="dialog"
          aria-modal
          aria-label="Reset all smart devices?"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/85 backdrop-blur-md"
          onClick={(e) => {
            // Click on the backdrop (outside the panel) cancels.
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-3xl border border-warning/40 bg-surface/95 p-7 shadow-2xl"
          >
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-warning/40 bg-warning/10 text-warning">
              <AlertTriangle className="h-6 w-6" strokeWidth={1.7} />
            </div>
            <h2 className="mt-4 text-2xl font-extralight tracking-tight text-foreground">
              Reset all smart devices?
            </h2>
            <p className="mt-2 text-sm font-light text-muted-foreground">
              This restores every device — lighting, displays, environment, audio, and access — to
              its built-in default. Custom brightness, color temps, music volume, and any other
              tweaks will be cleared. The Mock OR preview will reflect the reset immediately.
            </p>
            <p className="mt-2 text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
              Voice: <span className="text-foreground/80">"yes"</span> /{" "}
              <span className="text-foreground/80">"confirm"</span> →{" "}
              <span className="text-foreground/80">reset</span> ·{" "}
              <span className="text-foreground/80">"no"</span> /{" "}
              <span className="text-foreground/80">"cancel"</span> →{" "}
              <span className="text-foreground/80">close</span>
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                autoFocus
                className="inline-flex items-center gap-1.5 rounded-full bg-warning px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-background transition-all hover:bg-warning/90 hover:shadow-[0_0_18px_-4px_var(--warning)]"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                Reset all devices
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
