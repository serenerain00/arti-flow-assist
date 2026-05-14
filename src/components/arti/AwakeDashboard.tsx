import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CaseHeader } from "./CaseHeader";
import { TimeOutPanel } from "./TimeOutPanel";
import { InstrumentCount } from "./InstrumentCount";
import { TeamRoster } from "./TeamRoster";
import { AlertStack, ALERTS as ALERT_DEFS } from "./AlertStack";
import { QuadView, type QuadPanelId } from "./QuadView";
import { PreferenceCard } from "./PreferenceCard";
import { PatientDetailsModal } from "./PatientDetailsModal";
import {
  PatientVideoModal,
  type PatientVideoHandle,
  type PatientVideoSession,
} from "./PatientVideoModal";
import { PatientXraysModal, type PatientXraysHandle } from "./PatientXraysModal";
import { ProcedureOverviewModal } from "./ProcedureOverviewModal";
import { ArtiInvoker } from "./ArtiInvoker";
import { type LightboxImage } from "./ImageLightboxModal";
import { RoleSwitcherBar, type ActiveRole } from "./RoleSwitcherBar";
import {
  AnesthesiaPanel,
  MACHINE_CHECK_ITEMS,
  MACHINE_CHECK_INITIAL_DONE,
} from "./AnesthesiaPanel";
import {
  ScrubTechPanel,
  OPENING_CHECKLIST_ITEMS,
  OPENING_CHECKLIST_INITIAL_DONE,
} from "./ScrubTechPanel";
import {
  CirculatingNurseChecklist,
  NURSE_CHECKLIST,
  type NursePhase,
} from "./CirculatingNurseChecklist";
import type { HandoffNotes, HandoffSection } from "./handoffNotes";
import { HANDOFF_SECTIONS } from "./handoffNotes";
import { SurgeonPanel } from "./SurgeonPanel";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";
import type { DashboardActions, DashboardActionsRef } from "@/routes/index";
import type { ArtiToolResult } from "@/hooks/useArtiVoice";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onOpenPacu?: () => void;
  onLogout: () => void;
  activeCase?: CaseItem;
  onBackToCases?: () => void;
  onPrompt: (text: string) => void;
  actionsRef?: DashboardActionsRef;
  /** Written to by AwakeDashboard so the route's context builder can read live state. */
  dashboardContextRef?: React.MutableRefObject<() => string>;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Route-level lightbox opener. Used by panel thumbnail clicks. */
  onOpenLightbox: (images: LightboxImage[], index?: number, title?: string) => void;
  /** Open the annotated preference-card table checklist. Route-level modal. */
  onOpenPrefCardChecklist?: (tableId?: "back-table" | "mayo-stand") => void;
  /** Open the VIP 3D planning reference. Route-level modal. */
  onOpenVipPlanning?: () => void;
  /** Route-owned handoff notes + setter (passed into the nurse checklist). */
  handoffNotes: HandoffNotes;
  onSetHandoffNote: (section: HandoffSection, text: string) => void;
  /** Route-owned circulating-nurse checklist state + toggle. */
  nurseChecklistChecked: Set<string>;
  onToggleNurseChecklistItem: (id: string) => void;
  /** Open the dedicated nurse-checklist modal (voice + click parity). */
  onOpenNurseChecklist?: () => void;
  /** Lifted accordion-expand state shared with the nurse-checklist modal. */
  nurseChecklistExpanded?: Record<NursePhase, boolean>;
  onNurseChecklistExpandedChange?: (next: Record<NursePhase, boolean>) => void;
  /** Transition to the intraoperative ("case active") view. */
  onStartCase?: () => void;
  /** Time-out checklist state — lifted to the route so the start-case modal shares it. */
  timeOutChecked: Set<TimeOutId>;
  onToggleTimeOutItem: (id: TimeOutId) => ArtiToolResult;
}

export type TimeOutId = "patient" | "site" | "procedure" | "allergies";
export type InstrumentId = "raytec" | "lap" | "needle" | "blade" | "clamps";

/**
 * Voice-prompt training chips shown in the ArtiInvoker. Indexed by the
 * active role so the chips teach the surgeon the role-specific tools that
 * actually exist on their panel — surgeon learns about imaging + patient
 * video, scrub tech learns about the back-table layout, etc.
 *
 * When a modal is currently open we override these with modal-scoped
 * prompts (see SUGGESTIONS_PATIENT_VIDEO / SUGGESTIONS_XRAYS) so the
 * training surface always matches what's on screen.
 */
const SUGGESTIONS_BY_ROLE: Record<ActiveRole, string[]> = {
  nurse: ["Read the time-out", "Add a Raytec", "Show alerts", "Open quad view"],
  scrub: ["Show the back table", "Mark suture loaded", "Open AP X-ray"],
  surgeon: ["Open patient video", "Show me the X-rays", "Show the MRI", "Open patient details"],
  anesthesia: ["Show allergies", "Mark machine check", "Show the airway plan"],
};

const SUGGESTIONS_PATIENT_VIDEO = ["Unmute", "Pause", "Show captions", "Restart"];
const SUGGESTIONS_XRAYS = ["Show the AP", "Next view", "Show the MRI", "Zoom in"];

