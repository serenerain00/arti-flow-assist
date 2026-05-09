import { useMemo } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DashboardConfig,
  DashboardItem,
  DashboardSurface,
  WidgetContext,
  WidgetId,
} from "./types";
import { ALL_WIDGET_IDS, WIDGET_DEFS, WIDGET_ICON, WIDGET_RENDERERS } from "./registry";

interface Props {
  config: DashboardConfig;
  ctx: WidgetContext;
  editing: boolean;
  /** Which surface this canvas is rendered on — drives the palette filter. */
  surface: DashboardSurface;
  /**
   * Called when the user reorders / adds / removes items in edit mode.
   * Persistence is the parent's responsibility — this component owns
   * neither localStorage nor the "saved" state.
   */
  onChange: (next: DashboardConfig) => void;
}

/** Map a widget span to a Tailwind grid-column class. */
const SPAN_TO_CLASS: Record<"1" | "2" | "full", string> = {
  "1": "xl:col-span-1",
  "2": "xl:col-span-2",
  full: "col-span-full xl:col-span-3",
};

function spanClass(item: DashboardItem): string {
  const span = item.span ?? WIDGET_DEFS[item.id].defaultSpan;
  return SPAN_TO_CLASS[span === "full" ? "full" : (String(span) as "1" | "2")];
}

export function DashboardCanvas({ config, ctx, editing, surface, onChange }: Props) {
  if (editing) {
    return <EditCanvas config={config} ctx={ctx} surface={surface} onChange={onChange} />;
  }
  return <ReadCanvas config={config} ctx={ctx} />;
}

// ─────────────────────────────────────────────────────────────────────────
// Read mode — responsive 3-column grid.
// ─────────────────────────────────────────────────────────────────────────

function ReadCanvas({ config, ctx }: { config: DashboardConfig; ctx: WidgetContext }) {
  if (config.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 px-6 py-16 text-center text-sm font-light text-muted-foreground">
        No widgets on this dashboard yet. Click <span className="font-medium">Edit Dashboard</span>{" "}
        to add some.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      {config.items.map((item) => (
        <div key={item.id} className={spanClass(item)}>
          {WIDGET_RENDERERS[item.id](ctx)}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Edit mode — same responsive 3-col grid as Read mode (so the user
// references the live layout while editing) + a side palette of widgets
// they can add. Drag handle on each tile reorders within the grid.
// ─────────────────────────────────────────────────────────────────────────

function EditCanvas({
  config,
  ctx,
  surface,
  onChange,
}: {
  config: DashboardConfig;
  ctx: WidgetContext;
  surface: DashboardSurface;
  onChange: (next: DashboardConfig) => void;
}) {
  // 5px activation distance prevents stray clicks on widget controls
  // (e.g. 3D model orbit handles, chart tooltips) from initiating a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = config.items.findIndex((i) => i.id === active.id);
    const newIndex = config.items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({ items: arrayMove(config.items, oldIndex, newIndex) });
  };

  const remove = (id: WidgetId) => onChange({ items: config.items.filter((i) => i.id !== id) });
  const add = (id: WidgetId) => onChange({ items: [...config.items, { id }] });

  const presentIds = useMemo(() => new Set(config.items.map((i) => i.id)), [config.items]);
  const palette = useMemo(
    () =>
      ALL_WIDGET_IDS.filter(
        (id) => !presentIds.has(id) && WIDGET_DEFS[id].surfaces.includes(surface),
      ),
    [presentIds, surface],
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      {/* Sortable responsive grid — keeps the live layout so widgets look
          like they will once Save lands. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={config.items.map((i) => i.id)} strategy={rectSortingStrategy}>
          {config.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 px-6 py-16 text-center text-sm font-light text-muted-foreground">
              Empty dashboard. Add widgets from the palette →
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {config.items.map((item) => (
                <SortableTile
                  key={item.id}
                  item={item}
                  ctx={ctx}
                  onRemove={() => remove(item.id)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {/* Palette */}
      <aside className="self-start rounded-2xl border border-border/60 bg-surface/40 p-4 lg:sticky lg:top-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
          Widget Palette · {surface === "home" ? "Home" : "Pre-Op"}
        </div>
        <p className="mb-3 text-xs font-light text-muted-foreground">
          Click + to add. Drag the handle on a tile to reorder, X to remove.
        </p>
        {palette.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-surface/30 px-3 py-6 text-center text-xs font-light text-muted-foreground">
            All available widgets are already on the dashboard.
          </div>
        ) : (
          <ul className="space-y-2">
            {palette.map((id) => {
              const def = WIDGET_DEFS[id];
              const Icon = WIDGET_ICON[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => add(id)}
                    className="group flex w-full items-start gap-3 rounded-xl border border-border/50 bg-surface-2/50 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-surface-2/80"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.7} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-light text-foreground">{def.title}</div>
                      <div className="mt-0.5 text-[11px] font-light leading-snug text-muted-foreground">
                        {def.blurb}
                      </div>
                    </div>
                    <Plus
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                      strokeWidth={2}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}

function SortableTile({
  item,
  ctx,
  onRemove,
}: {
  item: DashboardItem;
  ctx: WidgetContext;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const def = WIDGET_DEFS[item.id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/tile relative rounded-2xl outline outline-2 outline-offset-[-2px] outline-dashed outline-primary/20 transition-shadow",
        spanClass(item),
        isDragging && "z-30 shadow-2xl outline-primary/60",
      )}
    >
      {/* Live widget — rendered as-is so the user sees the actual layout. */}
      <div className="pointer-events-none">{WIDGET_RENDERERS[item.id](ctx)}</div>

      {/* Edit chrome — drag handle (top-left) + remove (top-right). Sits
          above the widget; inner widget pointer-events disabled to keep
          interactions clean while editing. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 flex h-8 items-center gap-1.5 rounded-full border border-primary/40 bg-background/85 px-2.5 font-mono text-[10px] uppercase tracking-wider text-primary backdrop-blur transition-colors hover:border-primary hover:bg-background active:cursor-grabbing"
        aria-label={`Drag ${def.title}`}
        title={`Drag to reorder · ${def.title}`}
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="truncate max-w-[140px]">{def.title}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/85 text-muted-foreground backdrop-blur transition-colors hover:border-destructive/60 hover:text-destructive"
        aria-label={`Remove ${def.title}`}
        title="Remove from dashboard"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
