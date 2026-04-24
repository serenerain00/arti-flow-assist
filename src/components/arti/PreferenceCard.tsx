import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList,
  Syringe,
  Package,
  ArrowUpDown,
  Stethoscope,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
} from "lucide-react";
import { useState } from "react";
import surgicalTableOverview from "@/assets/surgical-table-overview.jpg";
import surgicalTableMayo from "@/assets/surgical-table-mayo.jpg";
import type { LightboxImage } from "./ImageLightboxModal";

export const PREF_CARD_IMAGES: LightboxImage[] = [
  {
    src: surgicalTableOverview,
    alt: "Overhead view of sterile back table with orthopedic instruments arranged in rows",
    label: "Back Table · Standard RSA Setup",
    caption: "Full instrument layout for reverse shoulder arthroplasty",
  },
  {
    src: surgicalTableMayo,
    alt: "Mayo stand layout for shoulder arthroplasty showing reamers, trials, and impactors",
    label: "Mayo Stand · Shoulder Arthroplasty",
    caption: "Reamers, trials, and impactors arranged in sequence",
  },
];

// Demo data — in production this comes from the surgeon's saved preference card
const PREF_CARD = {
  surgeon: "Dr. Anika Patel",
  procedure: "Reverse Total Shoulder Arthroplasty (RSA)",
  positioning: {
    position: "Beach chair, 60–70°",
    arm: "Articulated arm holder (Spider Limb Positioner)",
    padding: "Axillary roll, head secured with gel donut",
  },
  implants: [
    "Medtronix Univers Revers™ — Glenoid baseplate (size 25 mm)",
    "Glenosphere 38 mm",
    "Humeral stem — press-fit, size 8",
    "Poly insert — standard offset",
  ],
  instruments: [
    "Medtronix RSA tray (full set)",
    "Power reamer & drill",
    "Oscillating saw",
    "Bovie — blend 30/30",
    "Suture: #2 FiberWire × 4",
  ],
  supplies: [
    "3L NS irrigation",
    "10-blade & 15-blade",
    "Raytec 4×4 × 20",
    "Lap sponges × 10",
    "Drain: 10 Fr Hemovac",
    "Tegaderm + ABD pad dressing",
  ],
  notes: [
    "Surgeon prefers interscalene block pre-op — confirm with anesthesia.",
    "Always have backup cemented stem on standby.",
    "No Betadine — patient allergy. Use ChloraPrep only.",
  ],
};

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </div>
    {children}
  </div>
);

interface Props {
  onOpenLightbox?: (images: LightboxImage[], index?: number) => void;
}

export function PreferenceCard({ onOpenLightbox }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card
      id="preference-card"
      className="scroll-mt-24 border-border/60 bg-surface/80 backdrop-blur-md"
    >
      <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Surgeon Preference Card</CardTitle>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {PREF_CARD.surgeon} · {PREF_CARD.procedure}
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {/* Surgical Table Layout */}
          <div id="preference-card-layout-images" className="sm:col-span-2 scroll-mt-24">
            <Section icon={LayoutGrid} title="Surgical Table Layout">
              <div className="grid gap-3 sm:grid-cols-2">
                {PREF_CARD_IMAGES.map((img, i) => (
                  <button
                    key={img.label}
                    onClick={() => onOpenLightbox?.(PREF_CARD_IMAGES, i)}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface-2 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_28px_-8px_var(--primary)]"
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      width={1024}
                      height={640}
                      loading="lazy"
                      className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-80 group-hover:opacity-100 transition-opacity">
                      <figcaption className="font-mono text-[10px] uppercase tracking-wider text-white/80">
                        {img.label}
                      </figcaption>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-sm">
                        Expand
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </div>

          {/* Positioning */}
          <Section icon={ArrowUpDown} title="Positioning">
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <span className="text-foreground/80">Position:</span>{" "}
                {PREF_CARD.positioning.position}
              </li>
              <li>
                <span className="text-foreground/80">Arm:</span> {PREF_CARD.positioning.arm}
              </li>
              <li>
                <span className="text-foreground/80">Padding:</span> {PREF_CARD.positioning.padding}
              </li>
            </ul>
          </Section>

          {/* Implants */}
          <Section icon={Stethoscope} title="Implants">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PREF_CARD.implants.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* Instruments */}
          <Section icon={Syringe} title="Instruments & Equipment">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PREF_CARD.instruments.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* Supplies */}
          <Section icon={Package} title="Supplies & Consumables">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PREF_CARD.supplies.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          {/* Surgeon Notes */}
          <div className="sm:col-span-2">
            <Section icon={ClipboardList} title="Surgeon Notes">
              <div className="space-y-2">
                {PREF_CARD.notes.map((note) => (
                  <div
                    key={note}
                    className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-sm text-white"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
