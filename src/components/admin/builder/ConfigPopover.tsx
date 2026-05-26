import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ImagePlus, Trash2, X } from "lucide-react";
import type { PrefCardImage, Procedure, Surgeon } from "../types";
import { PrefCardWysiwyg } from "../PrefCardWysiwyg";
import type { ContentSource, WidgetConfig, WidgetImage, WidgetInstance } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  widget: WidgetInstance;
  procedures: Procedure[];
  surgeons: Surgeon[];
  images: PrefCardImage[];
  onClose: () => void;
  onSave: (patch: Partial<WidgetConfig>) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function makeImageId() {
  return `wi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function ConfigPopover({ widget, procedures, surgeons, images, onClose, onSave }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const surgeonsById = useMemo(() => {
    const map = new Map<string, Surgeon>();
    for (const s of surgeons) map.set(s.id, s);
    return map;
  }, [surgeons]);

  const sortedProcedures = useMemo(
    () =>
      [...procedures].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [procedures],
  );

  const procLabel = (p: Procedure) => {
    const s = surgeonsById.get(p.surgeonId);
    const name = s ? `${s.firstName} ${s.lastName}`.trim() || "(unnamed)" : "(no surgeon)";
    return `${p.name} — ${name}`;
  };

  const source: ContentSource = widget.config.source ?? "procedure";
  const supportsSourceToggle =
    widget.type === "carousel" ||
    widget.type === "image" ||
    widget.type === "prefcard-text";

  const renderBody = () => {
    switch (widget.type) {
      case "carousel": {
        const procImages = widget.config.procedureId
          ? images.filter((i) => i.procedureId === widget.config.procedureId)
          : [];
        return (
          <>
            <SourceToggle source={source} onChange={(s) => onSave({ source: s })} />
            {source === "procedure" ? (
              <>
                <ProcedurePicker
                  procedures={sortedProcedures}
                  label={procLabel}
                  value={widget.config.procedureId}
                  onChange={(id) => onSave({ procedureId: id })}
                />
                {widget.config.procedureId && (
                  <p className="mt-2 text-xs font-light text-muted-foreground">
                    {procImages.length} image{procImages.length === 1 ? "" : "s"} attached.
                  </p>
                )}
              </>
            ) : (
              <ImageUploader
                images={widget.config.customImages ?? []}
                multiple
                onChange={(next) => onSave({ customImages: next })}
              />
            )}
          </>
        );
      }
      case "image": {
        const procImages = widget.config.procedureId
          ? images.filter((i) => i.procedureId === widget.config.procedureId)
          : [];
        return (
          <>
            <SourceToggle source={source} onChange={(s) => onSave({ source: s })} />
            {source === "procedure" ? (
              <>
                <ProcedurePicker
                  procedures={sortedProcedures}
                  label={procLabel}
                  value={widget.config.procedureId}
                  onChange={(id) => onSave({ procedureId: id, imageId: undefined })}
                />
                {widget.config.procedureId && procImages.length > 0 && (
                  <div className="mt-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Image
                    </span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {procImages.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => onSave({ imageId: img.id })}
                          className={cn(
                            "aspect-[4/3] overflow-hidden rounded-md border bg-black",
                            widget.config.imageId === img.id
                              ? "border-primary"
                              : "border-border/60 hover:border-foreground/30",
                          )}
                        >
                          <img
                            src={img.dataUrl}
                            alt={img.name}
                            className="h-full w-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {widget.config.procedureId && procImages.length === 0 && (
                  <p className="mt-2 text-xs font-light text-muted-foreground">
                    This procedure has no images yet.
                  </p>
                )}
              </>
            ) : (
              <ImageUploader
                images={widget.config.customImages ?? []}
                multiple={false}
                onChange={(next) => onSave({ customImages: next })}
              />
            )}
          </>
        );
      }
      case "prefcard-text":
        return (
          <>
            <SourceToggle source={source} onChange={(s) => onSave({ source: s })} />
            {source === "procedure" ? (
              <ProcedurePicker
                procedures={sortedProcedures}
                label={procLabel}
                value={widget.config.procedureId}
                onChange={(id) => onSave({ procedureId: id })}
              />
            ) : (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  Preference card form
                </span>
                <div className="mt-2">
                  <PrefCardWysiwyg
                    value={widget.config.customHtml ?? ""}
                    onChange={(html) => onSave({ customHtml: html })}
                  />
                </div>
              </div>
            )}
          </>
        );
      case "timer": {
        const currentMin = Math.floor((widget.config.durationSec ?? 300) / 60);
        const currentSec = (widget.config.durationSec ?? 300) % 60;
        return (
          <div className="space-y-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Label
              </span>
              <input
                type="text"
                value={widget.config.label ?? ""}
                onChange={(e) => onSave({ label: e.target.value })}
                placeholder="e.g. Tourniquet"
                className="mt-2 w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Minutes"
                value={currentMin}
                min={0}
                max={120}
                onChange={(v) => onSave({ durationSec: v * 60 + currentSec })}
              />
              <NumberField
                label="Seconds"
                value={currentSec}
                min={0}
                max={59}
                onChange={(v) => onSave({ durationSec: currentMin * 60 + v })}
              />
            </div>
          </div>
        );
      }
      case "stopwatch":
        return (
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Label
            </span>
            <input
              type="text"
              value={widget.config.label ?? ""}
              onChange={(e) => onSave({ label: e.target.value })}
              placeholder="e.g. Tourniquet up"
              className="mt-2 w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
            />
          </label>
        );
      case "clock":
      case "arti":
      case "pacs":
      case "procedure-planning":
      case "timeout-checklist":
        return (
          <p className="text-xs font-light text-muted-foreground">
            No configuration for this widget.
          </p>
        );
    }
  };

  // The custom prefcard-text editor needs more width than other configs.
  const isWide = widget.type === "prefcard-text" && source === "custom";

  return (
    <div
      ref={rootRef}
      className={cn(
        "absolute bottom-2 right-2 z-40 flex flex-col rounded-xl border border-border/60 bg-popover/95 p-4 shadow-2xl backdrop-blur-sm",
        // Natural width but never wider/taller than the widget itself.
        "max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)]",
        isWide ? "w-[28rem]" : "w-80",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Configure widget</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close configuration"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{renderBody()}</div>
    </div>
  );
}

function SourceToggle({
  source,
  onChange,
}: {
  source: ContentSource;
  onChange: (s: ContentSource) => void;
}) {
  return (
    <div className="mb-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Source
      </span>
      <div className="mt-2 inline-flex overflow-hidden rounded-md border border-border/60">
        <button
          type="button"
          onClick={() => onChange("procedure")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            source === "procedure"
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2/40 text-muted-foreground hover:text-foreground",
          )}
        >
          Procedure
        </button>
        <button
          type="button"
          onClick={() => onChange("custom")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium transition-colors",
            source === "custom"
              ? "bg-primary text-primary-foreground"
              : "bg-surface-2/40 text-muted-foreground hover:text-foreground",
          )}
        >
          Custom
        </button>
      </div>
    </div>
  );
}

function ImageUploader({
  images,
  multiple,
  onChange,
}: {
  images: WidgetImage[];
  multiple: boolean;
  onChange: (next: WidgetImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: WidgetImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await readAsDataUrl(file);
      next.push({ id: makeImageId(), name: file.name, dataUrl });
      if (!multiple) break;
    }
    if (next.length === 0) return;
    onChange(multiple ? [...images, ...next] : next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (id: string) => onChange(images.filter((i) => i.id !== id));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-surface-2/40 px-3 py-5 text-center transition-colors hover:border-primary/60 hover:bg-surface-2/70"
      >
        <ImagePlus className="h-5 w-5 text-primary" strokeWidth={1.7} />
        <div className="text-xs font-light text-foreground">
          {multiple ? "Upload images" : images.length > 0 ? "Replace image" : "Upload image"}
        </div>
      </button>

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {images.map((img) => (
            <li
              key={img.id}
              className="relative overflow-hidden rounded-md border border-border/60 bg-black"
            >
              <div className="aspect-[4/3] w-full">
                <img src={img.dataUrl} alt={img.name} className="h-full w-full object-contain" />
              </div>
              <button
                type="button"
                onClick={() => removeAt(img.id)}
                aria-label={`Remove ${img.name}`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-md bg-black/70 text-white/90 transition-colors hover:bg-destructive"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.7} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProcedurePicker({
  procedures,
  label,
  value,
  onChange,
}: {
  procedures: Procedure[];
  label: (p: Procedure) => string;
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Procedure
      </span>
      <div className="relative mt-2">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="w-full appearance-none rounded-md border border-border/60 bg-surface-2/60 px-3 py-2 pr-9 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
        >
          <option value="">— Select —</option>
          {procedures.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.7}
        />
      </div>
      {procedures.length === 0 && (
        <p className="mt-2 text-xs font-light text-muted-foreground">
          No procedures yet. Add one in Settings → Surgeons or Procedures.
        </p>
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = Number(local);
          const clamped = Math.max(min, Math.min(max, Number.isFinite(n) ? Math.floor(n) : min));
          setLocal(String(clamped));
          onChange(clamped);
        }}
        className="mt-2 w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
      />
    </label>
  );
}
