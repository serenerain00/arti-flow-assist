import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Pencil,
  Stethoscope,
  Syringe,
  Trash2,
  Upload,
} from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import {
  SCHEDULE_CASES,
  SURGEONS,
  toDateKey,
  type PrefCardImage,
  type Surgeon,
  type SurgeonProcedure,
} from "./schedule";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onLogout: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;

  /** Surgeon being viewed. Looked up from SURGEONS. */
  surgeonName: string;
  /** Back to the surgeon directory. */
  onBack: () => void;
  /** Open the surgeon's calendar schedule (PersonScheduleModal). */
  onOpenSchedule: (name: string) => void;

  /** Returns the live image list for a procedure (seed + uploads − removed, with renames applied). */
  imagesFor: (procedureSlug: string) => PrefCardImage[];
  onRenameImage: (procedureSlug: string, imageId: string, newLabel: string) => void;
  onRemoveImage: (procedureSlug: string, imageId: string) => void;
  onUploadImages: (procedureSlug: string, files: File[]) => void;
  onOpenImageLightbox: (procedureSlug: string, imageIndex: number) => void;

  /** Voice-controlled expansion. When set, that procedure is open; others are collapsed. */
  expandedProcedureSlug: string | null;
  onSetExpandedProcedure: (slug: string | null) => void;
}

export function SurgeonProfileScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onLogout,
  onPrompt,
  onSidebarNavigate,
  surgeonName,
  onBack,
  onOpenSchedule,
  imagesFor,
  onRenameImage,
  onRemoveImage,
  onUploadImages,
  onOpenImageLightbox,
  expandedProcedureSlug,
  onSetExpandedProcedure,
}: Props) {
  const surgeon: Surgeon | undefined = useMemo(
    () => SURGEONS.find((s) => s.name === surgeonName),
    [surgeonName],
  );

  const procedures = surgeon?.procedures ?? [];

  const upcomingCount = useMemo(() => {
    if (!surgeon) return 0;
    const todayKey = toDateKey(new Date());
    return SCHEDULE_CASES.filter(
      (c) =>
        c.surgeon === surgeon.name &&
        c.date >= todayKey &&
        c.status !== "cancelled" &&
        c.status !== "completed",
    ).length;
  }, [surgeon]);

  if (!surgeon) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar
          onSleep={onSleep}
          onLogout={onLogout}
          activeKey="surgeons"
          onNavigate={onSidebarNavigate}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            staffName={staffName}
            staffRole={staffRole}
            initials={initials}
            onSleep={onSleep}
          />
          <main className="flex flex-1 items-center justify-center text-sm font-light text-muted-foreground">
            Surgeon "{surgeonName}" not found.
            <button
              onClick={onBack}
              className="ml-3 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wider hover:border-primary"
            >
              Back
            </button>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        onSleep={onSleep}
        onLogout={onLogout}
        activeKey="surgeons"
        onNavigate={onSidebarNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar staffName={staffName} staffRole={staffRole} initials={initials} onSleep={onSleep} />

        <main
          data-scroll
          className="relative min-h-0 flex-1 overflow-y-auto px-8 pt-6 pb-40 animate-fade-in"
        >
          {/* Back link */}
          <button
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.7} />
            Surgeons Directory
          </button>

          {/* Header */}
          <header className="mb-8 flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-5">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-medium text-white"
                style={{
                  background: `linear-gradient(135deg, ${surgeon.color}, color-mix(in oklab, ${surgeon.color} 60%, white))`,
                }}
              >
                {surgeon.initials}
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
                  Surgeon · Procedure Preferences
                </div>
                <h1 className="mt-2 text-4xl font-extralight tracking-tight text-foreground">
                  {surgeon.name}
                </h1>
                <p className="mt-1 text-sm font-light text-muted-foreground">
                  {surgeon.specialty} · {surgeon.homeRoom} · {upcomingCount} upcoming
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenSchedule(surgeon.name)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-xs font-light uppercase tracking-wider text-foreground transition-all hover:border-primary/50 hover:text-primary"
            >
              <CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.7} />
              View Schedule
            </button>
          </header>

          {/* Procedures */}
          <section>
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                Procedures · {procedures.length}
              </h2>
              <p className="text-xs font-light italic text-muted-foreground">
                Ask Arti: <span className="text-foreground/70">"open RSA"</span>,{" "}
                <span className="text-foreground/70">"rename back table to layout 1"</span>,{" "}
                <span className="text-foreground/70">"remove image 2"</span>
              </p>
            </div>

            {procedures.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 px-6 py-12 text-center text-sm font-light text-muted-foreground">
                No procedure preferences on file for {surgeon.name} yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {procedures.map((proc) => (
                  <ProcedureCard
                    key={proc.slug}
                    procedure={proc}
                    images={imagesFor(proc.slug)}
                    expanded={expandedProcedureSlug === proc.slug}
                    onToggle={() =>
                      onSetExpandedProcedure(expandedProcedureSlug === proc.slug ? null : proc.slug)
                    }
                    onRenameImage={(imgId, label) => onRenameImage(proc.slug, imgId, label)}
                    onRemoveImage={(imgId) => onRemoveImage(proc.slug, imgId)}
                    onUploadImages={(files) => onUploadImages(proc.slug, files)}
                    onOpenImageLightbox={(idx) => onOpenImageLightbox(proc.slug, idx)}
                  />
                ))}
              </ul>
            )}
          </section>
        </main>

        <ArtiInvoker
          placeholder="Ask Arti about this surgeon's preferences…"
          onSubmit={onPrompt}
          suggestions={[
            "Open RSA",
            "Upload an image to rotator cuff",
            "Rename back table to layout 1",
            "Remove the mayo stand image",
            "Back to surgeons",
          ]}
        />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Procedure card