export function AwakeDashboard({
  staffName,
  staffRole,
  initials,
  onSleep,
  onOpenPacu,
  onLogout,
  activeCase,
  onBackToCases,
  onPrompt,
  actionsRef,
  dashboardContextRef,
  onSidebarNavigate,
  onOpenLightbox,
  onOpenPrefCardChecklist,
  onOpenVipPlanning,
  handoffNotes,
  onSetHandoffNote,
  nurseChecklistChecked,
  onToggleNurseChecklistItem,
  onOpenNurseChecklist,
  nurseChecklistExpanded,
  onNurseChecklistExpandedChange,
  onStartCase,
  timeOutChecked,
  onToggleTimeOutItem,
}: Props) {
  const patientVideoModalRef = useRef<PatientVideoHandle | null>(null);
  const xraysModalRef = useRef<PatientXraysHandle | null>(null);
  const [counts, setCounts] = useState<Record<InstrumentId, number>>({
    raytec: 20,
    lap: 9,
    needle: 14,
    blade: 3,
    clamps: 12,
  });
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<number>>(new Set());
  const [quadOpen, setQuadOpen] = useState(false);
  const [quadFocused, setQuadFocused] = useState<QuadPanelId | null>(null);
  const [patientDetailsOpen, setPatientDetailsOpen] = useState(false);
  const [patientVideoOpen, setPatientVideoOpen] = useState(false);
  const [xraysOpen, setXraysOpen] = useState(false);
  const [procedureOverviewOpen, setProcedureOverviewOpen] = useState(false);
  /**
   * Per-case viewing log for patient pre-op videos. Keyed by case id so the
   * log survives role-switches and case navigation. Each entry holds the
   * latest session — open time, peak watched seconds, completion flag.
   *
   * Seeded with realistic prior-viewing entries for the day's cases so the
   * surgeon panel demonstrates the populated post-view state on first
   * render. c-005 is intentionally left empty to also show the
   * "Not yet viewed by team" state. Real plays overwrite seeded entries.
   */
  const [patientVideoSessions, setPatientVideoSessions] = useState<
    Record<string, PatientVideoSession>
  >(() => {
    const todayAt = (h: number, m: number): string => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    return {
      "c-001": {
        openedAtIso: todayAt(6, 42),
        closedAtIso: todayAt(6, 43),
        peakWatchedSec: 84,
        openDurationSec: 95,
        completed: true,
        openedBy: "Sarah Lin, RN",
      },
      "c-002": {
        openedAtIso: todayAt(7, 14),
        closedAtIso: todayAt(7, 15),
        peakWatchedSec: 75,
        openDurationSec: 88,
        completed: false,
        openedBy: "Voice · Arti",
      },
      "c-003": {
        openedAtIso: todayAt(7, 51),
        closedAtIso: todayAt(7, 52),
        peakWatchedSec: 78,
        openDurationSec: 82,
        completed: true,
        openedBy: "Dr. Anika Patel",
      },
      "c-004": {
        openedAtIso: todayAt(8, 22),
        closedAtIso: todayAt(8, 23),
        peakWatchedSec: 33,
        openDurationSec: 40,
        completed: false,
        openedBy: "Marcus Reyes, CST",
      },
    };
  });
  const [activeRole, setActiveRole] = useState<ActiveRole>("nurse");
  const [openingChecklist, setOpeningChecklist] = useState<Set<number>>(
    () => new Set(OPENING_CHECKLIST_INITIAL_DONE),
  );
  const [machineCheck, setMachineCheck] = useState<Set<number>>(
    () => new Set(MACHINE_CHECK_INITIAL_DONE),
  );
  // Circulating-nurse checklist — phase-banded (pre-incision / intra-op /
  // closing). State + setter come from the route so voice can drive it.

  // Keep the route-level context builder updated with live dashboard state.
  useEffect(() => {
    if (!dashboardContextRef) return;
    const ROLE_LABEL: Record<ActiveRole, string> = {
      nurse: "Circulating Nurse",
      scrub: "Scrub Tech",
      surgeon: "Surgeon",
      anesthesia: "Anesthesiologist",
    };
    const TO_LABELS: Record<string, string> = {
      patient: "Patient identity",
      site: "Surgical site marked",
      procedure: "Procedure agreed",
      allergies: "Allergies/antibiotics",
    };
    const checkedItems = [...timeOutChecked].map((id) => TO_LABELS[id] ?? id);
    const pendingItems = (["patient", "site", "procedure", "allergies"] as const)
      .filter((id) => !timeOutChecked.has(id))
      .map((id) => TO_LABELS[id]);

    const clinical = activeCase ? PATIENT_CLINICAL[activeCase.id] : undefined;
    const flaggedLabs =
      clinical?.labs.filter((l) => l.flag).map((l) => `${l.label} ${l.value}`) ?? [];
    const allLabs = clinical?.labs.map((l) => `${l.label} ${l.value}${l.flag ? " ⚠" : ""}`) ?? [];
    dashboardContextRef.current = () =>
      [
        `Active dashboard view: ${ROLE_LABEL[activeRole]}`,
        `Available role views: Circulating Nurse, Scrub Tech, Surgeon, Anesthesiologist`,
        `Time-out checklist: ${timeOutChecked.size}/4 confirmed`,
        checkedItems.length ? `  Confirmed: ${checkedItems.join(", ")}` : "  None confirmed yet",
        pendingItems.length ? `  Pending: ${pendingItems.join(", ")}` : "  All items confirmed",
        `Instrument counts (current / opening):`,
        `  Raytec ${counts.raytec}/20 · Lap ${counts.lap}/9 · Needle ${counts.needle}/14 · Blade ${counts.blade}/3 · Clamps ${counts.clamps}/12`,
        counts.raytec !== 20 ||
        counts.lap !== 9 ||
        counts.needle !== 14 ||
        counts.blade !== 3 ||
        counts.clamps !== 12
          ? "  ⚠ COUNT DISCREPANCY — investigate before closure"
          : "  All counts nominal",
        `Dismissed alerts: ${dismissedAlerts.size}`,
        (() => {
          const activeAlerts = ALERT_DEFS.map((a, i) => ({ ...a, index: i })).filter(
            (a) => !dismissedAlerts.has(a.index),
          );
          if (activeAlerts.length === 0) {
            return `── Arti · Prioritized Awareness ──\nNo active alerts — all acknowledged.`;
          }
          const lines = activeAlerts.map(
            (a, i) => `  ${i + 1}. [${a.tier.toUpperCase()}] ${a.title} — ${a.body}`,
          );
          return [
            `── Arti · Prioritized Awareness (${activeAlerts.length} active) ──`,
            ...lines,
            `READ-BACK GUIDANCE: when the user asks "what should I be aware of / anything I should know / what do I need to watch / what's important / read me the awareness / what are the alerts / what's flagged" or any close variation, read these alerts aloud — lead with CRITICAL items first, then advisory, then info. Use one short sentence per alert (tier + title + key detail). No preamble, no editorializing. This overrides the default "one short sentence" rule because the user is explicitly requesting situational awareness.`,
          ].join("\n");
        })(),
        `Opening checklist (scrub tech): ${openingChecklist.size}/${OPENING_CHECKLIST_ITEMS.length} done. Items by index: ${OPENING_CHECKLIST_ITEMS.map((label, i) => `${i}=${label}${openingChecklist.has(i) ? " ✓" : ""}`).join(" · ")}`,
        `Machine check (anesthesia): ${machineCheck.size}/${MACHINE_CHECK_ITEMS.length} done. Items by index: ${MACHINE_CHECK_ITEMS.map((label, i) => `${i}=${label}${machineCheck.has(i) ? " ✓" : ""}`).join(" · ")}`,
        (() => {
          // Circulating-nurse checklist — phase-banded tallies + pending items so
          // Arti can answer "what's left on the nurse checklist / pre-incision /
          // closing" from anywhere.
          const lines: string[] = [];
          for (const phase of NURSE_CHECKLIST) {
            const done = phase.items.filter((i) => nurseChecklistChecked.has(i.id));
            const pending = phase.items.filter((i) => !nurseChecklistChecked.has(i.id));
            lines.push(
              `  ${phase.label}: ${done.length}/${phase.items.length}${
                pending.length
                  ? ` · pending: ${pending
                      .slice(0, 4)
                      .map((p) => p.label)
                      .join(", ")}${pending.length > 4 ? "…" : ""}`
                  : " · ALL DONE"
              }`,
            );
          }
          return [
            `── Circulating-nurse checklist ──`,
            ...lines,
            `READ-BACK GUIDANCE: when the user asks "what's left on the nurse checklist / circulating nurse / pre-incision / intra-op / closing checklist", read the matching phase's pending items aloud (one short sentence, list first 3–4 names). For "overall nurse checklist status", give a one-liner like "Pre-incision 7 of 10, intra-op 2 of 6, closing not started."`,
            ``,
            `WRITE GUIDANCE — fire toggle_nurse_checklist_item with item free-text + status:`,
            `  "check off <X>" / "mark <X> done" / "<X> is done" / "I did <X>" / "cross off <X>" → status:"done".`,
            `  "uncheck <X>" / "undo <X>" / "<X> isn't done" → status:"pending".`,
            `  Bulk: "all pre-incision items are done" / "mark all closing complete" / "finish intra-op phase" → fire complete_nurse_checklist_phase(phase).`,
            ``,
            `DISAMBIGUATION vs toggle_timeout_item (Universal Protocol time-out: 4 items — patient, site, procedure, allergies):`,
            `  • If the user explicitly says "time-out" / "universal protocol" → toggle_timeout_item.`,
            `  • If the time-out modal is currently OPEN (see route-level context) and the user names patient/site/procedure/allergies in a BARE form → toggle_timeout_item.`,
            `  • If the user gives a specific nurse-checklist phrase (e.g. "patient ID verified", "allergies posted", "consent signed", "site marked with surgeon", "antibiotic given", "SCDs applied") → toggle_nurse_checklist_item.`,
            `  • Anything outside the 4 time-out items (NPO, prep, SCDs, antibiotic, counts, specimens, fluid balance, EBL, dressing, drains, PACU handoff, EHR closed, etc.) → toggle_nurse_checklist_item.`,
          ].join("\n");
        })(),
        (() => {
          // Handoff notes — section state + read-back/write guidance.
          const filled = HANDOFF_SECTIONS.filter((s) => Boolean(handoffNotes[s.id]?.trim()));
          const empty = HANDOFF_SECTIONS.filter((s) => !handoffNotes[s.id]?.trim());
          const lines = HANDOFF_SECTIONS.map((s) => {
            const v = handoffNotes[s.id]?.trim();
            return `  ${s.id}: ${v ? `"${v}"` : "(empty)"}`;
          });
          return [
            `── PACU handoff notes (${filled.length}/${HANDOFF_SECTIONS.length} filled) ──`,
            ...lines,
            empty.length
              ? `Empty sections: ${empty.map((s) => s.id).join(", ")}`
              : `All sections filled.`,
            `READ-BACK / WRITE GUIDANCE:`,
            `  "give me the handoff" / "read the PACU handoff" / "read the handoff notes" → read all 7 sections in order, "<label>: <text or 'not documented'>", one short sentence per filled section.`,
            `  "read <section>" / "what did Laura note about <section>" / "what's the EBL?" / "any complications?" / "post-op instructions?" / "implants used?" / "follow-ups?" → read just that section (or "Not documented yet" if empty).`,
            `  "EBL was 150" / "set complications to none" / "add to handoff that pain plan is interscalene block" / "note that we used the 38mm glenosphere" / "follow-up: PT in two weeks" → fire set_handoff_note(section, text). For numeric values like EBL, include units in the text (e.g. "150 mL"). For appends ("add to follow-ups"), pass the COMBINED text (existing + new); the live context above shows the current value.`,
            `Valid sections (use these ids in the tool): ${HANDOFF_SECTIONS.map((s) => s.id).join(", ")}.`,
          ].join("\n");
        })(),
        patientDetailsOpen
          ? `Patient details modal: OPEN — "close" / "close modal" / "close patient info" → close_patient_details`
          : `Patient details modal: closed`,
        procedureOverviewOpen
          ? `Procedure overview modal: OPEN — "close" / "close overview" → close_procedure_overview`
          : `Procedure overview modal: closed`,
        patientVideoOpen
          ? `Patient video modal: OPEN — transport tools available: play_patient_video, pause_patient_video, restart_patient_video, toggle_patient_video_captions, mute_patient_video, unmute_patient_video, close_patient_video. Generic "play"/"pause"/"restart"/"show captions"/"unmute"/"mute"/"close" all map to these (NOT to the how-to-video tools). The video DEFAULTS TO MUTED — staff routinely say "unmute" right after open to enable audio.`
          : `Patient video modal: closed`,
        xraysOpen
          ? (() => {
              const study = activeCase ? PATIENT_CLINICAL[activeCase.id].imaging : undefined;
              const viewLabels = study?.views.map((v) => `"${v.label}" (${v.modality})`).join(", ");
              return `Patient X-rays modal: OPEN — study ${study?.protocol ?? ""}, ${study?.views.length ?? 0} views: ${viewLabels}. Tools: xrays_next_view, xrays_prev_view, xrays_show_view (with view name as query — e.g. "AP", "axillary", "MRI", "Y view"), xrays_zoom_in, xrays_zoom_out, xrays_reset_zoom, close_xrays.`;
            })()
          : `Patient X-rays modal: closed`,
        activeCase
          ? (() => {
              const session = patientVideoSessions[activeCase.id];
              if (!session) return `Patient video viewing log (active case): never opened`;
              const opened = new Date(session.openedAtIso).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return `Patient video viewing log (active case): opened ${opened}, watched ${Math.round(session.peakWatchedSec)}s, ${session.completed ? "FULL play" : "partial"}, by ${session.openedBy}`;
            })()
          : "",
        quadOpen
          ? `Quad view: OPEN${
              quadFocused
                ? ` — currently FOCUSED on the ${quadFocused} panel (full-screen). "go back" / "unfocus" / "return" / "back to quad" / "show all four" → unfocus_quad_panel (returns to the 2×2 grid, KEEPS quad view open). "close" / "close quad view" / "exit quad" → close_quad_view (exits the whole overlay).`
                : ` — showing the 2×2 grid. "focus <panel>" / "expand <panel>" → focus_quad_panel (panel: timeout / instruments / alerts / team). "close" / "close quad view" → close_quad_view.`
            }`
          : `Quad view: closed`,
        clinical
          ? [
              `── Active-case patient chart ──`,
              `DOB: ${clinical.dob} · Sex: ${clinical.sex} · Height: ${clinical.height} · Weight: ${clinical.weight} · BMI: ${clinical.bmi}`,
              `Blood type: ${clinical.bloodType}`,
              `NPO: ${clinical.npo}`,
              `Allergies: ${clinical.allergies.length ? clinical.allergies.map((a) => `${a.agent} (${a.reaction}, ${a.severity})`).join(", ") : "NKDA — no known drug allergies"}`,
              `Medications: ${clinical.medications.length ? clinical.medications.join("; ") : "None on file"}`,
              `Conditions: ${clinical.conditions.join(", ")}`,
              `Labs (all): ${allLabs.join(", ")}`,
              flaggedLabs.length
                ? `  ⚠ Flagged: ${flaggedLabs.join(", ")}`
                : "  All labs within range",
              `Consents: ${clinical.consents.join("; ")}`,
              `Airway: Mallampati ${clinical.airway.mallampati}${clinical.airway.difficult ? " — DIFFICULT AIRWAY" : ""}`,
              `Anesthesia plan: ${clinical.anesthesiaPlan}`,
              `Surgeon notes: ${clinical.notes.join(" | ")}`,
              `Procedure steps: ${clinical.procedureSteps.map((s) => `${s.step}. ${s.title}`).join(" → ")}`,
              `Implants: ${clinical.implantPlan.map((i) => `${i.component} ${i.spec}${i.confirmed ? "" : " [UNCONFIRMED]"}`).join(", ")}`,
              `── Patient pre-op video (recorded ${clinical.patientVideo.recordedAt}) ──`,
              `Summary: ${clinical.patientVideo.summary}`,
              `AI-extracted video notes / insights (${clinical.patientVideo.aiInsights.length}):`,
              ...clinical.patientVideo.aiInsights.map((insight, i) => `  ${i + 1}. ${insight}`),
              `READ-BACK GUIDANCE: when the user asks "what are the video notes / patient notes / AI insights / patient video notes / video insights / what did the patient say" or any close variation, read these bullets aloud — one short sentence per insight, no preamble, no editorializing. List them in order. Cap at 5 bullets unless user asks for "all". This overrides the default "one short sentence" rule because the user is explicitly requesting a list.`,
              ``,
              `── VERB ROUTING — chart-data queries ──`,
              `  "SHOW / DISPLAY / PULL UP / BRING UP <X>" → fire show_focus_readout(category) AND narrate the data in the same turn. The modal opens visually while you speak. Mapping:`,
              `    'show allergies' / 'display patient allergies' / 'allergies full screen' / 'pull up allergies' → category:'allergies'`,
              `    'show consents' / 'display consents' / 'pull up consents' → category:'consents'`,
              `    'show anesthesia notes' / 'display anesthesia plan' / 'pull up anesthesia' → category:'anesthesia'`,
              `    'open positioning instructions' / 'show positioning' / 'display position' → category:'positioning'`,
              `    'display antibiotics status' / 'show antibiotics' / 'antibiotic redose' → category:'antibiotics'`,
              `    'show implant log' / 'display implants' / 'pull up the implants' → category:'implants'`,
              `    'display irrigation totals' / 'show fluid totals' / 'pull up fluid balance' / 'track fluid deficit' → category:'fluid'`,
              ``,
              `  "WHAT IS / WHAT'S / HOW MUCH / HAS X BEEN <verb>'d?" → answer directly from the chart data above, NO tool call. Examples:`,
              `    "has consent been signed?" / "is consent on file?" → read the Consents line. If empty say "I don't see a consent yet."`,
              `    "what are the allergies?" / "any allergies?" → read the Allergies line (severe first).`,
              `    "what's the anesthesia plan?" / "anesthesia notes" → read Anesthesia plan + Airway. Flag difficult airway.`,
              `    "what's the position?" → 'Beach chair, sixty to seventy degrees.' One sentence.`,
              `    "what's the antibiotic?" / "when's the next dose?" → read the Antibiotic line.`,
              `    "which implants are opened?" → name components with status opened/implanted. If none, 'No implants opened yet.'`,
              `    "what's the fluid balance?" / "fluid deficit?" → read pump telemetry.`,
              `    "what side are we on?" / "confirm laterality" → "${`${activeCase?.side ?? "Right"} ${activeCase?.procedureShort ?? "RSA"}.`}"`,
              `    "what procedure are we doing?" → procedure + side, one short sentence.`,
              ``,
              `  Keep narrations under 18 words unless the user explicitly asks for "all" / "everything".`,
            ].join("\n")
          : "",
        `Actions available from this screen: toggle time-out items, adjust instrument counts, dismiss advisory alerts, open quad view, show preference card, show table layout images, open scrub tech table layout images, toggle opening checklist items, toggle machine check items, switch role view, open patient details, open patient video, open patient X-rays, open how-to video`,
      ].join("\n");
  }, [
    activeRole,
    timeOutChecked,
    counts,
    dismissedAlerts,
    openingChecklist,
    machineCheck,
    nurseChecklistChecked,
    handoffNotes,
    patientDetailsOpen,
    procedureOverviewOpen,
    patientVideoOpen,
    patientVideoSessions,
    xraysOpen,
    quadOpen,
    quadFocused,
    activeCase,
    dashboardContextRef,
  ]);

  // Time-out toggling is owned by the route now (so the start-case modal
  // and the nurse panel share state). This is a thin alias kept stable
  // so the actions-ref signature doesn't change.
  const toggleTimeOutItem = useCallback(
    (id: TimeOutId): ArtiToolResult => onToggleTimeOutItem(id),
    [onToggleTimeOutItem],
  );

  const adjustInstrumentCount = useCallback((item: InstrumentId, delta: number): ArtiToolResult => {
    setCounts((prev) => ({ ...prev, [item]: Math.max(0, prev[item] + delta) }));
    return { ok: true };
  }, []);

  /**
   * Set an instrument count to an absolute value. No upper-bound clamp —
   * counts above the opening reference are valid (extras brought in
   * mid-case) and the discrepancy banner picks up any mismatch
   * automatically.
   */
  const setInstrumentCount = useCallback((item: InstrumentId, value: number): ArtiToolResult => {
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, reason: "count must be a non-negative number" };
    }
    setCounts((prev) => ({ ...prev, [item]: Math.floor(value) }));
    return { ok: true };
  }, []);

  /**
   * Safety-critical alerts (tier === "Critical") can never be auto-dismissed
   * per the Arti spec. The return shape lets the agent respond naturally
   * (system prompt handles the wording) instead of silently failing.
   */
  const dismissAlert = useCallback((index: number): ArtiToolResult => {
    const alert = ALERT_DEFS[index];
    if (!alert) return { ok: false, reason: "unknown alert" };
    if (alert.tier === "Critical") {
      return { ok: false, reason: "safety-critical alert cannot be dismissed" };
    }
    setDismissedAlerts((prev) => new Set(prev).add(index));
    return { ok: true };
  }, []);

  const openQuadView = useCallback((): ArtiToolResult => {
    setQuadFocused(null);
    setQuadOpen(true);
    return { ok: true };
  }, []);

  const focusQuadPanel = useCallback((panel: QuadPanelId): ArtiToolResult => {
    setQuadOpen(true);
    setQuadFocused(panel);
    return { ok: true };
  }, []);

  const unfocusQuadPanel = useCallback((): ArtiToolResult => {
    // Drop the focused-single state but keep the quad-grid open. Use
    // when the user says "go back" / "unfocus" / "return" while a single
    // panel is expanded — they want the 2×2 layout back, not to close.
    setQuadFocused(null);
    return { ok: true };
  }, []);

  const closeQuadView = useCallback((): ArtiToolResult => {
    setQuadOpen(false);
    setQuadFocused(null);
    return { ok: true };
  }, []);

  const showPreferenceCard = useCallback((): ArtiToolResult => {
    if (typeof document === "undefined") return { ok: false, reason: "no dom" };
    const el = document.getElementById("preference-card");
    if (!el) return { ok: false, reason: "preference card not mounted" };
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return { ok: true };
  }, []);

  const switchRole = useCallback((role: ActiveRole): ArtiToolResult => {
    setActiveRole(role);
    return { ok: true };
  }, []);

  const openPatientDetails = useCallback((): ArtiToolResult => {
    setPatientDetailsOpen(true);
    return { ok: true };
  }, []);

  const closePatientDetails = useCallback((): ArtiToolResult => {
    setPatientDetailsOpen(false);
    return { ok: true };
  }, []);

  const openProcedureOverview = useCallback((): ArtiToolResult => {
    setProcedureOverviewOpen(true);
    return { ok: true };
  }, []);

  const closeProcedureOverview = useCallback((): ArtiToolResult => {
    setProcedureOverviewOpen(false);
    return { ok: true };
  }, []);

  const openPatientVideo = useCallback((): ArtiToolResult => {
    if (!activeCase) {
      return { ok: false, reason: "no active case" };
    }
    // Switch to the surgeon panel so the staff sees the video card and the
    // AI insights tile after the modal closes — keeps the experience
    // coherent for voice-only operation.
    setActiveRole("surgeon");
    setPatientVideoOpen(true);
    return { ok: true };
  }, [activeCase]);

  const closePatientVideo = useCallback((): ArtiToolResult => {
    setPatientVideoOpen(false);
    return { ok: true };
  }, []);

  const playPatientVideo = useCallback((): ArtiToolResult => {
    if (!patientVideoOpen) return { ok: false, reason: "patient video not open" };
    patientVideoModalRef.current?.play();
    return { ok: true };
  }, [patientVideoOpen]);

  const pausePatientVideo = useCallback((): ArtiToolResult => {
    if (!patientVideoOpen) return { ok: false, reason: "patient video not open" };
    patientVideoModalRef.current?.pause();
    return { ok: true };
  }, [patientVideoOpen]);

  const restartPatientVideo = useCallback((): ArtiToolResult => {
    if (!patientVideoOpen) return { ok: false, reason: "patient video not open" };
    patientVideoModalRef.current?.restart();
    return { ok: true };
  }, [patientVideoOpen]);

  const togglePatientVideoCaptions = useCallback((): ArtiToolResult => {
    if (!patientVideoOpen) return { ok: false, reason: "patient video not open" };
    patientVideoModalRef.current?.toggleCaptions();
    return { ok: true };
  }, [patientVideoOpen]);

  const mutePatientVideo = useCallback((): ArtiToolResult => {
    if (!patientVideoOpen) return { ok: false, reason: "patient video not open" };
    patientVideoModalRef.current?.mute();
    return { ok: true };
  }, [patientVideoOpen]);

  const unmutePatientVideo = useCallback((): ArtiToolResult => {
    if (!patientVideoOpen) return { ok: false, reason: "patient video not open" };
    patientVideoModalRef.current?.unmute();
    return { ok: true };
  }, [patientVideoOpen]);

  // ── X-ray viewer ───────────────────────────────────────────────────
  const openXrays = useCallback((): ArtiToolResult => {
    if (!activeCase) return { ok: false, reason: "no active case" };
    setActiveRole("surgeon");
    setXraysOpen(true);
    return { ok: true };
  }, [activeCase]);

  const closeXrays = useCallback((): ArtiToolResult => {
    setXraysOpen(false);
    return { ok: true };
  }, []);

  const xraysNextView = useCallback((): ArtiToolResult => {
    if (!xraysOpen) return { ok: false, reason: "x-rays not open" };
    xraysModalRef.current?.nextView();
    return { ok: true };
  }, [xraysOpen]);

  const xraysPrevView = useCallback((): ArtiToolResult => {
    if (!xraysOpen) return { ok: false, reason: "x-rays not open" };
    xraysModalRef.current?.prevView();
    return { ok: true };
  }, [xraysOpen]);

  const xraysShowView = useCallback(
    (query: string): ArtiToolResult => {
      if (!xraysOpen) return { ok: false, reason: "x-rays not open" };
      const ok = xraysModalRef.current?.showView(query) ?? false;
      return ok ? { ok: true } : { ok: false, reason: `no view matched '${query}'` };
    },
    [xraysOpen],
  );

  const xraysZoomIn = useCallback((): ArtiToolResult => {
    if (!xraysOpen) return { ok: false, reason: "x-rays not open" };
    xraysModalRef.current?.zoomIn();
    return { ok: true };
  }, [xraysOpen]);

  const xraysZoomOut = useCallback((): ArtiToolResult => {
    if (!xraysOpen) return { ok: false, reason: "x-rays not open" };
    xraysModalRef.current?.zoomOut();
    return { ok: true };
  }, [xraysOpen]);

  const xraysResetZoom = useCallback((): ArtiToolResult => {
    if (!xraysOpen) return { ok: false, reason: "x-rays not open" };
    xraysModalRef.current?.resetZoom();
    return { ok: true };
  }, [xraysOpen]);

  /** Persist (or update) the latest viewing session for the active case. */
  const handleVideoSession = useCallback(
    (session: PatientVideoSession) => {
      if (!activeCase) return;
      setPatientVideoSessions((prev) => ({ ...prev, [activeCase.id]: session }));
    },
    [activeCase],
  );

  /**
   * Close whichever dashboard-scoped overlay is currently topmost.
   * Priority: patient details > quad view. Returns a label so the route
   * can include it in the spoken confirmation, or null when nothing was
   * open (route then falls through to other targets or no-ops).
   */
  const closeTopmostDashboardOverlay = useCallback((): string | null => {
    if (xraysOpen) {
      setXraysOpen(false);
      return "x-rays";
    }
    if (patientVideoOpen) {
      setPatientVideoOpen(false);
      return "patient video";
    }
    if (procedureOverviewOpen) {
      setProcedureOverviewOpen(false);
      return "procedure overview";
    }
    if (patientDetailsOpen) {
      setPatientDetailsOpen(false);
      return "patient details";
    }
    if (quadOpen) {
      setQuadOpen(false);
      setQuadFocused(null);
      return "quad view";
    }
    return null;
  }, [xraysOpen, patientVideoOpen, procedureOverviewOpen, patientDetailsOpen, quadOpen]);

  const toggleOpeningChecklistItem = useCallback((index: number): ArtiToolResult => {
    if (index < 0 || index >= OPENING_CHECKLIST_ITEMS.length) {
      return { ok: false, reason: "invalid checklist index" };
    }
    setOpeningChecklist((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    return { ok: true };
  }, []);

  const toggleMachineCheckItem = useCallback((index: number): ArtiToolResult => {
    if (index < 0 || index >= MACHINE_CHECK_ITEMS.length) {
      return { ok: false, reason: "invalid machine-check index" };
    }
    setMachineCheck((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    return { ok: true };
  }, []);

  /** Register dashboard tools with the route-level bridge. */
  const actions = useMemo<DashboardActions>(
    () => ({
      toggleTimeOutItem,
      adjustInstrumentCount,
      setInstrumentCount,
      dismissAlert,
      openQuadView,
      focusQuadPanel,
      unfocusQuadPanel,
      closeQuadView,
      showPreferenceCard,
      switchRole,
      openPatientDetails,
      closePatientDetails,
      openPatientVideo,
      closePatientVideo,
      playPatientVideo,
      pausePatientVideo,
      restartPatientVideo,
      togglePatientVideoCaptions,
      mutePatientVideo,
      unmutePatientVideo,
      openXrays,
      closeXrays,
      xraysNextView,
      xraysPrevView,
      xraysShowView,
      xraysZoomIn,
      xraysZoomOut,
      xraysResetZoom,
      toggleOpeningChecklistItem,
      toggleMachineCheckItem,
      openProcedureOverview,
      closeProcedureOverview,
      closeTopmostDashboardOverlay,
    }),
    [
      toggleTimeOutItem,
      adjustInstrumentCount,
      setInstrumentCount,
      dismissAlert,
      openQuadView,
      focusQuadPanel,
      unfocusQuadPanel,
      closeQuadView,
      showPreferenceCard,
      switchRole,
      openPatientDetails,
      closePatientDetails,
      openPatientVideo,
      closePatientVideo,
      playPatientVideo,
      pausePatientVideo,
      restartPatientVideo,
      togglePatientVideoCaptions,
      mutePatientVideo,
      unmutePatientVideo,
      openXrays,
      closeXrays,
      xraysNextView,
      xraysPrevView,
      xraysShowView,
      xraysZoomIn,
      xraysZoomOut,
      xraysResetZoom,
      toggleOpeningChecklistItem,
      toggleMachineCheckItem,
      openProcedureOverview,
      closeProcedureOverview,
      closeTopmostDashboardOverlay,
    ],
  );

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = actions;
    return () => {
      // Only clear if nobody else re-bound it (React Strict Mode protection).
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actions, actionsRef]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        onSleep={onSleep}
        onLogout={onLogout}
        activeKey="patients"
        onNavigate={onSidebarNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          staffName={staffName}
          staffRole={staffRole}
          initials={initials}
          onSleep={onSleep}
          onOpenPacu={onOpenPacu}
        />

        <RoleSwitcherBar activeRole={activeRole} onRoleChange={setActiveRole} />

        <main data-scroll className="min-h-0 flex-1 overflow-y-auto px-8 py-6 animate-fade-in">
          <div className="flex flex-col gap-5">
            {onBackToCases && (
              <button
                onClick={onBackToCases}
                className="-mb-2 inline-flex w-fit items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Today's cases
              </button>
            )}

            <CaseHeader
              activeCase={activeCase}
              onOpenPatientDetails={() => setPatientDetailsOpen(true)}
              onStartCase={onStartCase}
              onOpenProcedureOverview={() => setProcedureOverviewOpen(true)}
            />

            {/* ── Nurse view (default) ──
                Row-by-row layout (priority-ordered, no column-stack gaps):
                  Row 1: Time-out (2) + Alerts (1)          ← critical + safety, pre-incision
                  Row 2: Nurse Checklist (2) + Team (1)     ← primary workflow + people
                  Row 3: Instrument Count (full)            ← big numerals, full width
                  Row 4: Preference Card (full)             ← reference, below the fold
                Each row totals 3 cols; CSS grid stretches items in a row to
                the taller card's height, so there are no orphan gaps. */}
            {activeRole === "nurse" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <div className="xl:col-span-2">
                  <TimeOutPanel
                    checked={timeOutChecked as Set<string>}
                    onToggle={(id) => toggleTimeOutItem(id as TimeOutId)}
                  />
                </div>
                <div className="xl:col-span-1">
                  <AlertStack dismissed={dismissedAlerts} onDismiss={dismissAlert} />
                </div>

                <div className="xl:col-span-2">
                  <CirculatingNurseChecklist
                    checked={nurseChecklistChecked}
                    onToggle={onToggleNurseChecklistItem}
                    handoffNotes={handoffNotes}
                    onSetHandoffNote={onSetHandoffNote}
                    onExpand={onOpenNurseChecklist}
                    expanded={nurseChecklistExpanded}
                    onExpandedChange={onNurseChecklistExpandedChange}
                  />
                </div>
                <div className="xl:col-span-1">
                  <TeamRoster />
                </div>

                <div className="col-span-full">
                  <InstrumentCount
                    counts={counts}
                    onAdjust={(id, delta) => adjustInstrumentCount(id as InstrumentId, delta)}
                  />
                </div>

                <div className="col-span-full">
                  <PreferenceCard
                    onOpenLightbox={onOpenLightbox}
                    onOpenChecklist={onOpenPrefCardChecklist}
                  />
                </div>
              </div>
            )}

            {/* ── Scrub Tech view ── */}
            {activeRole === "scrub" && (
              <ScrubTechPanel
                activeCase={activeCase}
                counts={counts}
                onAdjust={(id, delta) => adjustInstrumentCount(id as InstrumentId, delta)}
                onOpenLightbox={onOpenLightbox}
                openingChecklist={openingChecklist}
                onToggleChecklistItem={toggleOpeningChecklistItem}
              />
            )}

            {/* ── Surgeon view ── */}
            {activeRole === "surgeon" && (
              <SurgeonPanel
                activeCase={activeCase}
                onOpenLightbox={onOpenLightbox}
                videoSession={activeCase ? patientVideoSessions[activeCase.id] : undefined}
                onOpenPatientVideo={() => openPatientVideo()}
                onOpenXrays={() => openXrays()}
                onOpenVipPlanning={onOpenVipPlanning}
              />
            )}

            {/* ── Anesthesia view ── */}
            {activeRole === "anesthesia" && (
              <AnesthesiaPanel
                activeCase={activeCase}
                machineCheckDone={machineCheck}
                onToggleMachineCheck={(i) => toggleMachineCheckItem(i)}
              />
            )}

            <div className="h-24" />
          </div>
        </main>

        {/* Quad-view toggle — visible on every role view so any team member
            can flip into the 4-quadrant layout (also reachable by voice). The
            QuadView overlay has its own X button to exit. */}
        <button
          onClick={openQuadView}
          className="absolute right-8 top-36 z-30 flex h-11 items-center gap-2 rounded-full border border-border bg-surface-2 px-4 text-xs font-light uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          aria-label="Open quad view"
          title="Open quad view (or say 'open quad view')"
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={1.7} />
          Quad View
        </button>
      </div>

      <PatientDetailsModal
        open={patientDetailsOpen}
        onClose={() => setPatientDetailsOpen(false)}
        activeCase={activeCase}
      />

      <ProcedureOverviewModal
        open={procedureOverviewOpen}
        onClose={() => setProcedureOverviewOpen(false)}
        activeCase={activeCase}
        onOpenVipPlanning={
          onOpenVipPlanning
            ? () => {
                setProcedureOverviewOpen(false);
                onOpenVipPlanning();
              }
            : undefined
        }
      />

      {activeCase && (
        <PatientVideoModal
          ref={patientVideoModalRef}
          open={patientVideoOpen}
          onClose={() => setPatientVideoOpen(false)}
          video={PATIENT_CLINICAL[activeCase.id].patientVideo}
          patientName={activeCase.patientName}
          onSession={handleVideoSession}
        />
      )}

      {activeCase && (
        <PatientXraysModal
          ref={xraysModalRef}
          open={xraysOpen}
          onClose={() => setXraysOpen(false)}
          study={PATIENT_CLINICAL[activeCase.id].imaging}
          activeCase={activeCase}
        />
      )}

      <QuadView
        open={quadOpen}
        focused={quadFocused}
        onFocus={setQuadFocused}
        onClose={closeQuadView}
        timeOutChecked={timeOutChecked}
        toggleTimeOutItem={toggleTimeOutItem}
        counts={counts}
        adjustInstrumentCount={adjustInstrumentCount}
        dismissedAlerts={dismissedAlerts}
        dismissAlert={dismissAlert}
      />

      <ArtiInvoker
        placeholder="Ask Arti about this case…"
        onSubmit={onPrompt}
        suggestions={
          xraysOpen
            ? SUGGESTIONS_XRAYS
            : patientVideoOpen
              ? SUGGESTIONS_PATIENT_VIDEO
              : SUGGESTIONS_BY_ROLE[activeRole]
        }
      />
    </div>
  );
}
