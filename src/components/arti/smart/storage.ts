import { DEVICES, type PropertyValue, type SmartDevice } from "./devices";

const KEY_PREFIX = "arti.smart:";
const deviceKey = (id: string) => `${KEY_PREFIX}${id}`;

/**
 * Read a device's persisted state from localStorage, falling back to its
 * compile-time defaults. Defensive about parse errors — corrupt entries
 * silently drop back to defaults.
 */
export function loadDeviceState(device: SmartDevice): Record<string, PropertyValue> {
  if (typeof window === "undefined") return { ...device.defaults };
  try {
    const raw = window.localStorage.getItem(deviceKey(device.id));
    if (!raw) return { ...device.defaults };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ...device.defaults };
    // Only accept keys that exist in the spec — survives schema changes.
    const keys = new Set(device.propertySpecs.map((s) => s.key));
    const out: Record<string, PropertyValue> = { ...device.defaults };
    for (const [k, v] of Object.entries(parsed as Record<string, PropertyValue>)) {
      if (
        keys.has(k) &&
        (typeof v === "boolean" || typeof v === "number" || typeof v === "string")
      ) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return { ...device.defaults };
  }
}

export function saveDeviceState(device: SmartDevice, state: Record<string, PropertyValue>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(deviceKey(device.id), JSON.stringify(state));
  } catch {
    // Quota / private mode — silently ignore in prototype.
  }
}

/** Reset one device to its compile-time defaults (clears its localStorage entry). */
export function resetDeviceState(device: SmartDevice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(deviceKey(device.id));
  } catch {
    // ignore
  }
}

/** Bulk-load all devices' states (used by MockORView for the visualization). */
export function loadAllDeviceStates(): Record<string, Record<string, PropertyValue>> {
  const out: Record<string, Record<string, PropertyValue>> = {};
  for (const d of DEVICES) {
    out[d.id] = loadDeviceState(d);
  }
  return out;
}

/**
 * Reset every device back to its compile-time defaults — clears the
 * localStorage entry for each. Used by the "Reset all" voice command +
 * button on the Smart Settings screen.
 */
export function resetAllDeviceStates(): void {
  for (const d of DEVICES) {
    resetDeviceState(d);
  }
}