// ──────────────────────────────────────────────────────────────────────────

function ProcedureCard({
  procedure,
  images,
  expanded,
  onToggle,
  onRenameImage,
  onRemoveImage,
  onUploadImages,
  onOpenImageLightbox,
}: {
  procedure: SurgeonProcedure;
  images: PrefCardImage[];
  expanded: boolean;
  onToggle: () => void;
  onRenameImage: (imageId: string, newLabel: string) => void;
  onRemoveImage: (imageId: string) => void;
  onUploadImages: (files: File[]) => void;
  onOpenImageLightbox: (index: number) => void;
}) {
  return (
    <li
      id={`procedure-${procedure.slug}`}
      className={cn(
        "scroll-mt-24 rounded-2xl border bg-surface/40 transition-all",
        expanded ? "border-primary/40" : "border-border/60 hover:border-primary/20",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-light text-foreground">{procedure.name}</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              {procedure.slug}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              · {images.length} image{images.length === 1 ? "" : "s"}
            </span>
          </div>
          {procedure.summary && (
            <p className="mt-1 text-xs font-light text-muted-foreground">{procedure.summary}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-border/40 px-5 py-5">
          {/* Image grid */}
          <ImageManager
            images={images}
            onRename={onRenameImage}
            onRemove={onRemoveImage}
            onUpload={onUploadImages}
            onOpen={onOpenImageLightbox}
          />

          {/* Detail sections */}
          <div className="grid gap-5 sm:grid-cols-2">
            {procedure.positioning && (
              <DetailSection icon={ArrowUpDown} title="Positioning" items={procedure.positioning} />
            )}
            {procedure.implants && (
              <DetailSection icon={Stethoscope} title="Implants" items={procedure.implants} />
            )}
            {procedure.instruments && (
              <DetailSection
                icon={Syringe}
                title="Instruments & Equipment"
                items={procedure.instruments}
              />
            )}
            {procedure.supplies && (
              <DetailSection
                icon={Package}
                title="Supplies & Consumables"
                items={procedure.supplies}
              />
            )}
          </div>

          {procedure.notes && procedure.notes.length > 0 && (
            <div>
              <SectionHeading icon={ClipboardList}>Surgeon Notes</SectionHeading>
              <div className="mt-2 space-y-2">
                {procedure.notes.map((note) => (
                  <div
                    key={note}
                    className="rounded-lg border border-warning/20 bg-warning/5 px-3 py-2 text-sm text-white"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Image manager
// ──────────────────────────────────────────────────────────────────────────

function ImageManager({
  images,
  onRename,
  onRemove,
  onUpload,
  onOpen,
}: {
  images: PrefCardImage[];
  onRename: (imageId: string, newLabel: string) => void;
  onRemove: (imageId: string) => void;
  onUpload: (files: File[]) => void;
  onOpen: (index: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionHeading icon={LayoutGrid}>Preference Card Images</SectionHeading>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onUpload(files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-primary transition-all hover:border-primary/60 hover:bg-primary/20"
          >
            <Upload className="h-3 w-3" strokeWidth={1.8} />
            Upload Image
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-surface-2/30 px-6 py-10 text-center transition-all hover:border-primary/40 hover:bg-surface-2/50"
        >
          <ImageIcon className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.4} />
          <div className="text-sm font-light text-muted-foreground">
            No images yet — click to upload
          </div>
        </button>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img, i) => (
            <ImageTile
              key={img.id}
              image={img}
              index={i}
              onRename={(label) => onRename(img.id, label)}
              onRemove={() => onRemove(img.id)}
              onOpen={() => onOpen(i)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ImageTile({
  image,
  index,
  onRename,
  onRemove,
  onOpen,
}: {
  image: PrefCardImage;
  index: number;
  onRename: (newLabel: string) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(image.label);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Sync the draft with the live label only when NOT editing — otherwise a
  // parent re-render between keystrokes would clobber the user's input.
  useEffect(() => {
    if (!editing) setDraft(image.label);
  }, [image.label, editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== image.label) onRename(trimmed);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(image.label);
    setEditing(false);
  };

  return (
    <li className="overflow-hidden rounded-xl border border-border/60 bg-surface-2/40">
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full overflow-hidden"
        aria-label={`Enlarge ${image.label}`}
      >
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </button>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            #{index + 1}
          </span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              onBlur={commit}
              className="min-w-0 flex-1 rounded border border-primary/40 bg-surface px-1.5 py-0.5 text-xs font-light text-foreground focus:border-primary focus:outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs font-light text-foreground">
              {image.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            // While editing, the input is focused. preventDefault on mousedown
            // keeps the input focused so onBlur doesn't fire commit before
            // this click handler — otherwise the two paths race and the
            // second commit reads stale state.
            onMouseDown={(e) => {
              if (editing) e.preventDefault();
            }}
            onClick={() => (editing ? commit() : setEditing(true))}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/50 hover:text-primary"
            aria-label={editing ? "Save label" : "Rename image"}
          >
            <Pencil className="h-2.5 w-2.5" strokeWidth={1.8} />
            {editing ? "Save" : "Rename"}
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-destructive/50 bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive transition-all hover:bg-destructive/25"
              >
                <Trash2 className="h-2.5 w-2.5" strokeWidth={1.8} />
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:border-destructive/50 hover:text-destructive"
              aria-label="Remove image"
            >
              <Trash2 className="h-2.5 w-2.5" strokeWidth={1.8} />
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Layout helpers
// ──────────────────────────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: import("lucide-react").LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
      <Icon className="h-3 w-3" strokeWidth={1.8} />
      {children}
    </div>
  );
}

function DetailSection({
  icon,
  title,
  items,
}: {
  icon: import("lucide-react").LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <SectionHeading icon={icon}>{title}</SectionHeading>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
