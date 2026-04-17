import { Minus, Plus, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Sponge / sharps / instrument count tracker.
 * Mitigates Retained Surgical Items (RSI) — a never-event with ~1:5,500 incidence.
 * Discrepancies surface immediately; closed-loop voice confirmation pattern.
 */
interface Item {
  id: string;
  label: string;
  initial: number;
  returned: number;
  category: "sponges" | "sharps" | "instruments";
}

const SEED: Item[] = [
  { id: "raytec", label: "Raytec sponges", initial: 20, returned: 20, category: "sponges" },
  { id: "lap", label: "Lap pads", initial: 10, returned: 9, category: "sponges" },
  { id: "needle", label: "Needles", initial: 14, returned: 14, category: "sharps" },
  { id: "blade", label: "Blades", initial: 3, returned: 3, category: "sharps" },
  { id: "clamps", label: "Mosquito clamps", initial: 12, returned: 12, category: "instruments" },
];

interface Props {
  counts?: Record<string, number>;
  onAdjust?: (id: string, delta: number) => void;
}

export function InstrumentCount({ counts: countsProp, onAdjust }: Props = {}) {
  const [internal, setInternal] = useState(SEED);

  // Merge external counts (from voice) into items
  const items = countsProp
    ? SEED.map((s) => ({ ...s, returned: countsProp[s.id] ?? s.returned }))
    : internal;

  const adjust = (id: string, delta: number) => {
    if (onAdjust) {
      onAdjust(id, delta);
      return;
    }
    setInternal((arr) =>
      arr.map((i) =>
        i.id === id
          ? { ...i, returned: Math.max(0, Math.min(i.initial + 5, i.returned + delta)) }
          : i,
      ),
    );
  };

  const discrepancy = useMemo(() => items.filter((i) => i.returned !== i.initial), [items]);

  return (
    <section
      className={cn(
        "glass rounded-2xl p-6 transition-colors",
        discrepancy.length > 0 && "ring-1 ring-warning/40",
      )}
    >
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Count · Pre-incision
          </div>
          <h2 className="mt-1 text-2xl font-light">Sharps · Sponges · Instruments</h2>
        </div>

        {discrepancy.length === 0 ? (
          <div className="rounded-full bg-success/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-success">
            ✓ Reconciled
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1.5 text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {discrepancy.length} discrepanc{discrepancy.length === 1 ? "y" : "ies"}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {items.map((it) => {
          const off = it.returned !== it.initial;
          return (
            <div
              key={it.id}
              className={cn(
                "flex items-center gap-4 rounded-lg bg-surface-2/40 px-4 py-3",
                off && "bg-warning/5",
              )}
            >
              <div className="flex-1">
                <div className="text-sm font-light">{it.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {it.category}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-1 py-1">
                  <button
                    onClick={() => adjust(it.id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    aria-label="Decrease"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-[3.5rem] text-center font-mono text-lg tabular-nums">
                    <span className={cn(off && "text-warning")}>{it.returned}</span>
                    <span className="text-muted-foreground/50">/{it.initial}</span>
                  </div>
                  <button
                    onClick={() => adjust(it.id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                    aria-label="Increase"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {discrepancy.length > 0 && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs font-light text-warning animate-fade-in">
          <strong className="font-medium">Heads up —</strong> Lap pad count is off by{" "}
          {discrepancy[0].initial - discrepancy[0].returned}. Recommend visual sweep of the field
          and trash before proceeding.
        </div>
      )}
    </section>
  );
}
