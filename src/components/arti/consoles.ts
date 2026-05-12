/**
 * OR tower equipment status — mock data for the prototype.
 *
 * Modeled on a typical Arthrex arthroscopy tower stack so the procedure
 * videos in the how-to library and the consoles on screen tell a
 * coherent brand story. Real towers vary by hospital but this is a
 * representative shoulder-arthroscopy room: light source on top, then
 * camera CCU, image mgmt, fluid pump, shaver, RF console at the bottom.
 *
 * Status semantics:
 *   active     — currently driving an instrument (pulsing primary).
 *   connected  — cable/handshake good, idle (steady green).
 *   standby    — powered but not engaged (steady blue).
 *   warming    — initializing / lamp warm-up / fluid prime (pulsing amber).
 *   error      — fault state, requires attention (pulsing red).
 *   offline    — no connection / device off (dim gray).
 */
export type ConsoleId = "light" | "camera" | "image" | "pump" | "shaver" | "rf";

/** Joints the DualWave pump has presets for. */
export type FluidPumpJoint = "shoulder" | "knee" | "hip" | "ankle" | "elbow" | "wrist";

/** Default pressure / flow / mode-label for each joint preset. */
export const FLUID_PUMP_PRESETS: Record<
  FluidPumpJoint,
  { pressureMmHg: number; flowMlMin: number; modeLabel: string }
> = {
  shoulder: { pressureMmHg: 60, flowMlMin: 200, modeLabel: "Shoulder · standard" },
  knee: { pressureMmHg: 50, flowMlMin: 250, modeLabel: "Knee · standard" },
  hip: { pressureMmHg: 80, flowMlMin: 300, modeLabel: "Hip · high-flow" },
  ankle: { pressureMmHg: 50, flowMlMin: 200, modeLabel: "Ankle · low-pressure" },
  elbow: { pressureMmHg: 40, flowMlMin: 150, modeLabel: "Elbow · gentle" },
  wrist: { pressureMmHg: 30, flowMlMin: 100, modeLabel: "Wrist · gentle" },
};

/** Resolve a free-text joint name (voice) to the canonical enum. */
export function resolveFluidPumpJoint(query?: string): FluidPumpJoint | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  if (/shoulder/.test(q)) return "shoulder";
  if (/knee/.test(q)) return "knee";
  if (/hip/.test(q)) return "hip";
  if (/ankle/.test(q)) return "ankle";
  if (/elbow/.test(q)) return "elbow";
  if (/wrist/.test(q)) return "wrist";
  return undefined;
}

export type ConsoleStatus = "active" | "connected" | "standby" | "warming" | "error" | "offline";

export interface ConsoleTelemetry {
  label: string;
  value: string;
  /** Optional secondary value (e.g. "200 mL/min" alongside "60 mmHg"). */
  detail?: string;
}

export interface ConsoleBackup {
  /** Display name of the backup device. */
  name: string;
  /** Where the backup lives (room/cart/storage). */
  location: string;
  /** True if a backup is on-hand and ready to swap in. */
  available: boolean;
}

export interface ConsoleDevice {
  id: ConsoleId;
  /** Compact name used in voice + cards. */
  shortName: string;
  /** Full descriptor surfaced on the tower's front panel. */
  fullName: string;
  manufacturer: string;
  model: string;
  /** Product line / family (Synergy, DualWave, APS, etc). */
  productLine: string;
  status: ConsoleStatus;
  /**
   * Short single-line status detail for the HUD label
   * (e.g. "75% · 612 lamp hr", "60 mmHg / 200 mL/min").
   */
  statusDetail: string;
  /** Devices currently plugged into this console (camera heads, blades, etc). */
  attachments: string[];
  /** Detailed key/value readouts shown in the right-hand detail panel. */
  telemetry: ConsoleTelemetry[];
  /**
   * Lower-case voice keywords so "fluid pump", "pump", "arthroscopic pump",
   * "fluid management" all resolve to the same console.
   */
  tags: string[];
  /**
   * Ordered troubleshooting steps surfaced by the Equipment Failure modal
   * when this console drops to status === "error" or "offline".
   */
  troubleshooting?: string[];
  /** Backup device the room can fall back to if this console is unrecoverable. */
  backup?: ConsoleBackup;
}

