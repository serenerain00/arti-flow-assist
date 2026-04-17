import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { SleepScreen } from "@/components/arti/SleepScreen";
import { AwakeDashboard } from "@/components/arti/AwakeDashboard";

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
 * Each transition is one-directional and triggered by an explicit
 * event. The dashboard never auto-restarts the wake flow; only an
 * explicit "go to sleep" returns to the sleep state, which resets
 * the cycle.
 */
type ArtiPhase = "sleep" | "waking" | "greeting" | "dashboard";

function ArtiWall() {
  const [phase, setPhase] = useState<ArtiPhase>("sleep");

  // Demo persona — in production sourced from RFID badge / OR scheduling
  const staff = {
    name: "Melissa Quinn",
    role: "Circulating Nurse",
    initials: "MQ",
  };

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

  if (phase === "dashboard") {
    return (
      <AwakeDashboard
        staffName={staff.name}
        staffRole={staff.role}
        initials={staff.initials}
        onSleep={handleSleep}
      />
    );
  }

  return (
    <SleepScreen
      phase={phase}
      staffName={staff.name}
      onWakeRequested={handleWakeRequested}
      onWakeAnimationComplete={handleWakeAnimationComplete}
      onGoToDashboard={handleGoToDashboard}
    />
  );
}
