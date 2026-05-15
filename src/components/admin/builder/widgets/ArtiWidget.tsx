import { Mic, MicOff } from "lucide-react";
import { motion } from "framer-motion";
import { useWakeWord } from "@/hooks/useWakeWord";
import type { WidgetSize } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  size: WidgetSize;
}

export function ArtiWidget({ size }: Props) {
  const { active, supported, activateManually, deactivate } = useWakeWord({ enabled: true });

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-4 py-4">
      <div className="relative flex flex-1 w-full items-center justify-center">
        <Orb active={active} size={size} />
      </div>

      {size !== "small" && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (active) deactivate();
              else activateManually();
            }}
            aria-pressed={active}
            aria-label={active ? "Stop listening" : "Activate Arti"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 bg-surface-2/60 text-foreground hover:bg-surface-2",
            )}
          >
            {supported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          {size === "large" && (
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {active ? "Listening…" : supported ? 'Say "hey arti"' : "Voice not supported"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Orb({ active, size }: { active: boolean; size: WidgetSize }) {
  const dim = size === "large" ? "h-32 w-32" : size === "medium" ? "h-20 w-20" : "h-12 w-12";

  return (
    <div className={cn("relative", dim)}>
      <motion.span
        animate={{
          scale: active ? [1, 1.18, 1] : 1,
          opacity: active ? [0.7, 1, 0.7] : 0.45,
        }}
        transition={{
          duration: 1.8,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
        className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-accent to-primary blur-md"
      />
      <motion.span
        animate={{
          scale: active ? [1, 1.06, 1] : 1,
        }}
        transition={{
          duration: 2.2,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
        className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/90 to-accent shadow-[0_0_40px_-5px_var(--primary)]"
      />
      {active && (
        <>
          <span
            className="absolute inset-0 rounded-full border border-primary/40"
            style={{ animation: "ripple-pulse 3s ease-out infinite" }}
          />
          <span
            className="absolute inset-0 rounded-full border border-primary/30"
            style={{ animation: "ripple-pulse 3s ease-out 0.6s infinite" }}
          />
        </>
      )}
    </div>
  );
}
