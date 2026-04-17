import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Team roster with scrub-in status. Reduces communication breakdown by making
 * the room composition explicit and persistent in shared awareness (SA Level 1).
 */
const TEAM = [
  { name: "Dr. Anika Patel", role: "Surgeon", initials: "AP", scrubbed: true },
  { name: "Dr. Liam Reyes", role: "Anesthesia", initials: "LR", scrubbed: true },
  { name: "Nora Quinn", role: "Circulator", initials: "NQ", scrubbed: true },
  { name: "Sam Okafor", role: "Scrub Tech", initials: "SO", scrubbed: true },
  { name: "Maya Chen", role: "Rep · Arthrex", initials: "MC", scrubbed: false },
];

export function TeamRoster() {
  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Team
          </div>
          <h2 className="mt-1 text-lg font-light">In the room</h2>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {TEAM.filter((t) => t.scrubbed).length}/{TEAM.length} ready
        </div>
      </div>

      <ul className="space-y-2">
        {TEAM.map((m) => (
          <li
            key={m.name}
            className="flex items-center gap-3 rounded-lg bg-surface-2/40 px-3 py-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-xs font-medium">
              {m.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-light">{m.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {m.role}
              </div>
            </div>
            {m.scrubbed ? (
              <CheckCircle2 className={cn("h-4 w-4 text-success")} />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/40" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
