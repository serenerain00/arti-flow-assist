import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, RoundedBox, Text } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Color, Group, MathUtils, Mesh, type MeshStandardMaterial } from "three";
import { Mic, Move3d, MousePointerClick, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsoleDevice, ConsoleId, ConsoleStatus } from "./consoles";

interface Props {
  consoles: ConsoleDevice[];
  focusedId: ConsoleId | null;
  onFocus: (id: ConsoleId) => void;
}

/**
 * Real 3D OR equipment tower rendered with React Three Fiber. The tower
 * has chassis posts, stacked console modules with bezels / displays /
 * status LEDs, casters at the base, and a cable bundle on the back. The
 * camera orbits freely (limited so the user can't go upside-down) and
 * smoothly dollies toward whichever module is voice-focused.
 *
 * Why R3F over CSS 3D: the previous CSS-3D version read as "tilted
 * cards" — there was no real geometry, no reflective materials, no
 * lighting. A surgeon expecting a tower model needs to *see* hardware:
 * front bezels, side vents, ports, casters. Three.js handles that
 * cleanly. Bundle cost is ~200 kB gzipped, tree-shaken.
 */
export function ConsoleTower3D({ consoles, focusedId, onFocus }: Props) {
  // SSR guard — Canvas accesses window during init.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Booting tower view…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [3.4, 1.4, 4.6], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={[0, 0, 0]} />
        <fog attach="fog" args={["#020205", 6, 16]} />

        <Suspense fallback={null}>
          <Lighting />
          <TowerScene consoles={consoles} focusedId={focusedId} onFocus={onFocus} />
          <CameraRig consoles={consoles} focusedId={focusedId} />

          {/* Soft bloom — only the LEDs, screens, and focus halo (which use
              high emissive intensity / toneMapped:false) cross the
              luminance threshold, so the rest of the tower stays crisp
              instead of going soft. */}
          <EffectComposer>
            <Bloom intensity={0.9} luminanceThreshold={0.45} luminanceSmoothing={0.35} mipmapBlur />
          </EffectComposer>
        </Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={4.0}
          maxDistance={10.0}
          // Keep slight polar limits so the user can't go fully under or
          // upside-down (the floor + ceiling break the illusion if you do).
          minPolarAngle={Math.PI / 3.6}
          maxPolarAngle={Math.PI / 1.7}
          // Full 360° azimuth — no min/max, so the user can spin all the
          // way around and inspect the cable bundle on the back.
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <NavigationLegend />
    </div>
  );
}

// ── Navigation legend (subtle corner overlay) ────────────────────────────

function NavigationLegend() {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-3 right-3 select-none",
        "rounded-lg border border-white/5 bg-black/45 px-3 py-2.5 backdrop-blur-md",
        "shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
      )}
    >
      <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-primary/70">
        Navigate
      </div>
      <div className="flex flex-col gap-1 font-mono text-[10px] tracking-wide text-foreground/70">
        <LegendRow icon={<Move3d className="h-3 w-3" />} label="drag · rotate 360°" />
        <LegendRow icon={<ZoomIn className="h-3 w-3" />} label="scroll · zoom" />
        <LegendRow icon={<MousePointerClick className="h-3 w-3" />} label="tap · focus" />
        <LegendRow icon={<Mic className="h-3 w-3" />} label='"show fluid pump"' />
      </div>
    </div>
  );
}

function LegendRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-4 w-4 items-center justify-center text-primary/80">{icon}</span>
      <span className="lowercase">{label}</span>
    </div>
  );
}

// ── Lighting ──────────────────────────────────────────────────────────────

