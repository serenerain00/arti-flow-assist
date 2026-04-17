import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";
import { ArtiVoiceProvider, type VoiceTools } from "@/components/arti/ArtiVoiceProvider";
import type { QuadPanelId } from "@/components/arti/QuadView";
import type { InstrumentId, TimeOutId } from "@/components/arti/AwakeDashboard";

export const Route = createFileRoute("/")({
  component: ArtiWall,
  head: () => ({
    meta: [
      { title: "Arti Wall · Intelligent OR Companion" },
      {
        name: "description",
        content:
          "Arti Wall — an ambient LED display for the operating room. Pre-case time-outs, instrument counts, and voice-driven guidance designed to reduce cognitive load and prevent never-events.",
      },
    ],
  }),
});

/**
 * Top-level state machine for the Arti wall:
 *   sleep → waking → greeting → dashboard
 *
 * Voice is owned by a single ArtiVoiceProvider that wraps the entire tree.
 * The ElevenLabs session is started ONCE (with the greeting as first message)
 * when the user wakes Arti, and remains live across the greeting → dashboard
 * transition. Putting Arti to sleep ends the session.
 */
type ArtiPhase = "sleep" | "waking" | "greeting" | "dashboard";

interface ToolHandlers {
  setHowToTitle: (t: string) => void;
  setHowToOpen: (o: boolean) => void;
  setTimeOutChecked: (fn: (s: Set<TimeOutId>) => Set<TimeOutId>) => void;
  setCounts: (fn: (c: Record<InstrumentId, number>) => Record<InstrumentId, number>) => void;
  setCockpit: (fn: (c: boolean) => boolean) => void;
  setDismissedAlerts: (fn: (s: Set<number>) => Set<number>) => void;
  setQuadOpen: (o: boolean) => void;
  setQuadFocused: (p: QuadPanelId | null) => void;
  setPatientDetailsOpen: (o: boolean) => void;
  goToDashboard: () => void;
}

const VIDEO_TITLES: Record<string, string> = {
  rotator: "Rotator cuff repair — Suture anchor technique",
  glenoid: "Univers Revers™ — Glenoid baseplate placement",
  reverse: "Reverse Total Shoulder Arthroplasty — Step-by-step",
  default: "Univers Revers™ — Glenoid baseplate placement",
};

function buildTools(h: ToolHandlers): VoiceTools {
  return {
    goToDashboard: () => {
      h.goToDashboard();
      return "Opening the dashboard.";
    },
    openHowToVideo: (title?: string) => {
      const lookup = (title ?? "").toLowerCase();
      const matched =
        Object.entries(VIDEO_TITLES).find(([k]) => k !== "default" && lookup.includes(k))?.[1] ??
        title ??
        VIDEO_TITLES.default;
      h.setHowToTitle(matched);
      h.setHowToOpen(true);
      return `Opened video: ${matched}`;
    },
    toggleTimeOutItem: (id: TimeOutId) => {
      h.setTimeOutChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return `Toggled time-out item: ${id}`;
    },
    adjustInstrumentCount: (item: InstrumentId, delta: number) => {
      h.setCounts((prev) => ({ ...prev, [item]: Math.max(0, prev[item] + delta) }));
      return `Adjusted ${item} by ${delta}`;
    },
    toggleSterileCockpit: (enabled?: boolean) => {
      h.setCockpit((c) => (typeof enabled === "boolean" ? enabled : !c));
      return `Sterile cockpit toggled`;
    },
    dismissAlert: (index: number) => {
      h.setDismissedAlerts((prev) => new Set(prev).add(index));
      return `Dismissed alert ${index}`;
    },
    openQuadView: () => {
      h.setQuadFocused(null);
      h.setQuadOpen(true);
      return "Opened quad view";
    },
    focusQuadPanel: (panel: QuadPanelId) => {
      h.setQuadOpen(true);
      h.setQuadFocused(panel);
      return `Focused panel: ${panel}`;
    },
    closeQuadView: () => {
      h.setQuadOpen(false);
      h.setQuadFocused(null);
      return "Closed quad view";
    },
    showPreferenceCard: () => {
      document.getElementById("preference-card")?.scrollIntoView({ behavior: "smooth" });
      return "Showing preference card";
    },
    showPatientDetails: () => {
      h.setPatientDetailsOpen(true);
      return "Opened patient details";
    },
  };
}

function ArtiWall() {
  const [phase, setPhase] = useState<ArtiPhase>("sleep");

  // Dashboard state hoisted here so a single VoiceTools object can mutate it
  // and feed both the provider (for voice control) and AwakeDashboard (for UI).
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

  const staff = { name: "Melissa Quinn", role: "Circulating Nurse", initials: "MQ" };

  const handleWakeRequested = useCallback(() => {
    setPhase((p) => (p === "sleep" ? "waking" : p));
  }, []);
  const handleWakeAnimationComplete = useCallback(() => {
    setPhase((p) => (p === "waking" ? "greeting" : p));
  }, []);
  const handleGoToDashboard = useCallback(() => {
    setPhase((p) => (p === "greeting" ? "dashboard" : p));
  }, []);
  const handleSleep = useCallback(() => {
    setPhase("sleep");
  }, []);

  const tools = useMemo(
    () =>
      buildTools({
        setHowToTitle,
        setHowToOpen,
        setTimeOutChecked,
        setCounts,
        setCockpit,
        setDismissedAlerts,
        setQuadOpen,
        setQuadFocused,
        setPatientDetailsOpen,
        goToDashboard: handleGoToDashboard,
      }),
    [handleGoToDashboard]
  );

  return (
    <ArtiVoiceProvider tools={tools}>
      {phase === "dashboard" ? (
        <AwakeDashboard
          staffName={staff.name}
          staffRole={staff.role}
          initials={staff.initials}
          onSleep={handleSleep}
          cockpit={cockpit}
          setCockpit={setCockpit}
          howToOpen={howToOpen}
          setHowToOpen={setHowToOpen}
          howToTitle={howToTitle}
          timeOutChecked={timeOutChecked}
          counts={counts}
          dismissedAlerts={dismissedAlerts}
          quadOpen={quadOpen}
          quadFocused={quadFocused}
          setQuadFocused={setQuadFocused}
          patientDetailsOpen={patientDetailsOpen}
          setPatientDetailsOpen={setPatientDetailsOpen}
          tools={tools}
        />
      ) : (
        <SleepScreen
          phase={phase}
          staffName={staff.name}
          onWakeRequested={handleWakeRequested}
          onWakeAnimationComplete={handleWakeAnimationComplete}
        />
      )}
    </ArtiVoiceProvider>
  );
}
