import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CaseHeader } from "./CaseHeader";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { TeamRoster } from "./TeamRoster";
import { AlertStack, ALERTS as ALERT_DEFS } from "./AlertStack";
import { HowToVideoModal } from "./HowToVideoModal";
import { QuadView, type QuadPanelId } from "./QuadView";
import { PreferenceCard, PREF_CARD_IMAGES } from "./PreferenceCard";
import { PatientDetailsModal } from "./PatientDetailsModal";
import { ArtiInvoker } from "./ArtiInvoker";
import { ImageLightboxModal, type LightboxHandle, type LightboxImage } from "./ImageLightboxModal";
import { RoleSwitcherBar, type ActiveRole } from "./RoleSwitcherBar";
import { AnesthesiaPanel } from "./AnesthesiaPanel";
import { ScrubTechPanel, SCRUB_LIGHTBOX_IMAGES, OPENING_CHECKLIST_ITEMS, OPENING_CHECKLIST_INITIAL_DONE } from "./ScrubTechPanel";
import { SurgeonPanel } from "./SurgeonPanel";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";
import type { DashboardActions, DashboardActionsRef } from "@/routes/index";
import type { ArtiToolResult } from "@/hooks/useArtiVoice";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  activeCase?: CaseItem;
  onBackToCases?: () => void;
  onPrompt: (text: string) => void;
  actionsRef?: DashboardActionsRef;
  /** Written to by AwakeDashboard so the route's context builder can read live state. */
  dashboardContextRef?: React.MutableRefObject<() => string>;
  onSidebarNavigate?: (key: SidebarKey) => void;
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
  activeCase,
  onBackToCases,
  onPrompt,
  actionsRef,
  dashboardContextRef,
  onSidebarNavigate,
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
  const [activeRole, setActiveRole] = useState<ActiveRole>("nurse");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxRef = useRef<LightboxHandle>(null);
  const [openingChecklist, setOpeningChecklist] = useState<Set<number>>(() => new Set(OPENING_CHECKLIST_INITIAL_DONE));

  const openLightbox = useCallback((images: LightboxImage[], index = 0) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  // Keep the route-level context builder updated with live dashboard state.
  useEffect(() => {
    if (!dashboardContextRef) return;
    const ROLE_LABEL: Record<ActiveRole, string> = {
      nurse: "Circulating Nurse",
      scrub: "Scrub Tech",
      surgeon: "Surgeon",
      anesthesia: "Anesthesiologist",
    };
    const TO_LABELS: Record<string, string> = {
      patient: "Patient identity", site: "Surgical site marked",
      procedure: "Procedure agreed", allergies: "Allergies/antibiotics",
    };
    const checkedItems = [...timeOutChecked].map((id) => TO_LABELS[id] ?? id);
    const pendingItems = (["patient", "site", "procedure", "allergies"] as const)
      .filter((id) => !timeOutChecked.has(id))
      .map((id) => TO_LABELS[id]);

    const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;
    const flaggedLabs = clinical?.labs.filter(l => l.flag).map(l => `${l.label} ${l.value}`) ?? [];
    dashboardContextRef.current = () => [
      `Active dashboard view: ${ROLE_LABEL[activeRole]}`,
      `Available role views: Circulating Nurse, Scrub Tech, Surgeon, Anesthesiologist`,
      `Sterile cockpit: ${cockpit ? "ON (suppress suggestions, direct commands only)" : "OFF"}`,
      `Time-out checklist: ${timeOutChecked.size}/4 confirmed`,
      checkedItems.length ? `  Confirmed: ${checkedItems.join(", ")}` : "  None confirmed yet",
      pendingItems.length ? `  Pending: ${pendingItems.join(", ")}` : "  All items confirmed",
      `Instrument counts (current / opening):`,
      `  Raytec ${counts.raytec}/20 · Lap ${counts.lap}/9 · Needle ${counts.needle}/14 · Blade ${counts.blade}/3 · Clamps ${counts.clamps}/12`,
      counts.raytec !== 20 || counts.lap !== 9 || counts.needle !== 14 || counts.blade !== 3 || counts.clamps !== 12
        ? "  ⚠ COUNT DISCREPANCY — investigate before closure"
        : "  All counts nominal",
      `Dismissed alerts: ${dismissedAlerts.size}`,
      `Opening checklist: ${openingChecklist.size}/${OPENING_CHECKLIST_ITEMS.length} done`,
      lightboxOpen
        ? `Image lightbox: OPEN (${lightboxIndex + 1} of ${lightboxImages.length}) — "next image"/"previous image"/"close" are valid commands`
        : `Image lightbox: closed`,
      clinical ? [
        `Surgeon notes: ${clinical.notes.join(" | ")}`,
        `Allergies: ${clinical.allergies.map(a => `${a.agent} (${a.reaction}, ${a.severity})`).join(", ")}`,
        `Conditions: ${clinical.conditions.join(", ")}`,
        `Anesthesia plan: ${clinical.anesthesiaPlan}`,
        `Airway: Mallampati ${clinical.airway.mallampati}${clinical.airway.difficult ? " — DIFFICULT AIRWAY" : ""}`,
        flaggedLabs.length ? `Flagged labs: ${flaggedLabs.join(", ")}` : "Labs: all within range",
        `Procedure steps: ${clinical.procedureSteps.map(s => `${s.step}. ${s.title}`).join(" → ")}`,
        `Implants: ${clinical.implantPlan.map(i => `${i.component} ${i.spec}${i.confirmed ? "" : " [UNCONFIRMED]"}`).join(", ")}`,
      ].join("\n") : "",
      `Actions available from this screen: toggle time-out items, adjust instrument counts, sterile cockpit, dismiss advisory alerts, open quad view, show preference card, show table layout images, open scrub tech table layout images, toggle opening checklist items, switch role view, open patient details, open how-to video`,
    ].join("\n");
  }, [activeRole, cockpit, timeOutChecked, counts, dismissedAlerts, openingChecklist, lightboxOpen, lightboxIndex, lightboxImages.length, dashboardContextRef]);

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
    openLightbox(PREF_CARD_IMAGES, 0);
    return { ok: true };
  }, [openLightbox]);

  const switchRole = useCallback((role: ActiveRole): ArtiToolResult => {
    setActiveRole(role);
    return { ok: true };
  }, []);

  const openPatientDetails = useCallback((): ArtiToolResult => {
    setPatientDetailsOpen(true);
    return { ok: true };
  }, []);

  const closePatientDetails = useCallback((): ArtiToolResult => {
    setPatientDetailsOpen(false);
    return { ok: true };
  }, []);

  const toggleOpeningChecklistItem = useCallback((index: number): ArtiToolResult => {
    if (index < 0 || index >= OPENING_CHECKLIST_ITEMS.length) {
      return { ok: false, reason: "invalid checklist index" };
    }
    setOpeningChecklist((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    return { ok: true };
  }, []);

  const openTableLayoutImages = useCallback((): ArtiToolResult => {
    openLightbox(SCRUB_LIGHTBOX_IMAGES, 0);
    return { ok: true };
  }, [openLightbox]);

  const lightboxNext = useCallback((): ArtiToolResult => {
    if (!lightboxOpen) return { ok: false, reason: "no lightbox open" };
    lightboxRef.current?.scrollNext();
    return { ok: true };
  }, [lightboxOpen]);

  const lightboxPrev = useCallback((): ArtiToolResult => {
    if (!lightboxOpen) return { ok: false, reason: "no lightbox open" };
    lightboxRef.current?.scrollPrev();
    return { ok: true };
  }, [lightboxOpen]);

  const closeLightbox = useCallback((): ArtiToolResult => {
    setLightboxOpen(false);
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
      switchRole,
      openPatientDetails,
      closePatientDetails,
      toggleOpeningChecklistItem,
      openTableLayoutImages,
      lightboxNext,
      lightboxPrev,
      closeLightbox,
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
      switchRole,
      openPatientDetails,
      closePatientDetails,
      toggleOpeningChecklistItem,
      openTableLayoutImages,
      lightboxNext,
      lightboxPrev,
      closeLightbox,
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
      <Sidebar onSleep={onSleep} activeKey="patient" onNavigate={onSidebarNavigate} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
          cockpitMode={cockpit}
          onToggleCockpit={() => setCockpit((c) => !c)}
        />

        <RoleSwitcherBar activeRole={activeRole} onRoleChange={setActiveRole} />

        <main data-scroll className="min-h-0 flex-1 overflow-y-auto px-8 py-6 animate-fade-in">
          <div className="flex flex-col gap-5">
            {onBackToCases && (
              <button
                onClick={onBackToCases}
                className="-mb-2 inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Today's cases
              </button>
            )}

            <CaseHeader
              activeCase={activeCase}
              cockpitMode={cockpit}
              onOpenPatientDetails={() => setPatientDetailsOpen(true)}
            />

            {/* ── Nurse view (default) ── */}
            {activeRole === "nurse" && (
              <>
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
                <PreferenceCard onOpenLightbox={openLightbox} />
              </>
            )}

            {/* ── Scrub Tech view ── */}
            {activeRole === "scrub" && (
              <ScrubTechPanel
                activeCase={activeCase}
                counts={counts}
                onAdjust={(id, delta) => adjustInstrumentCount(id as InstrumentId, delta)}
                onOpenLightbox={openLightbox}
                openingChecklist={openingChecklist}
                onToggleChecklistItem={toggleOpeningChecklistItem}
              />
            )}

            {/* ── Surgeon view ── */}
            {activeRole === "surgeon" && (
              <SurgeonPanel activeCase={activeCase} onOpenLightbox={openLightbox} />
            )}

            {/* ── Anesthesia view ── */}
            {activeRole === "anesthesia" && <AnesthesiaPanel activeCase={activeCase} />}

            <div className="h-24" />
          </div>
        </main>

        {activeRole === "nurse" && (
          <button
            onClick={openQuadView}
            className="absolute right-8 top-36 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            aria-label="Open quad view"
            title="Quad view"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
        )}
      </div>

      <HowToVideoModal open={howToOpen} onClose={() => setHowToOpen(false)} title={howToTitle} />
      <PatientDetailsModal open={patientDetailsOpen} onClose={() => setPatientDetailsOpen(false)} activeCase={activeCase} />

      <ImageLightboxModal
        ref={lightboxRef}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        title="Surgical Setup"
      />

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
        suggestions={cockpit ? [] : DEFAULT_SUGGESTIONS}
      />
    </div>
  );
}
