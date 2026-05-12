// Intraoperative ("case active") mock data + helpers.
//
// This file owns everything the IntraopDashboard reads while a surgery is
// live: the surgical phase script, ticking vital signs, implant log,
// supply requests, antibiotic redose schedule, the activity stream feed,
// and Arti's contextual prompts for the OR. The data is per-procedure so
// switching between Reverse TSA / SLAP / Bankart / etc. produces a
// believable layout change without rebuilding the screen.

import type { CaseItem } from "./cases";

// ── Surgical phases ────────────────────────────────────────────────────

/**
 * Phase identifiers are now per-procedure strings (snake_case slugs of
 * the surgical step). Each snapshot defines its own ordered list of
 * phases — RCR's "anchor_placement" is not the same step as RSA's, so
 * there is no global enum.
 */
export type IntraopPhaseId = string;

export interface IntraopPhase {
  id: IntraopPhaseId;
  /** Short label rendered in the timeline pill. */
  label: string;
  /** Sentence shown when this phase is current. */
  detail: string;
  /** Approximate share of total case minutes — used to draw the timeline. */
  weight: number;
  /**
   * Optional richer step text used by panels that want a different
   * voice from the timeline pill's `detail`. Falls back to `detail` if
   * not provided.
   */
  step?: string;
  /** Per-phase AI awareness prompts surfaced on the dashboard. */
  aiPrompts?: AiPrompt[];
  /** Caption shown on the surgeon's imaging tile during this phase. */
  imagingCaption?: string;
  /**
   * Trays / tool sets needed for this phase. Lets Arti answer
   * "what tray is next?" / "which tray is up?" by surfacing the trays
   * tied to the current and upcoming phases. First entry should be the
   * primary tray (the one the scrub tech opens next).
   */
  trays?: string[];
}

// (Legacy global INTRAOP_PHASES removed — phases now live on each
// snapshot as `phases: IntraopPhase[]`. Use snapshot.phases everywhere.)

// ── Vitals ─────────────────────────────────────────────────────────────

export interface VitalSnapshot {
  hr: number;
  /** Systolic / diastolic. */
  bp: { sys: number; dia: number };
  spo2: number;
  /** End-tidal CO2 in mmHg. */
  etco2: number;
  /** Core temperature in °C. */
  tempC: number;
  /** Mean arterial pressure derived for the strip. */
  map: number;
}

const SEED_VITALS: VitalSnapshot = {
  hr: 68,
  bp: { sys: 118, dia: 72 },
  spo2: 99,
  etco2: 36,
  tempC: 36.6,
  map: 87,
};

/**
 * Deterministic ambient drift around the seed values. Real OR monitors
 * tick smoothly — we want this to feel alive without ever firing alarms.
 */
export function driftVitals(prev: VitalSnapshot): VitalSnapshot {
  const j = (range: number) => (Math.random() - 0.5) * range;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const sys = clamp(prev.bp.sys + j(2), 108, 128);
  const dia = clamp(prev.bp.dia + j(1.5), 64, 80);
  return {
    hr: Math.round(clamp(prev.hr + j(2), 58, 82)),
    bp: { sys: Math.round(sys), dia: Math.round(dia) },
    spo2: Math.round(clamp(prev.spo2 + j(0.6), 96, 100)),
    etco2: Math.round(clamp(prev.etco2 + j(1), 32, 40)),
    tempC: Number(clamp(prev.tempC + j(0.05), 36.2, 37.0).toFixed(1)),
    map: Math.round((sys + 2 * dia) / 3),
  };
}

export function initialVitals(): VitalSnapshot {
  return { ...SEED_VITALS, bp: { ...SEED_VITALS.bp } };
}

// ── Vital-threshold alerts (Arti reminders triggered by vitals) ──────────

export type VitalId = "bp_sys" | "bp_dia" | "map" | "hr" | "spo2" | "etco2" | "tempC";
export type VitalComparison = "below" | "above";

export interface VitalThreshold {
  id: string;
  vital: VitalId;
  comparison: VitalComparison;
  value: number;
  /** Human-readable label rendered in the manual panel + spoken alert. */
  label: string;
  createdAtIso: string;
  /** ISO timestamp + observed value at the moment of first crossing. */
  fired?: { atIso: string; observed: number };
}

export const VITAL_LABELS: Record<VitalId, { label: string; unit: string; spoken: string }> = {
  bp_sys: { label: "Systolic BP", unit: "mmHg", spoken: "systolic blood pressure" },
  bp_dia: { label: "Diastolic BP", unit: "mmHg", spoken: "diastolic blood pressure" },
  map: { label: "MAP", unit: "mmHg", spoken: "mean arterial pressure" },
  hr: { label: "Heart rate", unit: "bpm", spoken: "heart rate" },
  spo2: { label: "SpO2", unit: "%", spoken: "S P O 2" },
  etco2: { label: "EtCO2", unit: "mmHg", spoken: "end-tidal C O 2" },
  tempC: { label: "Core temp", unit: "°C", spoken: "core temperature" },
};

