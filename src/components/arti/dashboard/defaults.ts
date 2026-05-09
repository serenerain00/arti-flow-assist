import type { DashboardConfig } from "./types";

/**
 * "My Dashboard" — the circulating nurse's pre-case readiness view.
 *
 * Order is deliberate, prioritized for what she actually scans in the
 * minutes before incision. Spans are tuned so each row packs cleanly
 * in the 3-col grid (full | 2+1 | 2+1 | 2+1 | 2 | full):
 *
 *   1. Welcome / day stats         — orient + glance the day
 *   2. Up-next case      +  Wrap-up checklist   — case context, tasks above awareness
 *   3. Supply status     +  Awareness (alerts)  — equipment / safety / timing
 *   4. OR readiness      +  Room vitals         — room state below awareness
 *   5. Communications              — PACU, family, anesthesia, sub-sterile, charge
 *   6. Quick actions               — case list / pre-op / surgeon prefs
 *
 * Charts (cases-per-day, procedure-mix) stay in the palette but are
 * dropped from the default — they're analytics, not in-the-moment work.
 */
export const DEFAULT_MY_DASHBOARD: DashboardConfig = {
  items: [
    { id: "home-hero" },
    { id: "home-up-next" },
    { id: "task-checklist" },
    { id: "supply-status" },
    { id: "alerts" },
    { id: "or-status" },
    { id: "home-room-vitals" },
    { id: "comms-feed" },
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
