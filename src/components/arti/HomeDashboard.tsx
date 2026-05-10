import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, RotateCcw, Shuffle, Sliders, X as XIcon } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import { TODAY_CASES } from "./cases";
import { cn } from "@/lib/utils";
import { DashboardCanvas } from "./dashboard/DashboardCanvas";
import { DEFAULT_MY_DASHBOARD, DEFAULT_PROCEDURE_DASHBOARD } from "./dashboard/defaults";
import {
  hasSavedProcedureDashboard,
  loadMyDashboard,
  loadProcedureDashboard,
  saveMyDashboard,
  saveProcedureDashboard,
} from "./dashboard/storage";
import type { DashboardConfig, WidgetContext } from "./dashboard/types";

/**
 * Live mutators the route can drive via voice while Home is mounted.
 * Mirrors DashboardActions / IntraopActions ref bridges.
 */
export interface HomeDashboardActions {
  /** Flip dashboard mode. Returns ok:false while in edit mode. */
  setMode: (mode: "my" | "procedure") => { ok: boolean; reason?: string };
}

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onLogout: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Route-owned ref — HomeDashboard registers actions on mount. */
  actionsRef?: React.MutableRefObject<HomeDashboardActions | null>;
  /** A mode the route stashed before navigating home — applied on mount and cleared. */
  pendingModeRef?: React.MutableRefObject<"my" | "procedure" | null>;
}

/**
 * Home — the circulating nurse's customizable dashboard. Two modes:
 *   • "My Dashboard" — her personal day-overview composition.
 *   • "Procedure Dashboard" — per-procedure preview, defaulting to the
 *     up-next case's procedure. She can flip between procedures.
 *
 * Edit mode reveals drag handles + a palette drawer; presets persist
 * to localStorage (`arti.dashboard:my`, `arti.dashboard:procedure:<slug>`).
 */
