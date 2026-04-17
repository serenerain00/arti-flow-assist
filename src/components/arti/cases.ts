// Shared mock case data for the day. Used by CaseList and PreOp.

export type CaseStatus = "in-progress" | "next" | "scheduled" | "completed" | "delayed";

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
    patientName: "Linnea Park",
    patientMrn: "MRN 845‑553",
    patientAgeSex: "51F",
    procedure: "Subacromial Decompression",
    procedureShort: "SAD",
    surgeon: "Dr. Anika Patel",
    status: "scheduled",
    side: "Right",
  },
];

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
};
