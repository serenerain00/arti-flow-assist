/**
 * Smart-device data model for the Admin → Smart Settings screen.
 *
 * The model is deliberately small: each device is a flat object whose
 * `properties` map names → primitive values, and whose `propertySpecs`
 * describes how to render + clamp each control. The UI is generic — any
 * new device just adds a registry entry.
 */

export type DeviceCategory = "lighting" | "displays" | "environment" | "audio" | "doors";

/** Discriminated union over property kinds the renderer understands. */
export type PropertySpec =
  | {
      kind: "toggle";
      key: string;
      label: string;
      sublabel?: string;
    }
  | {
      kind: "percent";
      key: string;
      label: string;
      sublabel?: string;
      /** Optional unit suffix shown next to the live value (default "%"). */
      unit?: string;
      /** Min/max clamp; defaults to 0..100. */
      min?: number;
      max?: number;
      /** Step size for the slider; defaults to 1. */
      step?: number;
    }
  | {
      kind: "select";
      key: string;
      label: string;
      sublabel?: string;
      options: Array<{ value: string; label: string }>;
    }
  | {
      kind: "kelvin";
      key: string;
      label: string;
      sublabel?: string;
      /** Min..max in Kelvin; defaults 2700..6500 (warm to cool). */
      min?: number;
      max?: number;
      step?: number;
    };

export type PropertyValue = boolean | number | string;

export interface SmartDevice {
  id: string;
  /** Display name shown in the sidebar / device list. */
  name: string;
  /** Short description shown under the name. */
  description: string;
  category: DeviceCategory;
  /** Optional grouping label inside a category (e.g. "Surgical Field"). */
  group?: string;
  /** Property specs the UI renders. Order is preserved. */
  propertySpecs: PropertySpec[];
  /** Initial values keyed by property key. */
  defaults: Record<string, PropertyValue>;
}

export const CATEGORY_META: Record<DeviceCategory, { label: string; blurb: string }> = {
  lighting: {
    label: "Lighting",
    blurb: "Surgical, ambient, and task lighting fixtures.",
  },
  displays: {
    label: "Displays",
    blurb: "OR wall, surgeon, and anesthesia monitors.",
  },
  environment: {
    label: "Environment",
    blurb: "Temperature, humidity, and airflow setpoints.",
  },
  audio: {
    label: "Audio",
    blurb: "Music, intercom, and microphone gain.",
  },
  doors: {
    label: "Access",
    blurb: "Door locks and sterile Live Case access controls.",
  },
};

/** Order of categories in the left nav. */
export const CATEGORY_ORDER: DeviceCategory[] = [
  "lighting",
  "displays",
  "environment",
  "audio",
  "doors",
];

// ─────────────────────────────────────────────────────────────────────────
// Seed devices. Add new ones here — the UI picks them up automatically.
// ─────────────────────────────────────────────────────────────────────────

