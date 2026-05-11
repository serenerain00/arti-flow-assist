import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, X, AlertTriangle, ClipboardCheck, Beaker } from "lucide-react";
import {
  PREF_CARD_TABLES,
  toolKey,
  type PrefCardTableId,
  type PrefCardTool,
  type PrefCardToolState,
  type ToolStatus,
} from "./prefCardTables";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Which table to show on open. Defaults to back-table. */
  initialTableId?: PrefCardTableId;
  state: PrefCardToolState;
  onSetStatus: (tableId: PrefCardTableId, toolId: string, status: ToolStatus) => void;
}

const STATUS_META: Record<
  ToolStatus,
  { label: string; chip: string; pinRing: string; pinFill: string; pinText: string }
> = {
  accounted: {
    label: "Accounted for",
    chip: "border-success/30 bg-success/15 text-success",
    pinRing: "ring-success/50",
    pinFill: "bg-success/85",
    pinText: "text-success-foreground",
  },
  missing: {
    label: "Missing",
    chip: "border-warning/30 bg-warning/15 text-warning",
    pinRing: "ring-warning/60",
    pinFill: "bg-warning/85",
    pinText: "text-warning-foreground",
  },
  contaminated: {
    label: "Contaminated",
    chip: "border-destructive/40 bg-destructive/15 text-destructive",
    pinRing: "ring-destructive/60",
    pinFill: "bg-destructive/85",
    pinText: "text-destructive-foreground",
  },
};

