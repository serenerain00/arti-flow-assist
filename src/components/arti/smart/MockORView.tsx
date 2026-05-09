import { useMemo } from "react";
import type { PropertyValue } from "./devices";

/**
 * Top-down stylized OR room. Responds live to the lighting devices'
 * state — boom lights cast bright pools, ambient lights warm the room
 * floor, x-ray viewer glows on the wall when on.
 *
 * Pure SVG so it scales with its container without a canvas mount cost.
 */

interface DeviceStates {
  [deviceId: string]: Record<string, PropertyValue>;
}

interface Props {
  deviceStates: DeviceStates;
  /** Optional id to highlight (the device the user is configuring). */
  focusDeviceId?: string;
}

/** Convert a Kelvin temperature to an approximate sRGB hex. */
function kelvinToHex(k: number): string {
  // Fast approximation — good enough for visual feedback. Curves from
  // Tanner Helland's blackbody formula.
  const t = k / 100;
  const r = t <= 66 ? 255 : clamp255(329.698727446 * Math.pow(t - 60, -0.1332047592));
  const g =
    t <= 66
      ? clamp255(99.4708025861 * Math.log(t) - 161.1195681661)
      : clamp255(288.1221695283 * Math.pow(t - 60, -0.0755148492));
  const b =
    t >= 66 ? 255 : t <= 19 ? 0 : clamp255(138.5177312231 * Math.log(t - 10) - 305.0447927307);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n));
}

/** Pull a property safely with a fallback. */
function pv(
  state: Record<string, PropertyValue> | undefined,
  key: string,
  fallback: PropertyValue,
): PropertyValue {
  if (!state) return fallback;
  const v = state[key];
  return v === undefined ? fallback : v;
}

