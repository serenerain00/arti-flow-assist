import { useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CaseHeader } from "./CaseHeader";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { TeamRoster } from "./TeamRoster";
import { AlertStack } from "./AlertStack";
import { VoiceBar } from "./VoiceBar";
import { HowToVideoModal } from "./HowToVideoModal";

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
          <CaseHeader cockpitMode={cockpit} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="space-y-5 xl:col-span-2">
              <TimeOutPanel checked={timeOutChecked} onToggle={toggleTimeOutItem} />
              <InstrumentCount counts={counts} onAdjust={adjustInstrumentCount} />
            </div>
            <div className="space-y-5">
              <AlertStack dismissed={dismissedAlerts} onDismiss={dismissAlert} />
              <TeamRoster />
            </div>
          </div>

          <div className="h-24" />
        </main>

        <div className="absolute bottom-6 left-32 right-8 z-40">
          <VoiceBar
            staffName={staffName}
            tools={{
              openHowToVideo,
              toggleTimeOutItem,
              adjustInstrumentCount,
              toggleSterileCockpit,
              dismissAlert,
            }}
          />
        </div>
      </div>

      <HowToVideoModal
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        title={howToTitle}
      />
    </div>
  );
}