/** Free-text → VitalId. Handles BP/blood pressure, MAP, SpO2, HR, EtCO2, temp. */
export function resolveVitalId(query?: string): VitalId | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  if (/(systolic|sys)\b/.test(q)) return "bp_sys";
  if (/(diastolic|dia)\b/.test(q)) return "bp_dia";
  if (/\b(map|mean arterial)\b/.test(q)) return "map";
  if (/\b(bp|blood pressure|pressure)\b/.test(q)) return "bp_sys";
  if (/\b(hr|heart rate|pulse|bpm)\b/.test(q)) return "hr";
  if (/\b(spo2|sp o2|sp o 2|oxygen|sat|saturation)\b/.test(q)) return "spo2";
  if (/\b(etco2|et co2|end[- ]?tidal|co2)\b/.test(q)) return "etco2";
  if (/\b(temp|temperature)\b/.test(q)) return "tempC";
  return undefined;
}

/** Pull the current observed value for a vital out of a snapshot. */
export function observeVital(v: VitalSnapshot, id: VitalId): number {
  switch (id) {
    case "bp_sys":
      return v.bp.sys;
    case "bp_dia":
      return v.bp.dia;
    case "map":
      return v.map;
    case "hr":
      return v.hr;
    case "spo2":
      return v.spo2;
    case "etco2":
      return v.etco2;
    case "tempC":
      return v.tempC;
  }
}

export function thresholdMatches(t: VitalThreshold, observed: number): boolean {
  return t.comparison === "below" ? observed < t.value : observed > t.value;
}

// ── Activity stream ────────────────────────────────────────────────────

export type ActivityKind = "med" | "imaging" | "implant" | "doc" | "room" | "ai";

export interface ActivityEvent {
  /** Minutes ago, relative to current case time. */
  minutesAgo: number;
  kind: ActivityKind;
  title: string;
  /** Optional one-line detail. */
  detail?: string;
}

export const ACTIVITY_SEED: ActivityEvent[] = [
  {
    minutesAgo: 2,
    kind: "ai",
    title: "Antibiotic redose due in 28 min",
    detail: "Cefazolin 2g — 4-hour interval",
  },
  {
    minutesAgo: 5,
    kind: "imaging",
    title: "Fluoroscopy AP captured",
    detail: "Saved to study · accession 884‑221",
  },
  {
    minutesAgo: 8,
    kind: "implant",
    title: "Glenosphere 36mm scanned",
    detail: "Lot G-2261-A · expires 2027-06",
  },
  {
    minutesAgo: 12,
    kind: "doc",
    title: "Implant verification logged",
    detail: "Marcus Reyes, CST",
  },
  {
    minutesAgo: 18,
    kind: "med",
    title: "Cefazolin 2g IV administered",
    detail: "Within 60-min window",
  },
  {
    minutesAgo: 22,
    kind: "room",
    title: "Live Case enabled",
    detail: "Voice quiet mode active",
  },
  { minutesAgo: 28, kind: "doc", title: "Time-out completed", detail: "All four items verified" },
  { minutesAgo: 32, kind: "room", title: "Patient draped", detail: "Bair Hugger 38°C" },
];

// ── Implants log ───────────────────────────────────────────────────────

export type ImplantStatus = "scanned" | "staged" | "verified" | "pending";

export interface ImplantLog {
  component: string;
  spec: string;
  lot?: string;
  status: ImplantStatus;
}

// ── Supply requests ────────────────────────────────────────────────────

export interface SupplyRequest {
  item: string;
  /** Who asked — usually scrub or surgeon. */
  requestedBy: string;
  status: "pending" | "in-route" | "delivered";
  /** Minutes since the request was placed. */
  minutesAgo: number;
}

// ── Specimens ──────────────────────────────────────────────────────────

export type SpecimenContainer = "formalin" | "fresh" | "saline" | "RPMI";
export type SpecimenStatus = "labeling" | "labeled" | "to_pathology" | "received";

export interface Specimen {
  /** Tissue source / clinical name. */
  source: string;
  container: SpecimenContainer;
  /** "14:32" wall-clock or relative — display as-is. */
  collectedAt: string;
  status: SpecimenStatus;
  /** Pathology destination (e.g. "Frozen", "Permanent", "Cytology"). */
  destination?: string;
  /** Who handled it — nurse name, optional. */
  handledBy?: string;
}

// ── Sutures opened ─────────────────────────────────────────────────────

export interface SutureUse {
  /** "2-0 Vicryl", "3-0 Monocryl", etc. */
  type: string;
  /** Number of packs opened so far. */
  opened: number;
  /** Number used (closed onto field). */
  used: number;
}