export function MockORView({ deviceStates, focusDeviceId }: Props) {
  const boom1 = deviceStates["lighting.surgical-boom-1"];
  const boom2 = deviceStates["lighting.surgical-boom-2"];
  const ambient = deviceStates["lighting.ambient"];
  const xray = deviceStates["lighting.xray-viewer"];
  const wall = deviceStates["displays.wall"];
  const surgeonMonitor = deviceStates["displays.surgeon-monitor"];
  const door = deviceStates["doors.main"];

  // Derived per-light values. Multiply on×brightness so the off state
  // collapses cleanly to zero.
  const boom1Lit = (+(pv(boom1, "on", true) ? 1 : 0) * Number(pv(boom1, "brightness", 90))) / 100;
  const boom2Lit = (+(pv(boom2, "on", true) ? 1 : 0) * Number(pv(boom2, "brightness", 80))) / 100;
  const ambientLit =
    (+(pv(ambient, "on", true) ? 1 : 0) * Number(pv(ambient, "brightness", 35))) / 100;
  const xrayLit = (+(pv(xray, "on", false) ? 1 : 0) * Number(pv(xray, "brightness", 70))) / 100;

  const boom1Spot = Number(pv(boom1, "spot_size", 50)) / 100;
  const boom2Spot = Number(pv(boom2, "spot_size", 65)) / 100;

  const boom1Color = kelvinToHex(Number(pv(boom1, "color_temp", 5000)));
  const boom2Color = kelvinToHex(Number(pv(boom2, "color_temp", 5000)));
  const ambientColor = kelvinToHex(Number(pv(ambient, "color_temp", 4000)));

  const wallOn = !!pv(wall, "on", true);
  const wallBrightness = Number(pv(wall, "brightness", 85)) / 100;
  const surgeonMonOn = !!pv(surgeonMonitor, "on", true);
  const surgeonMonBrightness = Number(pv(surgeonMonitor, "brightness", 92)) / 100;

  const doorLocked = !!pv(door, "locked", false);

  // Floor-tone driven by ambient brightness — at 0% the room looks like
  // a dim cool slate, at 100% it brightens with the ambient color temp.
  const floorAlpha = 0.08 + ambientLit * 0.4;
  const ringHighlight = useMemo(() => (focusDeviceId ? focusDeviceId : null), [focusDeviceId]);

  const isFocused = (id: string) => ringHighlight === id;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border/60 bg-[#06070b]">
      <svg viewBox="0 0 600 400" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="boom1-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={boom1Color} stopOpacity={0.95} />
            <stop offset="55%" stopColor={boom1Color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={boom1Color} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="boom2-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={boom2Color} stopOpacity={0.95} />
            <stop offset="55%" stopColor={boom2Color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={boom2Color} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="ambient-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ambientColor} stopOpacity={0.55} />
            <stop offset="100%" stopColor={ambientColor} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="wall-display-on" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5 * wallBrightness} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.85 * wallBrightness} />
          </linearGradient>
        </defs>

        {/* Room outline */}
        <rect
          x="20"
          y="20"
          width="560"
          height="360"
          rx="20"
          fill="#0c0e14"
          stroke="#1f2433"
          strokeWidth="1.5"
        />

        {/* Ambient floor wash — cone of color from ceiling cove */}
        <rect
          x="40"
          y="40"
          width="520"
          height="320"
          rx="14"
          fill={ambientColor}
          opacity={floorAlpha}
        />

        {/* Ambient cove highlights at four corners */}
        {[
          { cx: 90, cy: 70 },
          { cx: 510, cy: 70 },
          { cx: 90, cy: 330 },
          { cx: 510, cy: 330 },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={70 + ambientLit * 30}
            fill="url(#ambient-glow)"
            opacity={0.4 + ambientLit * 0.6}
          />
        ))}

        {/* Wall display (top wall) */}
        <g>
          <rect
            x="220"
            y="36"
            width="160"
            height="22"
            rx="3"
            fill={wallOn ? "url(#wall-display-on)" : "#1a1f2c"}
            stroke={isFocused("displays.wall") ? "#5b8ef0" : "#2a3142"}
            strokeWidth={isFocused("displays.wall") ? 2 : 1}
          />
          <text
            x="300"
            y="51"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="9"
            fill="#cbd5e1"
            opacity={wallOn ? 0.85 : 0.3}
          >
            ARTI WALL · {wallOn ? "ON" : "OFF"}
          </text>
        </g>

        {/* X-ray viewer (right wall) */}
        <g>
          <rect
            x="540"
            y="160"
            width="20"
            height="80"
            rx="3"
            fill={xrayLit > 0 ? "#fef3c7" : "#1a1f2c"}
            opacity={xrayLit > 0 ? 0.55 + xrayLit * 0.45 : 1}
            stroke={isFocused("lighting.xray-viewer") ? "#5b8ef0" : "#2a3142"}
            strokeWidth={isFocused("lighting.xray-viewer") ? 2 : 1}
          />
          {xrayLit > 0 && (
            <circle cx="550" cy="200" r={28 * xrayLit} fill="#fef3c7" opacity={0.18 * xrayLit} />
          )}
        </g>

        {/* Door (bottom wall) */}
        <g>
          <rect
            x="280"
            y="362"
            width="40"
            height="18"
            rx="2"
            fill={doorLocked ? "#dc2626" : "#1f2433"}
            opacity={doorLocked ? 0.35 : 1}
            stroke={isFocused("doors.main") ? "#5b8ef0" : "#2a3142"}
            strokeWidth={isFocused("doors.main") ? 2 : 1}
          />
          {doorLocked && (
            <text
              x="300"
              y="376"
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="8"
              fill="#fee2e2"
            >
              LOCKED
            </text>
          )}
        </g>

        {/* OR table — rounded rectangle in the center */}
        <g transform="translate(300 200)">
          <rect
            x="-65"
            y="-22"
            width="130"
            height="44"
            rx="10"
            fill="#3a4153"
            stroke="#5b6275"
            strokeWidth="1"
          />
          <rect x="-55" y="-15" width="110" height="30" rx="6" fill="#566075" />
          <text
            x="0"
            y="38"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="9"
            fill="#94a3b8"
            opacity={0.6}
          >
            OR Table
          </text>
        </g>

        {/* Surgeon monitor (right side) */}
        <g>
          <rect
            x="430"
            y="170"
            width="55"
            height="40"
            rx="3"
            fill={surgeonMonOn ? "#2563eb" : "#1a1f2c"}
            opacity={surgeonMonOn ? 0.4 + surgeonMonBrightness * 0.55 : 1}
            stroke={isFocused("displays.surgeon-monitor") ? "#5b8ef0" : "#2a3142"}
            strokeWidth={isFocused("displays.surgeon-monitor") ? 2 : 1}
          />
        </g>

        {/* Boom 1 — left side, pointed at table head */}
        <BoomLight
          cx={210}
          cy={170}
          spot={boom1Spot}
          lit={boom1Lit}
          color={boom1Color}
          fixtureColor="#94a3b8"
          focused={isFocused("lighting.surgical-boom-1")}
          gradientId="boom1-glow"
          label="Boom 1"
        />

        {/* Boom 2 — right side, pointed at table foot */}
        <BoomLight
          cx={390}
          cy={230}
          spot={boom2Spot}
          lit={boom2Lit}
          color={boom2Color}
          fixtureColor="#94a3b8"
          focused={isFocused("lighting.surgical-boom-2")}
          gradientId="boom2-glow"
          label="Boom 2"
        />
      </svg>

      {/* Header overlay */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-white/85 backdrop-blur">
        Mock OR · Live Preview
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-white/55">
        <span>Top-down view · OR 326</span>
        <span>Reflects current Smart Settings</span>
      </div>
    </div>
  );
}

function BoomLight({
  cx,
  cy,
  spot,
  lit,
  color,
  fixtureColor,
  focused,
  gradientId,
  label,
}: {
  cx: number;
  cy: number;
  spot: number;
  lit: number;
  color: string;
  fixtureColor: string;
  focused: boolean;
  gradientId: string;
  label: string;
}) {
  // Spot pool size grows with both spot_size and brightness so a tight
  // bright pool reads as a sharp focused beam, while a wide low one is
  // a soft fill.
  const pool = (40 + spot * 90) * (lit > 0 ? 1 : 0.001);
  return (
    <g>
      {/* Light pool */}
      {lit > 0 && (
        <circle cx={cx} cy={cy} r={pool} fill={`url(#${gradientId})`} opacity={0.5 + lit * 0.5} />
      )}
      {/* Fixture body — small disc with bezel */}
      <circle
        cx={cx}
        cy={cy}
        r={focused ? 16 : 14}
        fill="#0c0e14"
        stroke={focused ? "#5b8ef0" : fixtureColor}
        strokeWidth={focused ? 2.5 : 1.5}
      />
      <circle
        cx={cx}
        cy={cy}
        r={9}
        fill={lit > 0 ? color : "#1f2433"}
        opacity={lit > 0 ? 0.4 + lit * 0.6 : 1}
      />
      <text
        x={cx}
        y={cy + 28}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize="9"
        fill="#94a3b8"
        opacity={0.7}
      >
        {label}
      </text>
    </g>
  );
}