export const DEVICES: SmartDevice[] = [
  // ── Lighting ────────────────────────────────────────────────────────
  {
    id: "lighting.surgical-boom-1",
    name: "Surgical Light · Boom 1",
    description: "Primary surgical light over the table head.",
    category: "lighting",
    group: "Surgical Field",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      {
        kind: "percent",
        key: "brightness",
        label: "Brightness",
        sublabel: "Field illumination",
      },
      {
        kind: "kelvin",
        key: "color_temp",
        label: "Color Temperature",
        sublabel: "Warm 2700K · Cool 6500K",
      },
      {
        kind: "percent",
        key: "spot_size",
        label: "Spot Size",
        sublabel: "Tight (0%) → Wide (100%)",
      },
    ],
    defaults: { on: true, brightness: 90, color_temp: 5000, spot_size: 50 },
  },
  {
    id: "lighting.surgical-boom-2",
    name: "Surgical Light · Boom 2",
    description: "Secondary surgical light over the table foot.",
    category: "lighting",
    group: "Surgical Field",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      {
        kind: "percent",
        key: "brightness",
        label: "Brightness",
        sublabel: "Field illumination",
      },
      {
        kind: "kelvin",
        key: "color_temp",
        label: "Color Temperature",
        sublabel: "Warm 2700K · Cool 6500K",
      },
      {
        kind: "percent",
        key: "spot_size",
        label: "Spot Size",
        sublabel: "Tight (0%) → Wide (100%)",
      },
    ],
    defaults: { on: true, brightness: 80, color_temp: 5000, spot_size: 65 },
  },
  {
    id: "lighting.ambient",
    name: "Ambient Room Lights",
    description: "Ceiling cove lighting around the room perimeter.",
    category: "lighting",
    group: "Room",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      {
        kind: "percent",
        key: "brightness",
        label: "Brightness",
        sublabel: "Background light level",
      },
      {
        kind: "kelvin",
        key: "color_temp",
        label: "Color Temperature",
      },
    ],
    defaults: { on: true, brightness: 35, color_temp: 4000 },
  },
  {
    id: "lighting.xray-viewer",
    name: "X-Ray Viewer Box",
    description: "Wall-mounted radiograph illuminator.",
    category: "lighting",
    group: "Room",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      {
        kind: "percent",
        key: "brightness",
        label: "Brightness",
      },
    ],
    defaults: { on: false, brightness: 70 },
  },

  // ── Displays ────────────────────────────────────────────────────────
  {
    id: "displays.wall",
    name: "OR Wall Display",
    description: "The main multi-view wall — Arti's primary surface.",
    category: "displays",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      { kind: "percent", key: "brightness", label: "Brightness" },
      {
        kind: "select",
        key: "layout",
        label: "Default layout",
        sublabel: "Restored on power-on",
        options: [
          { value: "intraop", label: "Intraop dashboard" },
          { value: "multiview", label: "Multi-view (4-quadrant)" },
          { value: "imaging", label: "Imaging primary" },
        ],
      },
    ],
    defaults: { on: true, brightness: 85, layout: "intraop" },
  },
  {
    id: "displays.surgeon-monitor",
    name: "Surgeon's Primary Monitor",
    description: "Sterile-side surgeon arthroscopy/imaging monitor.",
    category: "displays",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      { kind: "percent", key: "brightness", label: "Brightness" },
      {
        kind: "select",
        key: "input",
        label: "Input source",
        options: [
          { value: "scope", label: "Arthroscope" },
          { value: "fluoro", label: "Fluoroscopy" },
          { value: "mri", label: "MRI" },
          { value: "ct", label: "CT" },
        ],
      },
    ],
    defaults: { on: true, brightness: 92, input: "scope" },
  },
  {
    id: "displays.anesthesia-mirror",
    name: "Anesthesia Mirror Display",
    description: "Mirror of the vitals monitor for the anesthesia team.",
    category: "displays",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      { kind: "percent", key: "brightness", label: "Brightness" },
    ],
    defaults: { on: true, brightness: 75 },
  },

  // ── Environment ─────────────────────────────────────────────────────
  {
    id: "environment.thermostat",
    name: "Thermostat",
    description: "Room temperature setpoint (target band 21–23°C).",
    category: "environment",
    propertySpecs: [
      {
        kind: "percent",
        key: "setpoint",
        label: "Setpoint",
        sublabel: "Range 18–26°C",
        min: 18,
        max: 26,
        step: 0.5,
        unit: "°C",
      },
    ],
    defaults: { setpoint: 21.5 },
  },
  {
    id: "environment.humidity",
    name: "Humidity Control",
    description: "Target relative humidity (band 30–60%).",
    category: "environment",
    propertySpecs: [
      {
        kind: "percent",
        key: "target",
        label: "Target RH",
        min: 30,
        max: 60,
      },
    ],
    defaults: { target: 48 },
  },
  {
    id: "environment.hepa",
    name: "HEPA Airflow",
    description: "Air-exchange rate over the sterile field.",
    category: "environment",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Filtration" },
      {
        kind: "percent",
        key: "exchanges",
        label: "Exchanges per hour",
        min: 15,
        max: 30,
        unit: "/hr",
      },
    ],
    defaults: { on: true, exchanges: 20 },
  },

  // ── Audio ───────────────────────────────────────────────────────────
  {
    id: "audio.music",
    name: "Room Music",
    description: "Background music for the team during the case.",
    category: "audio",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Power" },
      { kind: "percent", key: "volume", label: "Volume" },
      {
        kind: "select",
        key: "playlist",
        label: "Playlist",
        options: [
          { value: "ambient", label: "Ambient" },
          { value: "classical", label: "Classical" },
          { value: "lofi", label: "Lo-Fi" },
          { value: "surgeon-pick", label: "Surgeon's pick" },
        ],
      },
    ],
    defaults: { on: false, volume: 25, playlist: "ambient" },
  },
  {
    id: "audio.intercom",
    name: "Intercom",
    description: "Two-way comms with the sub-sterile core.",
    category: "audio",
    propertySpecs: [
      { kind: "toggle", key: "on", label: "Channel open" },
      { kind: "percent", key: "volume", label: "Volume" },
    ],
    defaults: { on: false, volume: 60 },
  },

  // ── Access ──────────────────────────────────────────────────────────
  {
    id: "doors.main",
    name: "Main OR Door",
    description: "Auto-lock during Live Case / time-out.",
    category: "doors",
    propertySpecs: [
      { kind: "toggle", key: "locked", label: "Locked" },
      { kind: "toggle", key: "auto_sterile", label: "Auto-lock during Live Case" },
    ],
    defaults: { locked: false, auto_sterile: true },
  },
];
