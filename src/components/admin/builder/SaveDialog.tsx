import { useEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { Save, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  defaultName?: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export function SaveDialog({ open, defaultName, onCancel, onSave }: Props) {
  const [name, setName] = useState(defaultName ?? "");
  const cardRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setName(defaultName ?? "");
  }, [open, defaultName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open || !cardRef.current || !overlayRef.current) return;
    gsap.fromTo(
      overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.18, ease: "power2.out" },
    );
    gsap.fromTo(
      cardRef.current,
      { scale: 0.92, opacity: 0, y: 12 },
      { scale: 1, opacity: 1, y: 0, duration: 0.32, ease: "back.out(1.4)" },
    );
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave(name.trim());
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-popover p-6 shadow-2xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
            Template
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-3/80 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.7} />
          </button>
        </div>
        <h2 className="mt-2 text-xl font-light tracking-tight text-foreground">
          Name this template
        </h2>
        <p className="mt-1.5 text-sm font-light text-muted-foreground">
          Templates save the layout for all three phases. Apply them to any procedure later.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Template name
            </span>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard shoulder layout"
              className="mt-2 w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2.5 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-border/60 bg-surface-2/60 px-4 py-2 text-sm font-light text-foreground transition-colors hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all",
                canSubmit
                  ? "hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
                  : "cursor-not-allowed opacity-40",
              )}
            >
              <Save className="h-3.5 w-3.5" strokeWidth={2} />
              Save template
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