// ── Fluids / blood loss / urine output ─────────────────────────────────

export interface FluidsLog {
  /** Inputs — IV fluids, irrigation. */
  ins: Array<{ label: string; volumeMl: number }>;
  /** Outputs — urine, suction (EBL), blood. */
  outs: Array<{ label: string; volumeMl: number }>;
  /** Estimated blood loss (mL). */
  ebl: number;
  /** Urine output (mL/kg/hr — display as text since we don't have weight here). */
  uopRate: string;
}

// ── Anesthetic depth / neuromuscular ───────────────────────────────────

export interface AnestheticDepth {
  /** Volatile / TIVA agent + concentration. */
  agent: string;
  /** Minimum alveolar concentration. */
  mac: number;
  /** Bispectral index (depth-of-hypnosis monitor). 0–100. Optional. */
  bis?: number;
  /** Train-of-four count "0/4" – "4/4" — paralysis status. Optional. */
  tof?: string;
  /** Last paralytic + dose + clock time. */
  lastParalytic?: string;
}

// ── Airway ─────────────────────────────────────────────────────────────

export interface AirwaySnapshot {
  /** "ETT" / "LMA" / "Nasal". */
  device: string;
  /** Tube size, e.g. "7.5". */
  size: string;
  /** Depth at lip / teeth. */
  depthCm: number;
  /** True if pre-op evaluation flagged difficult airway. */
  difficult: boolean;
  /** Mallampati class if known. */
  mallampati?: string;
}

// ── Patient warming ────────────────────────────────────────────────────

export interface WarmingStatus {
  /** Current core temp (°C). */
  coreTempC: number;
  /** Target threshold for normothermia. */
  targetMinC: number;
  /** Active warming devices in use. */
  devices: string[];
  /** Trend — short readable summary, e.g. "Stable" / "Rising 0.2°/15m". */
  trend: string;
}

// ── Patient positioning ────────────────────────────────────────────────

export interface PositioningStatus {
  /** "Beach chair" / "Lateral decubitus" / "Supine" / etc. */
  name: string;
  /** Padding / safety check summary. */
  padding: string;
  /** Last pressure-point check (clock time). */
  lastCheckAt: string;
}

// ── Contextual AI prompts ──────────────────────────────────────────────

export type AiPromptTone = "info" | "advisory" | "critical";

export interface AiPrompt {
  tone: AiPromptTone;
  /** Lead text — short, glanceable. */
  title: string;
  /** Optional one-line context. */
  body?: string;
  /** Optional suggested voice command users can speak / tap. */
  voiceHint?: string;
}

// ── Per-case intraop snapshot ──────────────────────────────────────────

export interface IntraopSnapshot {
  /**
   * Minutes elapsed at the moment the snapshot is read for the first time.
   * The dashboard ticks its own elapsed counter from here. Used only as a
   * demo seed when the user enters via the mid-case shortcut; the normal
   * `start_case` voice flow resets elapsed to 0.
   */
  elapsedSeed: number;
  /** Total expected case length in minutes. */
  estimatedMinutes: number;
  /**
   * Per-procedure surgical phases — ordered, each carrying its own
   * label, step text, AI prompts, imaging caption, and required trays.
   * Replaces the previous parallel `phaseScripts` / `phaseAiPrompts` /
   * `phaseImagingCaption` records.
   */
  phases: IntraopPhase[];
  /** Phase the case opens on. The user can walk forward/backward via voice. */
  currentPhase: IntraopPhaseId;
  /** Implant log; ordered as scrub tech stages them. */
  implants: ImplantLog[];
  /** Supply requests open or in-route. */
  supplies: SupplyRequest[];
  /**
   * Antibiotic redose info. Negative dueInMinutes means it is overdue.
   */
  antibiotic: {
    agent: string;
    /** Last-dose label e.g. "18 min ago". */
    lastDose: string;
    dueInMinutes: number;
  };
  /** Activity stream events. The dashboard prepends its own as the case ticks. */
  activity: ActivityEvent[];
  /** Whether the arthroscopy camera feed is mocked as live. */
  arthroscopyLive: boolean;
  // ── Clinical realism fields ──
  /** Tissue specimens captured during the case (nurse panel). */
  specimens: Specimen[];
  /** Suture packs opened and used during the case (scrub panel). */
  sutures: SutureUse[];
  /** Running fluid I&O + EBL (anesthesia + nurse panels). */
  fluids: FluidsLog;
  /** Anesthetic depth + neuromuscular blockade (anesthesia panel). */
  depth: AnestheticDepth;
  /** Airway snapshot (anesthesia panel). */
  airway: AirwaySnapshot;
  /** Patient warming status (nurse panel). */
  warming: WarmingStatus;
  /** Patient positioning (nurse panel). */
  positioning: PositioningStatus;
}

