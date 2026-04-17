import { useEffect, useRef } from "react";

/**
 * Water-ripple canvas for the sleep screen.
 * Subtle concentric ripples drift across a dark, calming surface.
 * GPU-friendly 2D canvas — no WebGL dep.
 */
export function RippleCanvas({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    type Ripple = { x: number; y: number; t: number; life: number; hue: number };
    const ripples: Ripple[] = [];

    const spawn = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ripples.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: h / 2 + (Math.random() - 0.5) * h * 0.4,
        t: 0,
        life: 320 + Math.random() * 200,
        hue: 210 + Math.random() * 30,
      });
    };

    let last = 0;
    const draw = (now: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      // soft vignette wash
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
      grad.addColorStop(0, "rgba(40, 80, 130, 0.08)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (now - last > 1400 / intensity) {
        spawn();
        last = now;
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.t += 1;
        if (r.t >= r.life) {
          ripples.splice(i, 1);
          continue;
        }
        const p = r.t / r.life;
        const radius = p * 520;
        const alpha = (1 - p) * 0.28 * intensity;

        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${r.hue}, 70%, 65%, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // inner echo
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${r.hue + 10}, 70%, 70%, ${alpha * 0.5})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
    />
  );
}