export function PrefCardChecklistModal({
  open,
  onClose,
  initialTableId = "back-table",
  state,
  onSetStatus,
}: Props) {
  const [activeTableId, setActiveTableId] = useState<PrefCardTableId>(initialTableId);
  const [showPins, setShowPins] = useState(true);
  const [hoveredToolId, setHoveredToolId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setActiveTableId(initialTableId);
  }, [open, initialTableId]);

  const activeTable = useMemo(
    () => PREF_CARD_TABLES.find((t) => t.id === activeTableId) ?? PREF_CARD_TABLES[0],
    [activeTableId],
  );

  function statusFor(toolId: string): ToolStatus {
    return state[toolKey(activeTable.id, toolId)]?.status ?? "missing";
  }

  const tallies = useMemo(() => {
    let accounted = 0;
    let missing = 0;
    let contaminated = 0;
    for (const t of activeTable.tools) {
      const s = statusFor(t.id);
      if (s === "accounted") accounted++;
      else if (s === "contaminated") contaminated++;
      else missing++;
    }
    return { accounted, missing, contaminated, total: activeTable.tools.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable, state]);

  function cycleStatus(toolId: string) {
    const current = statusFor(toolId);
    const next: ToolStatus = current === "accounted" ? "missing" : "accounted";
    onSetStatus(activeTable.id, toolId, next);
  }

  function flagContaminated(toolId: string) {
    onSetStatus(activeTable.id, toolId, "contaminated");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[95vh] w-[min(98vw,118rem)] max-w-none flex-col overflow-hidden border-border/60 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-4 border-b border-border/40">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div>
              <div>Preference card · table checklist</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {activeTable.caption}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm">
            Tap a pin or a row to mark accounted for. Use the flag to document a sterility breach.
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar + tallies */}
        <div className="flex shrink-0 items-center justify-between gap-4 pb-3">
          <div className="flex items-center gap-2">
            {PREF_CARD_TABLES.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTableId(t.id)}
                className={`rounded-full border px-4 py-1.5 text-xs font-light uppercase tracking-wider transition-colors ${
                  activeTableId === t.id
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-surface-2 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs font-light">
            <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-success">
              {tallies.accounted}/{tallies.total} accounted
            </span>
            {tallies.missing > 0 ? (
              <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-warning">
                {tallies.missing} missing
              </span>
            ) : null}
            {tallies.contaminated > 0 ? (
              <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-destructive">
                {tallies.contaminated} contaminated
              </span>
            ) : null}
            <button
              onClick={() => setShowPins((p) => !p)}
              className="rounded-full border border-border bg-surface-2 px-3 py-0.5 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            >
              {showPins ? "Hide pins" : "Show pins"}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[1.6fr_1fr]">
          {/* Image with annotation pins */}
          <div className="relative min-h-[24rem] overflow-hidden rounded-2xl border border-border/40 bg-black/40">
            <img
              src={activeTable.src}
              alt={activeTable.alt}
              className="h-full w-full object-contain"
            />
            {showPins ? (
              <div className="pointer-events-none absolute inset-0">
                {activeTable.tools.map((tool, idx) => {
                  const s = statusFor(tool.id);
                  const meta = STATUS_META[s];
                  const isHovered = hoveredToolId === tool.id;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => cycleStatus(tool.id)}
                      onMouseEnter={() => setHoveredToolId(tool.id)}
                      onMouseLeave={() => setHoveredToolId(null)}
                      style={{ left: `${tool.x}%`, top: `${tool.y}%` }}
                      className={`pointer-events-auto absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${meta.pinFill} ${meta.pinText} font-mono text-[11px] font-semibold tabular-nums ring-2 ${meta.pinRing} ring-offset-1 ring-offset-black/40 transition-transform hover:scale-110 ${
                        isHovered ? "z-20 scale-110" : "z-10"
                      }`}
                      title={`${idx + 1}. ${tool.label}${tool.detail ? ` — ${tool.detail}` : ""}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
                {hoveredToolId
                  ? (() => {
                      const tool = activeTable.tools.find((t) => t.id === hoveredToolId);
                      if (!tool) return null;
                      const s = statusFor(tool.id);
                      const meta = STATUS_META[s];
                      return (
                        <div
                          style={{ left: `${tool.x}%`, top: `${tool.y}%` }}
                          className="pointer-events-none absolute z-30 -translate-x-1/2 translate-y-4 whitespace-nowrap rounded-md border border-border/60 bg-surface/95 px-3 py-1.5 text-xs font-light shadow-lg backdrop-blur-sm"
                        >
                          <span className="text-foreground">{tool.label}</span>
                          {tool.detail ? (
                            <span className="ml-2 text-muted-foreground">{tool.detail}</span>
                          ) : null}
                          <span className={`ml-2 text-[10px] uppercase tracking-wider`}>·</span>
                          <span
                            className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                      );
                    })()
                  : null}
              </div>
            ) : null}
          </div>

          {/* Checklist sidebar */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/40 bg-surface-2/30">
            <ul className="flex-1 overflow-y-auto p-2">
              {activeTable.tools.map((tool: PrefCardTool, idx) => {
                const s = statusFor(tool.id);
                const meta = STATUS_META[s];
                return (
                  <li
                    key={tool.id}
                    onMouseEnter={() => setHoveredToolId(tool.id)}
                    onMouseLeave={() => setHoveredToolId(null)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      hoveredToolId === tool.id ? "bg-white/[0.04]" : ""
                    } ${s === "contaminated" ? "opacity-70" : ""}`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.pinFill} ${meta.pinText} font-mono text-[11px] font-semibold tabular-nums ring-1 ${meta.pinRing}`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm ${
                          s === "contaminated"
                            ? "line-through text-foreground/60"
                            : "text-foreground/90"
                        }`}
                      >
                        {tool.label}
                      </div>
                      {tool.detail ? (
                        <div className="truncate text-[11px] text-muted-foreground">
                          {tool.detail}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${meta.chip}`}
                    >
                      {s === "accounted" ? "✓" : s === "contaminated" ? "BREACH" : "Pending"}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => cycleStatus(tool.id)}
                        title={s === "accounted" ? "Mark missing" : "Mark accounted for"}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                          s === "accounted"
                            ? "border-success/40 bg-success/15 text-success"
                            : "border-border bg-surface-2 text-muted-foreground hover:border-success/30 hover:text-success"
                        }`}
                      >
                        {s === "accounted" ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                        ) : (
                          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                        )}
                      </button>
                      <button
                        onClick={() => flagContaminated(tool.id)}
                        title="Flag sterility breach"
                        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                          s === "contaminated"
                            ? "border-destructive/50 bg-destructive/20 text-destructive"
                            : "border-border bg-surface-2 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Contamination log footer */}
            <div className="shrink-0 border-t border-border/40 bg-surface-3/30 p-3">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Beaker className="h-3 w-3" strokeWidth={1.7} />
                Sterility log
              </div>
              {(() => {
                const breaches = activeTable.tools
                  .map((t) => ({ tool: t, entry: state[toolKey(activeTable.id, t.id)] }))
                  .filter((x) => x.entry?.status === "contaminated");
                if (breaches.length === 0) {
                  return (
                    <div className="mt-1 text-xs font-light text-muted-foreground">
                      No sterility breaches recorded on this table.
                    </div>
                  );
                }
                return (
                  <ul className="mt-1 space-y-1 text-xs font-light text-foreground/80">
                    {breaches.map(({ tool, entry }) => (
                      <li key={tool.id}>
                        <span className="text-destructive">●</span>{" "}
                        <span className="text-foreground">{tool.label}</span>
                        {entry?.ts ? (
                          <span className="ml-2 text-muted-foreground">
                            ·{" "}
                            {new Date(entry.ts).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
