import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AdminSleepScreen } from "@/components/admin/SleepScreen";
import { AdminShell } from "@/components/admin/AdminShell";
import { PreviewView } from "@/components/admin/builder/PreviewView";

type Phase = "sleep" | "shell";

function ArtSetupRoot() {
  // Preview mode bypasses the admin shell entirely — when the page is
  // opened with `?preview=<dashboardId>` (via Publish → "Preview in new
  // tab"), render the wall-style preview fullscreen.
  const [previewId, setPreviewId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setPreviewId(params.get("preview"));
  }, []);

  const [phase, setPhase] = useState<Phase>("sleep");
  const onWake = useCallback(() => setPhase("shell"), []);

  if (previewId) {
    return <PreviewView dashboardId={previewId} />;
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "sleep" ? (
        <AdminSleepScreen key="sleep" onWake={onWake} />
      ) : (
        <AdminShell key="shell" />
      )}
    </AnimatePresence>
  );
}

export const Route = createFileRoute("/")({
  component: ArtSetupRoot,
  head: () => ({
    meta: [
      { title: "Arti Setup" },
      {
        name: "description",
        content: "Administrator setup for the Arti OR wall — a minified reference build.",
      },
    ],
  }),
});
