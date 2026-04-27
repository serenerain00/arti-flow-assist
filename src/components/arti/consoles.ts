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

export type ConsoleStatus = "active" | "connected" | "standby" | "warming" | "error" | "offline";

export interface ConsoleTelemetry {
  label: string;
  value: string;
  /** Optional secondary value (e.g. "200 mL/min" alongside "60 mmHg"). */
  detail?: string;
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
 * Plain-text summary of every console's state. Embedded in the route's
 * live context when on the consoles screen so Claude can answer
 * "is the fluid pump connected?" with the actual telemetry.
 */
export function summarizeConsoles(focusedId?: ConsoleId | null): string {
  const lines = CONSOLES.map((c) => {
    const focusMark = focusedId === c.id ? " [FOCUSED]" : "";
    const attach = c.attachments.length ? ` · attachments: ${c.attachments.join(", ")}` : "";
    return `  - ${c.shortName} (${c.manufacturer} ${c.model}): ${c.status.toUpperCase()} — ${c.statusDetail}${attach}${focusMark}`;
  });
  return ["OR tower consoles:", ...lines].join("\n");
}
