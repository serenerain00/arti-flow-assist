import type { Phase } from "./types";

const LIVE_CASE_KEY = "art-setup.live-case.v1";

export interface LiveCaseState {
  active: boolean;
  dashboardId: string | null;
  currentPhase: Phase;
  updatedAt: number;
}

const DEFAULT_STATE: LiveCaseState = {
  active: false,
  dashboardId: null,
  currentPhase: "preop",
  updatedAt: 0,
};

export function loadLiveCase(): LiveCaseState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(LIVE_CASE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<LiveCaseState>;
    return {
      active: !!parsed.active,
      dashboardId: parsed.dashboardId ?? null,
      currentPhase: (parsed.currentPhase as Phase) ?? "preop",
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveLiveCase(state: LiveCaseState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIVE_CASE_KEY, JSON.stringify(state));
  } catch {
    // quota — ignore
  }
}

/** Subscribe to live-case updates from other tabs. The callback fires when
 *  another tab writes to LIVE_CASE_KEY (storage events don't fire in the
 *  same tab that made the write). */
export function subscribeLiveCase(onChange: (state: LiveCaseState) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key !== LIVE_CASE_KEY) return;
    onChange(loadLiveCase());
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export { LIVE_CASE_KEY };
