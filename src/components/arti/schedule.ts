// Multi-week OR schedule data. Drives the ScheduleScreen calendar.
// Today (per memory): 2026-04-24 (Friday). Data covers 2026-04-13 → 2026-05-15
// so the calendar has past/current/future cases to show.

import type { CaseStatus } from "./cases";

export type ServiceLine = "Orthopedics" | "Cardiothoracic" | "General" | "Spine" | "ENT";

export type AnesthesiaType = "General" | "General + Block" | "Regional" | "MAC" | "Local";

export type AsaClass = "I" | "II" | "III" | "IV" | "IV-E" | "V";

export interface Surgeon {
  name: string;
  specialty: ServiceLine;
  homeRoom: string;
  initials: string;
  color: string; // CSS color var / hex for calendar chips
}

export const SURGEONS: Surgeon[] = [
  { name: "Dr. Anika Patel",     specialty: "Orthopedics",    homeRoom: "OR 326", initials: "AP", color: "var(--primary)" },
  { name: "Dr. Jamal Foster",    specialty: "Orthopedics",    homeRoom: "OR 327", initials: "JF", color: "var(--accent)" },
  { name: "Dr. Sarah Kim",       specialty: "Orthopedics",    homeRoom: "OR 327", initials: "SK", color: "#d97706" },
  { name: "Dr. Ethan Reyes",     specialty: "Cardiothoracic", homeRoom: "OR 411", initials: "ER", color: "#dc2626" },
  { name: "Dr. Raul Okafor",     specialty: "General",        homeRoom: "OR 205", initials: "RO", color: "#2563eb" },
  { name: "Dr. Elena Vasquez",   specialty: "Spine",          homeRoom: "OR 308", initials: "EV", color: "#7c3aed" },
  { name: "Dr. Liam O'Connell",  specialty: "General",        homeRoom: "OR 205", initials: "LO", color: "#0891b2" },
  { name: "Dr. Aisha Bhatt",     specialty: "Cardiothoracic", homeRoom: "OR 411", initials: "AB", color: "#be185d" },
  { name: "Dr. Mateus Silva",    specialty: "Spine",          homeRoom: "OR 308", initials: "MS", color: "#9333ea" },
  { name: "Dr. Hannah Park",     specialty: "ENT",            homeRoom: "OR 327", initials: "HP", color: "#0d9488" },
];

export const ROOMS = ["OR 326", "OR 327", "OR 411", "OR 205", "OR 308"] as const;

export const SERVICE_LINES: ServiceLine[] = [
  "Orthopedics",
  "Cardiothoracic",
  "General",
  "Spine",
  "ENT",
];

export const SERVICE_LINE_COLORS: Record<ServiceLine, string> = {
  Orthopedics: "var(--primary)",
  Cardiothoracic: "#dc2626",
  General: "#2563eb",
  Spine: "#7c3aed",
  ENT: "#0891b2",
};

export interface ScheduleCase {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** 24-h "HH:MM" */
  time: string;
  durationMin: number;
  room: string;
  patientName: string;
  patientAgeSex: string;
  patientMrn: string;
  procedure: string;
  procedureShort: string;
  side?: "Left" | "Right" | "Bilateral";
  surgeon: string;
  serviceLine: ServiceLine;
  anesthesiaType: AnesthesiaType;
  asaClass: AsaClass;
  status: CaseStatus;
  firstCase?: boolean;
  addOn?: boolean;
  implantsRequired?: boolean;
  /** Flags for the circulating nurse / scrub / anesthesia to notice at a glance. */
  specialNeeds?: string[];
  notes?: string;
  // Team — assigned deterministically by (date + room) so the same room on
  // the same day has a consistent team across cases (matches real OR shifts).
  anesthesiologist: string;
  scrubTech: string;
  circulator: string;
}

/** Pools assigned per room/day. Names only — titles added at assignment time. */
export const ANESTHESIOLOGISTS = [
  "Dr. Priya Shah",
  "Dr. Nathan Greer",
  "Dr. Chiamaka Eze",
  "Dr. Adrián Castillo",
  "Dr. Hana Tanaka",
];

export const SCRUB_TECHS = [
  "Marcus Webb, CST",
  "Theresa Nguyen, CST",
  "Devon Kim, CST",
  "Yolanda Price, CST",
  "Isaac Muñoz, CST",
];

export const CIRCULATORS = [
  "Melissa Quinn, RN",
  "Jordan Hassan, RN",
  "Rose Delacroix, RN",
  "Aisha Weber, RN",
];

