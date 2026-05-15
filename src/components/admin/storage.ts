import type { Procedure, Surgeon, PrefCardImage } from "./types";

const SURGEONS_KEY = "art-setup.surgeons.v1";
const PROCEDURES_KEY = "art-setup.procedures.v1";
const IMAGES_KEY = "art-setup.prefcard-images.v1";

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — silently drop. Images are the only thing big enough
    // to hit this in practice, and the upload form surfaces that on save.
  }
}

export function loadSurgeons(): Surgeon[] {
  return readArray<Surgeon>(SURGEONS_KEY);
}

export function saveSurgeons(surgeons: Surgeon[]) {
  writeArray(SURGEONS_KEY, surgeons);
}

export function loadProcedures(): Procedure[] {
  return readArray<Procedure>(PROCEDURES_KEY);
}

export function saveProcedures(procedures: Procedure[]) {
  writeArray(PROCEDURES_KEY, procedures);
}

export function loadImages(): PrefCardImage[] {
  return readArray<PrefCardImage>(IMAGES_KEY);
}

export function saveImages(images: PrefCardImage[]) {
  writeArray(IMAGES_KEY, images);
}

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
