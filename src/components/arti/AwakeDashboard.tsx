import { useCallback, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CaseHeader } from "./CaseHeader";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { TeamRoster } from "./TeamRoster";
import { AlertStack } from "./AlertStack";
import { VoiceBar } from "./VoiceBar";
import { HowToVideoModal } from "./HowToVideoModal";
import { QuadView, type QuadPanelId } from "./QuadView";
import { PreferenceCard } from "./PreferenceCard";
import { PatientDetailsModal } from "./PatientDetailsModal";
import { LayoutGrid } from "lucide-react";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
}

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";

const VIDEO_TITLES: Record<string, string> = {
  rotator: "Rotator cuff repair — Suture anchor technique",
  glenoid: "Univers Revers™ — Glenoid baseplate placement",
  reverse: "Reverse Total Shoulder Arthroplasty — Step-by-step",
  default: "Univers Revers™ — Glenoid baseplate placement",
};

// Demo case — would come from OR scheduling in production
const CASE_CONTEXT = {
  patient: "Jane Doe, 64F",
  procedure: "Right reverse total shoulder arthroplasty",
  surgeon: "Dr. Patel",
  allergies: "Penicillin",
  nextPatient: "Robert Lin, 58M — Left rotator cuff repair, 11:30 AM",
};

export function AwakeDashboard({ staffName, staffRole, initials, onSleep }: Props) {
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
  // ───────── Voice tool handlers (called by ElevenLabs agent) ─────────
  const openHowToVideo = useCallback((title?: string) => {
    const lookup = (title ?? "").toLowerCase();
    const matched =
      Object.entries(VIDEO_TITLES).find(([k]) => k !== "default" && lookup.includes(k))?.[1] ??
      title ??
      VIDEO_TITLES.default;
    setHowToTitle(matched);
    setHowToOpen(true);
    return `Opened video: ${matched}`;
  }, []);

  const toggleTimeOutItem = useCallback((id: TimeOutId) => {
    setTimeOutChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    return `Toggled time-out item: ${id}`;
  }, []);

  const adjustInstrumentCount = useCallback((item: InstrumentId, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [item]: Math.max(0, prev[item] + delta),
    }));
    return `Adjusted ${item} by ${delta}`;
  }, []);

  const toggleSterileCockpit = useCallback((enabled?: boolean) => {
    setCockpit((c) => (typeof enabled === "boolean" ? enabled : !c));
    return `Sterile cockpit ${enabled ?? !cockpit ? "on" : "off"}`;
  }, [cockpit]);

  const dismissAlert = useCallback((index: number) => {
    setDismissedAlerts((prev) => new Set(prev).add(index));
    return `Dismissed alert ${index}`;
  }, []);

  const openQuadView = useCallback(() => {
    setQuadFocused(null);
    setQuadOpen(true);
    return "Opened quad view";
  }, []);

  const focusQuadPanel = useCallback((panel: QuadPanelId) => {
    setQuadOpen(true);
    setQuadFocused(panel);
    return `Focused panel: ${panel}`;
  }, []);

  const closeQuadView = useCallback(() => {
    setQuadOpen(false);
    setQuadFocused(null);
    return "Closed quad view";
  }, []);

  // ───────── Context for Arti ─────────
  const initialContext = useMemo(
    () =>
      [
        `You are Arti, an OR voice assistant on the wall display.`,
        `Active staff member: ${staffName} (${staffRole}).`,
        `Current case: ${CASE_CONTEXT.procedure} for ${CASE_CONTEXT.patient}, surgeon ${CASE_CONTEXT.surgeon}.`,
        `Allergies: ${CASE_CONTEXT.allergies}.`,
        `Next patient on the board: ${CASE_CONTEXT.nextPatient}.`,
        `You can call client tools to update the UI: openHowToVideo, toggleTimeOutItem, adjustInstrumentCount, toggleSterileCockpit, dismissAlert, openQuadView, focusQuadPanel (panels: timeout, instruments, alerts, team), closeQuadView.`,
      ].join(" "),
    [staffName, staffRole]
  );

  const liveContext = useMemo(() => {
    const checked = Array.from(timeOutChecked).join(", ") || "none";
    const activeAlerts = 3 - dismissedAlerts.size;
    const view = quadOpen
      ? quadFocused
        ? `Quad view focused on ${quadFocused}.`
        : `Quad view open (2x2 overview).`
      : `Standard dashboard view.`;
    return [
      `Time-out checked items: ${checked}.`,
      `Sterile cockpit: ${cockpit ? "on" : "off"}.`,
      `Open alerts: ${activeAlerts}.`,
      `Instrument counts — raytec ${counts.raytec}, lap ${counts.lap}, needle ${counts.needle}, blade ${counts.blade}, clamps ${counts.clamps}.`,
      view,
    ].join(" ");
  }, [timeOutChecked, dismissedAlerts, cockpit, counts, quadOpen, quadFocused]);

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
          <CaseHeader cockpitMode={cockpit} onOpenPatientDetails={() => setPatientDetailsOpen(true)} />

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

        {/* Quad view trigger (also voice-triggerable) */}
        <button
          onClick={openQuadView}
          className="absolute right-8 top-24 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground border border-border hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label="Open quad view"
          title="Quad view"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

        <div className="absolute bottom-6 left-32 right-8 z-40">
          <VoiceBar
            staffName={staffName}
            autoStart
            initialContext={initialContext}
            liveContext={liveContext}
            tools={{
              openHowToVideo,
              toggleTimeOutItem,
              adjustInstrumentCount,
              toggleSterileCockpit,
              dismissAlert,
              openQuadView,
              focusQuadPanel,
              closeQuadView,
            }}
          />
        </div>
      </div>

      <HowToVideoModal
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        title={howToTitle}
      />

      <PatientDetailsModal
        open={patientDetailsOpen}
        onClose={() => setPatientDetailsOpen(false)}
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
    </div>
  );
}
