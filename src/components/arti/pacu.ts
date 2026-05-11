/**
 * Mock PACU (Post-Anesthesia Care Unit) message feed.
 *
 * Messages are anchored relative to module load so the wall always shows a
 * realistic recent-activity timeline. The newest message lives at index 0;
 * Arti reads from the top when the user asks "what's the latest from PACU".
 */

export type PacuPriority = "info" | "advisory" | "urgent";

export interface PacuMessage {
  id: string;
  /** ISO timestamp the message arrived at the OR wall. */
  receivedAtIso: string;
  /** Sender (role + name when known). */
  from: string;
  /** Short, OR-relevant body — < 90 chars is ideal for the badge / readback. */
  body: string;
  priority: PacuPriority;
}

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

export const PACU_MESSAGES: PacuMessage[] = [
  {
    id: "pacu-001",
    receivedAtIso: minutesAgo(2),
    from: "PACU charge · Sarah Lin, RN",
    body: "Bed 4 ready for Voss. Warm blanket staged. Ready when you are.",
    priority: "advisory",
  },
  {
    id: "pacu-002",
    receivedAtIso: minutesAgo(11),
    from: "PACU · Marcus Reyes, RN",
    body: "Voss awake, pain 3/10. Family notified — they're in waiting room 2.",
    priority: "info",
  },
  {
    id: "pacu-003",
    receivedAtIso: minutesAgo(24),
    from: "PACU charge · Sarah Lin, RN",
    body: "ETA on Chen RSA? Bed 6 holding. Anesthesia heads-up appreciated.",
    priority: "advisory",
  },
  {
    id: "pacu-004",
    receivedAtIso: minutesAgo(38),
    from: "PACU · Anita Park, RN",
    body: "Patient Albrecht transferred to Med-Surg 11:08. Discharge to home tomorrow.",
    priority: "info",
  },
  {
    id: "pacu-005",
    receivedAtIso: minutesAgo(62),
    from: "PACU charge · Sarah Lin, RN",
    body: "Two beds free, two on hold. Schedule looks workable through 16:00.",
    priority: "info",
  },
  {
    id: "pacu-006",
    receivedAtIso: minutesAgo(95),
    from: "PACU · Marcus Reyes, RN",
    body: "Reminder: Voss has latex allergy — already flagged on her chart.",
    priority: "info",
  },
];

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
}
