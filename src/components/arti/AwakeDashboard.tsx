import { useCallback, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CaseHeader } from "./CaseHeader";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { TeamRoster } from "./TeamRoster";
import { AlertStack, ALERTS as ALERT_DEFS } from "./AlertStack";
import { HowToVideoModal } from "./HowToVideoModal";
import { QuadView, type QuadPanelId } from "./QuadView";
import { PreferenceCard } from "./PreferenceCard";
import { PatientDetailsModal } from "./PatientDetailsModal";
import { ArtiInvoker } from "./ArtiInvoker";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import type { CaseItem } from "./cases";
import type { DashboardActions, DashboardActionsRef } from "@/routes/index";
import type { ArtiToolResult } from "@/hooks/useArtiVoice";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  /** Optional case to display — when provided, drives the case header. */
  activeCase?: CaseItem;
  /** When provided, shows a "back to cases" affordance. */
  onBackToCases?: () => void;
  /** Free-text prompt handler (drives navigation + voice). */
  onPrompt: (text: string) => void;
  /**
   * Bridge so the voice agent (hosted at the route level) can drive
   * dashboard state. Populated on mount, cleared on unmount.
   */
  actionsRef?: DashboardActionsRef;
}

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";

const VIDEO_TITLES: Record<string, string> = {
  rotator: "Rotator cuff repair — Suture anchor technique",
  glenoid: "Univers Revers™ — Glenoid baseplate placement",
  reverse: "Reverse Total Shoulder Arthroplasty — Step-by-step",
  default: "Univers Revers™ — Glenoid baseplate placement",
};

/** Map a free-form title string to one of the canned video titles. */
function resolveVideoTitle(title?: string): string {
  if (!title) return VIDEO_TITLES.default;
  const t = title.toLowerCase();
  if (t.includes("rotator") || t.includes("cuff")) return VIDEO_TITLES.rotator;
  if (t.includes("glenoid") || t.includes("baseplate")) return VIDEO_TITLES.glenoid;
  if (t.includes("reverse") || t.includes("rsa")) return VIDEO_TITLES.reverse;
  return VIDEO_TITLES.default;
}

/** Suggestions shown in the invoker when NOT in sterile cockpit. */
const DEFAULT_SUGGESTIONS = ["Show team", "Read time-out", "Back to cases"];

