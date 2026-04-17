import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

function ArtiWall() {
  const [awake, setAwake] = useState(false);

  // Demo persona — in production sourced from RFID badge / OR scheduling
  const staff = {
    name: "Nora Quinn",
    role: "Circulating Nurse",
    initials: "NQ",
  };

  return awake ? (
    <AwakeDashboard
      staffName={staff.name}
      staffRole={staff.role}
      initials={staff.initials}
      onSleep={() => setAwake(false)}
    />
  ) : (
    <SleepScreen onWake={() => setAwake(true)} staffName={staff.name} />
  );
}
