import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClipboardCheck } from "lucide-react";
import { CirculatingNurseChecklist, type NursePhase } from "./CirculatingNurseChecklist";
import type { HandoffNotes, HandoffSection } from "./handoffNotes";

interface Props {
  open: boolean;
  onClose: () => void;
  checked: Set<string>;
  onToggle: (id: string) => void;
  handoffNotes: HandoffNotes;
  onSetHandoffNote: (section: HandoffSection, text: string) => void;
  /** Lifted accordion-expand state shared with the inline view. */
  expanded?: Record<NursePhase, boolean>;
  onExpandedChange?: (next: Record<NursePhase, boolean>) => void;
}

/**
 * Wraps the inline {@link CirculatingNurseChecklist} in a full-modal so the
 * circulating nurse can focus on her 25-item phase-banded list without
 * competing with the rest of the dashboard. Voice routing prefers
 * `toggle_nurse_checklist_item` while this modal is open — eliminates the
 * historic overlap with the Universal Protocol time-out (which has its own
 * 4-item modal).
 *
 * `data-scroll-modal` on the inner scroll container tells the route's
 * scroll voice handler to scroll THIS modal when the user says
 * "scroll down/up" — not the page behind it.
 */
export function CirculatingNurseChecklistModal({
  open,
  onClose,
  checked,
  onToggle,
  handoffNotes,
  onSetHandoffNote,
  expanded,
  onExpandedChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(95vw,80rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div>Circulating Nurse Checklist</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                Pre-incision · Intra-op · Closing — 25 items total
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            Voice toggles while this modal is open target this checklist (not the time-out).
          </DialogDescription>
        </DialogHeader>

        <div data-scroll-modal className="min-h-0 flex-1 overflow-y-auto p-2">
          <CirculatingNurseChecklist
            checked={checked}
            onToggle={onToggle}
            handoffNotes={handoffNotes}
            onSetHandoffNote={onSetHandoffNote}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
