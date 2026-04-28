import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Sparkles, Cpu, Mic, Volume2, Layers, BookOpen, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyStage, StageVisual } from "./script";

interface Props {
  stage: JourneyStage;
  /** When false, the visual freezes / fades out (used during exit animation). */
  active: boolean;
}

/**
 * Stage visual switcher. Each variant is a self-contained GSAP timeline
 * that runs from 0 when `active` flips true. We intentionally use GSAP
 * over Framer Motion here for the in-stage choreography — GSAP timelines
 * are easier to express for staggered, multi-element sequences with
 * specific timing across many DOM nodes.
 */
export function StageVisual({ stage, active }: Props) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {stage.visual === "vision" && <VisionVisual stage={stage} active={active} />}
      {stage.visual === "stack" && <StackVisual stage={stage} active={active} />}
      {stage.visual === "brain" && <BrainVisual stage={stage} active={active} />}
      {stage.visual === "voice" && <VoiceVisual stage={stage} active={active} />}
      {stage.visual === "polish" && <PolishVisual stage={stage} active={active} />}
      {stage.visual === "knowledge" && <KnowledgeVisual stage={stage} active={active} />}
      {stage.visual === "closing" && <ClosingVisual stage={stage} active={active} />}
      {stage.visual === "credits" && <CreditsVisual stage={stage} active={active} />}
    </div>
  );
}

// ── Helper hook: run a GSAP timeline when active flips true ────────────

function useStageTimeline(
  active: boolean,
  build: (ctx: gsap.Context) => void,
  scopeRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active || !scopeRef.current) return;
    const ctx = gsap.context(build, scopeRef.current);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

// ── Stage 1: Vision ─────────────────────────────────────────────────────
//
// Centered pulsing orb (Arti's signature) with concentric rings expanding
// outward. Title fades up. Tag chips drift in from the bottom.

function VisionVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".v-orb", { scale: 0, opacity: 0, duration: 0.9, ease: "back.out(1.7)" })
        .from(
          ".v-ring",
          {
            scale: 0,
            opacity: 0,
            duration: 1.2,
            stagger: 0.12,
            ease: "power3.out",
          },
          "-=0.6",
        )
        .from(".v-title", { y: 30, opacity: 0, duration: 0.6, ease: "power2.out" }, "-=0.8")
        .from(".v-sub", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.4")
        .from(
          ".v-tag",
          { y: 16, opacity: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" },
          "-=0.3",
        );

      // Continuous orb pulse
      gsap.to(".v-orb-glow", {
        scale: 1.18,
        opacity: 0.6,
        duration: 1.6,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });

      // Heartbeat — "lub-dub" double-thump with a rest between cycles.
      // Loops for the entire stage so the room sees the icon alive
      // through the whole "ambient companion" narration.
      gsap
        .timeline({ repeat: -1 })
        .to(".v-heart", { scale: 1.18, duration: 0.14, ease: "power2.out" })
        .to(".v-heart", { scale: 1.0, duration: 0.18, ease: "power2.in" })
        .to(".v-heart", { scale: 1.12, duration: 0.12, ease: "power2.out" })
        .to(".v-heart", { scale: 1.0, duration: 0.22, ease: "power2.in" })
        .to({}, { duration: 0.55 });
    },
    scope,
  );

  return (
    <div ref={scope} className="relative flex h-full w-full flex-col items-center justify-center">
      {/* Orb + rings */}
      <div className="relative h-64 w-64">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "v-ring pointer-events-none absolute inset-0 rounded-full border border-primary/40",
              i === 0 && "scale-100",
              i === 1 && "scale-[1.4]",
              i === 2 && "scale-[1.85]",
            )}
            style={{ opacity: 0.5 - i * 0.15 }}
          />
        ))}
        <div className="v-orb absolute inset-8 rounded-full bg-gradient-to-br from-primary/80 via-primary/40 to-cyan-300/30 shadow-[0_0_120px_30px_rgba(6,182,212,0.45)]">
          <div className="v-orb-glow absolute inset-0 rounded-full bg-primary/30 blur-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="v-heart h-16 w-16 text-white/80" strokeWidth={1.4} />
          </div>
        </div>
      </div>

      {/* Title block */}
      <div className="mt-12 text-center">
        <h2 className="v-title text-5xl font-light tracking-tight">{stage.title}</h2>
        <p className="v-sub mt-3 text-lg font-light text-muted-foreground">{stage.subtitle}</p>
      </div>

      {/* Tag chips */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {stage.tags.map((t) => (
          <span
            key={t}
            className="v-tag rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stage 2: Stack ──────────────────────────────────────────────────────
//
// Four big cards staggered into view. Each carries a tech name + role.

const STACK_CARDS = [
  { name: "React 19", role: "UI runtime", color: "from-cyan-400/30 to-cyan-600/10" },
  { name: "TypeScript", role: "Type safety", color: "from-blue-400/30 to-blue-700/10" },
  { name: "TanStack Start", role: "Full-stack router", color: "from-amber-400/30 to-amber-600/10" },
  { name: "Tailwind v4", role: "Design language", color: "from-sky-400/30 to-sky-600/10" },
];

function StackVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".s-title", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }).from(
        ".s-card",
        {
          y: 60,
          opacity: 0,
          rotation: -4,
          duration: 0.6,
          stagger: 0.13,
          ease: "back.out(1.6)",
        },
        "-=0.2",
      );
    },
    scope,
  );

  return (
    <div ref={scope} className="flex h-full w-full flex-col items-center justify-center px-12">
      <div className="s-title text-center">
        <h2 className="text-4xl font-light">{stage.title}</h2>
        <p className="mt-2 text-base font-light text-muted-foreground">{stage.subtitle}</p>
      </div>

      <div className="mt-12 grid w-full max-w-5xl grid-cols-2 gap-5 lg:grid-cols-4">
        {STACK_CARDS.map((c) => (
          <div
            key={c.name}
            className={cn(
              "s-card flex h-44 flex-col justify-between rounded-2xl border border-white/10 p-5",
              "bg-gradient-to-br backdrop-blur-md",
              c.color,
            )}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">
              {c.role}
            </div>
            <div className="text-2xl font-light text-white">{c.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stage 3: Brain ──────────────────────────────────────────────────────
//
// Centered Claude orb with tool chips radiating outward.

// Order matters — chips are placed around an ellipse in array order.
// Long-named chips are paired diametrically opposite each other so the
// visual weight stays balanced left↔right and top↔bottom. Short chips
// (scroll, open_case) anchor the cardinal axes where chips sit closest
// to the orb.
const BRAIN_TOOLS = [
  "set_reminder", // 0 · right
  "show_preference_card", // 1 · upper-right (long)
  "open_case", // 2 · upper-right (short)
  "scroll", // 3 · top (short)
  "open_how_to_video", // 4 · upper-left (long)
  "library_search", // 5 · upper-left
  "navigate_home", // 6 · left
  "set_instrument_count", // 7 · lower-left (long, mirrors #1)
  "switch_role", // 8 · lower-left (short, mirrors #2)
  "focus_console", // 9 · bottom
  "toggle_timeout", // 10 · lower-right (mirrors #4)
  "greet_person", // 11 · lower-right
];

function BrainVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".b-orb", { scale: 0, opacity: 0, duration: 0.7, ease: "back.out(1.6)" })
        .from(".b-title", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
        .from(".b-sub", { y: 16, opacity: 0, duration: 0.4, ease: "power2.out" }, "-=0.3")
        .from(
          ".b-tool",
          {
            x: 0,
            y: 0,
            scale: 0,
            opacity: 0,
            duration: 0.55,
            stagger: 0.05,
            ease: "back.out(1.4)",
          },
          "-=0.2",
        );

      // Pulsing brain orb
      gsap.to(".b-orb-glow", {
        opacity: 0.8,
        scale: 1.15,
        duration: 1.4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    },
    scope,
  );

  // Place tool chips around an ellipse for that "radiating" feel. Tighter
  // X radius + softer Y squash makes the cluster read as a circle rather
  // than a wide oval — important now that the longest chip names
  // (show_preference_card, set_instrument_count) used to throw the
  // visual weight to the left when at extreme X positions.
  const toolPositions = BRAIN_TOOLS.map((_, i) => {
    const angle = (i / BRAIN_TOOLS.length) * Math.PI * 2;
    const rx = 240;
    const ry = 175;
    return {
      x: Math.cos(angle) * rx,
      y: Math.sin(angle) * ry,
    };
  });

  return (
    <div ref={scope} className="relative flex h-full w-full flex-col items-center justify-center">
      {/* Title — top-32 clears the journey header (badge + progress dots + stage label
          take ~110px). Earlier top-12 sat directly on the timeline. */}
      <div className="absolute left-1/2 top-32 -translate-x-1/2 text-center">
        <h2 className="b-title text-4xl font-light">{stage.title}</h2>
        <p className="b-sub mt-2 text-base font-light text-muted-foreground">{stage.subtitle}</p>
      </div>

      {/* Tools radiating around the orb */}
      <div className="relative h-[420px] w-[680px]">
        {/* Orb in the middle */}
        <div className="b-orb absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-cyan-400/30 shadow-[0_0_80px_20px_rgba(6,182,212,0.5)]">
          <div className="b-orb-glow absolute inset-0 rounded-full bg-primary/40 blur-xl" />
          <Cpu className="relative h-12 w-12 text-white/85" strokeWidth={1.2} />
          <div className="absolute -bottom-9 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Claude Haiku
          </div>
        </div>

        {/* Tool chips */}
        {BRAIN_TOOLS.map((tool, i) => (
          <div
            key={tool}
            className="b-tool absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              transform: `translate(calc(-50% + ${toolPositions[i].x}px), calc(-50% + ${toolPositions[i].y}px))`,
            }}
          >
            <span className="rounded-full border border-primary/30 bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] tracking-wide text-foreground/80 backdrop-blur-md">
              {tool}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stage 4: Voice ──────────────────────────────────────────────────────
//
// Animated waveform on each side, Claude orb in the middle, flow lines.

function VoiceVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".vc-title", { y: 20, opacity: 0, duration: 0.5 })
        .from(".vc-sub", { y: 16, opacity: 0, duration: 0.4 }, "-=0.3")
        .from(".vc-mic", { x: -60, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.2")
        .from(".vc-line-l", { scaleX: 0, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".vc-orb", { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(1.6)" }, "-=0.3")
        .from(".vc-line-r", { scaleX: 0, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(".vc-speaker", { x: 60, opacity: 0, duration: 0.6, ease: "power3.out" }, "-=0.3")
        .from(".vc-tag", { y: 10, opacity: 0, duration: 0.4, stagger: 0.1 }, "-=0.2");

      // Animate the waveform bars
      gsap.utils.toArray<HTMLElement>(".vc-bar").forEach((bar, i) => {
        gsap.to(bar, {
          scaleY: 0.3 + Math.random() * 0.7,
          duration: 0.4 + Math.random() * 0.3,
          yoyo: true,
          repeat: -1,
          delay: i * 0.05,
          ease: "sine.inOut",
        });
      });

      // Continuous flow line glow pulse
      gsap.to(".vc-line-l, .vc-line-r", {
        opacity: 0.95,
        duration: 1.0,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    },
    scope,
  );

  return (
    <div ref={scope} className="flex h-full w-full flex-col items-center justify-center px-12">
      {/* Title */}
      <div className="text-center">
        <h2 className="vc-title text-4xl font-light">{stage.title}</h2>
        <p className="vc-sub mt-2 text-base font-light text-muted-foreground">{stage.subtitle}</p>
      </div>

      {/* Flow */}
      <div className="mt-14 flex items-center gap-6">
        {/* Mic + waveform left */}
        <div className="vc-mic flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-400/10 backdrop-blur-md">
            <Mic className="h-9 w-9 text-cyan-300" strokeWidth={1.5} />
          </div>
          <div className="flex h-12 items-center gap-1">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="vc-bar block w-1 origin-center bg-cyan-300/70"
                style={{ height: `${30 + Math.random() * 40}%` }}
              />
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-300/80">
            Web Speech API
          </span>
        </div>

        {/* Flow line left */}
        <div className="vc-line-l h-px w-16 origin-left bg-gradient-to-r from-cyan-400/0 via-cyan-300 to-primary" />

        {/* Center orb */}
        <div className="vc-orb relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-cyan-400/40 shadow-[0_0_60px_15px_rgba(6,182,212,0.4)]">
          <Cpu className="h-10 w-10 text-white/85" strokeWidth={1.3} />
        </div>

        {/* Flow line right */}
        <div className="vc-line-r h-px w-16 origin-left bg-gradient-to-r from-primary via-violet-300 to-violet-400/0" />

        {/* Speaker + waveform right */}
        <div className="vc-speaker flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-violet-400/40 bg-violet-400/10 backdrop-blur-md">
            <Volume2 className="h-9 w-9 text-violet-300" strokeWidth={1.5} />
          </div>
          <div className="flex h-12 items-center gap-1">
            {Array.from({ length: 16 }).map((_, i) => (
              <span
                key={i}
                className="vc-bar block w-1 origin-center bg-violet-300/70"
                style={{ height: `${30 + Math.random() * 40}%` }}
              />
            ))}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300/80">
            ElevenLabs Flash
          </span>
        </div>
      </div>

      {/* Tag chips */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
        {stage.tags.map((t) => (
          <span
            key={t}
            className="vc-tag rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stage 5: Polish ─────────────────────────────────────────────────────
//
// Three demo cards highlighting the animation/3D libs. Each does a tiny
// in-place demo (modal pop, GSAP slide, R3F-style glow box).

function PolishVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".p-title", { y: 20, opacity: 0, duration: 0.5 })
        .from(".p-sub", { y: 16, opacity: 0, duration: 0.4 }, "-=0.3")
        .from(
          ".p-card",
          { y: 60, opacity: 0, scale: 0.85, stagger: 0.15, duration: 0.6, ease: "back.out(1.4)" },
          "-=0.2",
        )
        .to(".p-card", { y: -8, duration: 0.5, ease: "sine.inOut", stagger: 0.1 })
        .to(".p-card", { y: 0, duration: 0.5, ease: "sine.inOut", stagger: 0.1 });

      // Bloom glow on the R3F card
      gsap.to(".p-glow", {
        opacity: 0.9,
        scale: 1.08,
        duration: 1.6,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    },
    scope,
  );

  return (
    <div ref={scope} className="flex h-full w-full flex-col items-center justify-center px-12">
      <div className="text-center">
        <h2 className="p-title text-4xl font-light">{stage.title}</h2>
        <p className="p-sub mt-2 text-base font-light text-muted-foreground">{stage.subtitle}</p>
      </div>

      <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
        {/* Framer Motion */}
        <div className="p-card flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/15 to-pink-500/5 p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
            <Layers className="h-10 w-10 text-purple-200" strokeWidth={1.4} />
          </div>
          <div className="text-center">
            <div className="text-lg font-light">Framer Motion</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Modal pop · zoom · fade
            </div>
          </div>
        </div>

        {/* GSAP */}
        <div className="p-card flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/15 to-emerald-700/5 p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <Sparkles className="h-10 w-10 text-emerald-200" strokeWidth={1.4} />
          </div>
          <div className="text-center">
            <div className="text-lg font-light">GSAP</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Timelines · stagger · choreography
            </div>
          </div>
        </div>

        {/* React Three Fiber */}
        <div className="p-card relative flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/15 to-blue-700/5 p-6">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
            <span className="p-glow absolute inset-0 rounded-2xl bg-cyan-300/40 blur-xl" />
            <Cpu className="relative h-10 w-10 text-cyan-200" strokeWidth={1.4} />
          </div>
          <div className="text-center">
            <div className="text-lg font-light">React Three Fiber</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Tower · bloom · 360°
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stage 6: Knowledge ──────────────────────────────────────────────────
//
// Layered card stack representing the curated content library.

function KnowledgeVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".k-title", { y: 20, opacity: 0, duration: 0.5 })
        .from(".k-sub", { y: 16, opacity: 0, duration: 0.4 }, "-=0.3")
        .from(
          ".k-stack-card",
          {
            y: 80,
            opacity: 0,
            rotation: () => -10 + Math.random() * 20,
            stagger: 0.12,
            duration: 0.7,
            ease: "back.out(1.4)",
          },
          "-=0.2",
        )
        .from(".k-source", { y: 16, opacity: 0, stagger: 0.1, duration: 0.4 }, "-=0.3");
    },
    scope,
  );

  return (
    <div ref={scope} className="flex h-full w-full flex-col items-center justify-center px-12">
      <div className="text-center">
        <h2 className="k-title text-4xl font-light">{stage.title}</h2>
        <p className="k-sub mt-2 text-base font-light text-muted-foreground">{stage.subtitle}</p>
      </div>

      {/* Card stack */}
      <div className="mt-12 relative h-64 w-[500px]">
        {[
          {
            kind: "video",
            title: "Reverse TSA · Univers Revers",
            channel: "Arthrex",
            year: 2025,
            offset: 0,
          },
          {
            kind: "video",
            title: "ACL Reconstruction · TightRope",
            channel: "What's New in Orthopedics",
            year: 2024,
            offset: 18,
          },
          {
            kind: "paper",
            title: "Knotless All-Suture Bankart Repair",
            channel: "Arthroscopy",
            year: 2023,
            offset: 36,
          },
          {
            kind: "paper",
            title: "Glenosphere Lateralization in RSA",
            channel: "JBJS",
            year: 2024,
            offset: 54,
          },
        ].map((c, i) => (
          <div
            key={i}
            className="k-stack-card absolute left-1/2 -translate-x-1/2 flex h-32 w-[440px] items-center gap-4 rounded-2xl border border-white/10 bg-surface-2/80 px-5 py-4 backdrop-blur-md"
            style={{
              top: c.offset,
              transform: `translateX(-50%) rotate(${(i - 1.5) * 2}deg)`,
              zIndex: 10 - i,
              boxShadow: `0 ${10 + i * 4}px ${30 + i * 8}px rgba(0,0,0,0.4)`,
            }}
          >
            <div
              className={cn(
                "flex h-20 w-32 shrink-0 items-center justify-center rounded-lg",
                c.kind === "video"
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "bg-amber-500/15 text-amber-200",
              )}
            >
              {c.kind === "video" ? (
                <Sparkles className="h-7 w-7" strokeWidth={1.4} />
              ) : (
                <BookOpen className="h-7 w-7" strokeWidth={1.4} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
                {c.kind === "video" ? "Surgical video" : "Research paper"}
              </div>
              <div className="mt-1 truncate text-sm font-light">{c.title}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {c.channel} · {c.year}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Source badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {["Arthrex", "JBJS", "PubMed-verified", "21 videos", "6 papers"].map((s) => (
          <span
            key={s}
            className="k-source rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stage 7: Closing ────────────────────────────────────────────────────
//
// Pulsing Arti orb, big "Built for Arthrex" wordmark, particles fly out.

function ClosingVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".c-orb", { scale: 0, opacity: 0, duration: 0.9, ease: "back.out(1.6)" })
        .from(
          ".c-particle",
          {
            scale: 0,
            opacity: 0,
            duration: 1.2,
            stagger: 0.04,
            ease: "power2.out",
          },
          "-=0.5",
        )
        .from(".c-line1", { y: 30, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.6")
        .from(".c-line2", { y: 30, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.5")
        .from(".c-arti", { y: 16, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.3");

      // Continuous orb pulse + particle drift
      gsap.to(".c-orb-glow", {
        opacity: 0.85,
        scale: 1.2,
        duration: 1.8,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      gsap.utils.toArray<HTMLElement>(".c-particle").forEach((p, i) => {
        gsap.to(p, {
          y: -20 + Math.random() * 40,
          x: -20 + Math.random() * 40,
          duration: 3 + Math.random() * 2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: i * 0.05,
        });
      });
    },
    scope,
  );

  // Particle positions in a wide circle around the orb.
  const particles = Array.from({ length: 18 }).map((_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const r = 200 + Math.random() * 80;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.7 };
  });

  return (
    <div ref={scope} className="relative flex h-full w-full flex-col items-center justify-center">
      {/* Orb */}
      <div className="relative h-56 w-56">
        {particles.map((p, i) => (
          <span
            key={i}
            className="c-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-primary/70"
            style={{
              transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
            }}
          />
        ))}
        <div className="c-orb absolute inset-4 rounded-full bg-gradient-to-br from-primary/80 via-primary/40 to-cyan-300/20 shadow-[0_0_140px_40px_rgba(6,182,212,0.55)]">
          <div className="c-orb-glow absolute inset-0 rounded-full bg-primary/30 blur-2xl" />
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.4em] text-white/90">
            Arti
          </div>
        </div>
      </div>

      {/* Wordmark */}
      <div className="mt-14 text-center">
        <h2 className="c-line1 text-5xl font-light tracking-tight text-foreground">
          {stage.title}
        </h2>
        <p className="c-line2 mt-3 text-lg font-light text-muted-foreground">{stage.subtitle}</p>
        <p className="c-arti mt-6 font-mono text-[10px] uppercase tracking-[0.4em] text-primary/80">
          One last thing…
        </p>
      </div>
    </div>
  );
}

// ── Stage 8: Credits ────────────────────────────────────────────────────
//
// A personal "designed by" frame for Melissa Casole (Senior UX Designer
// at Arthrex). Heart-icon orb, sparkle particles, name + role + a small
// kicker line. The narration carries the joke; the visual stays warm
// and clean.

function CreditsVisual({ stage, active }: { stage: JourneyStage; active: boolean }) {
  const scope = useRef<HTMLDivElement>(null);

  useStageTimeline(
    active,
    () => {
      const tl = gsap.timeline();
      tl.from(".cr-orb", { scale: 0, opacity: 0, duration: 0.85, ease: "back.out(1.6)" })
        .from(
          ".cr-spark",
          {
            scale: 0,
            opacity: 0,
            duration: 1.0,
            stagger: 0.06,
            ease: "power2.out",
          },
          "-=0.5",
        )
        .from(".cr-kicker", { y: 18, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.5")
        .from(".cr-name", { y: 30, opacity: 0, duration: 0.7, ease: "power2.out" }, "-=0.3")
        .from(".cr-role", { y: 20, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.4")
        .from(".cr-thanks", { y: 14, opacity: 0, duration: 0.5, ease: "power2.out" }, "-=0.2");

      gsap.to(".cr-orb-glow", {
        opacity: 0.85,
        scale: 1.18,
        duration: 1.6,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      gsap.utils.toArray<HTMLElement>(".cr-spark").forEach((p, i) => {
        gsap.to(p, {
          y: -12 + Math.random() * 24,
          x: -12 + Math.random() * 24,
          opacity: 0.4 + Math.random() * 0.5,
          duration: 2.5 + Math.random() * 2,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: i * 0.07,
        });
      });
    },
    scope,
  );

  // 14 sparkles in a wider halo around the orb.
  const sparks = Array.from({ length: 14 }).map((_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const r = 170 + Math.random() * 60;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r * 0.7 };
  });

  return (
    <div ref={scope} className="relative flex h-full w-full flex-col items-center justify-center">
      {/* Heart orb */}
      <div className="relative h-48 w-48">
        {sparks.map((p, i) => (
          <span
            key={i}
            className="cr-spark absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-primary/70"
            style={{
              transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
            }}
          />
        ))}
        <div className="cr-orb absolute inset-4 rounded-full bg-gradient-to-br from-primary/80 via-primary/40 to-cyan-300/20 shadow-[0_0_120px_30px_rgba(6,182,212,0.5)]">
          <div className="cr-orb-glow absolute inset-0 rounded-full bg-primary/30 blur-2xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart
              className="h-14 w-14 text-white/85"
              strokeWidth={1.4}
              fill="rgba(255,255,255,0.15)"
            />
          </div>
        </div>
      </div>

      {/* Name block */}
      <div className="mt-12 text-center">
        <p className="cr-kicker font-mono text-[10px] uppercase tracking-[0.4em] text-primary/80">
          Designed by
        </p>
        <h2 className="cr-name mt-3 text-5xl font-light tracking-tight text-foreground">
          {stage.title}
        </h2>
        <p className="cr-role mt-3 text-lg font-light text-muted-foreground">{stage.subtitle}</p>
        <p className="cr-thanks mt-6 font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">
          Thanks for watching · say "exit" to leave
        </p>
      </div>
    </div>
  );
}
