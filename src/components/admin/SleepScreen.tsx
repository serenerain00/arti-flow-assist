import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Moon } from "lucide-react";

interface Props {
  onWake: () => void;
}

const SHAKE_WINDOW_MS = 600;
const SHAKE_DIRECTION_CHANGES = 4;
const SHAKE_MIN_VELOCITY = 0.8;

export function AdminSleepScreen({ onWake }: Props) {
  const [time, setTime] = useState<Date | null>(null);
  const wakeRequestedRef = useRef(false);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    type Sample = { x: number; y: number; t: number };
    const samples: Sample[] = [];

    const requestWake = () => {
      if (wakeRequestedRef.current) return;
      wakeRequestedRef.current = true;
      onWake();
    };

    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      samples.push({ x: e.clientX, y: e.clientY, t: now });
      const cutoff = now - SHAKE_WINDOW_MS;
      while (samples.length && samples[0].t < cutoff) samples.shift();
      if (samples.length < 4) return;

      let directionChanges = 0;
      let lastSign = 0;
      let totalVelocity = 0;
      for (let i = 1; i < samples.length; i++) {
        const dx = samples[i].x - samples[i - 1].x;
        const dt = Math.max(1, samples[i].t - samples[i - 1].t);
        totalVelocity += Math.abs(dx) / dt;
        const sign = Math.sign(dx);
        if (sign !== 0 && sign !== lastSign) {
          if (lastSign !== 0) directionChanges += 1;
          lastSign = sign;
        }
      }
      const avgVelocity = totalVelocity / (samples.length - 1);
      if (directionChanges >= SHAKE_DIRECTION_CHANGES && avgVelocity >= SHAKE_MIN_VELOCITY) {
        requestWake();
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        requestWake();
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [onWake]);

  const clockStr = time ? time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const dateStr = time
    ? time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-hidden bg-[#070b14] text-foreground"
      aria-label="Standing by — shake the mouse to wake"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full bg-indigo-500/[0.08] blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[44rem] w-[44rem] rounded-full bg-sky-400/[0.08] blur-3xl" />
        <div className="absolute left-1/3 top-1/4 h-[26rem] w-[26rem] rounded-full bg-violet-500/[0.05] blur-3xl" />
        <span className="ripple-ring" style={{ animationDuration: "9s" }} />
        <span className="ripple-ring" style={{ animationDuration: "9s", animationDelay: "3s" }} />
        <span className="ripple-core" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-400/15 text-indigo-200">
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-indigo-200/80">
            Arti · standing by
          </div>
        </div>

        <div className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
          {dateStr}
        </div>
        <div className="mt-3 text-[9rem] font-extralight leading-none tracking-tight text-foreground/90 tabular-nums">
          {clockStr}
        </div>
        <div className="mt-12 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground/60">
          Shake to wake
        </div>
      </div>
    </motion.div>
  );
}
