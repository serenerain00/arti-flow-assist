import { useState } from "react";
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

export function AwakeDashboard({ staffName, staffRole, initials, onSleep }: Props) {
  const [cockpit, setCockpit] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [howToTitle, setHowToTitle] = useState(
    "Univers Revers™ — Glenoid baseplate placement"
  );

  const handleVoiceCommand = (cmd: string) => {
    const lower = cmd.toLowerCase();
    if (lower.includes("video") || lower.includes("rotator") || lower.includes("how")) {
      setHowToTitle("Rotator cuff repair — Suture anchor technique");
      setHowToOpen(true);
    } else if (lower.includes("cockpit")) {
      setCockpit((c) => !c);
    }
  };

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
              <TimeOutPanel />
              <InstrumentCount />
            </div>
            <div className="space-y-5">
              <AlertStack />
              <TeamRoster />
            </div>
          </div>

          {/* footer spacer so voice bar doesn't overlap content */}
          <div className="h-24" />
        </main>

        <div className="absolute bottom-6 left-32 right-8 z-40">
          <VoiceBar onCommand={handleVoiceCommand} />
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