/**
 * Reasonable shoulder-OR defaults, used to fill in clinical fields the
 * per-case snapshots haven't customized. Beach-chair is the typical
 * arthroscopic setup; lateral decubitus is a common alternative for
 * Bankart. Each per-case snapshot can override.
 */
const DEFAULT_FLUIDS: FluidsLog = {
  ins: [
    { label: "Lactated Ringer's", volumeMl: 1200 },
    { label: "Saline irrigation", volumeMl: 2500 },
  ],
  outs: [
    { label: "Foley urine", volumeMl: 380 },
    { label: "Suction (incl. irrigation)", volumeMl: 2680 },
  ],
  ebl: 120,
  uopRate: "0.7 mL/kg/hr",
};

const DEFAULT_DEPTH: AnestheticDepth = {
  agent: "Sevoflurane 1.8%",
  mac: 0.9,
  bis: 42,
  tof: "2/4",
  lastParalytic: "Rocuronium 50 mg · 38 min ago",
};

const DEFAULT_AIRWAY: AirwaySnapshot = {
  device: "ETT",
  size: "7.5",
  depthCm: 22,
  difficult: false,
  mallampati: "II",
};

const DEFAULT_WARMING: WarmingStatus = {
  coreTempC: 36.6,
  targetMinC: 36.0,
  devices: ["Bair Hugger upper-body 38°C", "IV fluid warmer"],
  trend: "Stable · within target",
};

const DEFAULT_POSITIONING_BEACH: PositioningStatus = {
  name: "Beach chair · 60°",
  padding: "Heel + occiput padded · arms tucked",
  lastCheckAt: "14:00",
};

const DEFAULT_POSITIONING_LATERAL: PositioningStatus = {
  name: "Lateral decubitus · right side up",
  padding: "Axillary roll · pillow between knees · arm board",
  lastCheckAt: "14:00",
};

// ── Per-procedure surgical phases ──────────────────────────────────────
//
// Each procedure defines its own ordered phases. Phases carry their own
// step text, AI prompts, imaging caption, and required trays so a single
// snapshot field replaces the previous parallel records.

/** Rotator Cuff Repair (arthroscopic). */
const RCR_PHASES: IntraopPhase[] = [
  {
    id: "diagnostic_scope",
    label: "Diagnostic scope",
    detail: "Posterior portal in · diagnostic arthroscopy of glenohumeral joint.",
    weight: 1,
    imagingCaption: "Arthroscopic survey · 30° scope",
    trays: ["Arthroscopy tray", "Fluid management"],
    aiPrompts: [{ tone: "info", title: "Arthroscopy feed live", body: "Recording to case study." }],
  },
  {
    id: "cleaning_tissue",
    label: "Cleaning tissue",
    detail: "Subacromial bursectomy · debridement of degenerative tissue.",
    weight: 2,
    imagingCaption: "Bursectomy · subacromial space",
    trays: ["Arthroscopy tray", "Shaver handpiece"],
  },
  {
    id: "preparing_bone",
    label: "Preparing bone",
    detail: "Footprint preparation on greater tuberosity · light decortication.",
    weight: 2,
    imagingCaption: "Footprint prep · greater tuberosity",
    trays: ["Arthroscopy tray", "Burr"],
  },
  {
    id: "anchor_placement",
    label: "Anchor placement",
    detail: "Medial-row anchor placed · lateral-row knotless next.",
    weight: 2,
    imagingCaption: "Anchor placement · 30° scope",
    trays: ["Anchor tray", "Drill guides"],
    aiPrompts: [{ tone: "advisory", title: "Verify anchor lot", voiceHint: "Show implants." }],
  },
  {
    id: "suture_passing",
    label: "Suture passing",
    detail: "Sutures passed through tendon · awaiting tensioning.",
    weight: 2,
    imagingCaption: "Suture passing through cuff",
    trays: ["Suture tray", "Suture passers"],
  },
  {
    id: "knot_tying",
    label: "Knot tying",
    detail: "Sliding knots set · backup half-hitches stacked.",
    weight: 2,
    imagingCaption: "Knot tying · cuff repair",
    trays: ["Suture tray", "Knot pusher"],
  },
  {
    id: "final_inspection",
    label: "Final inspection",
    detail: "Tendon coverage confirmed · footprint reduction inspected · portals closed.",
    weight: 1,
    imagingCaption: "Footprint coverage · final look",
    trays: ["Arthroscopy tray", "Closure tray"],
    aiPrompts: [{ tone: "advisory", title: "Final counts due", voiceHint: "Open quad view." }],
  },
];

