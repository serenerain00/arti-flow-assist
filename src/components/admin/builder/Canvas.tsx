import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { LayoutGrid } from "lucide-react";
import { WidgetWrapper } from "./WidgetWrapper";
import {
  PHASE_LABEL,
  WIDGET_META,
  gridSpan,
  type Phase,
  type WidgetConfig,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
} from "./types";
import type { PrefCardImage, Procedure, Surgeon } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  phase: Phase;
  widgets: WidgetInstance[];
  procedures: Procedure[];
  surgeons: Surgeon[];
  images: PrefCardImage[];
  /** Id of the widget currently being dragged (canvas drag), or null. */
  draggingId: string | null;
  /** Widget type being dragged from palette (palette drag), or null. */
  palettePreview: WidgetType | null;
  /** Index where the palette preview placeholder should render. */
  paletteInsertIndex: number | null;
  onRemoveWidget: (id: string) => void;
  onResizeWidget: (id: string, size: WidgetSize) => void;
  onConfigWidget: (id: string, patch: Partial<WidgetConfig>) => void;
}

export function Canvas({
  phase,
  widgets,
  procedures,
  surgeons,
  images,
  draggingId,
  palettePreview,
  paletteInsertIndex,
  onRemoveWidget,
  onResizeWidget,
  onConfigWidget,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-dropzone" });
  const ids = widgets.map((w) => w.id);

  const placeholderSpan = palettePreview ? gridSpan(WIDGET_META[palettePreview].defaultSize) : null;
  const showEmpty = widgets.length === 0 && !palettePreview;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative min-h-0 flex-1 overflow-auto px-8 py-8 transition-colors",
        isOver && "bg-primary/5",
      )}
    >
      {showEmpty ? (
        <EmptyDropzone phase={phase} isOver={isOver} />
      ) : (
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div
            className="grid h-full w-full grid-cols-4 gap-3 auto-rows-[minmax(140px,_1fr)]"
            style={{ gridAutoFlow: "row dense" }}
          >
            {widgets.map((widget, i) => {
              const items: React.ReactNode[] = [];
              if (palettePreview && paletteInsertIndex !== null && paletteInsertIndex === i) {
                items.push(
                  <PalettePlaceholder
                    key="palette-placeholder"
                    widgetType={palettePreview}
                    span={placeholderSpan!}
                  />,
                );
              }
              items.push(
                <WidgetWrapper
                  key={widget.id}
                  widget={widget}
                  procedures={procedures}
                  surgeons={surgeons}
                  images={images}
                  ghosted={draggingId === widget.id}
                  onRemove={() => onRemoveWidget(widget.id)}
                  onResize={(size) => onResizeWidget(widget.id, size)}
                  onConfig={(patch) => onConfigWidget(widget.id, patch)}
                />,
              );
              return items;
            })}
            {palettePreview &&
              paletteInsertIndex !== null &&
              paletteInsertIndex >= widgets.length && (
                <PalettePlaceholder
                  key="palette-placeholder-end"
                  widgetType={palettePreview}
                  span={placeholderSpan!}
                />
              )}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function PalettePlaceholder({
  widgetType,
  span,
}: {
  widgetType: WidgetType;
  span: { col: number; row: number };
}) {
  const meta = WIDGET_META[widgetType];
  return (
    <div
      style={{
        gridColumn: `span ${span.col}`,
        gridRow: `span ${span.row}`,
      }}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10 text-center text-primary"
    >
      <meta.icon className="h-6 w-6" strokeWidth={1.5} />
      <div className="font-mono text-[10px] uppercase tracking-[0.3em]">Drop here</div>
    </div>
  );
}

function EmptyDropzone({ phase, isOver }: { phase: Phase; isOver: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition-colors",
        isOver ? "border-primary/80 bg-primary/5" : "border-border/60",
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
        <LayoutGrid className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-light text-foreground">{PHASE_LABEL[phase]} is empty</h2>
        <p className="mt-1 text-sm font-light text-muted-foreground">
          Drag a widget from the right panel to start building this phase.
        </p>
      </div>
    </div>
  );
}
