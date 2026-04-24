import { BookOpen, CheckCircle, ClipboardList, Clock, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import surgicalTableOverview from "@/assets/surgical-table-overview.jpg";
import surgicalTableMayo from "@/assets/surgical-table-mayo.jpg";
import type { LightboxImage } from "./ImageLightboxModal";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";

export const SURGEON_LIGHTBOX_IMAGES: LightboxImage[] = [
  {
    src: surgicalTableOverview,
    alt: "Back table — standard RSA setup",
    label: "Back Table · Standard RSA Setup",
    caption: "Full instrument layout for reverse shoulder arthroplasty",
  },
  {
    src: surgicalTableMayo,
    alt: "Mayo stand — shoulder arthroplasty",
    label: "Mayo Stand · Shoulder Arthroplasty",
    caption: "Reamers, trials, and impactors arranged in sequence",
  },
];


interface Props {
  activeCase?: CaseItem;
  onOpenLightbox: (images: LightboxImage[], index?: number) => void;
}

function PanelLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/80">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {children}
    </div>
  );
}

export function SurgeonPanel({ activeCase, onOpenLightbox }: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : PATIENT_CLINICAL["c-002"];
  const c = clinical ?? PATIENT_CLINICAL["c-002"];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 animate-fade-in">
      {/* ── Left (2 cols) — procedure steps ── */}
      <div className="space-y-4 xl:col-span-2">
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={BookOpen}>
            Procedure Steps · {activeCase?.procedure ?? "Reverse Total Shoulder Arthroplasty"}
          </PanelLabel>
          <div className="space-y-2">
            {c.procedureSteps.map((s, i) => (
              <div
                key={s.step}
                className="flex items-start gap-4 rounded-xl border border-border/25 bg-surface-2/30 px-4 py-3 transition-colors hover:bg-surface-2/55"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/35 bg-accent/10">
                  <span className="font-mono text-[11px] font-semibold text-accent">{s.step}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground/90">{s.title}</p>
                  <p className="text-xs font-light text-muted-foreground">{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table setup images */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={LayoutGrid}>Table Setup · Tap to Inspect</PanelLabel>
          <div className="grid grid-cols-2 gap-3">
            {SURGEON_LIGHTBOX_IMAGES.map((img, i) => (
              <button
                key={img.label}
                onClick={() => onOpenLightbox(SURGEON_LIGHTBOX_IMAGES, i)}
                className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface-2 text-left transition-all duration-300 hover:border-accent/40 hover:shadow-[0_0_28px_-8px_var(--accent)]"
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
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
        {/* Case summary */}
        <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
          <PanelLabel icon={ClipboardList}>Case Summary</PanelLabel>
          <div className="space-y-2.5 text-sm">
            {[
              ["Patient", `${activeCase?.patientName ?? "Marcus Chen"} · ${activeCase?.patientAgeSex ?? "62M"}`],
              ["DOB", c.dob],
              ["MRN", activeCase?.patientMrn ?? "MRN 902‑118"],
              ["Procedure", `${activeCase?.procedureShort ?? "RSA"} · ${activeCase?.side ? `${activeCase.side} shoulder` : "Right shoulder"}`],
              ["Surgeon", activeCase?.surgeon ?? "Dr. Anika Patel"],
              ["Room / Time", `${activeCase?.room ?? "OR 326"} · ${activeCase?.time ?? "09:45"}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {k}
                </span>
                <span className="font-light text-foreground/85">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/[0.06] px-3 py-2 text-xs text-success">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            Consent · Laterality · Allergy — all verified
          </div>
        </div>

        {/* Implant plan */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={ClipboardList}>Implant Plan</PanelLabel>
          <div className="space-y-2">
            {c.implantPlan.map((imp) => (
              <div
                key={imp.component}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/25 bg-surface-2/30 px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-medium text-foreground/85">{imp.component}</p>
                  <p className="text-[11px] font-light text-muted-foreground">{imp.spec}</p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    imp.confirmed
                      ? "border-success/30 bg-success/[0.06] text-success"
                      : "border-warning/30 bg-warning/8 text-warning",
                  )}
                >
                  {imp.confirmed ? "confirmed" : "pending"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Surgeon notes */}
        <div className="rounded-2xl border border-border/60 bg-surface/60 p-5 backdrop-blur-sm">
          <PanelLabel icon={Clock}>Surgeon Notes</PanelLabel>
          <div className="space-y-2">
            {c.notes.map((note) => (
              <div
                key={note}
                className="rounded-xl border border-warning/20 bg-warning/[0.05] px-3 py-2.5 text-xs font-light leading-relaxed text-foreground/80"
              >
                {note}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
