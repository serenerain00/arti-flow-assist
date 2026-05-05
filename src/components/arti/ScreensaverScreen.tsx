import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ArtiInvoker } from "./ArtiInvoker";

interface Props {
  onExit: () => void;
  onPrompt: (text: string) => void;
}

/**
 * Calm sunrise landscape — invoked just before the patient is wheeled in
 * so the OR feels like a place to breathe instead of a place to rush.
 *
 * Pure CSS / SVG animation, no external assets. Layers (back → front):
 *   - vertical gradient sky (deep teal → coral → gold)
 *   - soft glowing sun with slow "breathing" scale animation
 *   - three drifting cloud silhouettes at different speeds
 *   - mountain silhouette at the horizon
 *   - shimmer band on the foreground water
 *   - slow drifting bokeh particles
 *
 * Exit:
 *   - say "exit screensaver" / "end screensaver" / "close it" (voice tool)
 *   - press Esc
 *   - hover anywhere → an X appears top-right; tap it
 *   - chat the same phrases through the ArtiInvoker
 */
export function ScreensaverScreen({ onExit, onPrompt }: Props) {
  // Hover-reveal for the exit X. Cursor activity arms a 3s timer; if the
  // user goes still, the X (and cursor) fade so the wall reads as art.
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHide = useCallback(() => {
    setChromeVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setChromeVisible(false), 3000);
  }, []);

  useEffect(() => {
    armHide();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [armHide]);

  // Esc keyboard exit.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  return (
    <div
      onMouseMove={armHide}
      onTouchStart={armHide}
      style={{ cursor: chromeVisible ? "default" : "none" }}
      className="relative h-screen w-screen overflow-hidden"
    >
      {/* ── Sky gradient (back layer) ─────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, #0c1e36 0%, #1f3a5c 18%, #5b6f86 38%, #d98968 62%, #f5b97a 78%, #f4d49a 92%, #e8b48a 100%)",
        }}
      />

      {/* ── Sun ───────────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="screensaver-sun-glow"
          style={{
            position: "absolute",
            width: "60vmin",
            height: "60vmin",
            top: "32%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(255,220,150,0.85) 0%, rgba(255,180,120,0.45) 22%, rgba(255,150,100,0.18) 48%, transparent 72%)",
            filter: "blur(8px)",
          }}
        />
        <div
          className="screensaver-sun-disc"
          style={{
            position: "absolute",
            width: "16vmin",
            height: "16vmin",
            top: "32%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 35%, #fff7e0 0%, #ffd99b 35%, #fbb472 65%, #f08f55 100%)",
            boxShadow: "0 0 80px 30px rgba(255,200,140,0.45)",
          }}
        />
      </div>

      {/* ── Cloud band ────────────────────────────────────────────────── */}
      <Cloud topVh={18} sizeVw={42} delaySec={0} durationSec={140} opacity={0.45} />
      <Cloud topVh={10} sizeVw={30} delaySec={-40} durationSec={180} opacity={0.32} />
      <Cloud topVh={28} sizeVw={50} delaySec={-90} durationSec={220} opacity={0.5} />
      <Cloud topVh={5} sizeVw={22} delaySec={-25} durationSec={160} opacity={0.25} />

      {/* ── Mountain silhouette (mid-foreground) ──────────────────────── */}
      <svg
        viewBox="0 0 1600 320"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-[28%] h-[18vh] w-full"
      >
        <defs>
          <linearGradient id="mountains" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3d4d65" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2a3a52" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <path
          d="M0,260 L0,200 L120,140 L260,180 L380,90 L520,180 L660,120 L780,200 L920,80 L1060,180 L1200,130 L1340,200 L1480,150 L1600,200 L1600,260 Z"
          fill="url(#mountains)"
        />
      </svg>

      {/* ── Foreground water + shimmer band ──────────────────────────── */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[28vh]"
        style={{
          background:
            "linear-gradient(to bottom, rgba(217,137,104,0.85) 0%, rgba(180,90,80,0.92) 40%, rgba(70,55,80,0.96) 100%)",
        }}
      />
      <div className="screensaver-shimmer pointer-events-none absolute inset-x-0 bottom-[20vh] h-[1.5vh]" />
      <div
        className="screensaver-shimmer screensaver-shimmer-2 pointer-events-none absolute inset-x-0 bottom-[12vh] h-[1px]"
      />

      {/* ── Bokeh particles ──────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="screensaver-bokeh"
            style={{
              left: `${(i * 7.7) % 100}%`,
              top: `${(i * 13.3) % 65}%`,
              width: `${4 + (i % 4) * 2}px`,
              height: `${4 + (i % 4) * 2}px`,
              animationDelay: `${(i * 1.3) % 18}s`,
              animationDuration: `${22 + (i % 6) * 4}s`,
              opacity: 0.45 + (i % 5) * 0.06,
            }}
          />
        ))}
      </div>

      {/* ── Soft caption (bottom center) ──────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-12 flex flex-col items-center gap-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.45em] text-white/55">
          arti · pause · breathe
        </div>
        <div className="font-light italic text-white/75 text-sm">
          Take a moment before they come in.
        </div>
      </div>

      {/* ── Hover-revealed exit X (top-right) ─────────────────────────── */}
      <button
        onClick={onExit}
        aria-label="Exit screensaver"
        title="Exit screensaver"
        style={{
          opacity: chromeVisible ? 1 : 0,
          transition: "opacity 0.6s ease",
          pointerEvents: chromeVisible ? "auto" : "none",
        }}
        className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white/90 backdrop-blur-md transition-colors hover:border-white/60 hover:bg-black/55"
      >
        <X className="h-5 w-5" strokeWidth={1.7} />
      </button>

      {/* ── Voice/chat invoker stays available so users can exit by speaking
            "end screensaver" or typing it. */}
      <ArtiInvoker
        placeholder="Type 'exit screensaver' or speak it…"
        onSubmit={onPrompt}
        suggestions={["Exit screensaver", "What's next on the schedule?", "Wake me when ready"]}
      />

      {/* ── Component-scoped keyframes ────────────────────────────────── */}
      <style>{`
        @keyframes sunBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.92; }
          50%      { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
        }
        .screensaver-sun-disc { animation: sunBreathe 9s ease-in-out infinite; }
        .screensaver-sun-glow { animation: sunBreathe 9s ease-in-out infinite; }

        @keyframes cloudDrift {
          from { transform: translateX(-30vw); }
          to   { transform: translateX(130vw); }
        }
        .screensaver-cloud { will-change: transform; }

        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .screensaver-shimmer {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 230, 200, 0.0) 30%,
            rgba(255, 230, 200, 0.55) 50%,
            rgba(255, 230, 200, 0.0) 70%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 11s ease-in-out infinite;
        }
        .screensaver-shimmer-2 {
          animation-duration: 17s;
          animation-direction: reverse;
          opacity: 0.6;
        }

        @keyframes bokehFloat {
          0%   { transform: translate(0, 0) scale(1); opacity: 0; }
          15%  { opacity: 0.6; }
          50%  { transform: translate(-12vw, -22vh) scale(1.15); opacity: 0.85; }
          85%  { opacity: 0.4; }
          100% { transform: translate(-22vw, -45vh) scale(0.9); opacity: 0; }
        }
        .screensaver-bokeh {
          position: absolute;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,235,200,0.95) 0%, rgba(255,200,140,0.35) 60%, transparent 100%);
          filter: blur(2px);
          animation: bokehFloat linear infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Soft cloud silhouette — three overlapping ellipses, blurred. Drifts
 * across the screen left → right at the configured duration; negative
 * delays let multiple clouds start mid-flight so the sky is never empty.
 */
function Cloud({
  topVh,
  sizeVw,
  delaySec,
  durationSec,
  opacity,
}: {
  topVh: number;
  sizeVw: number;
  delaySec: number;
  durationSec: number;
  opacity: number;
}) {
  return (
    <div
      className="screensaver-cloud pointer-events-none absolute"
      style={{
        top: `${topVh}vh`,
        width: `${sizeVw}vw`,
        height: `${sizeVw * 0.32}vw`,
        opacity,
        animation: `cloudDrift ${durationSec}s linear infinite`,
        animationDelay: `${delaySec}s`,
        filter: "blur(6px)",
      }}
    >
      <svg viewBox="0 0 200 70" preserveAspectRatio="none" className="h-full w-full">
        <ellipse cx="60" cy="38" rx="50" ry="22" fill="#fff5e8" />
        <ellipse cx="110" cy="32" rx="60" ry="26" fill="#fff5e8" />
        <ellipse cx="160" cy="40" rx="36" ry="18" fill="#fff5e8" />
      </svg>
    </div>
  );
}
