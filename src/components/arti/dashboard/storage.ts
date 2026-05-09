import { ALL_WIDGET_IDS } from "./registry";
import { DEFAULT_MY_DASHBOARD, DEFAULT_PROCEDURE_DASHBOARD } from "./defaults";
import type { DashboardConfig, WidgetId } from "./types";

const KEY_PREFIX = "arti.dashboard:";
const MY_KEY = `${KEY_PREFIX}my`;
const procKey = (procedureSlug: string) => `${KEY_PREFIX}procedure:${procedureSlug}`;

const isWidgetId = (s: unknown): s is WidgetId =>
  typeof s === "string" && (ALL_WIDGET_IDS as string[]).includes(s);

/** Defensive parse — never trust localStorage. Drops unknown ids silently. */
function parseConfig(raw: string | null): DashboardConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as DashboardConfig).items)
    ) {
      return null;
    }
    const items = (parsed as DashboardConfig).items.filter((it) => it && isWidgetId(it.id));
    return { items };
  } catch {
    return null;
  }
}

function safeRead(key: string): DashboardConfig | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConfig(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function safeWrite(key: string, config: DashboardConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(config));
  } catch {
    // Quota exceeded / private mode — silently ignore in prototype.
  }
}

export function loadMyDashboard(): DashboardConfig {
  return safeRead(MY_KEY) ?? DEFAULT_MY_DASHBOARD;
}

export function saveMyDashboard(config: DashboardConfig): void {
  safeWrite(MY_KEY, config);
}

export function loadProcedureDashboard(procedureSlug: string): DashboardConfig {
  return safeRead(procKey(procedureSlug)) ?? DEFAULT_PROCEDURE_DASHBOARD;
}

export function saveProcedureDashboard(procedureSlug: string, config: DashboardConfig): void {
  safeWrite(procKey(procedureSlug), config);
}

/** True iff the user has explicitly saved a preset for this procedure. */
export function hasSavedProcedureDashboard(procedureSlug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(procKey(procedureSlug)) !== null;
  } catch {
    return false;
  }
}

/** True iff the user has saved a custom My Dashboard preset. */
export function hasSavedMyDashboard(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MY_KEY) !== null;
  } catch {
    return false;
  }
}
