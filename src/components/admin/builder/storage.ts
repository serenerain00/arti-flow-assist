import {
  EMPTY_LAYOUTS,
  type Dashboard,
  type PhaseLayouts,
  type WidgetInstance,
} from "./types";

const DASHBOARDS_KEY = "art-setup.dashboards.v1";

// "prefcard-image" was renamed to the generic "image" widget. Remap any
// widgets stored under the old type so previously saved dashboards survive.
function migrateWidgets(widgets: unknown): WidgetInstance[] {
  if (!Array.isArray(widgets)) return [];
  return (widgets as WidgetInstance[]).map((w) =>
    (w.type as string) === "prefcard-image" ? { ...w, type: "image" } : w,
  );
}

export function loadDashboards(): Dashboard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DASHBOARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: ensure layouts shape on each row in case old data is partial.
    return (parsed as Dashboard[]).map((d) => ({
      ...d,
      layouts: {
        preop: migrateWidgets(d.layouts?.preop),
        intraop: migrateWidgets(d.layouts?.intraop),
        postop: migrateWidgets(d.layouts?.postop),
      },
    }));
  } catch {
    return [];
  }
}

export function saveDashboards(dashboards: Dashboard[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARDS_KEY, JSON.stringify(dashboards));
  } catch {
    // quota — ignore
  }
}

export function findDashboardForProcedure(
  dashboards: Dashboard[],
  surgeonId: string,
  procedureId: string,
): Dashboard | undefined {
  return dashboards.find(
    (d) => !d.isTemplate && d.surgeonId === surgeonId && d.procedureId === procedureId,
  );
}

export function makeEmptyDashboard(args: {
  name: string;
  surgeonId?: string;
  procedureId?: string;
  isTemplate: boolean;
}): Dashboard {
  const now = Date.now();
  return {
    id: makeDashboardId(),
    name: args.name,
    surgeonId: args.surgeonId,
    procedureId: args.procedureId,
    isTemplate: args.isTemplate,
    layouts: { ...EMPTY_LAYOUTS, preop: [], intraop: [], postop: [] },
    createdAt: now,
    updatedAt: now,
  };
}

export function makeWidgetId(): string {
  return `wg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function makeDashboardId(): string {
  return `db_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