export const CONSOLES: ConsoleDevice[] = [
  {
    id: "light",
    shortName: "Light Source",
    fullName: "SynergyUHD4 LED Light Source",
    manufacturer: "Arthrex",
    model: "AR-3210-0029",
    productLine: "Synergy",
    status: "active",
    statusDetail: "75% intensity · 612 lamp hr",
    attachments: ["Light cable A", "Light cable B (idle)"],
    telemetry: [
      { label: "Output intensity", value: "75%" },
      { label: "Lamp hours", value: "612 hr", detail: "of 30,000 rated" },
      { label: "Color temperature", value: "5,600 K" },
      { label: "Cable A", value: "Connected · in use" },
      { label: "Cable B", value: "Connected · idle" },
    ],
    tags: ["light", "light source", "lamp", "led", "illumination", "synergy light", "uhd light"],
    troubleshooting: [
      "Verify cable A is fully seated in the source and the scope.",
      "Cycle the source — power off, wait 10 seconds, power on.",
      "Swap to cable B (currently idle, confirmed connected).",
      "If lamp fault persists, swap to backup source on Cart 2.",
    ],
    backup: {
      name: "SynergyUHD4 Light Source · backup unit",
      location: "Equipment Cart 2 · sub-sterile core",
      available: true,
    },
  },
  {
    id: "camera",
    shortName: "Camera Console",
    fullName: "Synergy 4K Camera Control Unit",
    manufacturer: "Arthrex",
    model: "AR-3200-0023",
    productLine: "Synergy",
    status: "active",
    statusDetail: "4K head live · Nano standby",
    attachments: ["4K Synergy camera head", "Nano arthroscopic camera"],
    telemetry: [
      { label: "Primary head", value: "4K Synergy", detail: "Live · 60 fps" },
      { label: "Secondary head", value: "Nano", detail: "Standby" },
      { label: "White balance", value: "Calibrated", detail: "21:43 ago" },
      { label: "Output", value: "4K HDR · SDI + DisplayPort" },
      { label: "Recording", value: "Armed (not recording)" },
    ],
    tags: [
      "camera",
      "camera console",
      "camera control",
      "ccu",
      "4k",
      "synergy",
      "synergy 4k",
      "4k camera",
      "nano",
      "nano camera",
      "endoscope",
      "scope",
    ],
    troubleshooting: [
      "Confirm the 4K camera head cable is fully seated at the CCU.",
      "Power-cycle the CCU — hold standby for 5 seconds, then re-enable.",
      "Swap to the Nano arthroscopic camera on the secondary input.",
      "If signal does not return, switch to the backup CCU on Cart 2.",
    ],
    backup: {
      name: "Synergy 4K CCU · backup unit",
      location: "Equipment Cart 2 · sub-sterile core",
      available: true,
    },
  },
  {
    id: "image",
    shortName: "Image Mgmt",
    fullName: "Synergy ID Image Management",
    manufacturer: "Arthrex",
    model: "AR-3210-0040",
    productLine: "Synergy",
    status: "standby",
    statusDetail: "Recording armed · 0 captures",
    attachments: ["Footswitch", "USB drive (32 GB free)"],
    telemetry: [
      { label: "Recording", value: "Armed (not recording)" },
      { label: "Captures this case", value: "0 stills · 0 clips" },
      { label: "Storage", value: "32 GB free", detail: "of 64 GB" },
      { label: "Patient context", value: "Marcus Chen · MRN 4419201" },
      { label: "Footswitch", value: "Connected" },
    ],
    tags: [
      "image",
      "image mgmt",
      "image management",
      "synergy id",
      "recorder",
      "recording",
      "media",
      "captures",
      "stills",
    ],
    troubleshooting: [
      "Re-seat the footswitch cable at the back of the console.",
      "Confirm the USB drive is inserted and not write-locked.",
      "Cycle network — patient context syncs over the OR VLAN.",
    ],
    backup: {
      name: "Synergy ID · spare recorder",
      location: "Bio-med · pickup ETA 8 min",
      available: false,
    },
  },
  {
    id: "pump",
    shortName: "Fluid Pump",
    fullName: "DualWave Arthroscopy Pump",
    manufacturer: "Arthrex",
    model: "AR-6480",
    productLine: "DualWave",
    status: "active",
    statusDetail: "60 mmHg · 200 mL/min",
    attachments: ["Inflow tubing set", "Outflow tubing set"],
    telemetry: [
      { label: "Pressure setpoint", value: "60 mmHg" },
      { label: "Flow rate", value: "200 mL/min" },
      { label: "Saline bag", value: "Bag 1 of 2", detail: "1.4 L remaining" },
      { label: "Tubing set", value: "Single-use · this case" },
      { label: "Mode", value: "Shoulder · standard" },
    ],
    tags: [
      "pump",
      "fluid",
      "fluid pump",
      "fluid management",
      "arthroscopic pump",
      "arthroscopy pump",
      "irrigation",
      "saline",
      "dualwave",
      "ar-6480",
    ],
    troubleshooting: [
      "Check that both inflow and outflow tubing sets are clamped open.",
      "Confirm the saline bag is spiked and above pump level.",
      "Re-prime the pump (hold Prime for 3 seconds).",
      "If pressure does not stabilize, switch to backup pump on Cart 2.",
    ],
    backup: {
      name: "DualWave Pump · backup unit",
      location: "Equipment Cart 2 · sub-sterile core",
      available: true,
    },
  },
  {
    id: "shaver",
    shortName: "Shaver Console",
    fullName: "APS II Shaver / Burr Console",
    manufacturer: "Arthrex",
    model: "AR-8300",
    productLine: "APS",
    status: "standby",
    statusDetail: "Blade loaded · 0 RPM",
    attachments: ["4.5 mm aggressive shaver", "5.5 mm round burr"],
    telemetry: [
      { label: "Active handpiece", value: "4.5 mm aggressive shaver" },
      { label: "RPM setpoint", value: "3,000 RPM", detail: "Forward · oscillate" },
      { label: "Current draw", value: "0 W", detail: "Foot pedal disengaged" },
      { label: "Backup blade", value: "5.5 mm round burr", detail: "Ready" },
      { label: "Mode", value: "Shoulder soft tissue" },
    ],
    tags: [
      "shaver",
      "shaver console",
      "burr",
      "burr console",
      "blade",
      "aps",
      "aps ii",
      "ar-8300",
      "power instrument",
      "power console",
    ],
    troubleshooting: [
      "Re-seat the handpiece at the console — listen for the click.",
      "Verify the footpedal cable is locked at the rear panel.",
      "Swap to the 5.5 mm round burr handpiece (currently loaded, ready).",
    ],
    backup: {
      name: "APS II Shaver · backup unit",
      location: "Equipment Cart 2 · sub-sterile core",
      available: true,
    },
  },
  {
    id: "rf",
    shortName: "RF Console",
    fullName: "Quantum 2 Radiofrequency Generator",
    manufacturer: "Arthrex",
    model: "AR-9700",
    productLine: "Quantum",
    status: "connected",
    statusDetail: "35 W · coag · pedal idle",
    attachments: ["Quantum 50° wand"],
    telemetry: [
      { label: "Mode", value: "Coag" },
      { label: "Power", value: "35 W" },
      { label: "Wand", value: "Quantum 50°", detail: "Bipolar · single-use" },
      { label: "Foot pedal", value: "Idle" },
      { label: "Return electrode", value: "Not required (bipolar)" },
    ],
    tags: [
      "rf",
      "rf console",
      "radiofrequency",
      "ablation",
      "coag",
      "coagulation",
      "quantum",
      "quantum 2",
      "ar-9700",
      "wand",
    ],
    troubleshooting: [
      "Confirm the wand is fully seated in the front-panel port.",
      "Cycle the generator — standby off, wait 5 seconds, standby on.",
      "Swap to the spare Quantum 50° wand on the back table.",
    ],
    backup: {
      name: "Quantum 2 Generator · backup unit",
      location: "Equipment Cart 2 · sub-sterile core",
      available: true,
    },
  },
];

