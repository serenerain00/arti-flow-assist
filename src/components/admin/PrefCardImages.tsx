import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import type { PrefCardImage } from "./types";
import { makeId } from "./storage";
import { cn } from "@/lib/utils";

interface Props {
  procedureId: string;
  images: PrefCardImage[];
  onAddImages: (images: PrefCardImage[]) => void;
  onRemoveImage: (id: string) => void;
  onRenameImage: (id: string, name: string) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function PrefCardImages({
  procedureId,
  images,
  onAddImages,
  onRemoveImage,
  onRenameImage,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: PrefCardImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readAsDataUrl(file);
      next.push({
        id: makeId("img"),
        procedureId,
        name: file.name,
        dataUrl,
        createdAt: Date.now(),
      });
    }
    if (next.length > 0) onAddImages(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface/30 p-10 text-center transition-colors hover:border-primary/60 hover:bg-surface/50"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
          <ImagePlus className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div>
          <div className="text-sm font-light text-foreground">Upload preference card images</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Click to select · multiple supported
          </div>
        </div>
      </button>

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {images.map((img) => (
            <PrefCardImageCard
              key={img.id}
              image={img}
              onRename={(name) => onRenameImage(img.id, name)}
              onRemove={() => onRemoveImage(img.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PrefCardImageCard({
  image,
  onRename,
  onRemove,
}: {
  image: PrefCardImage;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(image.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setDraft(image.name), [image.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== image.name) onRename(trimmed);
    else setDraft(image.name);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(image.name);
    setEditing(false);
  };

  return (
    <li className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface-2/40">
      <div className="aspect-[4/3] w-full bg-black">
        <img src={image.dataUrl} alt={image.name} className="h-full w-full object-contain" />
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        {editing ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancel();
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-border/60 bg-surface-3/60 px-2 py-1 text-xs font-light text-foreground focus:border-primary/50 focus:outline-none"
              aria-label="Rename image"
            />
            <button
              type="button"
              onClick={commit}
              aria-label="Save name"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel rename"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={cn(
                "min-w-0 flex-1 truncate rounded-md px-1 py-0.5 text-left text-xs font-light text-muted-foreground transition-colors",
                "hover:bg-surface-3/40 hover:text-foreground",
              )}
              title="Click to rename"
            >
              {image.name}
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Rename ${image.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-surface-3 hover:text-foreground group-hover:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${image.name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
