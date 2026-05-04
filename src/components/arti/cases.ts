// Shared mock case data for the day. Used by CaseList and PreOp.

// Public sample MP4 — used as a placeholder until real patient-recorded
// uploads land. Big Buck Bunny is the canonical Apple HLS test asset and
// lets the prototype demonstrate the player + transcript pipeline without
// shipping any real PHI footage.
const PLACEHOLDER_VIDEO_SRC =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const PLACEHOLDER_VIDEO_POSTER =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg";

/**
 * Build a placeholder X-ray-like image URL. placehold.co lets us render a
 * dark viewport with a centered view label without shipping binary assets
 * — the PACS-style overlay rendered on top of the modal carries the rest
 * of the realism.
 */
function imgPlaceholder(label: string, modality: "XR" | "CT" | "MRI" = "XR"): string {
  // CT/MRI get a slightly cooler tone so the modality is visually distinct.
  const bg = modality === "MRI" ? "0a0e1a" : modality === "CT" ? "0e0e10" : "0a0a0a";
  const fg = "6b7280";
  const text = encodeURIComponent(label);
  return `https://placehold.co/1400x1400/${bg}/${fg}?text=${text}&font=mono`;
}

export type CaseStatus = "in-progress" | "next" | "scheduled" | "completed" | "delayed" | "cancelled";

export interface CaseItem {
  id: string;
  time: string; // "07:30"
  durationMin: number;
  room: string; // "OR 326"
  patientName: string;
  patientMrn: string;
  patientAgeSex: string; // "62M"
  procedure: string;
  procedureShort: string; // "RSA"
  surgeon: string;
  status: CaseStatus;
  side?: "Left" | "Right";
}

/**
 * Build today's case list with start times anchored to the current clock,
 * so the wall display always shows a realistic spread regardless of when
 * the prototype is loaded. The status mix stays the same — one completed
 * (earlier today), one delayed, one "next" with a near-term countdown,
 * and the rest scheduled later in the day.
 *
 * Computed once at module load. Refresh the page to re-anchor against a
 * new "now"; within a session the live countdown ticks naturally as time
 * passes (so the "next" case will eventually become overdue if the page
 * is left open for long enough — same behavior a real OR display has).
 */
function buildTodayCases(): CaseItem[] {
  const now = new Date();
  /** Offset minutes-from-now → "HH:MM" 24-hour string. */
  const offset = (minutes: number): string => {
    const t = new Date(now.getTime() + minutes * 60_000);
    return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  };

  return [
    {
      id: "c-001",
      // Earliest case of the day — wrapped up about 3 hours ago.
      time: offset(-180),
      durationMin: 90,
      room: "OR 326",
      patientName: "Helena Voss",
      patientMrn: "MRN 884‑221",
      patientAgeSex: "58F",
      procedure: "Arthroscopic Rotator Cuff Repair",
      procedureShort: "RCR",
      surgeon: "Dr. Anika Patel",
      status: "completed",
      side: "Left",
    },
    {
      id: "c-002",
      // Focus case — starts in 35 minutes. Pre-op view counts down to it.
      time: offset(35),
      durationMin: 150,
      room: "OR 326",
      patientName: "Marcus Chen",
      patientMrn: "MRN 902‑118",
      patientAgeSex: "62M",
      procedure: "Reverse Total Shoulder Arthroplasty",
      procedureShort: "RSA",
      surgeon: "Dr. Anika Patel",
      status: "next",
      side: "Right",
    },
    {
      id: "c-003",
      // Held over from earlier — was supposed to start 45 min ago,
      // delayed waiting on equipment turnover.
      time: offset(-45),
      durationMin: 75,
      room: "OR 326",
      patientName: "Priya Raman",
      patientMrn: "MRN 871‑044",
      patientAgeSex: "44F",
      procedure: "SLAP Repair · Biceps Tenodesis",
      procedureShort: "SLAP",
      surgeon: "Dr. Anika Patel",
      status: "delayed",
      side: "Right",
    },
    {
      id: "c-004",
      // Mid-afternoon scheduled — a couple hours out.
      time: offset(150),
      durationMin: 60,
      room: "OR 326",
      patientName: "Jonas Albrecht",
      patientMrn: "MRN 913‑207",
      patientAgeSex: "37M",
      procedure: "Bankart Repair",
      procedureShort: "BNK",
      surgeon: "Dr. Anika Patel",
      status: "scheduled",
      side: "Left",
    },
    {
      id: "c-005",
      // Last case of the day — late afternoon.
      time: offset(285),
      durationMin: 105,
      room: "OR 326",
      patientName: "Linnea Sundberg",
      patientMrn: "MRN 845‑553",
      patientAgeSex: "51F",
      procedure: "Subacromial Decompression",
      procedureShort: "SAD",
      surgeon: "Dr. Anika Patel",
      status: "scheduled",
      side: "Right",
    },
  ];
}

export const TODAY_CASES: CaseItem[] = buildTodayCases();