function Lighting() {
  return (
    <>
      {/* Brighter ambient — was reading too dark. */}
      <ambientLight intensity={0.7} color="#9fb6c8" />
      <directionalLight
        position={[4, 8, 5]}
        intensity={1.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      {/* Cool rim-light from behind for the OR/sci-fi vibe */}
      <directionalLight position={[-5, 4, -4]} intensity={0.7} color="#22d3ee" />
      {/* Cool fill on the opposite side so 360° rotation never reveals a
          dead-flat dark face. */}
      <directionalLight position={[5, 2, -5]} intensity={0.5} color="#a5f3fc" />
      {/* Warm accent point light near the camera console for visual
          interest under bloom. */}
      <pointLight position={[3, 2, 2]} intensity={0.6} color="#fbbf24" />
      {/* Subtle bottom uplight so the chassis casters and base read */}
      <pointLight position={[0, -1, 2]} intensity={0.35} color="#22d3ee" />
    </>
  );
}

// ── Camera animation toward focused module ────────────────────────────────

interface CameraRigProps {
  consoles: ConsoleDevice[];
  focusedId: ConsoleId | null;
}

function CameraRig({ consoles, focusedId }: CameraRigProps) {
  const { camera } = useThree();
  // Compute target Y per module (matches TowerScene layout).
  const moduleYs = useMemo(() => {
    return computeModuleLayout(consoles);
  }, [consoles]);

  const targetY = useRef(0);
  useEffect(() => {
    if (!focusedId) {
      targetY.current = 0;
      return;
    }
    const slot = moduleYs.find((m) => m.id === focusedId);
    if (slot) targetY.current = slot.y;
  }, [focusedId, moduleYs]);

  useFrame(() => {
    // Smoothly drift the orbit target Y toward the focused module so the
    // tower feels alive when Arti is speaking. We don't move the camera
    // itself — OrbitControls orbits around (0, 0, 0) by default and we
    // bias the camera Y a touch.
    camera.position.y = MathUtils.lerp(camera.position.y, 1.4 + targetY.current * 0.35, 0.04);
    camera.lookAt(0, targetY.current * 0.6, 0);
  });

  return null;
}

// ── Tower scene ───────────────────────────────────────────────────────────

interface TowerSceneProps {
  consoles: ConsoleDevice[];
  focusedId: ConsoleId | null;
  onFocus: (id: ConsoleId) => void;
}

const MODULE_WIDTH = 1.7;
const MODULE_DEPTH = 0.55;
const MODULE_GAP = 0.025;
const FRAME_INSET = 0.08;
const POST_THICKNESS = 0.06;
const BASE_HEIGHT = 0.12;

/** Computes the Y position + height for each module. Bottom-up. */
function computeModuleLayout(
  consoles: ConsoleDevice[],
): Array<{ id: ConsoleId; y: number; height: number }> {
  // Tower stacks top-to-bottom in the array. We render bottom-up so the
  // first array entry sits at the top of the stack.
  const reversed = [...consoles].reverse();
  let cursor = BASE_HEIGHT;
  const out: Array<{ id: ConsoleId; y: number; height: number }> = [];
  for (const device of reversed) {
    const h = moduleHeight(device.id);
    out.push({ id: device.id, y: cursor + h / 2, height: h });
    cursor += h + MODULE_GAP;
  }
  return out;
}

function moduleHeight(id: ConsoleId): number {
  // Realistic-feeling proportions matching common arthroscopy stacks:
  // light source / camera CCU are wider; image mgmt / recorder is shorter.
  switch (id) {
    case "light":
      return 0.42;
    case "camera":
      return 0.46;
    case "image":
      return 0.28;
    case "pump":
      return 0.5;
    case "shaver":
      return 0.4;
    case "rf":
      return 0.42;
    default:
      return 0.4;
  }
}

function TowerScene({ consoles, focusedId, onFocus }: TowerSceneProps) {
  const layout = useMemo(() => computeModuleLayout(consoles), [consoles]);
  const reversed = useMemo(() => [...consoles].reverse(), [consoles]);
  const totalHeight = layout[layout.length - 1]?.y ?? 1.5;
  const topY = totalHeight + (layout[layout.length - 1]?.height ?? 0) / 2 + 0.2;

  return (
    <group position={[0, -1.0, 0]}>
      {/* Floor (catches shadows and a soft cyan glow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#0a0d10" metalness={0.4} roughness={0.85} />
      </mesh>
      {/* Soft floor accent */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.9, 1.6, 64]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.06} />
      </mesh>

      {/* Base plate + casters */}
      <Base />

      {/* Frame posts (4 corners) */}
      <Post
        position={[-MODULE_WIDTH / 2 + FRAME_INSET / 2, topY / 2, MODULE_DEPTH / 2 + 0.01]}
        height={topY}
      />
      <Post
        position={[MODULE_WIDTH / 2 - FRAME_INSET / 2, topY / 2, MODULE_DEPTH / 2 + 0.01]}
        height={topY}
      />
      <Post
        position={[-MODULE_WIDTH / 2 + FRAME_INSET / 2, topY / 2, -MODULE_DEPTH / 2 - 0.01]}
        height={topY}
      />
      <Post
        position={[MODULE_WIDTH / 2 - FRAME_INSET / 2, topY / 2, -MODULE_DEPTH / 2 - 0.01]}
        height={topY}
      />

      {/* Top crown */}
      <Crown y={topY} />

      {/* Cable bundle on the back-right post */}
      <CableBundle topY={topY} />

      {/* Modules */}
      {reversed.map((device, i) => (
        <ConsoleModule
          key={device.id}
          device={device}
          y={layout[i].y}
          height={layout[i].height}
          focused={focusedId === device.id}
          onClick={() => onFocus(device.id)}
        />
      ))}
    </group>
  );
}

