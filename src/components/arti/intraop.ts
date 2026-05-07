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

export type IntraopPhaseId =
  | "timeout"
  | "incision"
  | "exposure"
  | "implant"
  | "verification"
  | "closure"
  | "emergence";

export interface IntraopPhase {
  id: IntraopPhaseId;
  /** Short label rendered in the timeline pill. */
  label: string;
  /** Sentence shown when this phase is current. */
  detail: string;
  /** Approximate share of total case minutes — used to draw the timeline. */
  weight: number;
}

/**
 * Canonical surgical phase script. Generic enough to map across any
 * shoulder case in the prototype; the per-procedure detail rides on the
 * IntraopPhaseSnapshot below (estimated minutes, current step text).
 */
export const INTRAOP_PHASES: IntraopPhase[] = [
  {
    id: "timeout",
    label: "Time-out",
    detail: "Pre-incision verification. Patient, site, allergies confirmed.",
    weight: 1,
  },
  {
    id: "incision",
    label: "Incision",
    detail: "Skin incision and superficial dissection.",
    weight: 2,
  },
  {
    id: "exposure",
    label: "Exposure",
    detail: "Approach and bone preparation. Trial sizing in progress.",
    weight: 3,
  },
  {
    id: "implant",
    label: "Implant",
    detail: "Implant placement. Preference card open. Trays staged.",
    weight: 4,
  },
  {
    id: "verification",
    label: "Verification",
    detail: "Range of motion, stability, and fluoroscopy verification.",
    weight: 2,
  },
  {
    id: "closure",
    label: "Closure",
    detail: "Layered closure. Final counts in progress.",
    weight: 2,
  },
  {
    id: "emergence",
    label: "Emergence",
    detail: "Dressing, transfer, and anesthesia emergence.",
    weight: 1,
  },
];

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
    title: "Sterile cockpit enabled",
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
  /** Phase the case opens on. The user can walk forward/backward via voice. */
  currentPhase: IntraopPhaseId;
  /**
   * Per-phase step text. Rendered under the active phase pill so every
   * phase has distinct, case-specific content as the user navigates.
   */
  phaseScripts: Record<IntraopPhaseId, string>;
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
  /**
   * Per-phase AI prompts — each phase has its own awareness card so the
   * room sees what Arti is paying attention to as the case progresses.
   */
  phaseAiPrompts: Record<IntraopPhaseId, AiPrompt[]>;
  /** Activity stream events. The dashboard prepends its own as the case ticks. */
  activity: ActivityEvent[];
  /**
   * Per-phase imaging caption — what the room sees in the imaging tile
   * for each phase. (Same camera feed, different annotation.)
   */
  phaseImagingCaption: Record<IntraopPhaseId, string>;
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

/**
 * Default per-phase prompt set used as a baseline for any case. Each
 * snapshot below merges its case-specific prompts on top via
 * mergePhasePrompts() so the timeline always has something coherent.
 */
const GENERIC_PHASE_PROMPTS: Record<IntraopPhaseId, AiPrompt[]> = {
  timeout: [
    {
      tone: "advisory",
      title: "Time-out in progress",
      body: "Patient · site · procedure · allergies. Confirm aloud.",
      voiceHint: "Mark time-out complete.",
    },
  ],
  incision: [
    {
      tone: "advisory",
      title: "Antibiotic timing window",
      body: "Cefazolin must be in within 60 min of incision.",
      voiceHint: "Time since last antibiotic.",
    },
  ],
  exposure: [
    {
      tone: "info",
      title: "Preference card loaded",
      voiceHint: "Open preference card.",
    },
    {
      tone: "info",
      title: "Arthroscopy feed live",
      body: "Recording to case study.",
    },
  ],
  implant: [
    {
      tone: "advisory",
      title: "Implant verification pending",
      voiceHint: "Show implants.",
    },
  ],
  verification: [
    {
      tone: "info",
      title: "Fluoroscopy available",
      body: "C-arm in position. Save final image to study.",
      voiceHint: "Show fluoroscopy.",
    },
  ],
  closure: [
    {
      tone: "advisory",
      title: "Final counts in progress",
      body: "Raytec · lap · needle · blade · clamps.",
      voiceHint: "Open quad view.",
    },
  ],
  emergence: [
    {
      tone: "info",
      title: "PACU hand-off ready",
      body: "Vitals stable · estimated extubation 4 min.",
    },
  ],
};