/** Reverse Total Shoulder Arthroplasty. */
const RSA_PHASES: IntraopPhase[] = [
  {
    id: "approach",
    label: "Deltopectoral approach",
    detail: "Skin incision · deltopectoral interval developed · cephalic vein protected.",
    weight: 2,
    imagingCaption: "External · deltopectoral approach",
    trays: ["Major shoulder tray", "Self-retaining retractors"],
  },
  {
    id: "subscap_takedown",
    label: "Subscap takedown",
    detail: "Subscapularis tenotomy · humeral head exposed.",
    weight: 2,
    imagingCaption: "External · subscap takedown",
    trays: ["Major shoulder tray", "Bovie · 30/30"],
  },
  {
    id: "humeral_resection",
    label: "Humeral resection",
    detail: "Humeral head osteotomy with cut guide · canal entered.",
    weight: 3,
    imagingCaption: "Humeral resection",
    trays: ["Humeral cut guide tray", "Oscillating saw"],
  },
  {
    id: "glenoid_prep",
    label: "Glenoid preparation",
    detail: "Glenoid exposed · reaming to subchondral bone · central peg drilled.",
    weight: 3,
    imagingCaption: "Glenoid preparation",
    trays: ["Glenoid reaming tray", "Power drill"],
    aiPrompts: [
      { tone: "info", title: "Baseplate on standby", body: "Backup glenosphere staged." },
    ],
  },
  {
    id: "baseplate_glenosphere",
    label: "Baseplate & glenosphere",
    detail: "Baseplate impacted · glenosphere seated and locked.",
    weight: 3,
    imagingCaption: "Glenosphere placement",
    trays: ["Baseplate impactor set"],
    aiPrompts: [{ tone: "advisory", title: "Verify implant lot", voiceHint: "Show implants." }],
  },
  {
    id: "humeral_stem_poly",
    label: "Humeral stem & poly",
    detail: "Humeral broaching · trial reduction · final stem and poly insert seated.",
    weight: 3,
    imagingCaption: "Humeral stem placement",
    trays: ["Humeral broach/stem tray", "Trial inserts"],
  },
  {
    id: "reduction_rom",
    label: "Reduction & ROM check",
    detail: "Joint reduced · range-of-motion verified in 90° abduction · stability tested.",
    weight: 2,
    imagingCaption: "Reduction & ROM check",
    trays: ["Trial inserts"],
  },
  {
    id: "subscap_closure",
    label: "Subscap repair & closure",
    detail: "Subscapularis repaired with heavy suture · layered closure · final counts.",
    weight: 2,
    imagingCaption: "External · layered closure",
    trays: ["Closure tray", "Heavy suture"],
    aiPrompts: [{ tone: "advisory", title: "Final counts due", voiceHint: "Open quad view." }],
  },
];

/** SLAP Repair + Biceps Tenodesis. */
const SLAP_PHASES: IntraopPhase[] = [
  {
    id: "diagnostic_scope",
    label: "Diagnostic scope",
    detail: "Posterior portal in · diagnostic arthroscopy.",
    weight: 1,
    imagingCaption: "Arthroscopic survey · 70° scope",
    trays: ["Arthroscopy tray"],
  },
  {
    id: "slap_identification",
    label: "SLAP identification",
    detail: "SLAP lesion identified at 12 o'clock · biceps anchor inspected.",
    weight: 1,
    imagingCaption: "SLAP lesion · 12 o'clock",
    trays: ["Arthroscopy tray", "Probe"],
  },
  {
    id: "biceps_tenotomy",
    label: "Biceps tenotomy",
    detail: "Long head of biceps released at root · prepared for tenodesis.",
    weight: 1,
    imagingCaption: "Biceps tenotomy",
    trays: ["Arthroscopic scissors"],
  },
  {
    id: "anchor_placement",
    label: "Anchor placement",
    detail: "Suture anchor placed · sutures retrieved.",
    weight: 2,
    imagingCaption: "Suture anchor placement",
    trays: ["Anchor tray", "Drill guides"],
    aiPrompts: [{ tone: "advisory", title: "Verify anchor lot", voiceHint: "Show implants." }],
  },
  {
    id: "tenodesis_screw",
    label: "Tenodesis screw",
    detail: "Bicipital groove prepared · interference screw seated.",
    weight: 2,
    imagingCaption: "Tenodesis screw placement",
    trays: ["Tenodesis screw set"],
  },
  {
    id: "stability_check",
    label: "Stability check",
    detail: "Anchor stability tested · biceps cuff secured.",
    weight: 1,
    imagingCaption: "Anchor stability test",
    trays: ["Arthroscopy tray"],
  },
  {
    id: "closure",
    label: "Closure",
    detail: "Portal sites closed · sterile dressing · final counts.",
    weight: 1,
    imagingCaption: "External · portal closure",
    trays: ["Closure tray"],
    aiPrompts: [{ tone: "advisory", title: "Final counts due", voiceHint: "Open quad view." }],
  },
];