/** Stable hash of a string — deterministic team assignment. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pick the team for a given room + date. Same key → same team. */
export function teamFor(date: string, room: string) {
  const h = hashStr(`${date}|${room}`);
  return {
    anesthesiologist: ANESTHESIOLOGISTS[h % ANESTHESIOLOGISTS.length],
    scrubTech: SCRUB_TECHS[Math.floor(h / 7) % SCRUB_TECHS.length],
    circulator: CIRCULATORS[Math.floor(h / 53) % CIRCULATORS.length],
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD in local time (avoids UTC shift on toISOString). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-04-24" → "Friday, April 24" */
export function formatLongDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "2026-04-24" → "Apr 24" */
export function formatShortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────
// The schedule (hand-curated for demo realism)
//
// Past dates get status: "completed" (except noted delays / cancellations).
// 2026-04-24 (today) mirrors TODAY_CASES from cases.ts so the OR 326 cases
// line up between Pre-Op dashboard and Schedule view.
// Future dates get status: "scheduled" (a couple delayed / cancelled for
// realism).
// ─────────────────────────────────────────────────────────────────────────

// Raw per-case records without team fields — team is computed per (date+room)
// and folded in below, so every case in the same room on the same day picks
// up a consistent anesthesiologist / scrub tech / circulator.
const RAW_SCHEDULE_CASES: Array<
  Omit<ScheduleCase, "anesthesiologist" | "scrubTech" | "circulator">
> = [
  // ─── Week of 2026-04-13 (completed) ────────────────────────────────────
  {
    id: "s-0413-01",
    date: "2026-04-13",
    time: "07:30",
    durationMin: 120,
    room: "OR 326",
    patientName: "Eleanor Ross",
    patientAgeSex: "68F",
    patientMrn: "MRN 812-330",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "III",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0413-02",
    date: "2026-04-13",
    time: "10:00",
    durationMin: 90,
    room: "OR 326",
    patientName: "David Huang",
    patientAgeSex: "54M",
    patientMrn: "MRN 820-117",
    procedure: "Arthroscopic Rotator Cuff Repair",
    procedureShort: "RCR",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "completed",
  },
  {
    id: "s-0413-03",
    date: "2026-04-13",
    time: "08:15",
    durationMin: 240,
    room: "OR 411",
    patientName: "Margaret Okonkwo",
    patientAgeSex: "72F",
    patientMrn: "MRN 755-091",
    procedure: "Coronary Artery Bypass Grafting × 3",
    procedureShort: "CABG",
    surgeon: "Dr. Ethan Reyes",
    serviceLine: "Cardiothoracic",
    anesthesiaType: "General",
    asaClass: "IV",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Difficult airway — video laryngoscopy available", "Blood products on standby"],
  },
  {
    id: "s-0413-04",
    date: "2026-04-13",
    time: "07:45",
    durationMin: 75,
    room: "OR 205",
    patientName: "Leonard Diaz",
    patientAgeSex: "46M",
    patientMrn: "MRN 864-229",
    procedure: "Laparoscopic Cholecystectomy",
    procedureShort: "Lap Chole",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "II",
    status: "completed",
    firstCase: true,
  },

  {
    id: "s-0414-01",
    date: "2026-04-14",
    time: "07:30",
    durationMin: 180,
    room: "OR 308",
    patientName: "Hiroshi Tanaka",
    patientAgeSex: "61M",
    patientMrn: "MRN 901-043",
    procedure: "Anterior Cervical Discectomy & Fusion C5–C6",
    procedureShort: "ACDF",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "III",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Neuromonitoring — SSEP/MEP"],
  },
  {
    id: "s-0414-02",
    date: "2026-04-14",
    time: "07:30",
    durationMin: 105,
    room: "OR 327",
    patientName: "Yasmin Aldridge",
    patientAgeSex: "34F",
    patientMrn: "MRN 912-776",
    procedure: "Carpal Tunnel Release (open)",
    procedureShort: "CTR",
    side: "Right",
    surgeon: "Dr. Sarah Kim",
    serviceLine: "Orthopedics",
    anesthesiaType: "MAC",
    asaClass: "I",
    status: "completed",
    firstCase: true,
  },
  {
    id: "s-0414-03",
    date: "2026-04-14",
    time: "10:00",
    durationMin: 120,
    room: "OR 327",
    patientName: "Thomas O'Brien",
    patientAgeSex: "59M",
    patientMrn: "MRN 878-551",
    procedure: "Distal Radius ORIF",
    procedureShort: "DR ORIF",
    side: "Left",
    surgeon: "Dr. Sarah Kim",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "II",
    status: "completed",
    implantsRequired: true,
  },

  {
    id: "s-0415-01",
    date: "2026-04-15",
    time: "07:30",
    durationMin: 180,
    room: "OR 326",
    patientName: "Catalina Moreno",
    patientAgeSex: "55F",
    patientMrn: "MRN 823-994",
    procedure: "Total Knee Arthroplasty",
    procedureShort: "TKA",
    side: "Right",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "II",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0415-02",
    date: "2026-04-15",
    time: "11:00",
    durationMin: 210,
    room: "OR 326",
    patientName: "Walter Fitzgerald",
    patientAgeSex: "67M",
    patientMrn: "MRN 791-488",
    procedure: "Total Hip Arthroplasty",
    procedureShort: "THA",
    side: "Left",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "III",
    status: "completed",
    implantsRequired: true,
    specialNeeds: ["BMI 34 — additional padding"],
  },
  {
    id: "s-0415-03",
    date: "2026-04-15",
    time: "07:30",
    durationMin: 90,
    room: "OR 205",
    patientName: "Beatrice Chao",
    patientAgeSex: "38F",
    patientMrn: "MRN 834-002",
    procedure: "Open Inguinal Hernia Repair",
    procedureShort: "Hernia",
    side: "Right",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "I",
    status: "completed",
    firstCase: true,
  },
  {
    id: "s-0415-04",
    date: "2026-04-15",
    time: "09:30",
    durationMin: 60,
    room: "OR 205",
    patientName: "Isabella Knight",
    patientAgeSex: "29F",
    patientMrn: "MRN 888-101",
    procedure: "Laparoscopic Appendectomy",
    procedureShort: "Appy",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "II",
    status: "completed",
    addOn: true,
    notes: "Add-on — urgent from ED",
  },

  {
    id: "s-0416-01",
    date: "2026-04-16",
    time: "07:30",
    durationMin: 105,
    room: "OR 326",
    patientName: "Marcus Lindqvist",
    patientAgeSex: "42M",
    patientMrn: "MRN 814-667",
    procedure: "Arthroscopic Bankart Repair",
    procedureShort: "BNK",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0416-02",
    date: "2026-04-16",
    time: "07:30",
    durationMin: 300,
    room: "OR 411",
    patientName: "Aleksander Novák",
    patientAgeSex: "58M",
    patientMrn: "MRN 749-220",
    procedure: "Aortic Valve Replacement (TAVR)",
    procedureShort: "TAVR",
    surgeon: "Dr. Ethan Reyes",
    serviceLine: "Cardiothoracic",
    anesthesiaType: "General",
    asaClass: "IV",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Dual anti-platelet", "Echo in room"],
  },

  {
    id: "s-0417-01",
    date: "2026-04-17",
    time: "07:30",
    durationMin: 90,
    room: "OR 326",
    patientName: "Fiona MacLeod",
    patientAgeSex: "49F",
    patientMrn: "MRN 807-334",
    procedure: "Subacromial Decompression",
    procedureShort: "SAD",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "completed",
    firstCase: true,
  },
  {
    id: "s-0417-02",
    date: "2026-04-17",
    time: "09:30",
    durationMin: 120,
    room: "OR 326",
    patientName: "Rebecca Alvarez",
    patientAgeSex: "45F",
    patientMrn: "MRN 856-993",
    procedure: "SLAP Repair",
    procedureShort: "SLAP",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "I",
    status: "completed",
    implantsRequired: true,
  },
  {
    id: "s-0417-03",
    date: "2026-04-17",
    time: "13:00",
    durationMin: 180,
    room: "OR 308",
    patientName: "Nathaniel Brooks",
    patientAgeSex: "62M",
    patientMrn: "MRN 822-457",
    procedure: "Lumbar Laminectomy L4–L5",
    procedureShort: "Lami",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "III",
    status: "completed",
    specialNeeds: ["Neuromonitoring"],
  },

  // ─── Week of 2026-04-20 (current, prior days completed) ────────────────
  {
    id: "s-0420-01",
    date: "2026-04-20",
    time: "07:30",
    durationMin: 180,
    room: "OR 326",
    patientName: "Graham Whitaker",
    patientAgeSex: "70M",
    patientMrn: "MRN 702-119",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "III",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0420-02",
    date: "2026-04-20",
    time: "11:15",
    durationMin: 90,
    room: "OR 326",
    patientName: "Sophia Becker",
    patientAgeSex: "52F",
    patientMrn: "MRN 809-442",
    procedure: "Arthroscopic Rotator Cuff Repair",
    procedureShort: "RCR",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "completed",
  },
  {
    id: "s-0420-03",
    date: "2026-04-20",
    time: "07:30",
    durationMin: 240,
    room: "OR 411",
    patientName: "Howard Pennington",
    patientAgeSex: "66M",
    patientMrn: "MRN 750-882",
    procedure: "Mitral Valve Repair",
    procedureShort: "MVR",
    surgeon: "Dr. Ethan Reyes",
    serviceLine: "Cardiothoracic",
    anesthesiaType: "General",
    asaClass: "IV",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["TEE in room"],
  },

  {
    id: "s-0421-01",
    date: "2026-04-21",
    time: "07:30",
    durationMin: 210,
    room: "OR 327",
    patientName: "Adele Sutherland",
    patientAgeSex: "64F",
    patientMrn: "MRN 781-555",
    procedure: "Total Hip Arthroplasty",
    procedureShort: "THA",
    side: "Right",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "II",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0421-02",
    date: "2026-04-21",
    time: "11:30",
    durationMin: 75,
    room: "OR 327",
    patientName: "Jason Mercer",
    patientAgeSex: "31M",
    patientMrn: "MRN 891-330",
    procedure: "Trigger Finger Release (D3)",
    procedureShort: "TFR",
    side: "Right",
    surgeon: "Dr. Sarah Kim",
    serviceLine: "Orthopedics",
    anesthesiaType: "MAC",
    asaClass: "I",
    status: "completed",
  },
  {
    id: "s-0421-03",
    date: "2026-04-21",
    time: "07:30",
    durationMin: 60,
    room: "OR 205",
    patientName: "Hannah Rosenberg",
    patientAgeSex: "27F",
    patientMrn: "MRN 902-771",
    procedure: "Laparoscopic Cholecystectomy",
    procedureShort: "Lap Chole",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "I",
    status: "completed",
    firstCase: true,
  },

  {
    id: "s-0422-01",
    date: "2026-04-22",
    time: "07:30",
    durationMin: 90,
    room: "OR 326",
    patientName: "Vincent Haraway",
    patientAgeSex: "59M",
    patientMrn: "MRN 816-208",
    procedure: "SLAP Repair · Biceps Tenodesis",
    procedureShort: "SLAP",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0422-02",
    date: "2026-04-22",
    time: "07:30",
    durationMin: 240,
    room: "OR 308",
    patientName: "Priscilla Wen",
    patientAgeSex: "47F",
    patientMrn: "MRN 834-661",
    procedure: "Posterior Spinal Fusion L3–L5",
    procedureShort: "PSF",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "III",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Neuromonitoring", "Cell saver"],
  },

  {
    id: "s-0423-01",
    date: "2026-04-23",
    time: "07:30",
    durationMin: 120,
    room: "OR 326",
    patientName: "Augusta Bellamy",
    patientAgeSex: "71F",
    patientMrn: "MRN 795-112",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "III",
    status: "completed",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0423-02",
    date: "2026-04-23",
    time: "11:00",
    durationMin: 75,
    room: "OR 205",
    patientName: "Samuel Kowalski",
    patientAgeSex: "44M",
    patientMrn: "MRN 843-221",
    procedure: "Laparoscopic Inguinal Hernia Repair",
    procedureShort: "Hernia",
    side: "Bilateral",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "II",
    status: "completed",
  },

  // ─── 2026-04-24 · TODAY (mirrors TODAY_CASES for OR 326) ───────────────
  {
    id: "c-001",
    date: "2026-04-24",
    time: "07:30",
    durationMin: 90,
    room: "OR 326",
    patientName: "Helena Voss",
    patientAgeSex: "58F",
    patientMrn: "MRN 884-221",
    procedure: "Arthroscopic Rotator Cuff Repair",
    procedureShort: "RCR",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "completed",
    firstCase: true,
    specialNeeds: ["Latex allergy — no latex in field"],
  },
  {
    id: "c-002",
    date: "2026-04-24",
    time: "09:45",
    durationMin: 150,
    room: "OR 326",
    patientName: "Marcus Chen",
    patientAgeSex: "62M",
    patientMrn: "MRN 902-118",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "III",
    status: "next",
    implantsRequired: true,
    specialNeeds: ["Penicillin allergy — Anaphylaxis", "No Betadine"],
  },
  {
    id: "c-003",
    date: "2026-04-24",
    time: "12:30",
    durationMin: 75,
    room: "OR 326",
    patientName: "Priya Raman",
    patientAgeSex: "44F",
    patientMrn: "MRN 871-044",
    procedure: "SLAP Repair · Biceps Tenodesis",
    procedureShort: "SLAP",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    implantsRequired: true,
    specialNeeds: ["Opioid-sparing plan", "Low Hgb — T&S on file"],
  },
  {
    id: "c-004",
    date: "2026-04-24",
    time: "14:15",
    durationMin: 60,
    room: "OR 326",
    patientName: "Jonas Albrecht",
    patientAgeSex: "37M",
    patientMrn: "MRN 913-207",
    procedure: "Bankart Repair",
    procedureShort: "BNK",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "delayed",
    implantsRequired: true,
    notes: "Case delayed — patient NPO > 14 h",
  },
  {
    id: "c-005",
    date: "2026-04-24",
    time: "16:00",
    durationMin: 105,
    room: "OR 326",
    patientName: "Linnea Sundberg",
    patientAgeSex: "51F",
    patientMrn: "MRN 845-553",
    procedure: "Subacromial Decompression",
    procedureShort: "SAD",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    specialNeeds: ["No NSAIDs — GI bleed history"],
  },
  {
    id: "s-0424-06",
    date: "2026-04-24",
    time: "07:30",
    durationMin: 180,
    room: "OR 327",
    patientName: "Oscar Brennan",
    patientAgeSex: "68M",
    patientMrn: "MRN 802-550",
    procedure: "Total Knee Arthroplasty",
    procedureShort: "TKA",
    side: "Right",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "III",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0424-07",
    date: "2026-04-24",
    time: "11:30",
    durationMin: 105,
    room: "OR 327",
    patientName: "Olivia Marchetti",
    patientAgeSex: "72F",
    patientMrn: "MRN 788-441",
    procedure: "Total Hip Revision",
    procedureShort: "THA Rev",
    side: "Left",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "General",
    asaClass: "III",
    status: "scheduled",
    implantsRequired: true,
    specialNeeds: ["Cell saver", "Blood products x 2 units"],
  },
  {
    id: "s-0424-08",
    date: "2026-04-24",
    time: "07:30",
    durationMin: 270,
    room: "OR 308",
    patientName: "Declan Whitfield",
    patientAgeSex: "41M",
    patientMrn: "MRN 856-003",
    procedure: "Craniotomy · Meningioma Resection",
    procedureShort: "Cranio",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "III",
    status: "scheduled",
    firstCase: true,
    specialNeeds: ["Neuromonitoring", "ICU bed booked"],
  },

  // ─── Week of 2026-04-27 (scheduled) ────────────────────────────────────
  {
    id: "s-0427-01",
    date: "2026-04-27",
    time: "07:30",
    durationMin: 150,
    room: "OR 326",
    patientName: "Rowan Kellerman",
    patientAgeSex: "56M",
    patientMrn: "MRN 921-100",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0427-02",
    date: "2026-04-27",
    time: "10:15",
    durationMin: 90,
    room: "OR 326",
    patientName: "Maya Osei",
    patientAgeSex: "39F",
    patientMrn: "MRN 928-771",
    procedure: "Arthroscopic Rotator Cuff Repair",
    procedureShort: "RCR",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "I",
    status: "scheduled",
  },
  {
    id: "s-0427-03",
    date: "2026-04-27",
    time: "07:30",
    durationMin: 240,
    room: "OR 411",
    patientName: "Clarence Donovan",
    patientAgeSex: "71M",
    patientMrn: "MRN 763-884",
    procedure: "CABG × 4",
    procedureShort: "CABG",
    surgeon: "Dr. Ethan Reyes",
    serviceLine: "Cardiothoracic",
    anesthesiaType: "General",
    asaClass: "IV",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["ICU bed booked", "Blood products on standby"],
  },

  {
    id: "s-0428-01",
    date: "2026-04-28",
    time: "07:30",
    durationMin: 180,
    room: "OR 327",
    patientName: "Celeste Lindgren",
    patientAgeSex: "58F",
    patientMrn: "MRN 885-200",
    procedure: "Total Knee Arthroplasty",
    procedureShort: "TKA",
    side: "Left",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0428-02",
    date: "2026-04-28",
    time: "11:00",
    durationMin: 105,
    room: "OR 327",
    patientName: "Pascal Giraud",
    patientAgeSex: "52M",
    patientMrn: "MRN 872-551",
    procedure: "Distal Radius ORIF",
    procedureShort: "DR ORIF",
    side: "Right",
    surgeon: "Dr. Sarah Kim",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "I",
    status: "scheduled",
    implantsRequired: true,
  },

  {
    id: "s-0429-01",
    date: "2026-04-29",
    time: "07:30",
    durationMin: 210,
    room: "OR 308",
    patientName: "Isadora Kelmendi",
    patientAgeSex: "44F",
    patientMrn: "MRN 845-119",
    procedure: "ACDF C5–C7",
    procedureShort: "ACDF",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Neuromonitoring"],
  },
  {
    id: "s-0429-02",
    date: "2026-04-29",
    time: "07:30",
    durationMin: 60,
    room: "OR 205",
    patientName: "Eugenie Bellweather",
    patientAgeSex: "34F",
    patientMrn: "MRN 890-204",
    procedure: "Laparoscopic Cholecystectomy",
    procedureShort: "Lap Chole",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "I",
    status: "scheduled",
    firstCase: true,
  },
  {
    id: "s-0429-03",
    date: "2026-04-29",
    time: "09:30",
    durationMin: 180,
    room: "OR 205",
    patientName: "Hector Zapata",
    patientAgeSex: "63M",
    patientMrn: "MRN 841-773",
    procedure: "Open Right Hemicolectomy",
    procedureShort: "Colectomy",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "III",
    status: "scheduled",
    specialNeeds: ["ERAS protocol"],
  },

  {
    id: "s-0430-01",
    date: "2026-04-30",
    time: "07:30",
    durationMin: 120,
    room: "OR 326",
    patientName: "Annika Holmgren",
    patientAgeSex: "61F",
    patientMrn: "MRN 893-001",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0430-02",
    date: "2026-04-30",
    time: "10:00",
    durationMin: 90,
    room: "OR 326",
    patientName: "Dimitri Laskaris",
    patientAgeSex: "48M",
    patientMrn: "MRN 909-441",
    procedure: "Subacromial Decompression",
    procedureShort: "SAD",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "cancelled",
    notes: "Cancelled — pre-op cardiac clearance pending",
  },

  {
    id: "s-0501-01",
    date: "2026-05-01",
    time: "07:30",
    durationMin: 180,
    room: "OR 327",
    patientName: "Regina Duval",
    patientAgeSex: "72F",
    patientMrn: "MRN 780-993",
    procedure: "Total Hip Arthroplasty",
    procedureShort: "THA",
    side: "Left",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "III",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0501-02",
    date: "2026-05-01",
    time: "07:30",
    durationMin: 300,
    room: "OR 411",
    patientName: "Konrad Albrechtsen",
    patientAgeSex: "69M",
    patientMrn: "MRN 741-118",
    procedure: "Aortic Valve Replacement (TAVR)",
    procedureShort: "TAVR",
    surgeon: "Dr. Ethan Reyes",
    serviceLine: "Cardiothoracic",
    anesthesiaType: "General",
    asaClass: "IV",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },

  // ─── Week of 2026-05-04 (scheduled) ────────────────────────────────────
  {
    id: "s-0504-01",
    date: "2026-05-04",
    time: "07:30",
    durationMin: 90,
    room: "OR 326",
    patientName: "Bernadette Yu",
    patientAgeSex: "55F",
    patientMrn: "MRN 914-221",
    procedure: "SLAP Repair",
    procedureShort: "SLAP",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "I",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0504-02",
    date: "2026-05-04",
    time: "09:30",
    durationMin: 120,
    room: "OR 326",
    patientName: "Roderick Amadi",
    patientAgeSex: "66M",
    patientMrn: "MRN 872-441",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    implantsRequired: true,
  },
  {
    id: "s-0504-03",
    date: "2026-05-04",
    time: "07:30",
    durationMin: 75,
    room: "OR 205",
    patientName: "Tamsin Fletcher",
    patientAgeSex: "41F",
    patientMrn: "MRN 895-330",
    procedure: "Laparoscopic Cholecystectomy",
    procedureShort: "Lap Chole",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
  },

  {
    id: "s-0505-01",
    date: "2026-05-05",
    time: "07:30",
    durationMin: 240,
    room: "OR 308",
    patientName: "Bram Vondermann",
    patientAgeSex: "57M",
    patientMrn: "MRN 819-552",
    procedure: "Posterior Spinal Fusion T11–L1",
    procedureShort: "PSF",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "III",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Neuromonitoring", "Cell saver"],
  },

  {
    id: "s-0506-01",
    date: "2026-05-06",
    time: "07:30",
    durationMin: 180,
    room: "OR 327",
    patientName: "Leonie Faulkner",
    patientAgeSex: "67F",
    patientMrn: "MRN 808-119",
    procedure: "Total Knee Arthroplasty",
    procedureShort: "TKA",
    side: "Right",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0506-02",
    date: "2026-05-06",
    time: "11:00",
    durationMin: 90,
    room: "OR 327",
    patientName: "Anais Petrova",
    patientAgeSex: "28F",
    patientMrn: "MRN 925-220",
    procedure: "Carpal Tunnel Release (endoscopic)",
    procedureShort: "CTR",
    side: "Right",
    surgeon: "Dr. Sarah Kim",
    serviceLine: "Orthopedics",
    anesthesiaType: "MAC",
    asaClass: "I",
    status: "scheduled",
  },

  {
    id: "s-0507-01",
    date: "2026-05-07",
    time: "07:30",
    durationMin: 105,
    room: "OR 326",
    patientName: "Finnegan Ward",
    patientAgeSex: "45M",
    patientMrn: "MRN 866-221",
    procedure: "Arthroscopic Bankart Repair",
    procedureShort: "BNK",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0507-02",
    date: "2026-05-07",
    time: "09:45",
    durationMin: 90,
    room: "OR 326",
    patientName: "Ingrid Solberg",
    patientAgeSex: "53F",
    patientMrn: "MRN 878-885",
    procedure: "Arthroscopic Rotator Cuff Repair",
    procedureShort: "RCR",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
  },

  {
    id: "s-0508-01",
    date: "2026-05-08",
    time: "07:30",
    durationMin: 270,
    room: "OR 411",
    patientName: "Mikail Radovanović",
    patientAgeSex: "64M",
    patientMrn: "MRN 736-991",
    procedure: "Mitral Valve Repair + Maze Procedure",
    procedureShort: "MVR + Maze",
    surgeon: "Dr. Ethan Reyes",
    serviceLine: "Cardiothoracic",
    anesthesiaType: "General",
    asaClass: "IV",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["TEE in room", "ICU bed booked"],
  },

  // ─── Week of 2026-05-11 (scheduled, lighter) ───────────────────────────
  {
    id: "s-0511-01",
    date: "2026-05-11",
    time: "07:30",
    durationMin: 120,
    room: "OR 326",
    patientName: "Cornelia Easton",
    patientAgeSex: "62F",
    patientMrn: "MRN 812-006",
    procedure: "Reverse Total Shoulder Arthroplasty",
    procedureShort: "RSA",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },
  {
    id: "s-0511-02",
    date: "2026-05-11",
    time: "10:00",
    durationMin: 90,
    room: "OR 326",
    patientName: "Louis Armstrong",
    patientAgeSex: "43M",
    patientMrn: "MRN 903-117",
    procedure: "Subacromial Decompression",
    procedureShort: "SAD",
    side: "Left",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "I",
    status: "scheduled",
  },

  {
    id: "s-0512-01",
    date: "2026-05-12",
    time: "07:30",
    durationMin: 210,
    room: "OR 327",
    patientName: "Gretchen Moreau",
    patientAgeSex: "69F",
    patientMrn: "MRN 774-443",
    procedure: "Total Hip Arthroplasty",
    procedureShort: "THA",
    side: "Right",
    surgeon: "Dr. Jamal Foster",
    serviceLine: "Orthopedics",
    anesthesiaType: "Regional",
    asaClass: "III",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
  },

  {
    id: "s-0513-01",
    date: "2026-05-13",
    time: "07:30",
    durationMin: 180,
    room: "OR 308",
    patientName: "Elliott Marchetti",
    patientAgeSex: "38M",
    patientMrn: "MRN 901-119",
    procedure: "ACDF C4–C5",
    procedureShort: "ACDF",
    surgeon: "Dr. Elena Vasquez",
    serviceLine: "Spine",
    anesthesiaType: "General",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
    implantsRequired: true,
    specialNeeds: ["Neuromonitoring"],
  },

  {
    id: "s-0514-01",
    date: "2026-05-14",
    time: "07:30",
    durationMin: 75,
    room: "OR 205",
    patientName: "Rosalind Banerjee",
    patientAgeSex: "35F",
    patientMrn: "MRN 918-330",
    procedure: "Laparoscopic Appendectomy",
    procedureShort: "Appy",
    surgeon: "Dr. Raul Okafor",
    serviceLine: "General",
    anesthesiaType: "General",
    asaClass: "I",
    status: "scheduled",
    firstCase: true,
  },

  {
    id: "s-0515-01",
    date: "2026-05-15",
    time: "07:30",
    durationMin: 90,
    room: "OR 326",
    patientName: "Tobias Kensington",
    patientAgeSex: "48M",
    patientMrn: "MRN 885-552",
    procedure: "Arthroscopic Rotator Cuff Repair",
    procedureShort: "RCR",
    side: "Right",
    surgeon: "Dr. Anika Patel",
    serviceLine: "Orthopedics",
    anesthesiaType: "General + Block",
    asaClass: "II",
    status: "scheduled",
    firstCase: true,
  },

  // ─── Week of 2026-05-18 ────────────────────────────────────────────────
  { id: "s-0518-01", date: "2026-05-18", time: "07:30", durationMin: 120, room: "OR 326", patientName: "Cassie Young",        patientAgeSex: "54F", patientMrn: "MRN 930-001", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0518-02", date: "2026-05-18", time: "10:00", durationMin: 90,  room: "OR 326", patientName: "Ronan McKenna",       patientAgeSex: "47M", patientMrn: "MRN 930-112", procedure: "Arthroscopic Rotator Cuff Repair",    procedureShort: "RCR",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled" },
  { id: "s-0518-03", date: "2026-05-18", time: "07:30", durationMin: 180, room: "OR 327", patientName: "Delia Norton",        patientAgeSex: "66F", patientMrn: "MRN 931-220", procedure: "Total Knee Arthroplasty",              procedureShort: "TKA",     side: "Right",     surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0518-04", date: "2026-05-18", time: "07:30", durationMin: 240, room: "OR 411", patientName: "Sergei Lysenko",      patientAgeSex: "68M", patientMrn: "MRN 745-557", procedure: "CABG × 3",                              procedureShort: "CABG",    surgeon: "Dr. Ethan Reyes",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["ICU bed booked"] },
  { id: "s-0518-05", date: "2026-05-18", time: "07:30", durationMin: 75,  room: "OR 205", patientName: "Selene Vargas",       patientAgeSex: "33F", patientMrn: "MRN 899-330", procedure: "Laparoscopic Cholecystectomy",         procedureShort: "Lap Chole", surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "I",   status: "scheduled", firstCase: true },

  { id: "s-0519-01", date: "2026-05-19", time: "07:30", durationMin: 105, room: "OR 326", patientName: "Harlan Price",        patientAgeSex: "52M", patientMrn: "MRN 870-441", procedure: "Arthroscopic Bankart Repair",          procedureShort: "BNK",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0519-02", date: "2026-05-19", time: "07:30", durationMin: 210, room: "OR 327", patientName: "Inez Pellegrino",     patientAgeSex: "71F", patientMrn: "MRN 781-663", procedure: "Total Hip Arthroplasty",               procedureShort: "THA",     side: "Left",      surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0519-03", date: "2026-05-19", time: "11:30", durationMin: 90,  room: "OR 327", patientName: "Bruno Ferrara",       patientAgeSex: "29M", patientMrn: "MRN 925-114", procedure: "Carpal Tunnel Release (endoscopic)",   procedureShort: "CTR",     side: "Right",     surgeon: "Dr. Sarah Kim",     serviceLine: "Orthopedics",    anesthesiaType: "MAC",             asaClass: "I",   status: "scheduled" },
  { id: "s-0519-04", date: "2026-05-19", time: "07:30", durationMin: 60,  room: "OR 205", patientName: "Minerva Kessler",     patientAgeSex: "41F", patientMrn: "MRN 901-881", procedure: "Laparoscopic Appendectomy",            procedureShort: "Appy",    surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "II",  status: "scheduled", firstCase: true, addOn: true, notes: "Add-on — urgent from ED" },

  { id: "s-0520-01", date: "2026-05-20", time: "07:30", durationMin: 120, room: "OR 326", patientName: "Everett Moreau",      patientAgeSex: "58M", patientMrn: "MRN 872-009", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0520-02", date: "2026-05-20", time: "07:30", durationMin: 180, room: "OR 308", patientName: "Philippa Osei",       patientAgeSex: "62F", patientMrn: "MRN 844-770", procedure: "Lumbar Laminectomy L3–L4",             procedureShort: "Lami",    surgeon: "Dr. Elena Vasquez", serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "II",  status: "scheduled", firstCase: true, specialNeeds: ["Neuromonitoring"] },
  { id: "s-0520-03", date: "2026-05-20", time: "09:00", durationMin: 75,  room: "OR 205", patientName: "Gideon Blake",        patientAgeSex: "55M", patientMrn: "MRN 856-007", procedure: "Laparoscopic Inguinal Hernia Repair",  procedureShort: "Hernia",  side: "Bilateral", surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "II",  status: "scheduled" },

  { id: "s-0521-01", date: "2026-05-21", time: "07:30", durationMin: 150, room: "OR 326", patientName: "Rosamund Liljeström", patientAgeSex: "69F", patientMrn: "MRN 861-447", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0521-02", date: "2026-05-21", time: "10:30", durationMin: 90,  room: "OR 326", patientName: "Benedict Kaur",       patientAgeSex: "44M", patientMrn: "MRN 889-223", procedure: "Subacromial Decompression",             procedureShort: "SAD",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled" },
  { id: "s-0521-03", date: "2026-05-21", time: "07:30", durationMin: 180, room: "OR 327", patientName: "Aurelia Mendoza",     patientAgeSex: "64F", patientMrn: "MRN 821-114", procedure: "Total Knee Arthroplasty",              procedureShort: "TKA",     side: "Left",      surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0521-04", date: "2026-05-21", time: "09:00", durationMin: 180, room: "OR 205", patientName: "Tarek Azizi",         patientAgeSex: "58M", patientMrn: "MRN 873-446", procedure: "Open Right Hemicolectomy",             procedureShort: "Colectomy", surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "III", status: "scheduled", specialNeeds: ["ERAS protocol"] },

  { id: "s-0522-01", date: "2026-05-22", time: "07:30", durationMin: 90,  room: "OR 326", patientName: "Josephine Clarke",    patientAgeSex: "51F", patientMrn: "MRN 890-550", procedure: "Subacromial Decompression",             procedureShort: "SAD",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true },
  { id: "s-0522-02", date: "2026-05-22", time: "07:30", durationMin: 120, room: "OR 327", patientName: "Ezra Holloway",       patientAgeSex: "37M", patientMrn: "MRN 915-220", procedure: "Distal Radius ORIF",                    procedureShort: "DR ORIF", side: "Right",     surgeon: "Dr. Sarah Kim",     serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "I",   status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0522-03", date: "2026-05-22", time: "07:30", durationMin: 300, room: "OR 411", patientName: "Matteo Ricci",        patientAgeSex: "72M", patientMrn: "MRN 730-118", procedure: "Aortic Valve Replacement (TAVR)",     procedureShort: "TAVR",    surgeon: "Dr. Ethan Reyes",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["ICU bed booked"] },

  // ─── Week of 2026-05-25 (Memorial Day — Mon closed) ────────────────────
  { id: "s-0526-01", date: "2026-05-26", time: "07:30", durationMin: 150, room: "OR 326", patientName: "Cordelia Winthrop",   patientAgeSex: "61F", patientMrn: "MRN 847-001", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0526-02", date: "2026-05-26", time: "07:30", durationMin: 180, room: "OR 327", patientName: "Miles Archer",        patientAgeSex: "67M", patientMrn: "MRN 812-447", procedure: "Total Knee Arthroplasty",              procedureShort: "TKA",     side: "Right",     surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0526-03", date: "2026-05-26", time: "07:30", durationMin: 270, room: "OR 411", patientName: "Valentina Horvat",    patientAgeSex: "66F", patientMrn: "MRN 719-220", procedure: "Mitral Valve Repair",                  procedureShort: "MVR",     surgeon: "Dr. Ethan Reyes",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["TEE in room"] },
  { id: "s-0526-04", date: "2026-05-26", time: "08:00", durationMin: 75,  room: "OR 205", patientName: "Beau Chandler",       patientAgeSex: "42M", patientMrn: "MRN 902-300", procedure: "Laparoscopic Cholecystectomy",         procedureShort: "Lap Chole", surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "II",  status: "scheduled" },

  { id: "s-0527-01", date: "2026-05-27", time: "07:30", durationMin: 90,  room: "OR 326", patientName: "Rhea Kovalenko",      patientAgeSex: "46F", patientMrn: "MRN 864-991", procedure: "Arthroscopic Rotator Cuff Repair",    procedureShort: "RCR",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true },
  { id: "s-0527-02", date: "2026-05-27", time: "08:00", durationMin: 75,  room: "OR 327", patientName: "Silas Forsythe",      patientAgeSex: "32M", patientMrn: "MRN 929-001", procedure: "Trigger Finger Release (D3)",          procedureShort: "TFR",     side: "Left",      surgeon: "Dr. Sarah Kim",     serviceLine: "Orthopedics",    anesthesiaType: "MAC",             asaClass: "I",   status: "scheduled" },
  { id: "s-0527-03", date: "2026-05-27", time: "07:30", durationMin: 240, room: "OR 308", patientName: "Theodosia Marchetti", patientAgeSex: "49F", patientMrn: "MRN 808-552", procedure: "Posterior Spinal Fusion L4–S1",        procedureShort: "PSF",     surgeon: "Dr. Elena Vasquez", serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["Neuromonitoring", "Cell saver"] },

  { id: "s-0528-01", date: "2026-05-28", time: "07:30", durationMin: 105, room: "OR 326", patientName: "Freya Wallenberg",    patientAgeSex: "43F", patientMrn: "MRN 877-118", procedure: "Arthroscopic Bankart Repair",          procedureShort: "BNK",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0528-02", date: "2026-05-28", time: "07:30", durationMin: 210, room: "OR 327", patientName: "Amara Nwachukwu",     patientAgeSex: "65F", patientMrn: "MRN 790-005", procedure: "Total Hip Arthroplasty",               procedureShort: "THA",     side: "Right",     surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0528-03", date: "2026-05-28", time: "07:30", durationMin: 90,  room: "OR 205", patientName: "Kieran O'Donnell",    patientAgeSex: "38M", patientMrn: "MRN 895-443", procedure: "Open Inguinal Hernia Repair",          procedureShort: "Hernia",  side: "Right",     surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "I",   status: "scheduled", firstCase: true },

  { id: "s-0529-01", date: "2026-05-29", time: "07:30", durationMin: 120, room: "OR 326", patientName: "Magnolia Renaud",     patientAgeSex: "57F", patientMrn: "MRN 841-660", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0529-02", date: "2026-05-29", time: "10:30", durationMin: 90,  room: "OR 326", patientName: "Lachlan Berkley",     patientAgeSex: "48M", patientMrn: "MRN 883-220", procedure: "Subacromial Decompression",             procedureShort: "SAD",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled" },
  { id: "s-0529-03", date: "2026-05-29", time: "07:30", durationMin: 180, room: "OR 327", patientName: "Daphne Hellström",    patientAgeSex: "62F", patientMrn: "MRN 815-116", procedure: "Total Knee Arthroplasty",              procedureShort: "TKA",     side: "Right",     surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },

  // ─── Week of 2026-06-01 ────────────────────────────────────────────────
  { id: "s-0601-01", date: "2026-06-01", time: "07:30", durationMin: 150, room: "OR 326", patientName: "Percival Damjanović", patientAgeSex: "59M", patientMrn: "MRN 854-119", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0601-02", date: "2026-06-01", time: "07:30", durationMin: 180, room: "OR 327", patientName: "Giselle Bonheur",     patientAgeSex: "68F", patientMrn: "MRN 808-997", procedure: "Total Knee Arthroplasty",              procedureShort: "TKA",     side: "Left",      surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0601-03", date: "2026-06-01", time: "07:30", durationMin: 240, room: "OR 411", patientName: "Sigmund Klein",       patientAgeSex: "74M", patientMrn: "MRN 728-114", procedure: "CABG × 4",                              procedureShort: "CABG",    surgeon: "Dr. Ethan Reyes",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["ICU bed booked", "Blood products on standby"] },

  { id: "s-0602-01", date: "2026-06-02", time: "07:30", durationMin: 90,  room: "OR 326", patientName: "Octavia Villanueva",  patientAgeSex: "45F", patientMrn: "MRN 869-220", procedure: "Arthroscopic Rotator Cuff Repair",    procedureShort: "RCR",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true },
  { id: "s-0602-02", date: "2026-06-02", time: "07:30", durationMin: 210, room: "OR 327", patientName: "Emmett Crawley",      patientAgeSex: "72M", patientMrn: "MRN 780-550", procedure: "Total Hip Arthroplasty",               procedureShort: "THA",     side: "Right",     surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0602-03", date: "2026-06-02", time: "11:30", durationMin: 90,  room: "OR 327", patientName: "Tatiana Ionescu",     patientAgeSex: "30F", patientMrn: "MRN 929-117", procedure: "Carpal Tunnel Release (open)",         procedureShort: "CTR",     side: "Left",      surgeon: "Dr. Sarah Kim",     serviceLine: "Orthopedics",    anesthesiaType: "MAC",             asaClass: "I",   status: "scheduled" },

  { id: "s-0603-01", date: "2026-06-03", time: "07:30", durationMin: 90,  room: "OR 326", patientName: "Jasper Montague",     patientAgeSex: "41M", patientMrn: "MRN 866-772", procedure: "SLAP Repair",                          procedureShort: "SLAP",    side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "I",   status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0603-02", date: "2026-06-03", time: "10:00", durationMin: 105, room: "OR 326", patientName: "Seraphina Lindqvist", patientAgeSex: "53F", patientMrn: "MRN 855-440", procedure: "Arthroscopic Bankart Repair",          procedureShort: "BNK",     side: "Left",      surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", implantsRequired: true },
  { id: "s-0603-03", date: "2026-06-03", time: "07:30", durationMin: 180, room: "OR 308", patientName: "Thaddeus Brennan",    patientAgeSex: "56M", patientMrn: "MRN 821-009", procedure: "Lumbar Laminectomy L4–L5",             procedureShort: "Lami",    surgeon: "Dr. Elena Vasquez", serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "III", status: "scheduled", firstCase: true, specialNeeds: ["Neuromonitoring"] },

  { id: "s-0604-01", date: "2026-06-04", time: "07:30", durationMin: 90,  room: "OR 326", patientName: "Delphine Yildiz",     patientAgeSex: "49F", patientMrn: "MRN 877-220", procedure: "Subacromial Decompression",             procedureShort: "SAD",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "II",  status: "scheduled", firstCase: true },
  { id: "s-0604-02", date: "2026-06-04", time: "07:30", durationMin: 180, room: "OR 327", patientName: "Phineas Okonkwo",     patientAgeSex: "60M", patientMrn: "MRN 812-114", procedure: "Total Knee Arthroplasty",              procedureShort: "TKA",     side: "Left",      surgeon: "Dr. Jamal Foster",  serviceLine: "Orthopedics",    anesthesiaType: "Regional",        asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0604-03", date: "2026-06-04", time: "08:00", durationMin: 75,  room: "OR 205", patientName: "Calliope Sinclair",   patientAgeSex: "36F", patientMrn: "MRN 909-330", procedure: "Laparoscopic Appendectomy",            procedureShort: "Appy",    surgeon: "Dr. Raul Okafor",   serviceLine: "General",        anesthesiaType: "General",         asaClass: "I",   status: "scheduled", addOn: true, notes: "Add-on — urgent from ED" },

  { id: "s-0605-01", date: "2026-06-05", time: "07:30", durationMin: 120, room: "OR 326", patientName: "Horatio Zappacosta",  patientAgeSex: "66M", patientMrn: "MRN 858-004", procedure: "Reverse Total Shoulder Arthroplasty", procedureShort: "RSA",     side: "Right",     surgeon: "Dr. Anika Patel",   serviceLine: "Orthopedics",    anesthesiaType: "General + Block", asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-0605-02", date: "2026-06-05", time: "08:00", durationMin: 75,  room: "OR 327", patientName: "Ingrid Kallinen",     patientAgeSex: "28F", patientMrn: "MRN 929-220", procedure: "Trigger Finger Release (D2)",          procedureShort: "TFR",     side: "Right",     surgeon: "Dr. Sarah Kim",     serviceLine: "Orthopedics",    anesthesiaType: "MAC",             asaClass: "I",   status: "scheduled" },
  { id: "s-0605-03", date: "2026-06-05", time: "07:30", durationMin: 210, room: "OR 308", patientName: "Xavier Bellmonte",    patientAgeSex: "54M", patientMrn: "MRN 826-118", procedure: "Anterior Cervical Discectomy & Fusion C5–C6", procedureShort: "ACDF", surgeon: "Dr. Elena Vasquez", serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["Neuromonitoring"] },

  // ─── Cases for the four newer surgeons (sprinkled across the demo range) ─
  // Dr. Liam O'Connell — General
  { id: "s-oc-0427", date: "2026-04-27", time: "11:30", durationMin: 90,  room: "OR 205", patientName: "Tobias Marlowe",      patientAgeSex: "52M", patientMrn: "MRN 822-114", procedure: "Laparoscopic Inguinal Hernia Repair",  procedureShort: "Hernia",  side: "Left",  surgeon: "Dr. Liam O'Connell", serviceLine: "General",        anesthesiaType: "General",         asaClass: "II",  status: "scheduled" },
  { id: "s-oc-0430", date: "2026-04-30", time: "07:30", durationMin: 75,  room: "OR 205", patientName: "Vesper Calloway",     patientAgeSex: "39F", patientMrn: "MRN 887-302", procedure: "Laparoscopic Cholecystectomy",         procedureShort: "Lap Chole", surgeon: "Dr. Liam O'Connell", serviceLine: "General",        anesthesiaType: "General",         asaClass: "I",   status: "scheduled", firstCase: true },
  { id: "s-oc-0512", date: "2026-05-12", time: "10:00", durationMin: 180, room: "OR 205", patientName: "Augusto Velázquez",   patientAgeSex: "61M", patientMrn: "MRN 845-220", procedure: "Open Sigmoid Colectomy",                procedureShort: "Colectomy", surgeon: "Dr. Liam O'Connell", serviceLine: "General",        anesthesiaType: "General",         asaClass: "III", status: "scheduled", specialNeeds: ["ERAS protocol"] },
  { id: "s-oc-0526", date: "2026-05-26", time: "11:30", durationMin: 60,  room: "OR 205", patientName: "Esme Lockhart",       patientAgeSex: "28F", patientMrn: "MRN 916-007", procedure: "Laparoscopic Appendectomy",            procedureShort: "Appy",    surgeon: "Dr. Liam O'Connell", serviceLine: "General",        anesthesiaType: "General",         asaClass: "I",   status: "scheduled", addOn: true, notes: "Add-on — urgent from ED" },

  // Dr. Aisha Bhatt — Cardiothoracic
  { id: "s-ab-0429", date: "2026-04-29", time: "07:30", durationMin: 270, room: "OR 411", patientName: "Eleanor Kazimirov",   patientAgeSex: "70F", patientMrn: "MRN 718-552", procedure: "Mitral Valve Replacement",             procedureShort: "MVR",     surgeon: "Dr. Aisha Bhatt",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["TEE in room", "ICU bed booked"] },
  { id: "s-ab-0506", date: "2026-05-06", time: "07:30", durationMin: 240, room: "OR 411", patientName: "Reginald Voss",       patientAgeSex: "65M", patientMrn: "MRN 729-118", procedure: "CABG × 3",                              procedureShort: "CABG",    surgeon: "Dr. Aisha Bhatt",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true },
  { id: "s-ab-0520", date: "2026-05-20", time: "07:30", durationMin: 300, room: "OR 411", patientName: "Yelena Antonescu",    patientAgeSex: "73F", patientMrn: "MRN 715-003", procedure: "Aortic Valve Replacement (TAVR)",     procedureShort: "TAVR",    surgeon: "Dr. Aisha Bhatt",   serviceLine: "Cardiothoracic", anesthesiaType: "General",         asaClass: "IV",  status: "scheduled", firstCase: true, implantsRequired: true },

  // Dr. Mateus Silva — Spine
  { id: "s-ms-0428", date: "2026-04-28", time: "07:30", durationMin: 210, room: "OR 308", patientName: "Calvin Mariotti",     patientAgeSex: "48M", patientMrn: "MRN 850-447", procedure: "Anterior Cervical Discectomy & Fusion C6–C7", procedureShort: "ACDF", surgeon: "Dr. Mateus Silva",  serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "II",  status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["Neuromonitoring"] },
  { id: "s-ms-0511", date: "2026-05-11", time: "07:30", durationMin: 240, room: "OR 308", patientName: "Astrid Kjellberg",    patientAgeSex: "55F", patientMrn: "MRN 818-220", procedure: "Posterior Spinal Fusion L2–L4",        procedureShort: "PSF",     surgeon: "Dr. Mateus Silva",  serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "III", status: "scheduled", firstCase: true, implantsRequired: true, specialNeeds: ["Neuromonitoring", "Cell saver"] },
  { id: "s-ms-0528", date: "2026-05-28", time: "07:30", durationMin: 180, room: "OR 308", patientName: "Ravi Mahapatra",      patientAgeSex: "41M", patientMrn: "MRN 901-330", procedure: "Lumbar Microdiscectomy L4–L5",         procedureShort: "Microdisc", surgeon: "Dr. Mateus Silva",  serviceLine: "Spine",          anesthesiaType: "General",         asaClass: "II",  status: "scheduled", firstCase: true },

  // Dr. Hannah Park — ENT
  { id: "s-hp-0427", date: "2026-04-27", time: "07:30", durationMin: 90,  room: "OR 327", patientName: "Mira Jankowski",      patientAgeSex: "8F",  patientMrn: "MRN 944-001", procedure: "Tonsillectomy & Adenoidectomy",        procedureShort: "T&A",     surgeon: "Dr. Hannah Park",   serviceLine: "ENT",            anesthesiaType: "General",         asaClass: "I",   status: "scheduled", firstCase: true, specialNeeds: ["Pediatric airway cart"] },
  { id: "s-hp-0504", date: "2026-05-04", time: "13:00", durationMin: 120, room: "OR 327", patientName: "Daniel Rosenthal",    patientAgeSex: "44M", patientMrn: "MRN 858-220", procedure: "Septoplasty + Bilateral Turbinate Reduction", procedureShort: "Septo", surgeon: "Dr. Hannah Park",   serviceLine: "ENT",            anesthesiaType: "General",         asaClass: "II",  status: "scheduled" },
  { id: "s-hp-0518", date: "2026-05-18", time: "13:00", durationMin: 150, room: "OR 327", patientName: "Lila Whitford",       patientAgeSex: "12F", patientMrn: "MRN 942-117", procedure: "Bilateral Tympanostomy + Adenoidectomy", procedureShort: "BMT+A", surgeon: "Dr. Hannah Park",   serviceLine: "ENT",            anesthesiaType: "General",         asaClass: "I",   status: "scheduled", specialNeeds: ["Pediatric airway cart"] },
  { id: "s-hp-0602", date: "2026-06-02", time: "10:00", durationMin: 180, room: "OR 327", patientName: "Beatrix Halloran",    patientAgeSex: "56F", patientMrn: "MRN 869-440", procedure: "Total Thyroidectomy",                  procedureShort: "Thyroid", surgeon: "Dr. Hannah Park",   serviceLine: "ENT",            anesthesiaType: "General",         asaClass: "II",  status: "scheduled", implantsRequired: false, specialNeeds: ["Recurrent laryngeal nerve monitoring"] },
];

export const SCHEDULE_CASES: ScheduleCase[] = RAW_SCHEDULE_CASES.map((c) => ({
  ...c,
  ...teamFor(c.date, c.room),
}));

// ─────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────

export function getCasesForDate(date: string): ScheduleCase[] {
  return SCHEDULE_CASES.filter((c) => c.date === date).sort((a, b) => a.time.localeCompare(b.time));
}

export function getCasesInRange(startKey: string, endKey: string): ScheduleCase[] {
  return SCHEDULE_CASES.filter((c) => c.date >= startKey && c.date <= endKey);
}

/** Summary of a day's cases — used by calendar cells. */
export interface DaySummary {
  date: string;
  total: number;
  byStatus: Partial<Record<CaseStatus, number>>;
  serviceLines: ServiceLine[];
  firstStart?: string;
  firstSurgeon?: string;
}

export function summarizeDay(date: string): DaySummary {
  const cases = getCasesForDate(date);
  const byStatus: Partial<Record<CaseStatus, number>> = {};
  const lines = new Set<ServiceLine>();
  for (const c of cases) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    lines.add(c.serviceLine);
  }
  return {
    date,
    total: cases.length,
    byStatus,
    serviceLines: [...lines],
    firstStart: cases[0]?.time,
    firstSurgeon: cases[0]?.surgeon,
  };
}

/** Loose parse of spoken date expressions: "May 20th", "May 20", "April 27". */
export function parseSpokenDate(text: string, referenceYear?: number): string | null {
  const MONTHS: Record<string, number> = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11,
  };
  const m = text
    .toLowerCase()
    .match(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
    );
  if (!m) return null;
  const monthIdx = MONTHS[m[1]];
  const day = parseInt(m[2], 10);
  if (Number.isNaN(day) || monthIdx == null) return null;
  const yr = referenceYear ?? new Date().getFullYear();
  const d = new Date(yr, monthIdx, day);
  return toDateKey(d);
}

// ─────────────────────────────────────────────────────────────────────────
// Person-centric helpers (for the PersonScheduleModal)
// ─────────────────────────────────────────────────────────────────────────

export type PersonRole = "Surgeon" | "Anesthesiologist" | "Scrub Tech" | "Circulator";
export type PersonScheduleView = "day" | "week" | "month";

export interface ResolvedPerson {
  /** Canonical full name (with credential suffix if applicable). */
  name: string;
  role: PersonRole;
  /** Specialty for surgeons; undefined for others. */
  specialty?: ServiceLine;
  /** Two-letter initials for an avatar. */
  initials: string;
}

function initialsFor(name: string): string {
  // Strip credential suffixes (", CST", ", RN", etc.) and Dr. prefix.
  const clean = name.replace(/,.*$/, "").replace(/^Dr\.\s+/i, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

/**
 * Fuzzy-resolve a spoken person reference ("Patel", "Marcus", "Dr. Foster")
 * to a canonical name + role. Searches surgeons, anesthesiologists, scrub
 * techs, and circulators. If `roleHint` is provided, that pool is searched
 * first.
 */
export function resolvePerson(
  query: string,
  roleHint?: PersonRole,
): ResolvedPerson | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const surgeons: ResolvedPerson[] = SURGEONS.map((s) => ({
    name: s.name,
    role: "Surgeon" as const,
    specialty: s.specialty,
    initials: s.initials,
  }));
  const anes: ResolvedPerson[] = ANESTHESIOLOGISTS.map((n) => ({
    name: n,
    role: "Anesthesiologist" as const,
    initials: initialsFor(n),
  }));
  const techs: ResolvedPerson[] = SCRUB_TECHS.map((n) => ({
    name: n,
    role: "Scrub Tech" as const,
    initials: initialsFor(n),
  }));
  const circ: ResolvedPerson[] = CIRCULATORS.map((n) => ({
    name: n,
    role: "Circulator" as const,
    initials: initialsFor(n),
  }));

  const POOLS: Record<PersonRole, ResolvedPerson[]> = {
    Surgeon: surgeons,
    Anesthesiologist: anes,
    "Scrub Tech": techs,
    Circulator: circ,
  };

  const order: PersonRole[] = roleHint
    ? [roleHint, ...(["Surgeon", "Anesthesiologist", "Scrub Tech", "Circulator"] as PersonRole[]).filter((r) => r !== roleHint)]
    : ["Surgeon", "Anesthesiologist", "Scrub Tech", "Circulator"];

  for (const role of order) {
    const pool = POOLS[role];
    // Exact match (case-insensitive)
    const exact = pool.find((p) => p.name.toLowerCase() === q);
    if (exact) return exact;
    // Last-name match: "patel" matches "Dr. Anika Patel"
    const lastMatch = pool.find((p) => {
      const cleaned = p.name.replace(/,.*$/, "").replace(/^Dr\.\s+/i, "");
      const last = cleaned.split(/\s+/).pop()?.toLowerCase();
      return last === q;
    });
    if (lastMatch) return lastMatch;
    // Substring match (handles "marcus webb" vs "Marcus Webb, CST")
    const sub = pool.find((p) => p.name.toLowerCase().includes(q));
    if (sub) return sub;
  }
  return null;
}

/** Beginning-of-week (Mon) for a given date, returned as YYYY-MM-DD. */
export function weekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

export function weekEnd(date: Date): string {
  const start = parseDateKey(weekStart(date));
  start.setDate(start.getDate() + 6);
  return toDateKey(start);
}

export function monthStart(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function monthEnd(date: Date): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/**
 * Return cases for a person in the given range, sorted by date+time
 * (earliest first). Searches every role field on each case so a
 * Scrub Tech who happens to share a name with a Surgeon won't collide.
 */
export function getCasesForPerson(
  person: ResolvedPerson,
  startKey: string,
  endKey: string,
): ScheduleCase[] {
  const matches = SCHEDULE_CASES.filter((c) => {
    if (c.date < startKey || c.date > endKey) return false;
    switch (person.role) {
      case "Surgeon":
        return c.surgeon === person.name;
      case "Anesthesiologist":
        return c.anesthesiologist === person.name;
      case "Scrub Tech":
        return c.scrubTech === person.name;
      case "Circulator":
        return c.circulator === person.name;
    }
  });
  return matches.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
}

/** Compute (start, end) keys for "day" / "week" / "month" relative to today. */
export function rangeForView(view: PersonScheduleView, today: Date = new Date()): {
  start: string;
  end: string;
  label: string;
} {
  switch (view) {
    case "day": {
      const k = toDateKey(today);
      return { start: k, end: k, label: formatLongDate(k) };
    }
    case "week": {
      const s = weekStart(today);
      const e = weekEnd(today);
      return {
        start: s,
        end: e,
        label: `${formatShortDate(s)} – ${formatShortDate(e)}`,
      };
    }
    case "month": {
      const s = monthStart(today);
      const e = monthEnd(today);
      return {
        start: s,
        end: e,
        label: today.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      };
    }
  }
}
