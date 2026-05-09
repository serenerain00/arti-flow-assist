import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Move3d, RotateCcw, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Interactive 3D anatomy model — stylized shoulder joint with implant
 * indicators (humeral head, glenoid, glenosphere, humeral stem). Driven
 * by R3F + drei OrbitControls. Mouse parity is the primary interaction
 * (drag to rotate, wheel to zoom). Touch will be added later via the
 * same OrbitControls (already gesture-aware).
 *
 * Self-contained — drop into any tile. Pauses auto-rotate the moment the
 * user grabs the model and resumes after 4s of inactivity. Has an
 * explicit "Reset view" button so a user who got disoriented can recover
 * without reloading.
 */

interface Props {
  className?: string;
  /** Header label shown over the canvas. */
  caption?: string;
  /** Toggle the anatomical-part labels (Scapula / Glenosphere / Humerus). */
  showLabels?: boolean;
}

export function AnatomyModel3D({
  className,
  caption = "Shoulder · 3D Anatomy",
  showLabels = true,
}: Props) {
  // SSR / hydration guard — Canvas touches `window`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Auto-rotate when idle; pause on user interaction; resume after 4s.
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeRef = useRef<number | null>(null);
  const onStart = () => {
    setAutoRotate(false);
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
  };
  const onEnd = () => {
    if (resumeRef.current) window.clearTimeout(resumeRef.current);
    resumeRef.current = window.setTimeout(() => setAutoRotate(true), 4000);
  };
  useEffect(
    () => () => {
      if (resumeRef.current) window.clearTimeout(resumeRef.current);
    },
    [],
  );

  // Reset-view nudge — bumps a key on the controls + scene wrapper to remount
  // them, restoring the default camera position and rotation.
  const [resetKey, setResetKey] = useState(0);
  const handleReset = () => setResetKey((k) => k + 1);

  if (!mounted) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-2xl border border-border/60 bg-black font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground",
          className,
        )}
      >
        Loading anatomy…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-[#06070b]",
        className,
      )}
    >
      <Canvas
        key={resetKey}
        dpr={[1, 2]}
        camera={{ position: [3.2, 1.4, 4.1], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Lighting />
          <ShoulderModel showLabels={showLabels} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={2.8}
          maxDistance={8}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate}
          autoRotateSpeed={0.55}
          onStart={onStart}
          onEnd={onEnd}
        />
      </Canvas>

      {/* Header caption */}
      {caption && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/85 backdrop-blur">
          {caption}
        </div>
      )}

      {/* Reset-view button */}
      <button
        type="button"
        onClick={handleReset}
        className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 font-mono text-[9px] uppercase tracking-wider text-white/70 backdrop-blur transition-colors hover:border-white/40 hover:text-white"
        title="Reset orientation"
      >
        <RotateCcw className="h-3 w-3" strokeWidth={2} />
        Reset
      </button>

      {/* Interaction hints */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-wider text-white/55">
        <span className="flex items-center gap-1.5">
          <Move3d className="h-3 w-3" /> drag to rotate
        </span>
        <span className="flex items-center gap-1.5">
          <ZoomIn className="h-3 w-3" /> scroll to zoom
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Scene
// ──────────────────────────────────────────────────────────────────────────

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 6, 4]} intensity={1.2} />
      {/* Cool fill light from behind — gives the anatomy a clinical edge. */}
      <directionalLight position={[-4, 2, -5]} intensity={0.5} color="#7aa6ff" />
      {/* Warm rim light below for depth. */}
      <pointLight position={[0, -3, 2]} intensity={0.3} color="#ffb37a" />
    </>
  );
}

/**
 * Stylized right shoulder joint. Not anatomically precise — the goal is
 * a recognizable silhouette (scapula, glenoid, humeral head + shaft) with
 * an implant indicator that conveys the pre-op plan at a glance.
 */
function ShoulderModel({ showLabels }: { showLabels?: boolean }) {
  const groupRef = useRef<Group>(null);
  const implantRef = useRef<Mesh>(null);

  // Subtle emissive pulse on the glenosphere — reads as "this is the
  // implant being planned/placed" without animating geometry.
  useFrame((state) => {
    if (!implantRef.current) return;
    const mat = implantRef.current.material as MeshStandardMaterial;
    mat.emissiveIntensity = 0.4 + 0.18 * Math.sin(state.clock.elapsedTime * 1.4);
  });

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* Scapula — flat plate behind the joint */}
      <mesh position={[-1.25, 0.05, -0.2]} rotation={[0, 0.3, 0.18]}>
        <boxGeometry args={[1.4, 1.55, 0.13]} />
        <meshStandardMaterial color="#bfa687" roughness={0.75} metalness={0.04} />
      </mesh>
      {/* Acromion — small protrusion above glenoid */}
      <mesh position={[-0.55, 0.95, 0.0]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.55, 0.22, 0.14]} />
        <meshStandardMaterial color="#b89a7c" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Glenoid — flat disc on lateral edge of scapula */}
      <mesh position={[-0.6, 0.05, 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.1, 32]} />
        <meshStandardMaterial color="#d9c8a8" roughness={0.55} metalness={0.06} />
      </mesh>

      {/* Glenosphere implant — emissive primary-tinted sphere */}
      <mesh ref={implantRef} position={[-0.32, 0.05, 0.05]}>
        <sphereGeometry args={[0.34, 36, 28]} />
        <meshStandardMaterial
          color="#c8ccd8"
          roughness={0.22}
          metalness={0.85}
          emissive="#5b8ef0"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Humeral head — articulating sphere */}
      <mesh position={[0.22, 0.0, 0.05]}>
        <sphereGeometry args={[0.55, 40, 30]} />
        <meshStandardMaterial color="#e8d6b8" roughness={0.62} metalness={0.05} />
      </mesh>

      {/* Humeral shaft */}
      <mesh position={[0.55, -1.05, 0.05]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.3, 0.26, 1.7, 26]} />
        <meshStandardMaterial color="#dccbab" roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Humeral stem implant — metallic core peeking out of the shaft top */}
      <mesh position={[0.45, -0.25, 0.05]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.13, 0.13, 0.32, 18]} />
        <meshStandardMaterial color="#9aa0b3" roughness={0.28} metalness={0.92} />
      </mesh>

      {showLabels && (
        <>
          <Html position={[-1.05, 0.95, 0.35]} center distanceFactor={6}>
            <div className="whitespace-nowrap rounded-full border border-white/25 bg-black/65 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/85 backdrop-blur">
              Scapula
            </div>
          </Html>
          <Html position={[-0.32, 0.75, 0.05]} center distanceFactor={6}>
            <div className="whitespace-nowrap rounded-full border border-primary/55 bg-black/70 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-primary backdrop-blur">
              Glenosphere
            </div>
          </Html>
          <Html position={[0.95, -0.5, 0.05]} center distanceFactor={6}>
            <div className="whitespace-nowrap rounded-full border border-white/25 bg-black/65 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white/85 backdrop-blur">
              Humerus
            </div>
          </Html>
        </>
      )}
    </group>
  );
}