const RSA_SNAPSHOT: IntraopSnapshot = {
  elapsedSeed: 0,
  estimatedMinutes: 150,
  currentPhase: "timeout",
  phaseScripts: {
    timeout: "Patient, site, allergies confirmed aloud. Briefing complete.",
    incision: "Deltopectoral approach · skin marked · scalpel to skin.",
    exposure: "Subscapularis tenotomy · humeral head dislocation.",
    implant: "Glenoid baseplate seated · trialing glenosphere 36 mm · humeral stem next.",
    verification: "Range of motion checked · stable in 90° abduction · fluoroscopy AP saved.",
    closure: "Subscapularis repaired · layered closure · final counts running.",
    emergence: "Sling applied · transferring to PACU · sevoflurane off.",
  },
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
  phaseAiPrompts: {
    ...GENERIC_PHASE_PROMPTS,
    implant: [
      {
        tone: "advisory",
        title: "Implant verification pending — poly insert",
        body: "+3 mm retentive insert not yet scanned.",
        voiceHint: "Show implants.",
      },
      {
        tone: "info",
        title: "Glenosphere 39 mm trial on standby",
        body: "Backup size delivered · staged on Mayo.",
      },
    ],
  },
  activity: ACTIVITY_SEED,
  phaseImagingCaption: {
    timeout: "Camera idle · ready to record",
    incision: "External · deltopectoral approach",
    exposure: "Arthroscopic view · subscapularis · 30° scope",
    implant: "Arthroscopic view · glenoid · 30° scope",
    verification: "Fluoroscopy AP · implant position",
    closure: "External · layered closure",
    emergence: "External · dressing applied",
  },
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
  currentPhase: "timeout",
  phaseScripts: {
    timeout: "Patient, site, allergies confirmed. Beach-chair position verified.",
    incision: "Posterior portal established · diagnostic arthroscopy.",
    exposure: "SLAP lesion identified at 12 o'clock · biceps tenotomy planned.",
    implant: "Suture anchor placed · biceps tenodesis screw next.",
    verification: "Anchor stability tested · biceps cuff secured.",
    closure: "Portal sites closed · sterile dressing.",
    emergence: "Sling applied · neuro check · transfer to PACU.",
  },
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
  phaseAiPrompts: GENERIC_PHASE_PROMPTS,
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
    { minutesAgo: 8, kind: "room", title: "Patient positioned beach chair" },
  ],
  phaseImagingCaption: {
    timeout: "Camera idle · ready to record",
    incision: "External · portal placement",
    exposure: "Arthroscopic view · biceps anchor · 70° scope",
    implant: "Arthroscopic view · suture anchor · 70° scope",
    verification: "Arthroscopic view · anchor stability · 70° scope",
    closure: "External · portal closure",
    emergence: "External · sling application",
  },
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
  currentPhase: "timeout",
  phaseScripts: {
    timeout: "Patient, site, allergies confirmed. Lateral decubitus position.",
    incision: "Posterior portal · diagnostic arthroscopy.",
    exposure: "Labral mobilization · preparing glenoid rim.",
    implant: "Suture anchors placed at 3, 4, and 5 o'clock.",
    verification: "Labrum reduced · stability tested.",
    closure: "Portal sites closed · sterile dressing.",
    emergence: "Sling · neuro check · PACU transfer.",
  },
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
  phaseAiPrompts: GENERIC_PHASE_PROMPTS,
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
  ],
  phaseImagingCaption: {
    timeout: "Camera idle · ready to record",
    incision: "External · portal placement",
    exposure: "Arthroscopic view · anterior labrum · 30° scope",
    implant: "Arthroscopic view · anchor placement · 30° scope",
    verification: "Arthroscopic view · labral reduction · 30° scope",
    closure: "External · portal closure",
    emergence: "External · sling application",
  },
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
  currentPhase: "timeout",
  phaseScripts: {
    timeout: "Patient, site, allergies confirmed. Beach-chair position.",
    incision: "Posterior portal · diagnostic arthroscopy.",
    exposure: "Bursectomy · footprint preparation.",
    implant: "Medial-row anchor placed · lateral-row knotless next.",
    verification: "Footprint reduction inspected · tendon coverage confirmed.",
    closure: "Portal sites closed · sterile dressing.",
    emergence: "Sling · neuro check · PACU transfer.",
  },
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
  phaseAiPrompts: GENERIC_PHASE_PROMPTS,
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
  ],
  phaseImagingCaption: {
    timeout: "Camera idle · ready to record",
    incision: "External · portal placement",
    exposure: "Arthroscopic view · supraspinatus footprint · 30° scope",
    implant: "Arthroscopic view · anchor placement · 30° scope",
    verification: "Arthroscopic view · footprint coverage · 30° scope",
    closure: "External · portal closure",
    emergence: "External · sling application",
  },
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
  currentPhase: "timeout",
  phaseScripts: {
    timeout: "Patient, site, allergies confirmed.",
    incision: "Posterior portal · diagnostic arthroscopy.",
    exposure: "Bursectomy · acromial undersurface debridement.",
    implant: "No implants planned · acromioplasty in progress.",
    verification: "Subacromial space confirmed clear.",
    closure: "Portal sites closed · sterile dressing.",
    emergence: "Sling · neuro check · PACU transfer.",
  },
  implants: [],
  supplies: [],
  antibiotic: {
    agent: "Cefazolin 2 g IV",
    lastDose: "14 min ago",
    dueInMinutes: 226,
  },
  phaseAiPrompts: {
    ...GENERIC_PHASE_PROMPTS,
    implant: [
      {
        tone: "info",
        title: "No implants planned for this case",
      },
    ],
  },
  activity: [
    { minutesAgo: 1, kind: "doc", title: "Time-out completed" },
    { minutesAgo: 4, kind: "med", title: "Cefazolin 2g IV administered" },
  ],
  phaseImagingCaption: {
    timeout: "Camera idle · ready to record",
    incision: "External · portal placement",
    exposure: "Arthroscopic view · subacromial space · 30° scope",
    implant: "Arthroscopic view · acromioplasty · 30° scope",
    verification: "Arthroscopic view · cleared space · 30° scope",
    closure: "External · portal closure",
    emergence: "External · sling application",
  },
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

export function phaseIndex(id: IntraopPhaseId): number {
  return INTRAOP_PHASES.findIndex((p) => p.id === id);
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
): IntraopPhaseId {
  const i = phaseIndex(current);
  if (i < 0) return INTRAOP_PHASES[0].id;
  const j = direction === "next" ? Math.min(i + 1, INTRAOP_PHASES.length - 1) : Math.max(i - 1, 0);
  return INTRAOP_PHASES[j].id;
}

/** Returns the canonical phase label (e.g. "Implant"). Used by Arti's narration. */
export function phaseLabel(id: IntraopPhaseId): string {
  return INTRAOP_PHASES.find((p) => p.id === id)?.label ?? id;
}
