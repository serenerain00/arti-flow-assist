import {
  BookOpen,
  CheckCircle,
  ClipboardList,
  Clock,
  LayoutGrid,
  PlayCircle,
  ScanLine,
  Sparkles,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import surgicalTableOverview from "@/assets/surgical-table-overview.jpg";
import surgicalTableMayo from "@/assets/surgical-table-mayo.jpg";
import type { LightboxImage } from "./ImageLightboxModal";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";
import type { PatientVideoSession } from "./PatientVideoModal";

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
  /** Latest viewing session for the active case (undefined = never opened). */
  videoSession?: PatientVideoSession;
  onOpenPatientVideo: () => void;
  onOpenXrays: () => void;
}

function fmtClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PanelLabel({
  icon: Icon,
  children,
}: {
  icon: import("lucide-react").LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/80">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {children}
    </div>
  );
}

export function SurgeonPanel({
  activeCase,
  onOpenLightbox,
  videoSession,
  onOpenPatientVideo,
  onOpenXrays,
}: Props) {
  const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : PATIENT_CLINICAL["c-002"];
  const c = clinical ?? PATIENT_CLINICAL["c-002"];
  const video = c.patientVideo;
  const study = c.imaging;
  const watchedPct =
    video.durationSec > 0 && videoSession
      ? Math.min(100, Math.round((videoSession.peakWatchedSec / video.durationSec) * 100))
      : 0;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 animate-fade-in">
      {/* ── Left (2 cols) — procedure steps ── */}
      <div className="space-y-4 xl:col-span-2">
        {/* Pre-op patient message card */}
        <button
          onClick={onOpenPatientVideo}
          className="group relative w-full overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[0.08] via-surface/60 to-surface/60 p-5 text-left backdrop-blur-sm transition-all duration-300 hover:border-accent/60 hover:shadow-[0_0_28px_-8px_var(--accent)]"
        >
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Video className="h-7 w-7" strokeWidth={1.6} />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-background shadow-lg">
                <PlayCircle className="h-5 w-5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent/85">
                <span>Pre-op patient message</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Recorded {video.recordedAt}</span>
              </div>
              <p className="mt-1 truncate text-base font-light text-foreground/90">
                {video.summary}
              </p>
              <div className="mt-1 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fmtClock(video.durationSec)}
                </span>
                <span>·</span>
                {videoSession ? (
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                      Viewed {fmtTimeShort(videoSession.openedAtIso)}
                    </span>
                    <span>·</span>
                    <span>
                      {watchedPct}% watched ({fmtClock(videoSession.peakWatchedSec)} of{" "}
                      {fmtClock(video.durationSec)})
                    </span>
                    {videoSession.completed && (
                      <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 normal-case tracking-normal text-success">
                        full play
                      </span>
                    )}
                    <span>·</span>
                    <span className="normal-case tracking-normal text-foreground/70">
                      by {videoSession.openedBy}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-warning">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
                    Not yet viewed by team
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-accent transition-colors group-hover:bg-accent/15">
              Open
            </div>
          </div>
        </button>

        {/* Patient imaging card — opens the PACS-style viewer. Mirrors
            the patient video card's shape so the two pre-op review
            entry points read as a paired set. */}
        <button
          onClick={onOpenXrays}
          className="group relative w-full overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.08] via-surface/60 to-surface/60 p-5 text-left backdrop-blur-sm transition-all duration-300 hover:border-primary/60 hover:shadow-[0_0_28px_-8px_var(--primary)]"
        >
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <ScanLine className="h-7 w-7" strokeWidth={1.6} />
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-background shadow-lg",
                  study.laterality === "R" ? "bg-emerald-400" : "bg-amber-400",
                )}
              >
                <span className="font-mono text-xs font-bold">{study.laterality}</span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-primary/85">
                <span>Pre-op imaging</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{study.studyDate}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{study.accession}</span>
              </div>
              <p className="mt-1 truncate text-base font-light text-foreground/90">
                {study.protocol}
              </p>
              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{study.bodyRegion}</span>
                <span>·</span>
                <span>{study.views.length} views</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  {Array.from(new Set(study.views.map((v) => v.modality))).map((m) => (
                    <span
                      key={m}
                      className="rounded-full border border-primary/30 bg-primary/[0.08] px-1.5 py-0.5 normal-case tracking-normal text-primary"
                    >
                      {m}
                    </span>
                  ))}
                </span>
              </div>
            </div>
            <div className="shrink-0 rounded-full border border-primary/40 bg-primary/[0.08] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors group-hover:bg-primary/15">
              Open
            </div>
          </div>
          {/* Inline thumbnail strip — surgeon can see the modalities at a
              glance before opening the full viewer. */}
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {study.views.map((v) => (
              <div
                key={v.id}
                className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-black"
              >
                <img
                  src={v.src}
                  alt={v.label}
                  className="h-full w-full object-cover opacity-70"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/85">
                  <span className="truncate">{v.label}</span>
                  <span className="ml-1 text-white/55">{v.modality}</span>
                </div>
              </div>
            ))}
          </div>
        </button>

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

        {/* AI-extracted patient-video notes — distilled by Arti from the
            patient's pre-op recording. These notes are also visible inside
            the modal but are surfaced here so the surgeon can scan them
            without opening the player. */}
        <div className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-5 backdrop-blur-sm">
          <PanelLabel icon={Sparkles}>Patient Video Notes · AI-Extracted</PanelLabel>
          <ul className="space-y-2">
            {video.aiInsights.map((insight, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-xl border border-border/30 bg-surface-2/40 px-3 py-2 text-xs font-light leading-relaxed text-foreground/85"
              >
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {insight}
              </li>
            ))}
          </ul>
          <button
            onClick={onOpenPatientVideo}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:text-foreground"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Watch source video
          </button>
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
