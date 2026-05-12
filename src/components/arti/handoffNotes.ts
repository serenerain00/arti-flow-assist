import type { CaseItem } from "./cases";
import { PATIENT_CLINICAL } from "./cases";

export type HandoffSection =
  | "baseline"
  | "procedure"
  | "complications"
  | "ebl"
  | "post_op"
  | "implants"
  | "follow_ups";

export type HandoffNotes = Partial<Record<HandoffSection, string>>;

export const HANDOFF_SECTIONS: Array<{
  id: HandoffSection;
  label: string;
  hint: string;
  placeholder: string;
}> = [
  {
    id: "baseline",
    label: "Baseline condition",
    hint: "Pre-op status, ASA, cooperation, language barriers, mobility",
    placeholder: "Alert and oriented. ASA II. Ambulatory with cane.",
  },
  {
    id: "procedure",
    label: "Procedure performed",
    hint: "Procedure short + side; final approach if different from plan",
    placeholder: "Right reverse total shoulder arthroplasty.",
  },
  {
    id: "complications",
    label: "Complications",
    hint: "Intra-op events worth flagging — bleeds, breaks, conversions",
    placeholder: "None.",
  },
  {
    id: "ebl",
    label: "Estimated blood loss",
    hint: "EBL in mL; note transfusion if any",
    placeholder: "~150 mL. No transfusion.",
  },
  {
    id: "post_op",
    label: "Post-op instructions",
    hint: "Positioning, sling, weight-bearing, ice, drain care",
    placeholder: "Sling at all times × 4 weeks. Ice 20 min q2h while awake.",
  },
  {
    id: "implants",
    label: "Implants used",
    hint: "Auto-prefilled from the case implant plan; edit if you swapped sizes",
    placeholder: "Glenoid baseplate 25 mm, glenosphere 38 mm…",
  },
  {
    id: "follow_ups",
    label: "Follow-ups & pain management",
    hint: "Pain plan, follow-up appointment, PT referral, callback contacts",
    placeholder: "Interscalene catheter overnight. PT consult day 2. Clinic in 10 days.",
  },
];

/** Free-text → HandoffSection. Accepts loose wording. */
export function resolveHandoffSection(query?: string): HandoffSection | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  if (/(baseline|preop status|pre-op status|baseline cond)/.test(q)) return "baseline";
  if (/(procedure performed|procedure done|procedure)/.test(q)) return "procedure";
  if (/(complication|intra[- ]?op event|adverse)/.test(q)) return "complications";
  if (/(ebl|estimated blood loss|blood loss)/.test(q)) return "ebl";
  if (
    /(post[- ]?op|postop instruction|post[- ]?operative|positioning|sling|weight bearing|ice)/.test(
      q,
    )
  )
    return "post_op";
  if (/(implant|hardware used|components used)/.test(q)) return "implants";
  if (/(follow[- ]?up|pain management|pain plan|pain control|callback|referral|pt consult)/.test(q))
    return "follow_ups";
  return undefined;
}

/** Auto-derive a sensible default for procedure/implants from the active case. */
export function getHandoffDefaults(activeCase?: CaseItem): HandoffNotes {
  if (!activeCase) return {};
  const clinical = PATIENT_CLINICAL[activeCase.id];
  const procedure = `${activeCase.side ? `${activeCase.side} ` : ""}${activeCase.procedure}`.trim();
  const implants = clinical?.implantPlan.map((i) => `${i.component} ${i.spec}`).join(" · ");
  return {
    procedure,
    implants,
  };
}