// ── Tower frame parts ─────────────────────────────────────────────────────

function Post({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={[POST_THICKNESS, height, POST_THICKNESS]} />
      <meshStandardMaterial color="#1a1c20" metalness={0.85} roughness={0.35} />
    </mesh>
  );
}

function Crown({ y }: { y: number }) {
  return (
    <group position={[0, y + 0.08, 0]}>
      {/* Top plate */}
      <RoundedBox
        args={[MODULE_WIDTH + 0.15, 0.08, MODULE_DEPTH + 0.05]}
        radius={0.018}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial color="#15171b" metalness={0.7} roughness={0.4} />
      </RoundedBox>
      {/* Carry handle */}
      <group position={[0, 0.08, 0]}>
        <mesh position={[-0.32, 0.05, 0]} castShadow>
          <boxGeometry args={[0.04, 0.1, 0.04]} />
          <meshStandardMaterial color="#0a0a0d" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0.32, 0.05, 0]} castShadow>
          <boxGeometry args={[0.04, 0.1, 0.04]} />
          <meshStandardMaterial color="#0a0a0d" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.7, 16]} />
          <meshStandardMaterial color="#0a0a0d" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function Base() {
  return (
    <group position={[0, BASE_HEIGHT / 2, 0]}>
      {/* Plate */}
      <RoundedBox
        args={[MODULE_WIDTH + 0.4, BASE_HEIGHT, MODULE_DEPTH + 0.3]}
        radius={0.03}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#101114" metalness={0.7} roughness={0.5} />
      </RoundedBox>
      {/* Casters (4 corners) */}
      {[
        [-MODULE_WIDTH / 2 - 0.05, MODULE_DEPTH / 2 + 0.05],
        [MODULE_WIDTH / 2 + 0.05, MODULE_DEPTH / 2 + 0.05],
        [-MODULE_WIDTH / 2 - 0.05, -MODULE_DEPTH / 2 - 0.05],
        [MODULE_WIDTH / 2 + 0.05, -MODULE_DEPTH / 2 - 0.05],
      ].map(([x, z], i) => (
        <Caster key={i} position={[x, -BASE_HEIGHT / 2 - 0.04, z]} />
      ))}
    </group>
  );
}

function Caster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Bracket */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.07, 0.06, 0.07]} />
        <meshStandardMaterial color="#0a0a0d" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Wheel */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 24]} />
        <meshStandardMaterial color="#0a0a0d" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Hub */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.045, 16]} />
        <meshStandardMaterial color="#3a3f44" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

function CableBundle({ topY }: { topY: number }) {
  // A coiled cable hanging from the top down the back-right post.
  return (
    <group position={[MODULE_WIDTH / 2 - 0.1, 0, -MODULE_DEPTH / 2 - 0.06]}>
      <mesh position={[0, topY * 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, topY * 0.85, 12]} />
        <meshStandardMaterial color="#1a1a1d" metalness={0.2} roughness={0.9} />
      </mesh>
      {/* Coiled hint near the bottom */}
      <mesh position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.08, 0.018, 12, 32]} />
        <meshStandardMaterial color="#1a1a1d" metalness={0.2} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── A single console module ───────────────────────────────────────────────

const STATUS_LED_COLOR: Record<ConsoleStatus, string> = {
  active: "#67e8f9",
  connected: "#34d399",
  standby: "#38bdf8",
  warming: "#fbbf24",
  error: "#fb7185",
  offline: "#52525b",
};

