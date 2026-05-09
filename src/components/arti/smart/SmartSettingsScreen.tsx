import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  DoorClosed,
  Lightbulb,
  Monitor,
  Music,
  RotateCcw,
  Thermometer,
} from "lucide-react";
import { Sidebar, type SidebarKey } from "../Sidebar";
import { TopBar } from "../TopBar";
import { ArtiInvoker } from "../ArtiInvoker";
import { cn } from "@/lib/utils";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  DEVICES,
  type DeviceCategory,
  type PropertySpec,
  type PropertyValue,
  type SmartDevice,
} from "./devices";
import { loadAllDeviceStates, loadDeviceState, resetDeviceState, saveDeviceState } from "./storage";
import { MockORView } from "./MockORView";

import type { SmartSettingsActionsRef } from "@/routes/index";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onLogout: () => void;
  onPrompt: (text: string) => void;
  onBack: () => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Voice tools register imperative actions here (selectDevice, applyPropertyChange). */
  actionsRef?: SmartSettingsActionsRef;
  /** Optional initial selection passed by the route when voice navigates here. */
  initialDeviceId?: string | null;
  /** Called once the screen has consumed initialDeviceId so the route can clear it. */
  onInitialDeviceConsumed?: () => void;
  /** Open the "are you sure?" confirmation for bulk-resetting all devices. */
  onOpenResetAll: () => void;
}

const CATEGORY_ICON: Record<DeviceCategory, typeof Lightbulb> = {
  lighting: Lightbulb,
  displays: Monitor,
  environment: Thermometer,
  audio: Music,
  doors: DoorClosed,
};

