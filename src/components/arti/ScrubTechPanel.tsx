import { CheckCircle, Circle, Layers, LayoutGrid, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import surgicalTableOverview from "@/assets/surgical-table-overview.jpg";
import surgicalTableMayo from "@/assets/surgical-table-mayo.jpg";
import type { LightboxImage } from "./ImageLightboxModal";
import type { CaseItem } from "./cases";

export const SCRUB_LIGHTBOX_IMAGES: LightboxImage[] = [
  {
    src: surgicalTableOverview,
    alt: "Overhead view of sterile back table with orthopedic instruments arranged in rows",
    label: "Back Table · Standard RSA Setup",
    caption: "Verify instrument arrangement before draping",
  },
  {
    src: surgicalTableMayo,
    alt: "Mayo stand layout for shoulder arthroplasty showing reamers, trials, and impactors",
    label: "Mayo Stand · Shoulder Arthroplasty",
    caption: "Reamers, trials, and impactors arranged in sequence",
  },
];

const INITIAL: Record<string, number> = {
  raytec: 20, lap: 9, needle: 14, blade: 3, clamps: 12,
};

const INSTRUMENT_DEFS = [
  { id: "raytec", label: "Raytec", sub: "4×4 Sponge" },
  { id: "lap", label: "Lap", sub: "Laparotomy Pad" },
  { id: "needle", label: "Needle", sub: "Suture Needle" },
  { id: "blade", label: "Blade", sub: "Scalpel Blade" },
  { id: "clamps", label: "Clamps", sub: "Hemostat" },
];

export const OPENING_CHECKLIST_ITEMS = [
  "Instrument trays counted & verified",
  "Back table draped & organized",
  "Mayo stand positioned & stocked",
  "Implants logged and available",
  "Suture loaded (2× FiberWire #2)",
  "Irrigation primed (3 L NS)",
  "Drain ready (10 Fr Hemovac)",
];

export const OPENING_CHECKLIST_INITIAL_DONE = new Set([0, 1, 2, 3]);

const IMPLANTS = [
  { name: "Baseplate 25 mm", status: "open" },
  { name: "Glenosphere 38 mm", status: "open" },
  { name: "Humeral Stem #8", status: "open" },
  { name: "Poly Insert — Std offset", status: "open" },
  { name: "Stem #9 (backup)", status: "available" },
];

interface Props {
  activeCase?: CaseItem;
  counts: Record<string, number>;
  onAdjust: (item: string, delta: number) => void;
  onOpenLightbox: (images: LightboxImage[], index?: number) => void;
  openingChecklist: Set<number>;
  onToggleChecklistItem: (index: number) => void;
}

function PanelLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-success/80">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {children}
    </div>
  );
}

export function ScrubTechPanel({ activeCase, counts, onAdjust, onOpenLightbox, openingChecklist, onToggleChecklistItem }: Props) {
  const checklistDone = openingChecklist.size;
  const procedureShort = activeCase?.procedureShort ?? "RSA";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 animate-fade-in">
      {/* ── Left (2 cols) ── */}
      <div className="space-y-4 xl:col-span-2">
        {/* Instrument counts — large numerals readable at distance from sterile field */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={Package}>
            Instrument Counts · {procedureShort}
          </PanelLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {INSTRUMENT_DEFS.map(({ id, label, sub }) => {
              const current = counts[id] ?? 0;
              const initial = INITIAL[id] ?? 0;
              const discrepancy = current !== initial;
              return (
                <div
                  key={id}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all duration-300",
                    discrepancy
                      ? "border-warning/50 bg-warning/[0.07] shadow-[0_0_20px_-6px_var(--warning)]"
                      : "border-border/40 bg-surface-2/40",
                  )}
                >
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </p>
                  {/* Large count — visible across a sterile field */}
                  <div
                    className={cn(
                      "text-5xl font-thin tabular-nums leading-none transition-colors duration-300",
                      discrepancy ? "text-warning" : "text-foreground",
                    )}
                  >
                    {current}
                  </div>
                  <p className="text-[9px] text-muted-foreground/50">
                    / {initial}
                  </p>
                  {discrepancy && (
                    <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 font-mono text-[9px] text-warning">
                      {current > initial ? `+${current - initial}` : current - initial}
                    </span>
                  )}
                  {/* +/− controls */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onAdjust(id, -1)}
                      disabled={current === 0}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-success/40 hover:text-foreground disabled:opacity-30"
                    >
                      −
                    </button>
                    <button
                      onClick={() => onAdjust(id, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-success/40 hover:text-foreground"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-center text-[9px] font-light text-muted-foreground/40">{sub}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Table layout images */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={LayoutGrid}>Table Layout · Tap to Inspect</PanelLabel>
          <div className="grid grid-cols-2 gap-3">
            {SCRUB_LIGHTBOX_IMAGES.map((img, i) => (
              <button
                key={img.label}
                onClick={() => onOpenLightbox(SCRUB_LIGHTBOX_IMAGES, i)}
                className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface-2 text-left transition-all duration-300 hover:border-success/40 hover:shadow-[0_0_28px_-8px_var(--success)]"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 opacity-100">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/80">
                    {img.label}
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-sm">
                    Expand
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right column ── */}
      <div className="space-y-4">
        {/* Opening checklist */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={Layers}>Opening Checklist</PanelLabel>
          <div className="space-y-2.5">
            {OPENING_CHECKLIST_ITEMS.map((label, i) => {
              const done = openingChecklist.has(i);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onToggleChecklistItem(i)}
                  className="flex w-full items-start gap-3 text-left text-sm transition-opacity hover:opacity-80"
                >
                  {done ? (
                    <CheckCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-success"
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30"
                      strokeWidth={1.8}
                    />
                  )}
                  <span
                    className={cn(
                      "font-light leading-snug",
                      done ? "text-foreground/45 line-through" : "text-foreground/90",
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Ready</span>
              <span className="font-mono">
                {checklistDone}/{OPENING_CHECKLIST_ITEMS.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3/60">
              <div
                className="h-full rounded-full bg-success transition-all duration-700"
                style={{ width: `${(checklistDone / OPENING_CHECKLIST_ITEMS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Implant availability */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={CheckCircle}>Implant Availability</PanelLabel>
          <div className="space-y-2.5">
            {IMPLANTS.map((imp) => (
              <div key={imp.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-light text-foreground/80">{imp.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    imp.status === "open"
                      ? "border-success/30 bg-success/[0.06] text-success"
                      : "border-border/50 bg-surface-2/40 text-muted-foreground",
                  )}
                >
                  {imp.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
