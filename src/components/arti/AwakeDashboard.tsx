import { useEffect, useMemo } from "react";
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
import { useArtiVoice, type VoiceTools } from "./ArtiVoiceProvider";

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  cockpit: boolean;
  setCockpit: React.Dispatch<React.SetStateAction<boolean>>;
  howToOpen: boolean;
  setHowToOpen: React.Dispatch<React.SetStateAction<boolean>>;
  howToTitle: string;
  timeOutChecked: Set<TimeOutId>;
  counts: Record<InstrumentId, number>;
  dismissedAlerts: Set<number>;
  quadOpen: boolean;
  quadFocused: QuadPanelId | null;
  setQuadFocused: React.Dispatch<React.SetStateAction<QuadPanelId | null>>;
  patientDetailsOpen: boolean;
  setPatientDetailsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tools: VoiceTools;
}

const CASE_CONTEXT = {
  patient: "Jane Doe, 64F",
  procedure: "Right reverse total shoulder arthroplasty",
  surgeon: "Dr. Patel",
  allergies: "Penicillin",
  nextPatient: "Robert Lin, 58M — Left rotator cuff repair, 11:30 AM",
};

export function AwakeDashboard({
  staffName,
  staffRole,
  initials,
  onSleep,
  cockpit,
  setCockpit,
  howToOpen,
  setHowToOpen,
  howToTitle,
  timeOutChecked,
  counts,
  dismissedAlerts,
  quadOpen,
  quadFocused,
  setQuadFocused,
  patientDetailsOpen,
  setPatientDetailsOpen,
  tools,
}: Props) {
  const { connected, sendContext, stop } = useArtiVoice();

  // Push initial case context to Arti once we're connected on the dashboard.
  // Single send — agent already has it in conversation memory after that.
  useEffect(() => {
    if (!connected) return;
    sendContext(
      [
        `You are Arti, an ambient OR voice assistant on the wall display.`,
        `Active staff member: ${staffName} (${staffRole}).`,
        `Current case: ${CASE_CONTEXT.procedure} for ${CASE_CONTEXT.patient}, surgeon ${CASE_CONTEXT.surgeon}.`,
        `Allergies: ${CASE_CONTEXT.allergies}.`,
        `Next patient on the board: ${CASE_CONTEXT.nextPatient}.`,
        `IMPORTANT: Do NOT greet the user — they have already been greeted on the wake screen. Do NOT speak unless asked. Keep responses short, calm, and professional.`,
      ].join(" ")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // Push live state changes (debounced naturally by React batching) so Arti
  // always has the latest UI state when answering.
  const liveContext = useMemo(() => {
    const checked = Array.from(timeOutChecked).join(", ") || "none";
    const activeAlerts = 3 - dismissedAlerts.size;
    const view = quadOpen
      ? quadFocused
        ? `Quad view focused on ${quadFocused}.`
        : `Quad view open.`
      : `Standard dashboard view.`;
    return [
      `Time-out checked items: ${checked}.`,
      `Sterile cockpit: ${cockpit ? "on" : "off"}.`,
      `Open alerts: ${activeAlerts}.`,
      `Instrument counts — raytec ${counts.raytec}, lap ${counts.lap}, needle ${counts.needle}, blade ${counts.blade}, clamps ${counts.clamps}.`,
      view,
    ].join(" ");
  }, [timeOutChecked, dismissedAlerts, cockpit, counts, quadOpen, quadFocused]);

  useEffect(() => {
    if (!connected) return;
    sendContext(liveContext);
  }, [connected, liveContext, sendContext]);

  const handleSleep = () => {
    stop();
    onSleep();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={handleSleep} />

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
                onToggle={(id) => tools.toggleTimeOutItem(id as TimeOutId)}
              />
              <InstrumentCount
                counts={counts}
                onAdjust={(id, delta) => tools.adjustInstrumentCount(id as InstrumentId, delta)}
              />
            </div>
            <div className="space-y-5">
              <AlertStack dismissed={dismissedAlerts} onDismiss={tools.dismissAlert} />
              <TeamRoster />
            </div>
          </div>

          <PreferenceCard />

          <div className="h-24" />
        </main>

        <button
          onClick={() => tools.openQuadView()}
          className="absolute right-8 top-24 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted-foreground border border-border hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label="Open quad view"
          title="Quad view"
        >
          <LayoutGrid className="h-5 w-5" />
        </button>

        <div className="absolute bottom-6 left-32 right-8 z-40">
          <VoiceBar />
        </div>
      </div>

      <HowToVideoModal open={howToOpen} onClose={() => setHowToOpen(false)} title={howToTitle} />

      <PatientDetailsModal
        open={patientDetailsOpen}
        onClose={() => setPatientDetailsOpen(false)}
      />

      <QuadView
        open={quadOpen}
        focused={quadFocused}
        onFocus={setQuadFocused}
        onClose={() => tools.closeQuadView()}
        timeOutChecked={timeOutChecked}
        toggleTimeOutItem={tools.toggleTimeOutItem}
        counts={counts}
        adjustInstrumentCount={tools.adjustInstrumentCount}
        dismissedAlerts={dismissedAlerts}
        dismissAlert={tools.dismissAlert}
      />
    </div>
  );
}