/** Bankart Repair (arthroscopic). */
const BANKART_PHASES: IntraopPhase[] = [
  {
    id: "diagnostic_scope",
    label: "Diagnostic scope",
    detail: "Posterior portal in · anterior labrum inspected.",
    weight: 1,
    imagingCaption: "Arthroscopic survey · 30° scope",
    trays: ["Arthroscopy tray"],
  },
  {
    id: "labral_mobilization",
    label: "Labral mobilization",
    detail: "Anterior labrum mobilized off glenoid neck.",
    weight: 1,
    imagingCaption: "Labrum mobilization",
    trays: ["Arthroscopic elevator", "Shaver handpiece"],
  },
  {
    id: "glenoid_prep",
    label: "Glenoid rim prep",
    detail: "Glenoid rim decorticated to bleeding bone.",
    weight: 1,
    imagingCaption: "Glenoid rim preparation",
    trays: ["Arthroscopic burr"],
  },
  {
    id: "anchor_placement",
    label: "Anchor placement",
    detail: "Suture anchors placed at 3, 4, and 5 o'clock.",
    weight: 2,
    imagingCaption: "Anchor placement · 30° scope",
    trays: ["Anchor tray", "Drill guides"],
    aiPrompts: [{ tone: "advisory", title: "Verify anchor lots", voiceHint: "Show implants." }],
  },
  {
    id: "suture_passing",
    label: "Suture passing",
    detail: "Sutures passed through labral tissue.",
    weight: 2,
    imagingCaption: "Suture passing through labrum",
    trays: ["Suture tray", "Suture passer set"],
  },
  {
    id: "knot_tying",
    label: "Knot tying",
    detail: "Sliding knots seated · labrum reduced to glenoid rim.",
    weight: 2,
    imagingCaption: "Knot tying · labral repair",
    trays: ["Suture tray", "Knot pusher"],
  },
  {
    id: "stability_check",
    label: "Stability check",
    detail: "Anterior translation tested · stable · portals closed.",
    weight: 1,
    imagingCaption: "Stability test · final look",
    trays: ["Arthroscopy tray", "Closure tray"],
    aiPrompts: [{ tone: "advisory", title: "Final counts due", voiceHint: "Open quad view." }],
  },
];

/** Subacromial Decompression. */
const SAD_PHASES: IntraopPhase[] = [
  {
    id: "diagnostic_scope",
    label: "Diagnostic scope",
    detail: "Posterior portal in · diagnostic arthroscopy.",
    weight: 1,
    imagingCaption: "Arthroscopic survey · 30° scope",
    trays: ["Arthroscopy tray"],
  },
  {
    id: "bursectomy",
    label: "Bursectomy",
    detail: "Subacromial bursa cleared · CA arch visualized.",
    weight: 2,
    imagingCaption: "Bursectomy · subacromial space",
    trays: ["Shaver handpiece"],
  },
  {
    id: "ca_release",
    label: "CA ligament release",
    detail: "Coracoacromial ligament released from acromial undersurface.",
    weight: 1,
    imagingCaption: "CA ligament release",
    trays: ["Cautery tray"],
  },
  {
    id: "acromial_debridement",
    label: "Acromial debridement",
    detail: "Acromial undersurface debrided to flat profile.",
    weight: 2,
    imagingCaption: "Acromial undersurface debridement",
    trays: ["Arthroscopic burr"],
  },
  {
    id: "acromioplasty",
    label: "Acromioplasty",
    detail: "Type II spur resected · subacromial space confirmed clear.",
    weight: 2,
    imagingCaption: "Acromioplasty in progress",
    trays: ["Acromioplasty burr"],
  },
  {
    id: "final_inspection",
    label: "Final inspection",
    detail: "Subacromial space cleared · portals closed · sterile dressing.",
    weight: 1,
    imagingCaption: "Final inspection · cleared space",
    trays: ["Arthroscopy tray", "Closure tray"],
    aiPrompts: [{ tone: "advisory", title: "Final counts due", voiceHint: "Open quad view." }],
  },
];