export function AwakeDashboard({
  staffName,
  staffRole,
  initials,
  onSleep,
  onBackToCases,
  onPrompt,
  actionsRef,
}: Props) {
  const [cockpit, setCockpit] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [howToTitle, setHowToTitle] = useState(VIDEO_TITLES.default);
  const [timeOutChecked, setTimeOutChecked] = useState<Set<TimeOutId>>(new Set());
  const [counts, setCounts] = useState<Record<InstrumentId, number>>({
    raytec: 20,
    lap: 9,
    needle: 14,
    blade: 3,
    clamps: 12,
  });
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());
  const [quadOpen, setQuadOpen] = useState(false);
  const [quadFocused, setQuadFocused] = useState<QuadPanelId | null>(null);
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false);

  const toggleTimeOutItem = useCallback((id: TimeOutId): ArtiToolResult => {
    setTimeOutChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    return { ok: true };
  }, []);

  const adjustInstrumentCount = useCallback((item: InstrumentId, delta: number): ArtiToolResult => {
    setCounts((prev) => ({ ...prev, [item]: Math.max(0, prev[item] + delta) }));
    return { ok: true };
  }, []);

  /**
   * Safety-critical alerts (tier === "Critical") can never be auto-dismissed
   * per the Arti spec. The return shape lets the agent respond naturally
   * (system prompt handles the wording) instead of silently failing.
   */
  const dismissAlert = useCallback((index: number): ArtiToolResult => {
    const alert = ALERT_DEFS[index];
    if (!alert) return { ok: false, reason: "unknown alert" };
    if (alert.tier === "Critical") {
      return { ok: false, reason: "safety-critical alert cannot be dismissed" };
    }
    setDismissedAlerts((prev) => new Set(prev).add(index));
    return { ok: true };
  }, []);

  const openQuadView = useCallback((): ArtiToolResult => {
    setQuadFocused(null);
    setQuadOpen(true);
    return { ok: true };
  }, []);

  const focusQuadPanel = useCallback((panel: QuadPanelId): ArtiToolResult => {
    setQuadOpen(true);
    setQuadFocused(panel);
    return { ok: true };
  }, []);

  const closeQuadView = useCallback((): ArtiToolResult => {
    setQuadOpen(false);
    setQuadFocused(null);
    return { ok: true };
  }, []);

  const toggleSterileCockpit = useCallback((enabled?: boolean): ArtiToolResult => {
    setCockpit((c) => (typeof enabled === "boolean" ? enabled : !c));
    return { ok: true };
  }, []);

  const openHowToVideo = useCallback((title?: string): ArtiToolResult => {
    setHowToTitle(resolveVideoTitle(title));
    setHowToOpen(true);
    return { ok: true };
  }, []);

  const showPreferenceCard = useCallback((): ArtiToolResult => {
    if (typeof document === "undefined") return { ok: false, reason: "no dom" };
    const el = document.getElementById("preference-card");
    if (!el) return { ok: false, reason: "preference card not mounted" };
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return { ok: true };
  }, []);

  const showPreferenceCardLayoutImages = useCallback((): ArtiToolResult => {
    if (typeof document === "undefined") return { ok: false, reason: "no dom" };
    const el = document.getElementById("preference-card-layout-images");
    if (!el) return { ok: false, reason: "layout images not mounted" };
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return { ok: true };
  }, []);

  /** Register dashboard tools with the route-level bridge. */
  const actions = useMemo<DashboardActions>(
    () => ({
      toggleTimeOutItem,
      adjustInstrumentCount,
      toggleSterileCockpit,
      dismissAlert,
      openQuadView,
      focusQuadPanel,
      closeQuadView,
      openHowToVideo,
      showPreferenceCard,
      showPreferenceCardLayoutImages,
    }),
    [
      toggleTimeOutItem,
      adjustInstrumentCount,
      toggleSterileCockpit,
      dismissAlert,
      openQuadView,
      focusQuadPanel,
      closeQuadView,
      openHowToVideo,
      showPreferenceCard,
      showPreferenceCardLayoutImages,
    ],
  );

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = actions;
    return () => {
      // Only clear if nobody else re-bound it (React Strict Mode protection).
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actions, actionsRef]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
          cockpitMode={cockpit}
          onToggleCockpit={() => setCockpit((c) => !c)}
        />

        <main className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-6 animate-fade-in">
          {onBackToCases && (
            <button
              onClick={onBackToCases}
              className="-mb-2 inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Today's cases
            </button>
          )}

          <CaseHeader
            cockpitMode={cockpit}
            onOpenPatientDetails={() => setPatientDetailsOpen(true)}
          />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <TimeOutPanel
                checked={timeOutChecked as Set<string>}
                onToggle={(id) => toggleTimeOutItem(id as TimeOutId)}
              />
              <InstrumentCount
                counts={counts}
                onAdjust={(id, delta) => adjustInstrumentCount(id as InstrumentId, delta)}
              />
            </div>
            <div className="space-y-5">
              <AlertStack dismissed={dismissedAlerts} onDismiss={dismissAlert} />
              <TeamRoster />
            </div>
          </div>

          <PreferenceCard />

          <div className="h-24" />
        </main>

        <button
          onClick={openQuadView}
          className="absolute right-8 top-24 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground border border-border hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label="Open quad view"
          title="Quad view"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>
      </div>

      <HowToVideoModal open={howToOpen} onClose={() => setHowToOpen(false)} title={howToTitle} />

      <PatientDetailsModal open={patientDetailsOpen} onClose={() => setPatientDetailsOpen(false)} />

      <QuadView
        open={quadOpen}
        focused={quadFocused}
        onFocus={setQuadFocused}
        onClose={closeQuadView}
        timeOutChecked={timeOutChecked}
        toggleTimeOutItem={toggleTimeOutItem}
        counts={counts}
        adjustInstrumentCount={adjustInstrumentCount}
        dismissedAlerts={dismissedAlerts}
        dismissAlert={dismissAlert}
      />

      <ArtiInvoker
        placeholder={
          cockpit ? "Sterile cockpit · direct commands only" : "Ask Arti about this case…"
        }
        onSubmit={onPrompt}
        // Per Arti spec: sterile cockpit suppresses all suggestions. Default
        // surface offers a few starter prompts otherwise.
        suggestions={cockpit ? [] : DEFAULT_SUGGESTIONS}
      />
    </div>
  );
}
