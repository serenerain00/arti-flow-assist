import { Check, ListChecks } from "lucide-react";
import type { WidgetSize } from "../types";

interface Props {
  size: WidgetSize;
}

interface TimeoutItem {
  label: string;
  done: boolean;
}

// The time-out checklist is owned and configured by an upstream surgical-safety
// application and streamed into Arti read-only. These items stand in for that
// feed in the prototype — the builder never edits them.
const TIMEOUT_ITEMS: TimeoutItem[] = [
  { label: "Patient identity confirmed", done: true },
  { label: "Surgical site marked", done: true },
  { label: "Procedure verified", done: true },
  { label: "Allergies reviewed", done: true },
  { label: "Antibiotic prophylaxis given", done: false },
  { label: "Imaging displayed", done: false },
];

export function TimeoutChecklistWidget({ size }: Props) {
  const done = TIMEOUT_ITEMS.filter((i) => i.done).length;
  const total = TIMEOUT_ITEMS.length;

  if (size === "small") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
        <ListChecks className="h-7 w-7 text-primary" strokeWidth={1.4} />
        <div className="mt-2 text-3xl font-extralight leading-none tabular-nums text-foreground">
          {done}
          <span className="text-xl text-muted-foreground">/{total}</span>
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
          Time-out
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col px-4 py-4">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2 text-primary/90">
          <ListChecks className="h-4 w-4" strokeWidth={1.7} />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            Surgical Time-Out
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {TIMEOUT_ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5">
            <span
              className={
                item.done
                  ? "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-success text-success-foreground"
                  : "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-border/70"
              }
            >
              {item.done && <Check className="h-3 w-3" strokeWidth={2.5} />}
            </span>
            <span
              className={
                item.done
                  ? "text-sm font-light text-foreground"
                  : "text-sm font-light text-muted-foreground"
              }
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2 shrink-0 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/70">
        Synced · safety checklist feed
      </div>
    </div>
  );
}
