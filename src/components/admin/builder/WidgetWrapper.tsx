import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import gsap from "gsap";
import { GripVertical, Settings2, X } from "lucide-react";
import { ClockWidget } from "./widgets/ClockWidget";
import { TimerWidget } from "./widgets/TimerWidget";
import { StopwatchWidget } from "./widgets/StopwatchWidget";
import { ArtiWidget } from "./widgets/ArtiWidget";
import { CarouselWidget } from "./widgets/CarouselWidget";
import { PrefCardImageWidget } from "./widgets/PrefCardImageWidget";
import { PrefCardTextWidget } from "./widgets/PrefCardTextWidget";
import { PacsWidget } from "./widgets/PacsWidget";
import { ProcedurePlanningWidget } from "./widgets/ProcedurePlanningWidget";
import { ConfigPopover } from "./ConfigPopover";
import {
  WIDGET_META,
  gridSpan,
  type WidgetConfig,
  type WidgetInstance,
  type WidgetSize,
} from "./types";
import type { PrefCardImage, Procedure, Surgeon } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  widget: WidgetInstance;
  procedures: Procedure[];
  surgeons: Surgeon[];
  images: PrefCardImage[];
  /** When true, this widget is the drag source — render as a dashed placeholder. */
  ghosted: boolean;
  onRemove: () => void;
  onResize: (size: WidgetSize) => void;
  onConfig: (patch: Partial<WidgetConfig>) => void;
}

interface DisplayImage {
  id: string;
  name: string;
  dataUrl: string;
}

export function WidgetWrapper(props: Props) {
  const { widget, procedures, surgeons, images, ghosted, onRemove, onResize, onConfig } = props;
  const [configOpen, setConfigOpen] = useState(false);
  const meta = WIDGET_META[widget.type];
  const span = gridSpan(widget.size);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Grow-in on mount.
  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(
      contentRef.current,
      { scale: 0.82, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.42, ease: "back.out(1.5)" },
    );
  }, []);

  const sortable = useSortable({ id: widget.id });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  // Resolve content based on source mode.
  const isCustom = widget.config.source === "custom";
  const procedure =
    !isCustom && widget.config.procedureId
      ? procedures.find((p) => p.id === widget.config.procedureId)
      : undefined;
  const procImages = procedure ? images.filter((i) => i.procedureId === procedure.id) : [];
  const customImages: DisplayImage[] = widget.config.customImages ?? [];

  const carouselImages: DisplayImage[] = isCustom ? customImages : procImages;
  let displayImage: DisplayImage | undefined;
  if (isCustom) {
    displayImage = customImages[0];
  } else if (widget.config.imageId) {
    displayImage = images.find((i) => i.id === widget.config.imageId);
  } else {
    displayImage = procImages[0];
  }
  const html = isCustom ? widget.config.customHtml : procedure?.prefCardHtml;
  const caption = isCustom ? undefined : procedure?.name;

  const renderContent = () => {
    switch (widget.type) {
      case "clock":
        return <ClockWidget size={widget.size} />;
      case "timer":
        return (
          <TimerWidget
            size={widget.size}
            durationSec={widget.config.durationSec ?? 300}
            label={widget.config.label}
          />
        );
      case "stopwatch":
        return <StopwatchWidget size={widget.size} label={widget.config.label} />;
      case "arti":
        return <ArtiWidget size={widget.size} />;
      case "carousel":
        return <CarouselWidget size={widget.size} images={carouselImages} />;
      case "prefcard-image":
        return <PrefCardImageWidget size={widget.size} caption={caption} image={displayImage} />;
      case "prefcard-text":
        return <PrefCardTextWidget size={widget.size} caption={caption} html={html} />;
      case "pacs":
        return <PacsWidget size={widget.size} />;
      case "procedure-planning":
        return <ProcedurePlanningWidget size={widget.size} />;
    }
  };

  const style: React.CSSProperties = {
    gridColumn: `span ${span.col}`,
    gridRow: `span ${span.row}`,
    transform: CSS.Translate.toString(transform),
    transition,
    visibility: isDragging ? "hidden" : "visible",
  };

  const supportsSize = (s: WidgetSize) => meta.sizes.includes(s);

  if (ghosted) {
    return (
      <div
        style={{
          gridColumn: `span ${span.col}`,
          gridRow: `span ${span.row}`,
        }}
        className="pointer-events-none rounded-2xl border-2 border-dashed border-primary/60 bg-primary/5"
      />
    );
  }

  const isReserved = !!meta.reserved;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-2xl border transition-colors",
        isReserved
          ? "border-primary/50 bg-surface/60 hover:border-primary/80"
          : "border-border/80 bg-surface/60 hover:border-primary/60",
      )}
    >
      <div ref={contentRef} className="absolute inset-0 overflow-hidden rounded-2xl">
        {renderContent()}
      </div>

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag widget"
        className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 cursor-grab items-center justify-center rounded-md bg-black/40 text-white/80 opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={1.7} />
      </button>

      {isReserved ? (
        <span
          className="absolute right-1.5 top-1.5 z-10 rounded-full bg-primary/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-primary"
          title="Reserved widget — cannot be removed"
        >
          Reserved
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove widget"
          className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/40 text-white/80 transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      )}

      <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
        {(["small", "medium", "large"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResize(s);
            }}
            disabled={!supportsSize(s)}
            aria-label={`Set size ${s}`}
            className={cn(
              "rounded-full px-1.5 font-mono text-[9px] uppercase tracking-wider transition-colors",
              widget.size === s
                ? "bg-primary text-primary-foreground"
                : "text-white/80 hover:bg-white/10",
              !supportsSize(s) && "cursor-not-allowed opacity-30",
            )}
          >
            {s.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      {!isReserved && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfigOpen((v) => !v);
          }}
          aria-label="Configure widget"
          className="absolute bottom-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/40 text-white/80 opacity-0 transition-all hover:bg-black/60 group-hover:opacity-100"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.7} />
        </button>
      )}

      {configOpen && !isReserved && (
        <ConfigPopover
          widget={widget}
          procedures={procedures}
          surgeons={surgeons}
          images={images}
          onClose={() => setConfigOpen(false)}
          onSave={(patch) => onConfig(patch)}
        />
      )}
    </div>
  );
}
