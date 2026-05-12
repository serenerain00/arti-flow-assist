import type { DashboardConfig } from "./types";

/**
 * "My Dashboard" — the circulating nurse's pre-case readiness view.
 *
 * Order is deliberate, prioritized for what she actually scans in the
 * minutes before incision. The three "wall-state" cards (room vitals,
 * communications, quick actions) sit immediately under the up-next +
 * wrap-up row so they're glance-distance from the top instead of buried
 * below supply / OR readiness.
 *
 *   1. Welcome / day stats         — orient + glance the day
 *   2. Up-next case      +  Wrap-up checklist   — case context + tasks
 *   3. Room vitals       +  Communications      — wall state + inbound (up-top)
 *   4. Quick actions                              — case list / pre-op / surgeon prefs
 *   5. Supply status     +  Awareness (alerts)  — equipment / safety / timing
 *   6. OR readiness                              — room state
 *
 * Charts (cases-per-day, procedure-mix) stay in the palette but are
 * dropped from the default — they're analytics, not in-the-moment work.
 */
export const DEFAULT_MY_DASHBOARD: DashboardConfig = {
  items: [
    { id: "home-hero" },
    { id: "home-up-next" },
    { id: "task-checklist" },
    { id: "home-room-vitals" },
    { id: "comms-feed" },
    { id: "home-quick-actions" },
    { id: "supply-status" },
    { id: "alerts" },
    { id: "or-status" },
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