export interface PatientClinical {
  dob: string;
  sex: string;
  height: string;
  weight: string;
  bmi: string;
  bloodType: string;
  npo: string;
  allergies: Array<{ agent: string; reaction: string; severity: "severe" | "moderate" | "mild" }>;
  medications: string[];
  conditions: string[];
  labs: Array<{ label: string; value: string; flag: boolean }>;
  consents: string[];
  notes: string[];
  airway: { mallampati: string; difficult: boolean };
  anesthesiaPlan: string;
  procedureSteps: Array<{ step: number; title: string; detail: string }>;
  implantPlan: Array<{ component: string; spec: string; confirmed: boolean }>;
  /**
   * Pre-op video the patient recorded for the surgeon. AI-extracted
   * insights surface as bullet "video notes" on the surgeon panel; the
   * raw transcript powers the closed-caption rail in the modal player.
   */
  patientVideo: PatientVideo;
  /**
   * Pre-op imaging study (XR/CT/MRI) for the surgeon-panel PACS viewer.
   * Each study can hold several views (AP, axillary, MRI cuts, etc).
   */
  imaging: PatientImagingStudy;
}

export type ImagingModality = "XR" | "CT" | "MRI";

export interface ImagingView {
  /** Stable id used for voice tool dispatch ("xrays_show_view"). */
  id: string;
  /** Short label shown in DICOM corner overlay and thumbnail strip ("AP", "Axillary Lateral"). */
  label: string;
  modality: ImagingModality;
  src: string;
  /** Optional one-liner describing the projection / sequence. */
  description?: string;
  /** Brief radiologist-style read displayed inline. */
  findings?: string;
}

export interface PatientImagingStudy {
  studyDate: string;
  accession: string;
  bodyRegion: string;
  laterality: "L" | "R";
  /** Plain-language protocol description shown in the study header. */
  protocol: string;
  views: ImagingView[];
}

export interface PatientVideoCaption {
  /** Caption start time in seconds. */
  startSec: number;
  /** Spoken text rendered as a closed-caption line. */
  text: string;
}

export interface PatientVideo {
  /** Stable id for telemetry and tool dispatch. */
  id: string;
  /** Placeholder MP4 (poster image used until staff hits play). */
  src: string;
  poster: string;
  durationSec: number;
  /** Patient-recorded date in display form (e.g. "May 1, 2026 · 4:42 PM"). */
  recordedAt: string;
  /** Short blurb shown on the surgeon-panel video card. */
  summary: string;
  transcript: PatientVideoCaption[];
  /** AI-extracted bullet insights surfaced on the surgeon panel. */
  aiInsights: string[];
}