/**
 * Resolve a free-text query (from voice) to a single console. Tries:
 *   1. Exact tag match (high confidence)
 *   2. Substring match against tags
 *   3. Substring match against fullName / model
 */
export function findConsole(query?: string): ConsoleDevice | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  if (!q) return undefined;

  // Exact tag hit first.
  const exact = CONSOLES.find((c) => c.tags.includes(q));
  if (exact) return exact;

  // Tag substring hit (e.g. "the fluid pump please" → "fluid pump" tag).
  const taggedSub = CONSOLES.find((c) => c.tags.some((t) => q.includes(t)));
  if (taggedSub) return taggedSub;

  // Fallback: name / model substring.
  return CONSOLES.find(
    (c) =>
      q.includes(c.shortName.toLowerCase()) ||
      q.includes(c.fullName.toLowerCase()) ||
      q.includes(c.model.toLowerCase()),
  );
}

/**
 * Plain-text summary of every console's state.
 *
 * Two flavors:
 *   • lean (default) — ONE line per console with status + statusDetail.
 *     Sent on every voice request from screens where consoles aren't the
 *     focus, so Claude can still answer "is the pump connected?" from
 *     anywhere without paying for detailed telemetry every turn.
 *   • detailed (verbose=true) — adds the full key/value telemetry block
 *     for the focused console only. Used when the user is actually on
 *     the consoles screen, so detail is justified.
 *
 * The lean form runs ~80 tokens; the detailed form ~250 tokens. Sending
 * lean from non-consoles screens shaves measurable Claude turn-1
 * latency — input tokens directly feed processing time even with
 * prompt caching since live context isn't cached.
 */
export function summarizeConsoles(
  focusedId?: ConsoleId | null,
  options: { verbose?: boolean } = {},
): string {
  const { verbose = false } = options;
  const lines = CONSOLES.flatMap((c) => {
    const focusMark = focusedId === c.id ? " [FOCUSED]" : "";
    const attach = c.attachments.length ? ` · ${c.attachments.join(", ")}` : "";
    const head = `  - ${c.shortName}: ${c.status.toUpperCase()} — ${c.statusDetail}${attach}${focusMark}`;
    // Detailed key/value telemetry only when verbose AND for the
    // focused console. Other consoles stay one-line even in verbose.
    if (!verbose || focusedId !== c.id) return [head];
    const tele = c.telemetry
      .map((t) => `      • ${t.label}: ${t.value}${t.detail ? ` (${t.detail})` : ""}`)
      .join("\n");
    return [head, tele];
  });
  return ["OR tower consoles:", ...lines].join("\n");
}
