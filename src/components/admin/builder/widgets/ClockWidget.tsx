import { useEffect, useState } from "react";
import type { WidgetSize } from "../types";

interface Props {
  size: WidgetSize;
}

function timeZoneShort() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

export function ClockWidget({ size }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="flex h-full w-full items-center justify-center" />;
  }

  const hm = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const s = now.toLocaleTimeString([], { second: "2-digit" });
  const dateLong = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const tz = timeZoneShort();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-4 text-center">
      <div
        className={
          size === "large"
            ? "text-7xl font-extralight leading-none tracking-tight tabular-nums"
            : size === "medium"
              ? "text-5xl font-extralight leading-none tracking-tight tabular-nums"
              : "text-3xl font-extralight leading-none tracking-tight tabular-nums"
        }
      >
        {hm}
      </div>
      {size !== "small" && (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {size === "large" ? `${dateLong} · ${tz} · ${s}s` : dateLong}
        </div>
      )}
    </div>
  );
}