export const PATIENT_CLINICAL: Record<string, PatientClinical> = {
  "c-001": {
    dob: "09/22/1966", sex: "Female", height: "5′5″ (165 cm)", weight: "142 lbs (64 kg)",
    bmi: "23.8", bloodType: "O+", npo: "NPO since midnight · 7 h 30 m ago",
    allergies: [
      { agent: "Sulfa drugs", reaction: "Maculopapular rash", severity: "moderate" },
      { agent: "Latex", reaction: "Contact urticaria", severity: "mild" },
    ],
    medications: ["Alendronate 70 mg weekly", "Calcium + Vitamin D daily", "Metoprolol 25 mg daily"],
    conditions: ["Osteoporosis (T-score −2.7)", "Mild hypertension — controlled", "Chronic rotator cuff tear (left shoulder)"],
    labs: [
      { label: "Hgb", value: "13.1 g/dL", flag: false }, { label: "Plt", value: "220 K/µL", flag: false },
      { label: "INR", value: "1.0", flag: false }, { label: "Cr", value: "0.9 mg/dL", flag: false },
      { label: "Glucose", value: "92 mg/dL", flag: false }, { label: "K+", value: "4.0 mEq/L", flag: false },
    ],
    consents: ["Surgical consent — signed", "Anesthesia consent — signed", "Blood products — consented"],
    notes: ["Fall risk — DEXA confirmed osteoporosis. Handle bone gently.", "No latex products in field."],
    airway: { mallampati: "Class I", difficult: false },
    anesthesiaPlan: "General — LMA, Sevo maintenance",
    procedureSteps: [
      { step: 1, title: "Positioning", detail: "Beach chair 65°, left arm positioner, axillary roll, gel donut" },
      { step: 2, title: "Portal placement", detail: "Posterior viewing portal, anterior & lateral working portals" },
      { step: 3, title: "Diagnostic arthroscopy", detail: "Inspect glenohumeral joint, biceps anchor, rotator interval — confirm 3 cm tear" },
      { step: 4, title: "Tear mobilization", detail: "Release adhesions, mobilize tendon edges to footprint" },
      { step: 5, title: "Footprint preparation", detail: "Burr and shaver to bleeding bone at greater tuberosity" },
      { step: 6, title: "Medial row anchors", detail: "3× double-loaded suture anchors at medial footprint" },
      { step: 7, title: "Suture passing & repair", detail: "Mattress configuration through tendon, lateral row knotless fixation" },
      { step: 8, title: "Assessment & closure", detail: "Probe repair under load, irrigate, portal closure × 3" },
    ],
    implantPlan: [
      { component: "Suture Anchors (medial row)", spec: "5.5 mm double-loaded × 3", confirmed: true },
      { component: "Knotless Anchors (lateral row)", spec: "4.75 mm × 2", confirmed: true },
      { component: "FiberWire Suture", spec: "#2 × 6 strands", confirmed: true },
    ],
    patientVideo: {
      id: "pv-001",
      src: PLACEHOLDER_VIDEO_SRC,
      poster: PLACEHOLDER_VIDEO_POSTER,
      durationSec: 84,
      recordedAt: "April 30, 2026 · 6:12 PM",
      summary: "Helena recorded a short pre-op note about her left shoulder pain and home support.",
      transcript: [
        { startSec: 0, text: "Hi Dr. Patel — this is Helena Voss." },
        { startSec: 4, text: "I wanted to send a quick note before tomorrow." },
        { startSec: 8, text: "The pain in my left shoulder has gotten worse this week." },
        { startSec: 14, text: "Lifting anything overhead — even a coffee mug — wakes me up at night." },
        { startSec: 22, text: "I've been taking Tylenol only, no NSAIDs, like we discussed." },
        { startSec: 30, text: "I'm a little worried about the bone density, since the DEXA was low." },
        { startSec: 38, text: "My daughter is staying with me for the first week post-op." },
        { startSec: 46, text: "She'll help with the sling and the ice machine." },
        { startSec: 54, text: "I haven't had any new falls or injuries since our last visit." },
        { startSec: 62, text: "And I confirmed — no latex bandages anywhere in the house." },
        { startSec: 70, text: "Thank you again. See you in the morning." },
      ],
      aiInsights: [
        "Pain has progressed in the past week — disrupting sleep with overhead motion.",
        "Adhering to no-NSAID guidance; using Tylenol only.",
        "Daughter on-site for week 1 — sling + cryocompression support confirmed.",
        "No new falls or injuries since last clinic visit.",
        "Patient-confirmed: no latex products in the home environment.",
      ],
    },
    imaging: {
      studyDate: "Apr 22, 2026",
      accession: "ACC-26-0422-1184",
      bodyRegion: "Left Shoulder",
      laterality: "L",
      protocol: "Pre-op shoulder series + MRI rotator cuff (3 T)",
      views: [
        {
          id: "v1-ap",
          label: "AP",
          modality: "XR",
          src: imgPlaceholder("AP · Left Shoulder", "XR"),
          description: "Anteroposterior, neutral rotation",
          findings: "Acromiohumeral distance 7 mm — mild superior migration. Type II acromion. No fracture.",
        },
        {
          id: "v1-axil",
          label: "Axillary Lateral",
          modality: "XR",
          src: imgPlaceholder("AXIL · Left Shoulder", "XR"),
          description: "Axillary lateral projection",
          findings: "Glenohumeral relationship preserved. No dislocation. Mild AC arthrosis.",
        },
        {
          id: "v1-y",
          label: "Scapular Y",
          modality: "XR",
          src: imgPlaceholder("Y · Left Shoulder", "XR"),
          description: "Scapular Y / outlet",
          findings: "Type II curved acromion with subtle anterior downsloping.",
        },
        {
          id: "v1-mri",
          label: "MRI T2 Coronal",
          modality: "MRI",
          src: imgPlaceholder("MRI T2 Coronal", "MRI"),
          description: "T2 fat-sat coronal, 3 T",
          findings: "Full-thickness supraspinatus tear, ~3 cm in AP dimension. Tendon retraction to glenoid rim. Mild fatty infiltration (Goutallier 2).",
        },
      ],
    },
  },
  "c-002": {
    dob: "04/11/1963", sex: "Male", height: "5′10″ (178 cm)", weight: "192 lbs (87 kg)",
    bmi: "27.6", bloodType: "A+", npo: "NPO since midnight · 9 h 45 m ago",
    allergies: [
      { agent: "Penicillin", reaction: "Anaphylaxis", severity: "severe" },
      { agent: "Betadine", reaction: "Contact dermatitis", severity: "moderate" },
    ],
    medications: [
      "Lisinopril 10 mg daily — held day of surgery", "Metformin 500 mg BID — held day of surgery",
      "Aspirin 81 mg daily — held 7 days pre-op", "Atorvastatin 20 mg QHS",
    ],
    conditions: ["Hypertension — controlled", "Type 2 Diabetes — A1c 6.8%", "Rotator cuff tear (chronic, right shoulder)", "Mild OSA — no CPAP"],
    labs: [
      { label: "Hgb", value: "13.2 g/dL", flag: false }, { label: "Plt", value: "245 K/µL", flag: false },
      { label: "INR", value: "1.0", flag: false }, { label: "Cr", value: "1.1 mg/dL", flag: false },
      { label: "Glucose", value: "148 mg/dL", flag: true }, { label: "K+", value: "4.2 mEq/L", flag: false },
    ],
    consents: ["Surgical consent — signed", "Anesthesia consent — signed", "Blood transfusion — declined"],
    notes: ["Interscalene nerve block planned — confirm with anesthesia team.", "No Betadine — use ChloraPrep only.", "Patient requests minimal narcotics post-op."],
    airway: { mallampati: "Class II", difficult: false },
    anesthesiaPlan: "General + Interscalene Block — LMA Supreme #4, Sevo 2%",
    procedureSteps: [
      { step: 1, title: "Positioning", detail: "Beach chair 65°, Spider Limb Positioner, axillary roll, gel donut" },
      { step: 2, title: "Deltopectoral approach", detail: "10-blade incision, identify & protect cephalic vein" },
      { step: 3, title: "Subscapularis management", detail: "Lesser tuberosity osteotomy, tag with #2 FiberWire × 2" },
      { step: 4, title: "Humeral preparation", detail: "Oscillating saw, canal broach to size 8, trial reduction" },
      { step: 5, title: "Glenoid exposure & reaming", detail: "Capsular release, ream to 25 mm, pilot hole, baseplate × 4 screws" },
      { step: 6, title: "Glenosphere placement", detail: "38 mm glenosphere, locking screw torqued to 12 Nm" },
      { step: 7, title: "Humeral component & closure", detail: "Poly insert, press-fit, assess ROM, subscapularis repair, drain × 1" },
    ],
    implantPlan: [
      { component: "Glenoid Baseplate", spec: "25 mm · Screw fixation", confirmed: true },
      { component: "Glenosphere", spec: "38 mm · Standard", confirmed: true },
      { component: "Humeral Stem", spec: "Press-fit · Size 8", confirmed: false },
      { component: "Poly Insert", spec: "Standard offset", confirmed: true },
    ],
    patientVideo: {
      id: "pv-002",
      src: PLACEHOLDER_VIDEO_SRC,
      poster: PLACEHOLDER_VIDEO_POSTER,
      durationSec: 96,
      recordedAt: "May 1, 2026 · 4:42 PM",
      summary: "Marcus recorded a pre-op video focused on pain, glucose control, and post-op narcotic concerns.",
      transcript: [
        { startSec: 0, text: "Good evening, Dr. Patel — Marcus Chen here." },
        { startSec: 5, text: "I wanted to record a quick note before tomorrow's case." },
        { startSec: 10, text: "The right shoulder pain is steady — about a six on ten at rest." },
        { startSec: 18, text: "Sharper, maybe an eight, when I try to reach behind my back." },
        { startSec: 26, text: "I held my Lisinopril and Metformin this morning, as instructed." },
        { startSec: 34, text: "Last finger-stick this evening was one-forty-eight." },
        { startSec: 41, text: "I stopped the daily aspirin a week ago — no bleeding issues since." },
        { startSec: 49, text: "I'd really like to keep narcotics to a minimum after surgery." },
        { startSec: 57, text: "Last time, opioids made me very nauseated for two days." },
        { startSec: 65, text: "I'm comfortable with the interscalene block — please use it if you can." },
        { startSec: 73, text: "Also, please do not use Betadine — it gives me a contact rash." },
        { startSec: 81, text: "ChloraPrep is fine. Penicillin is anaphylaxis, so please double-check antibiotics." },
        { startSec: 90, text: "Thanks again. See you in the morning." },
      ],
      aiInsights: [
        "Pain 6/10 at rest, 8/10 with internal rotation — consistent with chronic RTC progression.",
        "Held Lisinopril and Metformin morning of surgery per instructions.",
        "Evening glucose 148 — confirms flagged morning lab; recheck pre-induction.",
        "Aspirin held 7 days; no bleeding events since.",
        "Patient strongly prefers minimal narcotics — prior opioid-related nausea × 2 days.",
        "Patient confirms interscalene block consent.",
        "RECONFIRM: NO Betadine (contact dermatitis), NO penicillins (anaphylaxis) — ChloraPrep + cefazolin alternative required.",
      ],
    },
    imaging: {
      studyDate: "Apr 18, 2026",
      accession: "ACC-26-0418-2247",
      bodyRegion: "Right Shoulder",
      laterality: "R",
      protocol: "Pre-op RSA planning · CT 3D reconstruction",
      views: [
        {
          id: "v2-grashey",
          label: "Grashey",
          modality: "XR",
          src: imgPlaceholder("GRASHEY · Right Shoulder", "XR"),
          description: "True AP of glenohumeral joint",
          findings: "End-stage glenohumeral OA with bone-on-bone contact. Superior humeral migration. Walch B2 glenoid.",
        },
        {
          id: "v2-axil",
          label: "Axillary Lateral",
          modality: "XR",
          src: imgPlaceholder("AXIL · Right Shoulder", "XR"),
          description: "Axillary lateral",
          findings: "Posterior glenoid wear and humeral subluxation — confirms B2 morphology.",
        },
        {
          id: "v2-y",
          label: "Scapular Y",
          modality: "XR",
          src: imgPlaceholder("Y · Right Shoulder", "XR"),
          description: "Scapular Y projection",
          findings: "Acromiohumeral distance reduced; rotator cuff insufficiency pattern.",
        },
        {
          id: "v2-ct",
          label: "CT 3D Recon",
          modality: "CT",
          src: imgPlaceholder("CT 3D RECON · Glenoid", "CT"),
          description: "Volume-rendered glenoid · pre-op planning",
          findings: "Glenoid retroversion 22° (Friedman). Posterior bone loss ~6 mm. Adequate stock for 25 mm baseplate with 4-screw fixation.",
        },
      ],
    },
  },
  "c-003": {
    dob: "07/03/1981", sex: "Female", height: "5′4″ (163 cm)", weight: "128 lbs (58 kg)",
    bmi: "21.8", bloodType: "B+", npo: "NPO since midnight · 12 h ago",
    allergies: [
      { agent: "Codeine", reaction: "Severe nausea/vomiting", severity: "moderate" },
      { agent: "Morphine", reaction: "Nausea, pruritis", severity: "moderate" },
    ],
    medications: ["Sertraline 50 mg daily", "Ferrous sulfate 325 mg daily", "OCP — continued", "Omeprazole 20 mg daily"],
    conditions: ["Iron-deficiency anemia — on supplementation", "Anxiety disorder — stable on sertraline", "GERD", "SLAP tear + biceps tendinopathy (right shoulder)"],
    labs: [
      { label: "Hgb", value: "10.9 g/dL", flag: true }, { label: "Plt", value: "310 K/µL", flag: false },
      { label: "INR", value: "1.0", flag: false }, { label: "Cr", value: "0.7 mg/dL", flag: false },
      { label: "Glucose", value: "88 mg/dL", flag: false }, { label: "Ferritin", value: "8 ng/mL", flag: true },
    ],
    consents: ["Surgical consent — signed", "Anesthesia consent — signed", "Blood products — consented"],
    notes: ["Avoid opioids — use multimodal analgesia (Ketorolac, Tylenol, nerve block).", "Low Hgb — type & screen on file, have blood available.", "Anxious patient — consider pre-op anxiolytic."],
    airway: { mallampati: "Class I", difficult: false },
    anesthesiaPlan: "General + Interscalene Block — avoid opioids, TIVA or Sevo",
    procedureSteps: [
      { step: 1, title: "Positioning", detail: "Beach chair 70°, right arm positioner, padded axillary roll" },
      { step: 2, title: "Diagnostic arthroscopy", detail: "Confirm type II SLAP tear, assess biceps anchor instability" },
      { step: 3, title: "SLAP debridement", detail: "Prepare superior glenoid to bleeding bone, 11–1 o'clock" },
      { step: 4, title: "Anchor placement", detail: "1× knotless anchor at 12 o'clock superior glenoid" },
      { step: 5, title: "Labral repair", detail: "Pass suture through labrum, restore anatomic bumper, assess tension" },
      { step: 6, title: "Biceps tenotomy", detail: "Release biceps at labral anchor under direct visualization" },
      { step: 7, title: "Subpectoral tenodesis", detail: "Ream canal, seat biceps tendon, secure with interference screw" },
      { step: 8, title: "Closure", detail: "Irrigate, portal closure × 3, sterile dressing" },
    ],
    implantPlan: [
      { component: "SLAP Anchor", spec: "Knotless 3.0 mm × 1", confirmed: true },
      { component: "Tenodesis Interference Screw", spec: "8 mm × 12 mm", confirmed: true },
      { component: "FiberWire Suture", spec: "#2 — no opioid analogue needed", confirmed: true },
    ],
    patientVideo: {
      id: "pv-003",
      src: PLACEHOLDER_VIDEO_SRC,
      poster: PLACEHOLDER_VIDEO_POSTER,
      durationSec: 78,
      recordedAt: "May 2, 2026 · 8:18 AM",
      summary: "Priya flagged opioid intolerance, anxiety, and a desire for a calm pre-op environment.",
      transcript: [
        { startSec: 0, text: "Hi Dr. Patel, this is Priya Raman." },
        { startSec: 4, text: "I'm a little anxious about tomorrow, so I wanted to send this." },
        { startSec: 11, text: "Codeine and morphine both make me throw up for hours." },
        { startSec: 18, text: "Last time I had Toradol and a nerve block, I did really well." },
        { startSec: 26, text: "If we can stick with multimodal — Tylenol, ketorolac, the block — I'd be grateful." },
        { startSec: 36, text: "I took my sertraline this morning with a sip of water." },
        { startSec: 43, text: "I also took my iron yesterday, but skipped today since I'm NPO." },
        { startSec: 52, text: "If anyone has a moment in pre-op, even a brief check-in would help my anxiety." },
        { startSec: 62, text: "My partner is dropping me off and will be in the waiting room all day." },
        { startSec: 71, text: "Thank you. I trust you all completely." },
      ],
      aiInsights: [
        "Avoid opioids — codeine and morphine both cause severe nausea/vomiting.",
        "Patient responded well previously to multimodal (Toradol + block + Tylenol).",
        "Sertraline taken AM with sip of water — within NPO guidance.",
        "Iron skipped today (NPO) — note for hematology trending.",
        "Pre-op anxiety high — consider brief anxiolytic and a check-in from team lead.",
        "Support contact in waiting room throughout the case.",
      ],
    },
    imaging: {
      studyDate: "Apr 25, 2026",
      accession: "ACC-26-0425-3902",
      bodyRegion: "Right Shoulder",
      laterality: "R",
      protocol: "Pre-op shoulder series + MR arthrogram",
      views: [
        {
          id: "v3-ap",
          label: "AP",
          modality: "XR",
          src: imgPlaceholder("AP · Right Shoulder", "XR"),
          description: "Anteroposterior, neutral rotation",
          findings: "Bony anatomy unremarkable. No fracture, no dislocation, joint space preserved.",
        },
        {
          id: "v3-axil",
          label: "Axillary Lateral",
          modality: "XR",
          src: imgPlaceholder("AXIL · Right Shoulder", "XR"),
          description: "Axillary lateral",
          findings: "Concentric glenohumeral relationship.",
        },
        {
          id: "v3-mri-coronal",
          label: "MR Arthrogram · Coronal",
          modality: "MRI",
          src: imgPlaceholder("MR Arthro · Coronal", "MRI"),
          description: "T1 fat-sat coronal post-arthrogram",
          findings: "Type II SLAP tear with contrast tracking under superior labrum. Biceps anchor unstable.",
        },
        {
          id: "v3-mri-sag",
          label: "MR Arthrogram · Sagittal",
          modality: "MRI",
          src: imgPlaceholder("MR Arthro · Sagittal", "MRI"),
          description: "T1 fat-sat sagittal post-arthrogram",
          findings: "Biceps tendinopathy at the bicipital groove. Rotator cuff intact.",
        },
      ],
    },
  },
  "c-004": {
    dob: "11/18/1987", sex: "Male", height: "6′1″ (185 cm)", weight: "198 lbs (90 kg)",
    bmi: "26.3", bloodType: "O−", npo: "NPO since midnight · 14 h 15 m ago",
    allergies: [
      { agent: "Penicillin", reaction: "Urticaria", severity: "mild" },
    ],
    medications: ["Lisinopril 5 mg daily", "Metoprolol 12.5 mg daily"],
    conditions: ["Hypertension — controlled", "Recurrent shoulder dislocation × 3 (left shoulder)", "Athletic — BMX rider"],
    labs: [
      { label: "Hgb", value: "15.8 g/dL", flag: false }, { label: "Plt", value: "278 K/µL", flag: false },
      { label: "INR", value: "1.0", flag: false }, { label: "Cr", value: "1.0 mg/dL", flag: false },
      { label: "Glucose", value: "95 mg/dL", flag: false }, { label: "K+", value: "4.1 mEq/L", flag: false },
    ],
    consents: ["Surgical consent — signed", "Anesthesia consent — signed", "Blood products — consented"],
    notes: ["Universal donor (O−) — use blood products cautiously.", "Use cephalosporin for prophylaxis (not penicillin).", "Case delayed — patient NPO > 14 h, monitor glucose."],
    airway: { mallampati: "Class I", difficult: false },
    anesthesiaPlan: "General + Interscalene Block — LMA, Sevo or TIVA",
    procedureSteps: [
      { step: 1, title: "Positioning", detail: "Beach chair, lateral tilt, left arm positioner, padded pressure points" },
      { step: 2, title: "Diagnostic arthroscopy", detail: "Confirm anterior–inferior Bankart lesion, assess Hill-Sachs size" },
      { step: 3, title: "Capsulolabral mobilization", detail: "Elevator to release complex from glenoid neck, fresh bleeding edges" },
      { step: 4, title: "Glenoid preparation", detail: "Abrader at 3–5 o'clock anterior glenoid to bleeding bone" },
      { step: 5, title: "Anchor #1 — 5 o'clock", detail: "Knotless anchor, inferior-most position" },
      { step: 6, title: "Anchor #2 — 4 o'clock", detail: "Knotless anchor, mid anterior" },
      { step: 7, title: "Anchor #3 — 3 o'clock", detail: "Knotless anchor, superior extent of lesion" },
      { step: 8, title: "Capsulolabral repair & closure", detail: "Pass sutures, restore labral bumper, check stability, irrigate, close" },
    ],
    implantPlan: [
      { component: "Knotless Suture Anchors", spec: "3.0 mm × 3", confirmed: true },
      { component: "FiberTape Suture", spec: "#2 × 3 strands", confirmed: true },
    ],
    patientVideo: {
      id: "pv-004",
      src: PLACEHOLDER_VIDEO_SRC,
      poster: PLACEHOLDER_VIDEO_POSTER,
      durationSec: 72,
      recordedAt: "May 1, 2026 · 11:05 AM",
      summary: "Jonas described a recent near-dislocation event and his goals for return to BMX.",
      transcript: [
        { startSec: 0, text: "Hey Doc — Jonas Albrecht, here." },
        { startSec: 4, text: "Three days ago I almost dislocated again reaching into the back seat of my car." },
        { startSec: 12, text: "Felt the shift, caught it before it popped — but it scared me." },
        { startSec: 20, text: "No actual dislocation since the last clinic visit, just that one near-miss." },
        { startSec: 28, text: "I held my Lisinopril this morning per instructions." },
        { startSec: 35, text: "BP at home was one-twenty-eight over eighty-two." },
        { startSec: 42, text: "Penicillin gives me hives — not anaphylaxis, but worth flagging." },
        { startSec: 50, text: "My main goal is getting back on the BMX bike for the fall season." },
        { startSec: 58, text: "I'm willing to be slow with rehab if it means a stable shoulder long-term." },
        { startSec: 66, text: "See you tomorrow. Thanks." },
      ],
      aiInsights: [
        "Near-dislocation event 3 days pre-op — stability still tenuous.",
        "No frank dislocation since last clinic visit.",
        "Lisinopril held morning of surgery; home BP 128/82.",
        "Penicillin → urticaria (mild) — confirm cefazolin use.",
        "Patient goal: fall BMX season return — willing to extend rehab for durable repair.",
      ],
    },
    imaging: {
      studyDate: "Apr 19, 2026",
      accession: "ACC-26-0419-4716",
      bodyRegion: "Left Shoulder",
      laterality: "L",
      protocol: "Pre-op instability series + MRI",
      views: [
        {
          id: "v4-ap",
          label: "AP",
          modality: "XR",
          src: imgPlaceholder("AP · Left Shoulder", "XR"),
          description: "Anteroposterior, neutral rotation",
          findings: "Concentric joint with no acute fracture. Subtle Hill-Sachs notch on humeral head.",
        },
        {
          id: "v4-westpoint",
          label: "West Point Axillary",
          modality: "XR",
          src: imgPlaceholder("WEST POINT · Left", "XR"),
          description: "Modified axillary for anterior glenoid",
          findings: "Anterior-inferior glenoid bone loss ~12% — within reach of Bankart repair without bone block.",
        },
        {
          id: "v4-stryker",
          label: "Stryker Notch",
          modality: "XR",
          src: imgPlaceholder("STRYKER NOTCH · Left", "XR"),
          description: "Posterolateral humeral head profile",
          findings: "Hill-Sachs lesion measured at 18 × 6 mm — engaging in functional position.",
        },
        {
          id: "v4-mri",
          label: "MRI · Bankart",
          modality: "MRI",
          src: imgPlaceholder("MRI · Bankart Lesion", "MRI"),
          description: "T2 axial — anterior labrum",
          findings: "Anterior labral tear from 3 to 6 o'clock. Capsular redundancy. No bony Bankart.",
        },
      ],
    },
  },
  "c-005": {
    dob: "02/28/1974", sex: "Female", height: "5′6″ (168 cm)", weight: "161 lbs (73 kg)",
    bmi: "25.9", bloodType: "AB+", npo: "NPO since midnight · 16 h ago",
    allergies: [
      { agent: "Aspirin", reaction: "GI bleed", severity: "severe" },
      { agent: "NSAIDs", reaction: "GI bleed", severity: "severe" },
    ],
    medications: ["Levothyroxine 88 mcg daily", "Omeprazole 40 mg daily", "Calcium + Vitamin D daily"],
    conditions: ["Hypothyroidism — stable on replacement", "GERD — on PPI", "Subacromial impingement (right shoulder, > 18 months)"],
    labs: [
      { label: "Hgb", value: "12.4 g/dL", flag: false }, { label: "Plt", value: "231 K/µL", flag: false },
      { label: "INR", value: "1.1", flag: false }, { label: "Cr", value: "0.8 mg/dL", flag: false },
      { label: "TSH", value: "5.8 mIU/L", flag: true }, { label: "K+", value: "3.8 mEq/L", flag: false },
    ],
    consents: ["Surgical consent — signed", "Anesthesia consent — signed", "Blood products — consented"],
    notes: ["No Aspirin or NSAIDs — GI bleed history. Use Acetaminophen + nerve block for analgesia.", "TSH mildly elevated — endocrine aware, cleared for surgery.", "Long NPO — monitor for hypoglycemia."],
    airway: { mallampati: "Class II", difficult: false },
    anesthesiaPlan: "General + Suprascapular Block — avoid NSAIDs, Sevo maintenance",
    procedureSteps: [
      { step: 1, title: "Positioning", detail: "Beach chair 30°, right arm draped free, optional arm sling traction" },
      { step: 2, title: "Diagnostic arthroscopy", detail: "Inspect glenohumeral joint, confirm intact rotator cuff" },
      { step: 3, title: "Subacromial entry", detail: "Posterior portal into subacromial bursa, establish lateral working portal" },
      { step: 4, title: "Bursectomy", detail: "Shaver and ablator — anterior and lateral subacromial bursa" },
      { step: 5, title: "Acromioplasty", detail: "Remove 5–6 mm from anterior–inferior acromion with arthroscopic burr" },
      { step: 6, title: "CA ligament release", detail: "Release coracoacromial ligament from acromion anterior edge" },
      { step: 7, title: "Rotator cuff assessment", detail: "Probe full-thickness integrity under direct visualization — no repair anticipated" },
      { step: 8, title: "Closure", detail: "Irrigate, portal closure × 2, sterile dressing" },
    ],
    implantPlan: [
      { component: "No Implants Required", spec: "Soft tissue / bony decompression only", confirmed: true },
    ],
    patientVideo: {
      id: "pv-005",
      src: PLACEHOLDER_VIDEO_SRC,
      poster: PLACEHOLDER_VIDEO_POSTER,
      durationSec: 81,
      recordedAt: "May 2, 2026 · 7:50 AM",
      summary: "Linnea reviewed her GI bleed history and clarified post-op activity expectations.",
      transcript: [
        { startSec: 0, text: "Hello Dr. Patel, this is Linnea Park." },
        { startSec: 5, text: "Quick reminder: no aspirin and no NSAIDs for me, ever." },
        { startSec: 12, text: "I had a GI bleed two years ago and I do not want to repeat that." },
        { startSec: 20, text: "Tylenol and the nerve block plan you described sound perfect." },
        { startSec: 28, text: "Levothyroxine taken this morning with a small sip of water." },
        { startSec: 35, text: "Omeprazole as well, since the GERD is acting up at night." },
        { startSec: 43, text: "I'm a stained-glass artist — I really need overhead reach back." },
        { startSec: 52, text: "Realistic timeline for full overhead use is what I care about most." },
        { startSec: 60, text: "I have arranged help at home for the first two weeks." },
        { startSec: 68, text: "Long NPO since midnight — I'm a bit lightheaded but okay." },
        { startSec: 76, text: "Thanks for everything. See you soon." },
      ],
      aiInsights: [
        "ABSOLUTE: no aspirin / NSAIDs — prior GI bleed history.",
        "Tylenol + suprascapular block analgesia plan accepted by patient.",
        "Levothyroxine and omeprazole taken AM with sip of water (NPO-compliant).",
        "Patient goal: full overhead reach for stained-glass work — counsel on realistic timeline.",
        "Home support secured for 2 weeks post-op.",
        "Long NPO interval — patient reports mild lightheadedness; check glucose pre-induction.",
      ],
    },
    imaging: {
      studyDate: "Apr 24, 2026",
      accession: "ACC-26-0424-5530",
      bodyRegion: "Right Shoulder",
      laterality: "R",
      protocol: "Pre-op subacromial impingement series",
      views: [
        {
          id: "v5-ap",
          label: "AP",
          modality: "XR",
          src: imgPlaceholder("AP · Right Shoulder", "XR"),
          description: "Anteroposterior, neutral rotation",
          findings: "Subacromial spur at the anterior acromion. Acromiohumeral distance 9 mm.",
        },
        {
          id: "v5-outlet",
          label: "Outlet Y",
          modality: "XR",
          src: imgPlaceholder("OUTLET Y · Right", "XR"),
          description: "Supraspinatus outlet view",
          findings: "Type II curved acromion with prominent anterior-inferior osteophyte — primary impingement source.",
        },
        {
          id: "v5-axil",
          label: "Axillary Lateral",
          modality: "XR",
          src: imgPlaceholder("AXIL · Right Shoulder", "XR"),
          description: "Axillary lateral",
          findings: "Glenohumeral joint preserved. AC joint mildly arthritic.",
        },
      ],
    },
  },
};

export const STATUS_META: Record<CaseStatus, { label: string; tone: string; dot: string }> = {
  "in-progress": {
    label: "In Progress",
    tone: "text-primary border-primary/40 bg-primary/10",
    dot: "bg-primary",
  },
  next: {
    label: "Up Next",
    tone: "text-accent border-accent/40 bg-accent/10",
    dot: "bg-accent",
  },
  scheduled: {
    label: "Scheduled",
    tone: "text-muted-foreground border-border bg-surface-2/60",
    dot: "bg-muted-foreground/60",
  },
  completed: {
    label: "Completed",
    tone: "text-success border-success/30 bg-success/10",
    dot: "bg-success",
  },
  delayed: {
    label: "Delayed",
    tone: "text-warning border-warning/40 bg-warning/10",
    dot: "bg-warning",
  },
  cancelled: {
    label: "Cancelled",
    tone: "text-destructive border-destructive/40 bg-destructive/10",
    dot: "bg-destructive",
  },
};
