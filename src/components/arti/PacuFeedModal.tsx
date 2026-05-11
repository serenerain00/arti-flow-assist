import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MessageSquare, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { PACU_MESSAGES, formatRelative, type PacuPriority } from "./pacu";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRIORITY_META: Record<
  PacuPriority,
  {
    label: string;
    icon: import("lucide-react").LucideIcon;
    border: string;
    bg: string;
    chip: string;
  }
> = {
  info: {
    label: "Info",
    icon: Info,
    border: "border-accent/20",
    bg: "bg-accent/[0.04]",
    chip: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
  },
  advisory: {
    label: "Advisory",
    icon: AlertCircle,
    border: "border-warning/30",
    bg: "bg-warning/[0.05]",
    chip: "border-warning/30 bg-warning/15 text-warning",
  },
  urgent: {
    label: "Urgent",
    icon: AlertTriangle,
    border: "border-destructive/40",
    bg: "bg-destructive/[0.06]",
    chip: "border-destructive/40 bg-destructive/15 text-destructive",
  },
};

export function PacuFeedModal({ open, onClose }: Props) {
  // Tick a clock so relative timestamps refresh while the modal is open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(95vw,72rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-5 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <div>PACU Feed</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                Recent messages from the recovery unit · most recent first
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            Say &ldquo;Arti, what&apos;s the latest from PACU&rdquo; from any screen to hear the
            newest message.
          </DialogDescription>
        </DialogHeader>

        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
          {PACU_MESSAGES.map((m) => {
            const meta = PRIORITY_META[m.priority];
            const Icon = meta.icon;
            return (
              <li key={m.id} className={`rounded-2xl border ${meta.border} ${meta.bg} p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-foreground/70" strokeWidth={1.7} />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/70">
                      {m.from}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}
                    >
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatRelative(m.receivedAtIso, now)}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-base font-light text-foreground/90">{m.body}</div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
