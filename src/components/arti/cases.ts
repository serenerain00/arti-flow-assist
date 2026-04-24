// Shared mock case data for the day. Used by CaseList and PreOp.

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

export const TODAY_CASES: CaseItem[] = [
  {
    id: "c-001",
    time: "07:30",
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
    time: "09:45",
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
    time: "12:30",
    durationMin: 75,
    room: "OR 326",
    patientName: "Priya Raman",
    patientMrn: "MRN 871‑044",
    patientAgeSex: "44F",
    procedure: "SLAP Repair · Biceps Tenodesis",
    procedureShort: "SLAP",
    surgeon: "Dr. Anika Patel",
    status: "scheduled",
    side: "Right",
  },
  {
    id: "c-004",
    time: "14:15",
    durationMin: 60,
    room: "OR 326",
    patientName: "Jonas Albrecht",
    patientMrn: "MRN 913‑207",
    patientAgeSex: "37M",
    procedure: "Bankart Repair",
    procedureShort: "BNK",
    surgeon: "Dr. Anika Patel",
    status: "delayed",
    side: "Left",
  },
  {
    id: "c-005",
    time: "16:00",
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