export function HomeDashboard({
  staffName,
  staffRole,
  initials,
  onSleep,
  onLogout,
  onPrompt,
  onSidebarNavigate,
  actionsRef,
  pendingModeRef,
}: Props) {
  // ── Dashboard mode + edit state ──────────────────────────────────────
  const [dashboardMode, setDashboardMode] = useState<"my" | "procedure">("my");
  const [editing, setEditing] = useState(false);
  const [editConfig, setEditConfig] = useState<DashboardConfig | null>(null);
  /** Bumped after every save so loaders re-read from localStorage. */
  const [savedVersion, setSavedVersion] = useState(0);

  // Procedure slug — defaults to the up-next case on the board so the
  // procedure dashboard "knows what's coming" without requiring nav.
  const upNextCase = useMemo(
    () => TODAY_CASES.find((c) => c.status === "next") ?? TODAY_CASES[0],
    [],
  );
  const defaultProcedureSlug = useMemo(
    () => (upNextCase?.procedureShort ?? "general").toLowerCase().replace(/\s+/g, "-"),
    [upNextCase?.procedureShort],
  );
  /** When the user "flips" to a different procedure preset to peek. */
  const [flippedSlug, setFlippedSlug] = useState<string | null>(null);
  const effectiveSlug = flippedSlug ?? defaultProcedureSlug;

  // Procedure options for the flip dropdown — distinct procedures on
  // today's board.
  const procedureOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: Array<{ slug: string; label: string }> = [];
    for (const c of TODAY_CASES) {
      const slug = c.procedureShort.toLowerCase().replace(/\s+/g, "-");
      if (seen.has(slug)) continue;
      seen.add(slug);
      opts.push({ slug, label: `${c.procedureShort} — ${c.procedure}` });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  // Read the active config (re-evaluated on save).
  const activeConfig = useMemo(() => {
    return dashboardMode === "my" ? loadMyDashboard() : loadProcedureDashboard(effectiveSlug);
    // savedVersion forces a re-read after saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardMode, effectiveSlug, savedVersion]);

  const displayedConfig = editing && editConfig ? editConfig : activeConfig;

  const handleStartEdit = () => {
    setEditConfig(activeConfig);
    setEditing(true);
  };
  const handleSave = () => {
    if (!editConfig) return;
    if (dashboardMode === "my") saveMyDashboard(editConfig);
    else saveProcedureDashboard(effectiveSlug, editConfig);
    setSavedVersion((v) => v + 1);
    setEditing(false);
    setEditConfig(null);
  };
  const handleCancel = () => {
    setEditing(false);
    setEditConfig(null);
  };
  const handleResetToDefault = () => {
    setEditConfig(dashboardMode === "my" ? DEFAULT_MY_DASHBOARD : DEFAULT_PROCEDURE_DASHBOARD);
  };

  // Reset edit + flip when switching modes.
  useEffect(() => {
    setEditing(false);
    setEditConfig(null);
  }, [dashboardMode]);

  // Pick up a pending mode the route stashed (voice fired while we were on
  // a different screen). Apply once, then clear so it doesn't repeat.
  useEffect(() => {
    const pending = pendingModeRef?.current;
    if (!pending) return;
    setDashboardMode(pending);
    pendingModeRef.current = null;
  }, [pendingModeRef]);

  // Register the actions object so the route's voice tools can flip mode.
  useEffect(() => {
    if (!actionsRef) return;
    const actions: HomeDashboardActions = {
      setMode: (mode) => {
        if (editing) return { ok: false, reason: "dashboard is in edit mode" };
        setDashboardMode(mode);
        return { ok: true };
      },
    };
    actionsRef.current = actions;
    return () => {
      if (actionsRef.current === actions) actionsRef.current = null;
    };
  }, [actionsRef, editing]);

  const widgetContext: WidgetContext = useMemo(
    () => ({
      staffName,
      onPrompt,
      // Procedure dashboard widgets that read activeCase get the up-next
      // case so previews (case-summary, anatomy-3d caption) reflect what
      // the team is about to do.
      activeCase: dashboardMode === "procedure" ? upNextCase : undefined,
    }),
    [staffName, onPrompt, dashboardMode, upNextCase],
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        onSleep={onSleep}
        onLogout={onLogout}
        activeKey="home"
        onNavigate={onSidebarNavigate}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar staffName={staffName} staffRole={staffRole} initials={initials} onSleep={onSleep} />

        <main
          data-scroll
          className="relative min-h-0 flex-1 overflow-y-auto px-8 pt-8 pb-40 animate-fade-in"
        >
          <div className="flex flex-col gap-6">
            <DashboardChrome
              dashboardMode={dashboardMode}
              onChangeMode={(m) => {
                if (editing) return;
                setDashboardMode(m);
              }}
              editing={editing}
              onStartEdit={handleStartEdit}
              onSave={handleSave}
              onCancel={handleCancel}
              onResetToDefault={handleResetToDefault}
              effectiveSlug={effectiveSlug}
              defaultProcedureSlug={defaultProcedureSlug}
              flippedSlug={flippedSlug}
              onFlipProcedure={(slug) =>
                setFlippedSlug(slug === defaultProcedureSlug ? null : slug)
              }
              procedureOptions={procedureOptions}
              hasSavedForActive={hasSavedProcedureDashboard(defaultProcedureSlug)}
            />

            <DashboardCanvas
              key={`${dashboardMode}:${effectiveSlug}:${savedVersion}`}
              config={displayedConfig}
              ctx={widgetContext}
              editing={editing}
              surface="home"
              onChange={(next) => setEditConfig(next)}
            />
          </div>
        </main>

        <ArtiInvoker
          placeholder="Ask Arti anything…"
          onSubmit={onPrompt}
          suggestions={["Show me the case list", "Open the next case", "What's my day look like?"]}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// DashboardChrome — toggle + edit controls + procedure flip picker.
// ─────────────────────────────────────────────────────────────────────────

interface DashboardChromeProps {
  dashboardMode: "my" | "procedure";
  onChangeMode: (m: "my" | "procedure") => void;
  editing: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onResetToDefault: () => void;
  effectiveSlug: string;
  defaultProcedureSlug: string;
  flippedSlug: string | null;
  onFlipProcedure: (slug: string) => void;
  procedureOptions: Array<{ slug: string; label: string }>;
  hasSavedForActive: boolean;
}

function DashboardChrome({
  dashboardMode,
  onChangeMode,
  editing,
  onStartEdit,
  onSave,
  onCancel,
  onResetToDefault,
  effectiveSlug,
  defaultProcedureSlug,
  flippedSlug,
  onFlipProcedure,
  procedureOptions,
  hasSavedForActive,
}: DashboardChromeProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface/40 px-4 py-3">
      {/* Left: mode toggle */}
      <div className="inline-flex rounded-full border border-border/60 bg-surface-2/60 p-1 font-mono text-[10px] uppercase tracking-wider">
        {(
          [
            { id: "my", label: "My Dashboard" },
            { id: "procedure", label: "Procedure Dashboard" },
          ] as Array<{ id: "my" | "procedure"; label: string }>
        ).map((opt) => {
          const active = dashboardMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeMode(opt.id)}
              disabled={editing}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-all",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                editing && !active && "cursor-not-allowed opacity-40",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Middle: flip-procedure picker (procedure dashboard only) */}
      {dashboardMode === "procedure" && !editing && (
        <div className="flex items-center gap-2">
          <Shuffle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.7} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Procedure
          </span>
          <select
            value={effectiveSlug}
            onChange={(e) => onFlipProcedure(e.target.value)}
            className="rounded-full border border-border/60 bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-foreground focus:border-primary/50 focus:outline-none"
            title="Flip to a different procedure's preset"
          >
            {procedureOptions.map((opt) => (
              <option key={opt.slug} value={opt.slug}>
                {opt.label}
                {opt.slug === defaultProcedureSlug ? " · up-next" : ""}
              </option>
            ))}
          </select>
          {flippedSlug && (
            <button
              type="button"
              onClick={() => onFlipProcedure(defaultProcedureSlug)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary/40 hover:text-foreground"
              title="Snap back to the up-next case's procedure"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
              Back to up-next
            </button>
          )}
        </div>
      )}

      {/* Right: edit / save / cancel controls */}
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={onResetToDefault}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              title="Reset this dashboard to its built-in default"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.8} />
              Reset to default
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              <XIcon className="h-3 w-3" strokeWidth={1.8} />
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
            >
              <Check className="h-3 w-3" strokeWidth={2} />
              Save preset
            </button>
          </>
        ) : (
          <>
            {dashboardMode === "procedure" && hasSavedForActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-success">
                <Sliders className="h-3 w-3" strokeWidth={1.8} />
                Saved preset
              </span>
            )}
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-all hover:border-primary/70 hover:bg-primary/20"
            >
              <Pencil className="h-3 w-3" strokeWidth={2} />
              Edit Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
