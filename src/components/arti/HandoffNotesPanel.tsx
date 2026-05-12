import { FileText } from "lucide-react";
import { HANDOFF_SECTIONS, type HandoffNotes, type HandoffSection } from "./handoffNotes";

interface Props {
  notes: HandoffNotes;
  onSet: (section: HandoffSection, text: string) => void;
}

/**
 * 7-field handoff documentation panel. Rendered inside the Closing phase
 * of the circulating-nurse checklist. State is lifted to the route so
 * voice can drive it ("Arti, EBL was 150 mL") and read it back from any
 * screen. Each field is a controlled textarea; the parent persists.
 */
export function HandoffNotesPanel({ notes, onSet }: Props) {
  const completed = HANDOFF_SECTIONS.filter((s) => Boolean(notes[s.id]?.trim())).length;
  const total = HANDOFF_SECTIONS.length;

  return (
    <div className="mt-3 rounded-2xl border border-border/60 bg-surface-2/30 p-4">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" strokeWidth={1.8} />
          <div>
            <div className="text-sm font-light uppercase tracking-wider text-foreground/90">
              Handoff notes
            </div>
            <div className="text-[11px] font-light text-muted-foreground">
              For PACU handoff. Arti can read each section back on request.
            </div>
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tabular-nums ${
            completed === total
              ? "border-success/30 bg-success/15 text-success"
              : completed > 0
                ? "border-warning/30 bg-warning/15 text-warning"
                : "border-border bg-surface-2/60 text-muted-foreground"
          }`}
        >
          {completed}/{total} filled
        </span>
      </div>

      <ul className="space-y-3">
        {HANDOFF_SECTIONS.map((s) => {
          const value = notes[s.id] ?? "";
          return (
            <li key={s.id}>
              <label className="block">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-light uppercase tracking-wider text-foreground/80">
                    {s.label}
                  </span>
                  <span className="text-[10px] font-light text-muted-foreground/70">{s.hint}</span>
                </div>
                <textarea
                  value={value}
                  onChange={(e) => onSet(s.id, e.target.value)}
                  rows={s.id === "post_op" || s.id === "follow_ups" ? 3 : 2}
                  placeholder={s.placeholder}
                  className="mt-1 w-full rounded-lg border border-border/50 bg-surface-3/30 px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
