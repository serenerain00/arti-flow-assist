import type { DashboardConfig } from "./types";

/**
 * "My Dashboard" — what the circulating nurse sees on Home before any
 * customization. Mirrors the legacy hard-coded HomeDashboard layout so
 * existing users don't perceive a regression.
 */
export const DEFAULT_MY_DASHBOARD: DashboardConfig = {
  items: [
    { id: "home-hero" },
    { id: "home-up-next" },
    { id: "home-room-vitals" },
    { id: "home-cases-per-day" },
    { id: "home-procedure-mix" },
    { id: "home-quick-actions" },
  ],
};

/**
 * "Procedure Dashboard" — defaults composed for any procedure. Surfaces
 * the static info the team would want at a glance for the case they're
 * about to do (3D anatomy, summary, pref card). Customizable per
 * procedure slug; saved presets override this seed.
 */
export const DEFAULT_PROCEDURE_DASHBOARD: DashboardConfig = {
  items: [
    { id: "case-summary" },
    { id: "anatomy-3d" },
    { id: "home-up-next" },
    { id: "home-room-vitals" },
    { id: "preference-card" },
  ],
};
