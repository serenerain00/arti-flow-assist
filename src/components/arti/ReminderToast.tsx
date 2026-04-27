import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FiredReminder {
  id: string;
  text: string;
  /** ms epoch when the reminder fired. */
  firedAt: number;
}

interface Props {
  reminders: FiredReminder[];
  onDismiss: (id: string) => void;
  /** Auto-dismiss timeout in ms. Default 30s. */
  autoDismissMs?: number;
}

/**
 * Floating stack of fired reminders. Renders at top-center so it's visible
 * from any screen without obscuring the primary UI. Each card auto-dismisses
 * after `autoDismissMs` or on tap.
 */
export function ReminderToast({ reminders, onDismiss, autoDismissMs = 30_000 }: Props) {
  // Per-reminder auto-dismiss timers.
  useEffect(() => {
    const timers = reminders.map((r) =>
      setTimeout(() => onDismiss(r.id), Math.max(0, r.firedAt + autoDismissMs - Date.now())),
    );
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [reminders, onDismiss, autoDismissMs]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-[70] flex -translate-x-1/2 flex-col items-center gap-3">
      <AnimatePresence initial={false}>
        {reminders.map((r) => (
          <motion.div
            key={r.id}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "tween", duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pointer-events-auto flex min-w-[320px] max-w-[560px] items-start gap-3 rounded-2xl border border-primary/40 bg-surface/95 px-5 py-4 shadow-[var(--shadow-elevated)] backdrop-blur-xl",
            )}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Bell className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
                Reminder
              </div>
              <div className="mt-1 text-sm font-light text-foreground">{r.text}</div>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(r.id)}
              aria-label="Dismiss reminder"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
