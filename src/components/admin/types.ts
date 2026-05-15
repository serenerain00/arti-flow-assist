export interface Surgeon {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  loginEnabled: boolean;
  procedureIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Procedure {
  id: string;
  surgeonId: string;
  name: string;
  category: string;
  laterality: boolean;
  prefCardImageIds: string[];
  prefCardHtml: string;
  createdAt: number;
  updatedAt: number;
}

export interface PrefCardImage {
  id: string;
  procedureId: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export const PROCEDURE_CATEGORIES = [
  "N/A",
  "Arthroscopy",
  "Joint Reconstruction",
  "Soft Tissue",
  "Trauma",
  "Sports Medicine",
  "Spine",
  "Other",
] as const;
