import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import gsap from "gsap";
import { WIDGET_META, WIDGET_ORDER, type WidgetType } from "./types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
}

export function Palette({ open }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Stagger-in palette cards on mount.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const cards = list.querySelectorAll("[data-palette-card]");
    gsap.fromTo(
      cards,
      { x: 32, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.45,
        stagger: 0.05,
        ease: "back.out(1.4)",
      },
    );
  }, []);

  return (
    <div className="relative h-full overflow-hidden border-l border-border bg-surface/60">
      <aside
        className="flex h-full w-72 flex-col"
        style={{
          transform: open ? "translateX(0%)" : "translateX(100%)",
          transition: "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
            Widgets
          </div>
          <p className="mt-1 text-xs font-light text-muted-foreground">
            Drag a widget onto the canvas. Drop anywhere on the canvas to place it.
          </p>
        </div>
        <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {WIDGET_ORDER.map((type) => (
            <PaletteCard key={type} type={type} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function PaletteCard({ type }: { type: WidgetType }) {
  const meta = WIDGET_META[type];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", widgetType: type },
  });

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : {};

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      data-palette-card
      {...listeners}
      {...attributes}
      className={cn(
        "flex w-full cursor-grab items-start gap-3 rounded-xl border border-border/60 bg-surface-2/40 px-3 py-3 text-left transition-all",
        "hover:border-primary/40 hover:bg-surface-2/70",
        "active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-3/50 text-primary">
        <meta.icon className="h-4 w-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{meta.label}</div>
        <div className="mt-0.5 text-xs font-light text-muted-foreground">
          {meta.blurb}
        </div>
      </div>
    </button>
  );
}