export function SmartSettingsScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onLogout,
  onPrompt,
  onBack,
  onSidebarNavigate,
  actionsRef,
  initialDeviceId,
  onInitialDeviceConsumed,
  onOpenResetAll,
}: Props) {
  // ── Selection ─────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string>(() => initialDeviceId ?? DEVICES[0].id);

  // Adopt a route-passed initial id (voice navigation can land here with a
  // device pre-selected). Consume once so the route can clear its pending state.
  useEffect(() => {
    if (initialDeviceId && initialDeviceId !== selectedId) {
      setSelectedId(initialDeviceId);
    }
    if (initialDeviceId) onInitialDeviceConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDeviceId]);
  const selectedDevice = useMemo(
    () => DEVICES.find((d) => d.id === selectedId) ?? DEVICES[0],
    [selectedId],
  );

  // ── State for the SELECTED device (live, drives controls + mock OR). ──
  const [deviceState, setDeviceState] = useState<Record<string, PropertyValue>>(() =>
    loadDeviceState(selectedDevice),
  );
  // Reload state when selection changes.
  useEffect(() => {
    setDeviceState(loadDeviceState(selectedDevice));
  }, [selectedDevice]);

  // ── State map of ALL devices for the Mock OR view. Mirrors writes from
  // the selected device so the preview reacts as the user drags.
  const [allStates, setAllStates] = useState(() => loadAllDeviceStates());
  useEffect(() => {
    // When selectedDevice's local state changes, mirror into allStates.
    setAllStates((prev) => ({ ...prev, [selectedDevice.id]: deviceState }));
  }, [selectedDevice.id, deviceState]);

  // Persist on debounce — write 200ms after the last change.
  useEffect(() => {
    const t = window.setTimeout(() => saveDeviceState(selectedDevice, deviceState), 200);
    return () => window.clearTimeout(t);
  }, [selectedDevice, deviceState]);

  const updateProperty = (key: string, value: PropertyValue) => {
    setDeviceState((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetDevice = () => {
    resetDeviceState(selectedDevice);
    const reset = { ...selectedDevice.defaults };
    setDeviceState(reset);
    setAllStates((prev) => ({ ...prev, [selectedDevice.id]: reset }));
  };

  // Register voice-driven actions while mounted. The route holds the ref;
  // we clear it on unmount so stale callbacks don't fire after a tear-down.
  useEffect(() => {
    if (!actionsRef) return;
    const actions = {
      selectDevice: (id: string) => setSelectedId(id),
      applyPropertyChange: (deviceId: string, key: string, value: PropertyValue) => {
        // Mirror into allStates so the Mock OR preview reacts even if the
        // changed device isn't the currently-selected one.
        setAllStates((prev) => ({
          ...prev,
          [deviceId]: { ...(prev[deviceId] ?? {}), [key]: value },
        }));
        // If it's the focused device, also update the live deviceState
        // (drives the right-pane controls).
        if (deviceId === selectedId) {
          setDeviceState((prev) => ({ ...prev, [key]: value }));
        }
      },
      reloadAllStates: () => {
        // Bulk re-read after a route-level reset. Refresh the controls of
        // the currently-focused device + the Mock OR preview together.
        setAllStates(loadAllDeviceStates());
        setDeviceState(loadDeviceState(selectedDevice));
      },
    };
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actionsRef, selectedId]);

  // ── Category expand state for the left nav ──────────────────────────
  // Single-expand accordion — opening one category collapses the others.
  // Default is "lighting" so the user lands on the most-used controls.
  const [expandedCategory, setExpandedCategory] = useState<DeviceCategory | null>("lighting");
  const toggleCategory = (cat: DeviceCategory) =>
    setExpandedCategory((prev) => (prev === cat ? null : cat));

  // When a device is selected (by click here or by voice), make sure its
  // category is the one expanded — otherwise the active item would be
  // hidden inside a collapsed group.
  useEffect(() => {
    setExpandedCategory(selectedDevice.category);
  }, [selectedDevice.category]);

  const devicesByCategory = useMemo(() => {
    const map = new Map<DeviceCategory, SmartDevice[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const d of DEVICES) map.get(d.category)?.push(d);
    return map;
  }, []);

  // Whether to show the Mock OR alongside the controls. The lighting
  // category is the natural fit; other categories reuse the same widget
  // since it visualizes displays + door state too.
  const showMockOR = true;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        onSleep={onSleep}
        onLogout={onLogout}
        activeKey="preferences"
        onNavigate={onSidebarNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar staffName={staffName} staffRole={staffRole} initials={initials} onSleep={onSleep} />

        <main className="relative min-h-0 flex-1 overflow-hidden animate-fade-in">
          <div className="flex h-full">
            {/* ── Left nav: categories + devices ── */}
            <nav className="w-72 shrink-0 overflow-y-auto border-r border-border/60 bg-surface/40 px-3 py-5">
              <button
                onClick={onBack}
                className="mb-4 inline-flex items-center gap-1.5 px-2 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" strokeWidth={1.7} />
                Admin Settings
              </button>
              <div className="px-2 pb-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
                  Smart Settings
                </div>
                <h1 className="mt-1.5 text-xl font-extralight text-foreground">OR 326 · Devices</h1>
                <p className="mt-1 text-xs font-light text-muted-foreground">
                  Configure smart devices in the room. Changes save automatically.
                </p>
              </div>

              {CATEGORY_ORDER.map((cat) => {
                const items = devicesByCategory.get(cat) ?? [];
                if (items.length === 0) return null;
                const Icon = CATEGORY_ICON[cat];
                const isExpanded = expandedCategory === cat;
                const isCollapsed = !isExpanded;
                return (
                  <div key={cat} className="mb-4">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                      <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/85">
                        {CATEGORY_META[cat].label}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-muted-foreground/70">
                        {items.length}
                      </span>
                      {isCollapsed ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    {!isCollapsed && (
                      <ul className="mt-1 space-y-0.5">
                        {items.map((d) => {
                          const active = d.id === selectedId;
                          return (
                            <li key={d.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedId(d.id)}
                                className={cn(
                                  "block w-full rounded-lg px-3 py-2 text-left transition-colors",
                                  active
                                    ? "border border-primary/40 bg-primary/10 text-foreground"
                                    : "border border-transparent text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-light">{d.name}</span>
                                  {d.group && (
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                                      {d.group}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] font-light leading-snug text-muted-foreground/80">
                                  {d.description}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}

              {/* Reset-all — bulk restore. The actual reset goes through a
                  route-level confirm modal (also voice-controllable). */}
              <div className="mt-6 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={onOpenResetAll}
                  className="group flex w-full items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-left transition-colors hover:border-warning/60 hover:bg-warning/10"
                  title="Restore every device to defaults (asks for confirmation)"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-warning" strokeWidth={1.8} />
                  <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.3em] text-warning">
                    Reset All Devices
                  </span>
                </button>
                <p className="mt-2 px-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
                  Voice: "reset all smart devices"
                </p>
              </div>
            </nav>

            {/* ── Right pane: controls + live OR preview ── */}
            <section className="flex min-w-0 flex-1 flex-col overflow-y-auto px-8 py-8 pb-40">
              <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary">
                    {CATEGORY_META[selectedDevice.category].label}
                    {selectedDevice.group ? ` · ${selectedDevice.group}` : ""}
                  </div>
                  <h2 className="mt-2 text-3xl font-extralight tracking-tight text-foreground">
                    {selectedDevice.name}
                  </h2>
                  <p className="mt-1 text-sm font-light text-muted-foreground">
                    {selectedDevice.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDevice}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  title="Restore this device's defaults"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
                  Reset
                </button>
              </header>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
                {/* Controls */}
                <div className="space-y-4">
                  {selectedDevice.propertySpecs.map((spec) => (
                    <PropertyControl
                      key={spec.key}
                      spec={spec}
                      value={deviceState[spec.key]}
                      onChange={(v) => updateProperty(spec.key, v)}
                    />
                  ))}
                </div>

                {/* Mock OR preview */}
                {showMockOR && (
                  <div className="aspect-[3/2] w-full xl:sticky xl:top-2 xl:self-start">
                    <MockORView deviceStates={allStates} focusDeviceId={selectedDevice.id} />
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>

        <ArtiInvoker
          placeholder="Tell Arti how to set the room…"
          onSubmit={onPrompt}
          suggestions={[
            "Dim Boom 1 to 60 percent",
            "Turn off the X-ray viewer",
            "Set ambient to warm",
            "Lock the OR door",
          ]}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Per-property control renderer.
// ─────────────────────────────────────────────────────────────────────────

function PropertyControl({
  spec,
  value,
  onChange,
}: {
  spec: PropertySpec;
  value: PropertyValue | undefined;
  onChange: (v: PropertyValue) => void;
}) {
  const labelBlock = (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <div className="text-sm font-light text-foreground">{spec.label}</div>
        {spec.sublabel && (
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
            {spec.sublabel}
          </div>
        )}
      </div>
      <LiveValue spec={spec} value={value} />
    </div>
  );

  if (spec.kind === "toggle") {
    const v = !!value;
    return (
      <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
        {labelBlock}
        <button
          type="button"
          role="switch"
          aria-checked={v}
          onClick={() => onChange(!v)}
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
            v ? "bg-primary" : "bg-surface-3",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
              v ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
    );
  }

  if (spec.kind === "select") {
    const v = String(value ?? spec.options[0]?.value ?? "");
    return (
      <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
        {labelBlock}
        <select
          value={v}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
        >
          {spec.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // percent + kelvin both render as sliders; kelvin uses a warm→cool gradient track.
  const isKelvin = spec.kind === "kelvin";
  const min = spec.min ?? (isKelvin ? 2700 : 0);
  const max = spec.max ?? (isKelvin ? 6500 : 100);
  const step = spec.step ?? (isKelvin ? 100 : 1);
  const v = typeof value === "number" ? value : Number(value ?? 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-5">
      {labelBlock}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3",
          isKelvin && "bg-gradient-to-r from-orange-300/70 via-yellow-100/60 to-blue-300/80",
        )}
      />
      <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
        <span>
          {isKelvin
            ? `${min}K · warm`
            : min + (spec.kind === "percent" && spec.unit ? spec.unit : "%")}
        </span>
        <span>
          {isKelvin
            ? `${max}K · cool`
            : max + (spec.kind === "percent" && spec.unit ? spec.unit : "%")}
        </span>
      </div>
    </div>
  );
}

function LiveValue({ spec, value }: { spec: PropertySpec; value: PropertyValue | undefined }) {
  if (spec.kind === "toggle") {
    return (
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
          value
            ? "border-success/40 bg-success/10 text-success"
            : "border-border/60 bg-surface-2/60 text-muted-foreground",
        )}
      >
        {value ? "On" : "Off"}
      </span>
    );
  }
  if (spec.kind === "select") {
    const v = String(value ?? "");
    const label = spec.options.find((o) => o.value === v)?.label ?? v;
    return (
      <span className="font-mono text-xs uppercase tracking-wider text-foreground/80">{label}</span>
    );
  }
  if (spec.kind === "kelvin") {
    return (
      <span className="font-mono text-base tabular-nums text-foreground/90">
        {Math.round(Number(value ?? 0))}K
      </span>
    );
  }
  const unit = spec.unit ?? "%";
  return (
    <span className="font-mono text-base tabular-nums text-foreground/90">
      {Number(value ?? 0).toFixed(unit === "°C" ? 1 : 0)}
      <span className="ml-0.5 text-muted-foreground/70">{unit}</span>
    </span>
  );
}
