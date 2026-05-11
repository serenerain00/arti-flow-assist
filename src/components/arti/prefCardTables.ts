/**
 * Annotated preference-card table layouts for the back table and Mayo stand.
 *
 * Each tool has a stable `id`, a display `label`, and `x/y` coordinates as
 * percentages of the underlying image (0–100). Coordinates are visual best
 * guesses — close enough for a prototype demo of the checklist + annotation
 * pattern; production would use surgeon-curated maps per pref card.
 */

import surgicalTableOverview from "@/assets/surgical-table-overview.jpg";
import surgicalTableMayo from "@/assets/surgical-table-mayo.jpg";

export type PrefCardTableId = "back-table" | "mayo-stand";

export type ToolStatus = "accounted" | "missing" | "contaminated";

/** Per-tool state — keyed `${tableId}:${toolId}`. */
export type PrefCardToolState = Record<string, { status: ToolStatus; note?: string; ts?: string }>;

export function toolKey(tableId: PrefCardTableId, toolId: string): string {
  return `${tableId}:${toolId}`;
}

export interface PrefCardTool {
  /** Stable id used for voice tool dispatch + state keys. */
  id: string;
  /** Display label shown on the pin + in the checklist. */
  label: string;
  /** Optional short clarifier (size, side, count). */
  detail?: string;
  /** Pin position as a percentage of the image (0–100). */
  x: number;
  y: number;
}

export interface PrefCardTable {
  id: PrefCardTableId;
  label: string;
  src: string;
  alt: string;
  caption: string;
  tools: PrefCardTool[];
}

export const PREF_CARD_TABLES: PrefCardTable[] = [
  {
    id: "back-table",
    label: "Back Table",
    src: surgicalTableOverview,
    alt: "Overhead view of sterile back table with general surgery instruments",
    caption: "Back table · standard RSA setup",
    tools: [
      { id: "metz-long", label: "Metzenbaum scissors", detail: "Long, curved", x: 15, y: 14 },
      { id: "iris-scissors", label: "Iris scissors", detail: "Fine, straight", x: 28, y: 11 },
      { id: "mayo-curved", label: "Mayo scissors", detail: "Curved, 6.75″", x: 41, y: 11 },
      { id: "needle-driver-1", label: "Needle driver", detail: "Mayo-Hegar", x: 53, y: 11 },
      { id: "curved-mayo-clamp", label: "Mayo clamp", detail: "Curved", x: 66, y: 13 },
      { id: "halsted-mosquito", label: "Halsted mosquito", detail: "Curved", x: 76, y: 11 },
      { id: "suture-scissors", label: "Suture scissors", detail: "Straight", x: 89, y: 12 },
      {
        id: "knife-handle-3",
        label: "Knife handle #3",
        detail: "For #10 / #15 blades",
        x: 9,
        y: 34,
      },
      { id: "adson-plain", label: "Adson forceps", detail: "Plain", x: 21, y: 36 },
      { id: "adson-teeth", label: "Adson forceps", detail: "1×2 teeth", x: 26, y: 36 },
      { id: "debakey", label: "DeBakey forceps", detail: "Atraumatic", x: 33, y: 36 },
      { id: "bayonet", label: "Bayonet forceps", detail: "Long", x: 46, y: 36 },
      { id: "allis-clamp", label: "Allis tissue clamp", x: 57, y: 36 },
      { id: "kelly-curved", label: "Kelly clamp", detail: "Curved", x: 71, y: 36 },
      { id: "russian-forceps", label: "Russian forceps", x: 89, y: 36 },
      { id: "mayo-curved-large-1", label: "Mayo scissors", detail: "Curved, large", x: 9, y: 80 },
      {
        id: "mayo-straight-large",
        label: "Mayo scissors",
        detail: "Straight, large",
        x: 24,
        y: 80,
      },
      { id: "metz-curved-large", label: "Metzenbaum", detail: "Curved, large", x: 38, y: 80 },
      { id: "scissors-bottom-4", label: "Operating scissors", detail: "Sharp/sharp", x: 53, y: 80 },
      { id: "scissors-bottom-5", label: "Operating scissors", detail: "Sharp/blunt", x: 68, y: 80 },
      { id: "scissors-bottom-6", label: "Mayo scissors", detail: "Right-handed", x: 83, y: 82 },
    ],
  },
  {
    id: "mayo-stand",
    label: "Mayo Stand",
    src: surgicalTableMayo,
    alt: "Mayo stand stocked for shoulder arthroplasty",
    caption: "Mayo stand · shoulder arthroplasty",
    tools: [
      { id: "reamer-head", label: "Glenoid reamer head", detail: "Cup, low-profile", x: 22, y: 22 },
      { id: "starter-awl", label: "Starter awl", x: 30, y: 11 },
      { id: "humeral-broach-set", label: "Humeral broaches", detail: "Sizes 7–11", x: 45, y: 12 },
      { id: "trial-glenosphere", label: "Trial glenosphere", detail: "38 mm", x: 71, y: 10 },
      {
        id: "magnifier-trial",
        label: "Trial poly insert",
        detail: "Standard offset",
        x: 80,
        y: 12,
      },
      { id: "power-handpiece", label: "Power handpiece", detail: "Battery-driven", x: 8, y: 42 },
      { id: "burr-brush", label: "Burr / cleaning brush", x: 14, y: 32 },
      { id: "trial-bases", label: "Baseplate trials", detail: "25 mm / 29 mm", x: 51, y: 19 },
      { id: "impactor", label: "Glenosphere impactor", x: 60, y: 30 },
      { id: "osteotome-set", label: "Osteotomes", detail: "Curved + straight", x: 47, y: 44 },
      { id: "curette-set", label: "Curettes", detail: "Angled, 3 sizes", x: 38, y: 42 },
      { id: "cobb-elevator", label: "Cobb elevator", x: 34, y: 60 },
      { id: "freer-elevator", label: "Freer elevator", x: 41, y: 60 },
      { id: "bone-hook", label: "Bone hook", x: 64, y: 60 },
      { id: "hohmann-retractor", label: "Hohmann retractor", detail: "Wide blade", x: 90, y: 36 },
      { id: "bone-tenaculum", label: "Bone tenaculum", x: 90, y: 12 },
      { id: "army-navy", label: "Army-Navy retractor", x: 43, y: 82 },
      { id: "rake-retractor", label: "Senn rake retractor", x: 25, y: 72 },
    ],
  },
];

export function findTable(id: PrefCardTableId): PrefCardTable | undefined {
  return PREF_CARD_TABLES.find((t) => t.id === id);
}

/** Free-text lookup: matches "back table", "mayo", "mayo stand", etc. */
export function resolveTableId(query?: string): PrefCardTableId | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  if (/mayo/.test(q)) return "mayo-stand";
  if (/back\s*table|back/.test(q)) return "back-table";
  return undefined;
}

/** Fuzzy match a tool by free text within a specific table. */
export function findTool(table: PrefCardTable, query: string): PrefCardTool | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  // Exact id match first.
  const byId = table.tools.find((t) => t.id === q);
  if (byId) return byId;
  // Label includes query.
  const byLabel = table.tools.find((t) => t.label.toLowerCase().includes(q));
  if (byLabel) return byLabel;
  // Query includes part of the label.
  const byPartial = table.tools.find((t) => {
    const words = t.label.toLowerCase().split(/\s+/);
    return words.some((w) => q.includes(w) && w.length >= 4);
  });
  return byPartial;
}