const STATUS_PULSE: Record<ConsoleStatus, boolean> = {
  active: true,
  connected: false,
  standby: false,
  warming: true,
  error: true,
  offline: false,
};

interface ModuleProps {
  device: ConsoleDevice;
  y: number;
  height: number;
  focused: boolean;
  onClick: () => void;
}

function ConsoleModule({ device, y, height, focused, onClick }: ModuleProps) {
  const groupRef = useRef<Group>(null);
  const ledRef = useRef<Mesh>(null);
  const focusGlowRef = useRef<Mesh>(null);
  const ledColor = useMemo(() => new Color(STATUS_LED_COLOR[device.status]), [device.status]);
  const shouldPulse = STATUS_PULSE[device.status];

  // Animate: gentle hover when focused, LED pulse for active states.
  useFrame((state) => {
    if (groupRef.current) {
      const targetZ = focused ? 0.05 : 0;
      groupRef.current.position.z = MathUtils.lerp(groupRef.current.position.z, targetZ, 0.1);
    }
    if (ledRef.current) {
      const mat = ledRef.current.material as MeshStandardMaterial;
      const base = 1.6;
      mat.emissiveIntensity = shouldPulse
        ? base + Math.sin(state.clock.elapsedTime * 3.5) * 0.7
        : base;
    }
    if (focusGlowRef.current) {
      const mat = focusGlowRef.current.material as MeshStandardMaterial;
      const target = focused ? 0.85 : 0;
      mat.opacity = MathUtils.lerp(mat.opacity, target, 0.12);
    }
  });

  return (
    <group ref={groupRef} position={[0, y, 0]} onClick={onClick}>
      {/* Module chassis */}
      <RoundedBox
        args={[MODULE_WIDTH - 0.04, height, MODULE_DEPTH - 0.02]}
        radius={0.014}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#13141a" metalness={0.55} roughness={0.45} />
      </RoundedBox>

      {/* Front bezel — slightly recessed, darker */}
      <mesh position={[0, 0, MODULE_DEPTH / 2 - 0.011]} castShadow>
        <boxGeometry args={[MODULE_WIDTH - 0.18, height - 0.06, 0.012]} />
        <meshStandardMaterial color="#0a0a0d" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Mini display screen on the bezel — emissive so it glows */}
      <mesh position={[-MODULE_WIDTH / 2 + 0.32, 0, MODULE_DEPTH / 2 - 0.003]}>
        <boxGeometry args={[0.42, height - 0.16, 0.005]} />
        <meshStandardMaterial
          color="#020308"
          emissive="#06b6d4"
          emissiveIntensity={0.18}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      {/* Brand text on the bezel (drei <Text>) */}
      <Text
        position={[-MODULE_WIDTH / 2 + 0.32, height / 2 - 0.07, MODULE_DEPTH / 2]}
        fontSize={0.038}
        color="#9fb6c8"
        anchorX="center"
        anchorY="top"
        letterSpacing={0.18}
        font={undefined}
      >
        {device.manufacturer.toUpperCase()}
      </Text>
      <Text
        position={[-MODULE_WIDTH / 2 + 0.32, height / 2 - 0.13, MODULE_DEPTH / 2]}
        fontSize={0.05}
        color="#e2e8f0"
        anchorX="center"
        anchorY="top"
        maxWidth={0.4}
      >
        {device.productLine}
      </Text>
      <Text
        position={[-MODULE_WIDTH / 2 + 0.32, -height / 2 + 0.06, MODULE_DEPTH / 2]}
        fontSize={0.028}
        color="#64748b"
        anchorX="center"
        anchorY="bottom"
        letterSpacing={0.15}
      >
        {device.model.toUpperCase()}
      </Text>

      {/* Status LED + label on the right side of the bezel */}
      <group position={[MODULE_WIDTH / 2 - 0.22, 0, MODULE_DEPTH / 2 - 0.003]}>
        {/* LED dome */}
        <mesh ref={ledRef} position={[0, height / 6, 0]}>
          <sphereGeometry args={[0.025, 24, 24]} />
          <meshStandardMaterial
            color={ledColor}
            emissive={ledColor}
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
        {/* LED ring */}
        <mesh position={[0, height / 6, -0.001]}>
          <ringGeometry args={[0.026, 0.04, 32]} />
          <meshBasicMaterial color={ledColor} transparent opacity={0.35} />
        </mesh>
        <Text
          position={[0, height / 6 - 0.07, 0]}
          fontSize={0.028}
          color="#e2e8f0"
          anchorX="center"
          anchorY="top"
          letterSpacing={0.18}
        >
          {device.status.toUpperCase()}
        </Text>
        <Text
          position={[0, -height / 6, 0]}
          fontSize={0.022}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          maxWidth={0.32}
        >
          {device.statusDetail}
        </Text>
      </group>

      {/* Side ventilation slits — shallow grooves on left + right sides */}
      <VentSlits side="left" height={height} />
      <VentSlits side="right" height={height} />

      {/* Front-panel ports (rotated: a few cylinders flush with front) */}
      <Ports id={device.id} height={height} />

      {/* Focus halo — a thin ring around the module that fades in when focused */}
      <mesh ref={focusGlowRef} position={[0, 0, MODULE_DEPTH / 2 + 0.02]}>
        <planeGeometry args={[MODULE_WIDTH + 0.18, height + 0.18]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={1.2}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>

      {/* HTML tag floating beside the module — only when focused, for clean UI */}
      {focused && (
        <Html
          position={[MODULE_WIDTH / 2 + 0.4, 0, 0]}
          transform
          distanceFactor={2.4}
          occlude={false}
        >
          <div
            className={cn(
              "pointer-events-none rounded-lg border border-primary/50 bg-black/70 px-3 py-1.5 backdrop-blur-md",
              "font-mono text-[10px] uppercase tracking-wider text-primary",
              "whitespace-nowrap",
            )}
          >
            <div>{device.shortName}</div>
            <div className="text-foreground/80">{device.statusDetail}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function VentSlits({ side, height }: { side: "left" | "right"; height: number }) {
  const x = side === "left" ? -MODULE_WIDTH / 2 + 0.012 : MODULE_WIDTH / 2 - 0.012;
  const slits = 5;
  const spacing = (height * 0.7) / slits;
  return (
    <group>
      {Array.from({ length: slits }).map((_, i) => (
        <mesh
          key={i}
          position={[x, -height * 0.35 + i * spacing + spacing / 2, 0]}
          rotation={[0, side === "left" ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <planeGeometry args={[MODULE_DEPTH * 0.7, 0.012]} />
          <meshBasicMaterial color="#000" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Ports({ id, height }: { id: ConsoleId; height: number }) {
  // Each module gets a small set of recessed ports so the front face has
  // some hardware character. Counts/positions vary loosely by device type.
  const portColor = "#22272d";
  const accentColor = "#0a0a0d";
  const z = MODULE_DEPTH / 2 - 0.005;
  const ringColor = "#3a3f44";

  // Portion of the bezel right side allocated for ports
  const xBase = 0.28;
  const positions: Array<[number, number, number]> = (() => {
    switch (id) {
      case "camera":
        return [
          [xBase, height / 4, z],
          [xBase + 0.12, height / 4, z],
        ];
      case "pump":
        return [
          [xBase, height / 5, z],
          [xBase + 0.13, height / 5, z],
        ];
      case "shaver":
        return [[xBase + 0.05, height / 6, z]];
      case "rf":
        return [[xBase + 0.05, height / 6, z]];
      case "light":
        return [
          [xBase, height / 6, z],
          [xBase + 0.12, height / 6, z],
        ];
      default:
        return [];
    }
  })();

  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={p}>
          {/* Outer ring */}
          <mesh>
            <cylinderGeometry args={[0.038, 0.038, 0.008, 24]} />
            <meshStandardMaterial color={ringColor} metalness={0.9} roughness={0.25} />
          </mesh>
          {/* Inner socket (recessed) */}
          <mesh position={[0, 0, -0.005]}>
            <cylinderGeometry args={[0.028, 0.028, 0.01, 24]} />
            <meshStandardMaterial color={portColor} metalness={0.6} roughness={0.5} />
          </mesh>
          {/* Pin highlight */}
          <mesh position={[0, 0, -0.008]}>
            <cylinderGeometry args={[0.008, 0.008, 0.012, 12]} />
            <meshStandardMaterial color={accentColor} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