const RSA_SNAPSHOT: IntraopSnapshot = {
  elapsedSeed: 0,
  estimatedMinutes: 150,
  phases: RSA_PHASES,
  currentPhase: RSA_PHASES[0].id,
  implants: [
    {
      component: "Glenoid baseplate",
      spec: "Standard · 25 mm post",
      lot: "GB-7741-K",
      status: "staged",
    },
    {
      component: "Glenosphere",
      spec: "36 mm · standard offset",
      lot: "G-2261-A",
      status: "staged",
    },
    { component: "Humeral stem", spec: "Size 9 · standard", lot: "HS-5512-B", status: "staged" },
    { component: "Polyethylene insert", spec: "+3 mm retentive", status: "pending" },
  ],
  supplies: [
    {
      item: "Glenosphere 39 mm trial",
      requestedBy: "Dr. Anika Patel",
      status: "delivered",
      minutesAgo: 11,
    },
  ],
  antibiotic: {
    agent: "Cefazolin 2 g IV",
    lastDose: "18 min ago",
    dueInMinutes: 222,
  },
  activity: ACTIVITY_SEED,
  arthroscopyLive: true,
  specimens: [
    {
      source: "Subacromial bursa",
      container: "formalin",
      collectedAt: "14:18",
      status: "labeled",
      destination: "Permanent",
      handledBy: "Sarah Lin, RN",
    },
  ],
  sutures: [
    { type: "2-0 Vicryl", opened: 3, used: 1 },
    { type: "0 Ethibond", opened: 2, used: 0 },
    { type: "3-0 Monocryl", opened: 2, used: 0 },
  ],
  fluids: DEFAULT_FLUIDS,
  depth: DEFAULT_DEPTH,
  airway: DEFAULT_AIRWAY,
  warming: DEFAULT_WARMING,
  positioning: DEFAULT_POSITIONING_BEACH,
};

const SLAP_SNAPSHOT: IntraopSnapshot = {
  elapsedSeed: 0,
  estimatedMinutes: 75,
  phases: SLAP_PHASES,
  currentPhase: SLAP_PHASES[0].id,
  implants: [
    { component: "Suture anchor", spec: "2.9 mm BioComposite", lot: "SA-3389-J", status: "staged" },
    { component: "Tenodesis screw", spec: "8 × 23 mm PEEK", lot: "TS-7102-D", status: "staged" },
  ],
  supplies: [],
  antibiotic: {
    agent: "Cefazolin 2 g IV",
    lastDose: "16 min ago",
    dueInMinutes: 224,
  },
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
    { minutesAgo: 8, kind: "room", title: "Patient positioned beach chair" },
  ],
  arthroscopyLive: true,
  specimens: [
    {
      source: "Biceps tendon stump",
      container: "formalin",
      collectedAt: "13:48",
      status: "labeled",
      destination: "Permanent",
      handledBy: "Sarah Lin, RN",
    },
  ],
  sutures: [
    { type: "2-0 FiberWire", opened: 2, used: 1 },
    { type: "3-0 Monocryl", opened: 1, used: 0 },
  ],
  fluids: {
    ...DEFAULT_FLUIDS,
    ebl: 60,
    outs: [
      { label: "Foley urine", volumeMl: 240 },
      { label: "Suction (incl. irrigation)", volumeMl: 1980 },
    ],
  },
  depth: DEFAULT_DEPTH,
  airway: DEFAULT_AIRWAY,
  warming: DEFAULT_WARMING,
  positioning: DEFAULT_POSITIONING_BEACH,
};

const BANKART_SNAPSHOT: IntraopSnapshot = {
  elapsedSeed: 0,
  estimatedMinutes: 60,
  phases: BANKART_PHASES,
  currentPhase: BANKART_PHASES[0].id,
  implants: [
    { component: "Suture anchor", spec: "3.0 mm all-suture", lot: "AA-9987-F", status: "staged" },
    { component: "Suture anchor", spec: "3.0 mm all-suture", lot: "AA-9987-F", status: "staged" },
    { component: "Suture anchor", spec: "3.0 mm all-suture", lot: "AA-9987-F", status: "staged" },
  ],
  supplies: [],
  antibiotic: {
    agent: "Cefazolin 2 g IV",
    lastDose: "12 min ago",
    dueInMinutes: 228,
  },
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
  ],
  arthroscopyLive: true,
  specimens: [],
  sutures: [
    { type: "2-0 FiberWire", opened: 1, used: 0 },
    { type: "3-0 Monocryl", opened: 1, used: 0 },
  ],
  fluids: { ...DEFAULT_FLUIDS, ebl: 40 },
  depth: { ...DEFAULT_DEPTH, mac: 0.85 },
  airway: DEFAULT_AIRWAY,
  warming: DEFAULT_WARMING,
  positioning: DEFAULT_POSITIONING_LATERAL,
};

const RCR_SNAPSHOT: IntraopSnapshot = {
  elapsedSeed: 0,
  estimatedMinutes: 90,
  phases: RCR_PHASES,
  currentPhase: RCR_PHASES[0].id,
  implants: [
    {
      component: "Medial-row anchor",
      spec: "5.5 mm all-suture",
      lot: "MR-1108-C",
      status: "staged",
    },
    {
      component: "Lateral-row anchor",
      spec: "4.75 mm knotless",
      lot: "LR-2245-E",
      status: "staged",
    },
  ],
  supplies: [],
  antibiotic: {
    agent: "Cefazolin 2 g IV",
    lastDose: "22 min ago",
    dueInMinutes: 218,
  },
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
  ],
  arthroscopyLive: true,
  specimens: [
    {
      source: "Subacromial bursa",
      container: "formalin",
      collectedAt: "13:54",
      status: "labeling",
      destination: "Permanent",
      handledBy: "Sarah Lin, RN",
    },
  ],
  sutures: [
    { type: "2-0 FiberWire", opened: 2, used: 1 },
    { type: "3-0 Monocryl", opened: 1, used: 0 },
  ],
  fluids: DEFAULT_FLUIDS,
  depth: DEFAULT_DEPTH,
  airway: DEFAULT_AIRWAY,
  warming: DEFAULT_WARMING,
  positioning: DEFAULT_POSITIONING_BEACH,
};

const SAD_SNAPSHOT: IntraopSnapshot = {
  elapsedSeed: 0,
  estimatedMinutes: 105,
  phases: SAD_PHASES,
  currentPhase: SAD_PHASES[0].id,
  implants: [],
  supplies: [],
  antibiotic: {
    agent: "Cefazolin 2 g IV",
    lastDose: "14 min ago",
    dueInMinutes: 226,
  },
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
  ],
  arthroscopyLive: true,
  specimens: [
    {
      source: "Subacromial bursa",
      container: "formalin",
      collectedAt: "13:38",
      status: "to_pathology",
      destination: "Permanent",
      handledBy: "Sarah Lin, RN",
    },
  ],
  sutures: [{ type: "3-0 Monocryl", opened: 1, used: 0 }],
  fluids: { ...DEFAULT_FLUIDS, ebl: 30 },
  depth: { ...DEFAULT_DEPTH, mac: 0.8 },
  airway: DEFAULT_AIRWAY,
  warming: DEFAULT_WARMING,
  positioning: DEFAULT_POSITIONING_BEACH,
};

const SNAPSHOT_BY_CASE: Record<string, IntraopSnapshot> = {
  "c-001": RCR_SNAPSHOT,
  "c-002": RSA_SNAPSHOT,
  "c-003": SLAP_SNAPSHOT,
  "c-004": BANKART_SNAPSHOT,
  "c-005": SAD_SNAPSHOT,
};

/** Per-case intraop snapshot. Falls back to RSA so any case is renderable. */
export function getIntraopSnapshot(caseId: string | undefined): IntraopSnapshot {
  if (caseId && SNAPSHOT_BY_CASE[caseId]) return SNAPSHOT_BY_CASE[caseId];
  return RSA_SNAPSHOT;
}

// ── Helpers ────────────────────────────────────────────────────────────

export function phaseIndex(id: IntraopPhaseId, phases: IntraopPhase[]): number {
  return phases.findIndex((p) => p.id === id);
}

/** "1:23:04" / "23:04" elapsed format. */
export function formatElapsed(totalSec: number): string {
  if (totalSec < 0) totalSec = 0;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function caseLabel(c: CaseItem | undefined): string {
  if (!c) return "Active Case";
  return `${c.procedure} · ${c.procedureShort}`;
}

/** Step forward / backward in the canonical phase order. Clamps at the ends. */
export function neighborPhase(
  current: IntraopPhaseId,
  direction: "next" | "previous",
  phases: IntraopPhase[],
): IntraopPhaseId {
  const i = phaseIndex(current, phases);
  if (i < 0) return phases[0]?.id ?? current;
  const j = direction === "next" ? Math.min(i + 1, phases.length - 1) : Math.max(i - 1, 0);
  return phases[j].id;
}

/** Returns the phase label (e.g. "Anchor placement"). Used by Arti's narration. */
export function phaseLabel(id: IntraopPhaseId, phases: IntraopPhase[]): string {
  return phases.find((p) => p.id === id)?.label ?? id;
}

/**
 * Free-text phase matcher for voice. Tries (1) exact id, (2)
 * case-insensitive label, (3) substring match on label words. Returns
 * the matched phase or undefined. Lets Claude hand us "anchor
 * placement", "anchors", "Anchor" etc. and land on the right step.
 */
export function findPhase(query: string, phases: IntraopPhase[]): IntraopPhase | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const exactId = phases.find((p) => p.id.toLowerCase() === q);
  if (exactId) return exactId;
  const exactLabel = phases.find((p) => p.label.toLowerCase() === q);
  if (exactLabel) return exactLabel;
  // Substring on full label first (so "anchor placement" beats "anchor")
  const longestMatch = phases
    .filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
    .sort((a, b) => b.label.length - a.label.length)[0];
  if (longestMatch) return longestMatch;
  // Last-ditch: any word in the query matches any label word
  const queryWords = q.split(/\s+/).filter(Boolean);
  return phases.find((p) => {
    const labelWords = p.label.toLowerCase().split(/\s+/);
    return queryWords.some((qw) => labelWords.some((lw) => lw.startsWith(qw) || qw.startsWith(lw)));
  });
}
