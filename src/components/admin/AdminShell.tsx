import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AdminSidebar, type AdminNavKey } from "./Sidebar";
import { AdminLogin } from "./AdminLogin";
import { AdminDashboard } from "./AdminDashboard";
import { SurgeonsList } from "./SurgeonsList";
import { SurgeonForm } from "./SurgeonForm";
import { SurgeonDetail } from "./SurgeonDetail";
import { ProceduresAllList } from "./ProceduresAllList";
import { ProcedureDetail } from "./ProcedureDetail";
import { BuilderShell, ensureReservedWidgets } from "./builder/BuilderShell";
import { DashboardsList } from "./builder/DashboardsList";
import { LiveCaseScreen } from "./LiveCaseScreen";
import { LiveCaseSwitch } from "./LiveCaseSwitch";
import {
  findDashboardForProcedure,
  loadDashboards,
  makeDashboardId,
  makeEmptyDashboard,
  saveDashboards,
} from "./builder/storage";
import {
  loadLiveCase,
  saveLiveCase,
  subscribeLiveCase,
  type LiveCaseState,
} from "./builder/liveCase";
import type { Dashboard, Phase, PhaseLayouts } from "./builder/types";
import {
  loadImages,
  loadProcedures,
  loadSurgeons,
  makeId,
  saveImages,
  saveProcedures,
  saveSurgeons,
} from "./storage";
import type { PrefCardImage, Procedure, Surgeon } from "./types";

type View =
  | { kind: "idle" }
  | { kind: "login" }
  | { kind: "dashboard" }
  | { kind: "surgeons" }
  | { kind: "surgeon-new" }
  | { kind: "surgeon-detail"; id: string }
  | { kind: "procedures-all" }
  | {
      kind: "procedure-detail";
      surgeonId: string;
      procedureId: string;
      from: "surgeon" | "procedures";
    }
  | { kind: "dashboards-list" }
  | {
      kind: "builder";
      dashboardId: string;
      /** When set, exiting the builder returns to that procedure-detail view
       *  instead of the dashboards-list. */
      returnTo?: {
        surgeonId: string;
        procedureId: string;
        from: "surgeon" | "procedures";
      };
    }
  | { kind: "live-case" };

export function AdminShell() {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [authed, setAuthed] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);

  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [images, setImages] = useState<PrefCardImage[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [liveCase, setLiveCase] = useState<LiveCaseState>({
    active: false,
    dashboardId: null,
    currentPhase: "preop",
    updatedAt: 0,
  });

  // Builder hides the sidebar by default; any other view shows it.
  useEffect(() => {
    setSidebarHidden(view.kind === "builder");
  }, [view.kind]);

  useEffect(() => {
    setSurgeons(loadSurgeons());
    setProcedures(loadProcedures());
    setImages(loadImages());
    setDashboards(loadDashboards());
    // Live case always starts OFF on a fresh page load. Operators must turn
    // it on explicitly each session, but we keep dashboardId / currentPhase
    // from the persisted state so the previous selection is remembered.
    const persisted = loadLiveCase();
    const fresh: LiveCaseState = { ...persisted, active: false, updatedAt: Date.now() };
    setLiveCase(fresh);
    saveLiveCase(fresh);
    // Sync live-case state from other tabs (the wall preview tab listens
    // for changes too — this keeps the controller in sync if the user
    // edits state in another window).
    return subscribeLiveCase((next) => setLiveCase(next));
  }, []);

  const persistDashboards = useCallback((next: Dashboard[]) => {
    setDashboards(next);
    saveDashboards(next);
  }, []);

  const persistLiveCase = useCallback((patch: Partial<LiveCaseState>) => {
    setLiveCase((prev) => {
      const next: LiveCaseState = { ...prev, ...patch, updatedAt: Date.now() };
      saveLiveCase(next);
      return next;
    });
  }, []);

  const persistSurgeons = useCallback((next: Surgeon[]) => {
    setSurgeons(next);
    saveSurgeons(next);
  }, []);

  const persistProcedures = useCallback((next: Procedure[]) => {
    setProcedures(next);
    saveProcedures(next);
  }, []);

  const persistImages = useCallback((next: PrefCardImage[]) => {
    setImages(next);
    saveImages(next);
  }, []);

  const activeNavKey: AdminNavKey | undefined = useMemo(() => {
    if (view.kind === "builder" || view.kind === "dashboards-list") return "builder";
    if (view.kind === "live-case") return "live-case";
    if (view.kind === "idle") return undefined;
    return "settings";
  }, [view]);

  const onSidebarNav = (key: AdminNavKey) => {
    if (key === "settings") {
      setView(authed ? { kind: "dashboard" } : { kind: "login" });
      return;
    }
    if (key === "builder") {
      setView({ kind: "dashboards-list" });
      return;
    }
    if (key === "live-case") {
      if (!liveCase.active) return;
      setView({ kind: "live-case" });
    }
  };

  // ─── Dashboard CRUD ──────────────────────────────────────────────────
  const openProcedureDashboard = (
    surgeonId: string,
    procedureId: string,
    from: "surgeon" | "procedures",
  ) => {
    const returnTo = { surgeonId, procedureId, from };
    const existing = findDashboardForProcedure(dashboards, surgeonId, procedureId);
    if (existing) {
      setView({ kind: "builder", dashboardId: existing.id, returnTo });
      return;
    }
    const surgeon = surgeons.find((s) => s.id === surgeonId);
    const procedure = procedures.find((p) => p.id === procedureId);
    const name = procedure ? procedure.name : "Procedure dashboard";
    const surgeonLabel = surgeon ? ` · ${surgeon.firstName} ${surgeon.lastName}` : "";
    const created: Dashboard = {
      ...makeEmptyDashboard({
        name: `${name}${surgeonLabel}`,
        surgeonId,
        procedureId,
        isTemplate: false,
      }),
      layouts: ensureReservedWidgets({ preop: [], intraop: [], postop: [] }),
    };
    persistDashboards([...dashboards, created]);
    setView({ kind: "builder", dashboardId: created.id, returnTo });
  };

  const createTemplate = (name: string) => {
    const created: Dashboard = {
      ...makeEmptyDashboard({ name, isTemplate: true }),
      layouts: ensureReservedWidgets({ preop: [], intraop: [], postop: [] }),
    };
    const next = [...dashboards, created];
    persistDashboards(next);
    setView({ kind: "builder", dashboardId: created.id });
  };

  const updateDashboard = (id: string, patch: Partial<Dashboard>) => {
    persistDashboards(
      dashboards.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)),
    );
  };

  const deleteDashboard = (id: string) => {
    persistDashboards(dashboards.filter((d) => d.id !== id));
  };

  // ─── Surgeon / procedure deletion (cascades) ─────────────────────────
  // Deleting a procedure also removes its prefcard images and its wall
  // dashboard, and unlinks it from the owning surgeon.
  const deleteProcedure = (id: string) => {
    const proc = procedures.find((p) => p.id === id);
    persistProcedures(procedures.filter((p) => p.id !== id));
    persistImages(images.filter((i) => i.procedureId !== id));
    persistDashboards(dashboards.filter((d) => d.procedureId !== id));
    if (proc) {
      persistSurgeons(
        surgeons.map((s) =>
          s.id === proc.surgeonId
            ? {
                ...s,
                procedureIds: s.procedureIds.filter((pid) => pid !== id),
                updatedAt: Date.now(),
              }
            : s,
        ),
      );
    }
  };

  // Deleting a surgeon removes all of their procedures (and those
  // procedures' prefcard images and dashboards) along with the surgeon.
  const deleteSurgeon = (id: string) => {
    const ownProcedureIds = new Set(
      procedures.filter((p) => p.surgeonId === id).map((p) => p.id),
    );
    persistSurgeons(surgeons.filter((s) => s.id !== id));
    persistProcedures(procedures.filter((p) => p.surgeonId !== id));
    persistImages(images.filter((i) => !ownProcedureIds.has(i.procedureId)));
    persistDashboards(dashboards.filter((d) => d.surgeonId !== id));
  };

  const saveAsTemplate = (sourceId: string, name: string) => {
    const source = dashboards.find((d) => d.id === sourceId);
    if (!source) return;
    const cloned: Dashboard = {
      id: makeDashboardId(),
      name,
      isTemplate: true,
      layouts: {
        preop: source.layouts.preop.map((w) => ({ ...w, id: makeId("wg") })),
        intraop: source.layouts.intraop.map((w) => ({ ...w, id: makeId("wg") })),
        postop: source.layouts.postop.map((w) => ({ ...w, id: makeId("wg") })),
      } as PhaseLayouts,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persistDashboards([...dashboards, cloned]);
  };

  // ─── Surgeon CRUD ────────────────────────────────────────────────────
  const upsertSurgeon = (
    id: string | null,
    draft: Omit<Surgeon, "id" | "procedureIds" | "createdAt" | "updatedAt">,
  ) => {
    const now = Date.now();
    if (id) {
      persistSurgeons(surgeons.map((s) => (s.id === id ? { ...s, ...draft, updatedAt: now } : s)));
      return id;
    }
    const newId = makeId("sg");
    const created: Surgeon = {
      id: newId,
      ...draft,
      procedureIds: [],
      createdAt: now,
      updatedAt: now,
    };
    persistSurgeons([...surgeons, created]);
    return newId;
  };

  // ─── Procedure CRUD ──────────────────────────────────────────────────
  const createProcedure = (surgeonId: string): string => {
    const now = Date.now();
    const id = makeId("pr");
    const ownerProcedures = procedures.filter((p) => p.surgeonId === surgeonId);
    const next: Procedure = {
      id,
      surgeonId,
      name: `Custom Procedure ${ownerProcedures.length + 1}`,
      category: "N/A",
      laterality: true,
      prefCardImageIds: [],
      prefCardHtml: "",
      createdAt: now,
      updatedAt: now,
    };
    persistProcedures([...procedures, next]);
    persistSurgeons(
      surgeons.map((s) =>
        s.id === surgeonId ? { ...s, procedureIds: [...s.procedureIds, id], updatedAt: now } : s,
      ),
    );
    return id;
  };

  const patchProcedure = (id: string, patch: Partial<Procedure>) => {
    persistProcedures(
      procedures.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    );
  };

  // ─── Image CRUD ──────────────────────────────────────────────────────
  const addImages = (newImages: PrefCardImage[]) => {
    const next = [...images, ...newImages];
    persistImages(next);
    if (newImages.length === 0) return;
    const procedureId = newImages[0].procedureId;
    const proc = procedures.find((p) => p.id === procedureId);
    if (!proc) return;
    patchProcedure(procedureId, {
      prefCardImageIds: [...proc.prefCardImageIds, ...newImages.map((i) => i.id)],
    });
  };

  const removeImage = (id: string) => {
    const img = images.find((i) => i.id === id);
    persistImages(images.filter((i) => i.id !== id));
    if (!img) return;
    const proc = procedures.find((p) => p.id === img.procedureId);
    if (!proc) return;
    patchProcedure(proc.id, {
      prefCardImageIds: proc.prefCardImageIds.filter((x) => x !== id),
    });
  };

  const renameImage = (id: string, name: string) => {
    persistImages(images.map((i) => (i.id === id ? { ...i, name } : i)));
  };

  // ─── Render the active panel ─────────────────────────────────────────
  const renderPanel = () => {
    switch (view.kind) {
      case "idle":
        return <IdlePanel />;
      case "login":
        return (
          <AdminLogin
            onLogin={() => {
              setAuthed(true);
              setView({ kind: "dashboard" });
            }}
          />
        );
      case "dashboard":
        return (
          <AdminDashboard
            onOpenSurgeons={() => setView({ kind: "surgeons" })}
            onOpenProcedures={() => setView({ kind: "procedures-all" })}
          />
        );
      case "procedures-all":
        return (
          <ProceduresAllList
            procedures={procedures}
            surgeons={surgeons}
            dashboards={dashboards}
            onBack={() => setView({ kind: "dashboard" })}
            onOpen={(procedureId) => {
              const proc = procedures.find((p) => p.id === procedureId);
              if (!proc) return;
              setView({
                kind: "procedure-detail",
                surgeonId: proc.surgeonId,
                procedureId,
                from: "procedures",
              });
            }}
            onDelete={(procedureId) => deleteProcedure(procedureId)}
          />
        );
      case "surgeons":
        return (
          <SurgeonsList
            surgeons={surgeons}
            procedures={procedures}
            onBack={() => setView({ kind: "dashboard" })}
            onAdd={() => setView({ kind: "surgeon-new" })}
            onOpen={(id) => setView({ kind: "surgeon-detail", id })}
            onDelete={(id) => deleteSurgeon(id)}
          />
        );
      case "surgeon-new":
        return (
          <SurgeonForm
            onCancel={() => setView({ kind: "surgeons" })}
            onSave={(draft) => {
              const newId = upsertSurgeon(null, {
                firstName: draft.firstName.trim(),
                lastName: draft.lastName.trim(),
                email: draft.email.trim(),
                loginEnabled: draft.loginEnabled,
              });
              // Drop straight into the surgeon detail so the user can
              // jump to Procedures without bouncing through the list.
              setView({ kind: "surgeon-detail", id: newId });
            }}
          />
        );
      case "surgeon-detail": {
        const surgeon = surgeons.find((s) => s.id === view.id);
        if (!surgeon) {
          // Surgeon disappeared (e.g. cleared storage); bounce to list.
          setView({ kind: "surgeons" });
          return null;
        }
        const own = procedures.filter((p) => p.surgeonId === surgeon.id);
        return (
          <SurgeonDetail
            surgeon={surgeon}
            procedures={own}
            dashboards={dashboards}
            onBack={() => setView({ kind: "surgeons" })}
            onSave={(draft) => {
              upsertSurgeon(surgeon.id, {
                firstName: draft.firstName.trim(),
                lastName: draft.lastName.trim(),
                email: draft.email.trim(),
                loginEnabled: draft.loginEnabled,
              });
            }}
            onAddProcedure={() => {
              const procedureId = createProcedure(surgeon.id);
              setView({
                kind: "procedure-detail",
                surgeonId: surgeon.id,
                procedureId,
                from: "surgeon",
              });
            }}
            onOpenProcedure={(procedureId) =>
              setView({
                kind: "procedure-detail",
                surgeonId: surgeon.id,
                procedureId,
                from: "surgeon",
              })
            }
            onDeleteProcedure={(procedureId) => deleteProcedure(procedureId)}
            onDelete={() => {
              deleteSurgeon(surgeon.id);
              setView({ kind: "surgeons" });
            }}
          />
        );
      }
      case "procedure-detail": {
        const procedure = procedures.find((p) => p.id === view.procedureId);
        if (!procedure) {
          setView(
            view.from === "procedures"
              ? { kind: "procedures-all" }
              : { kind: "surgeon-detail", id: view.surgeonId },
          );
          return null;
        }
        const backView: View =
          view.from === "procedures"
            ? { kind: "procedures-all" }
            : { kind: "surgeon-detail", id: view.surgeonId };
        return (
          <ProcedureDetail
            procedure={procedure}
            surgeon={surgeons.find((s) => s.id === procedure.surgeonId)}
            images={images}
            dashboard={findDashboardForProcedure(dashboards, procedure.surgeonId, procedure.id)}
            onBack={() => setView(backView)}
            onPatch={(patch) => patchProcedure(procedure.id, patch)}
            onAddImages={addImages}
            onRemoveImage={removeImage}
            onRenameImage={renameImage}
            onOpenDashboard={() =>
              openProcedureDashboard(procedure.surgeonId, procedure.id, view.from)
            }
            onDelete={() => {
              deleteProcedure(procedure.id);
              setView(backView);
            }}
          />
        );
      }
      case "dashboards-list":
        return (
          <DashboardsList
            dashboards={dashboards}
            surgeons={surgeons}
            procedures={procedures}
            onOpen={(dashboardId) => setView({ kind: "builder", dashboardId })}
            onCreateTemplate={(name) => createTemplate(name)}
            onDelete={(dashboardId) => deleteDashboard(dashboardId)}
          />
        );
      case "live-case":
        return (
          <LiveCaseScreen
            dashboards={dashboards}
            surgeons={surgeons}
            procedures={procedures}
            images={images}
            activeDashboardId={liveCase.dashboardId}
            currentPhase={liveCase.currentPhase}
            onSelectDashboard={(id) => persistLiveCase({ dashboardId: id })}
            onSelectPhase={(phase: Phase) => persistLiveCase({ currentPhase: phase })}
          />
        );
      case "builder": {
        const dashboard = dashboards.find((d) => d.id === view.dashboardId);
        if (!dashboard) {
          setView({ kind: "dashboards-list" });
          return null;
        }
        // Exit destination — back to the procedure's wall-dashboard section
        // when the builder was opened from there; otherwise the All list.
        const returnTo = view.returnTo;
        const exitView: View = returnTo
          ? {
              kind: "procedure-detail",
              surgeonId: returnTo.surgeonId,
              procedureId: returnTo.procedureId,
              from: returnTo.from,
            }
          : { kind: "dashboards-list" };
        return (
          <BuilderShell
            dashboard={dashboard}
            procedures={procedures}
            surgeons={surgeons}
            images={images}
            sidebarHidden={sidebarHidden}
            onShowSidebar={() => setSidebarHidden(false)}
            onUpdate={(patch) => updateDashboard(dashboard.id, patch)}
            onBackToList={() => setView(exitView)}
            onSaveAsTemplate={(name) => saveAsTemplate(dashboard.id, name)}
          />
        );
      }
    }
  };

  const isBuilder = view.kind === "builder";
  const isLiveCase = view.kind === "live-case";
  // The floating "Case in progress" switch lives on every controller view
  // except the builder canvas (too cluttered) and the login form (focus
  // belongs on the password input). It stays available on the idle / pre-
  // login screen so a refresh-with-live-case-on can still be flipped off.
  const showLiveCaseSwitch = view.kind !== "builder" && view.kind !== "login";

  const handleToggleLiveCase = () => {
    const next = !liveCase.active;
    // When turning live case OFF, also drop them out of the live-case view.
    if (!next && view.kind === "live-case") {
      setView(authed ? { kind: "dashboard" } : { kind: "login" });
    }
    // A case always starts in pre-op — reset the phase on enable so we never
    // resume on whatever phase a previous session happened to leave behind.
    persistLiveCase(next ? { active: true, currentPhase: "preop" } : { active: false });
  };

  // Whole-shell layout is a 2-column grid. Animating gridTemplateColumns
  // gives a single coordinated motion for the sidebar collapse — the canvas
  // resizes in lockstep with the panel's slide-out, no flex jolt.
  return (
    <motion.div
      key="admin-shell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="h-screen w-full overflow-hidden bg-background"
      style={{
        display: "grid",
        gridTemplateColumns: `${sidebarHidden ? "0px" : "6rem"} 1fr`,
        transition: "grid-template-columns 0.42s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div className="relative h-full overflow-hidden">
        <div
          className="h-full w-24"
          style={{
            transform: sidebarHidden ? "translateX(-100%)" : "translateX(0%)",
            transition: "transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <AdminSidebar
            activeKey={activeNavKey}
            onNavigate={onSidebarNav}
            liveCaseEnabled={liveCase.active}
          />
        </div>
      </div>
      <main
        className={
          isBuilder || isLiveCase
            ? "relative min-w-0 overflow-hidden"
            : "relative min-w-0 overflow-y-auto"
        }
      >
        <AnimatePresence mode="wait">{renderPanel()}</AnimatePresence>
      </main>
      {showLiveCaseSwitch && (
        <LiveCaseSwitch active={liveCase.active} onToggle={handleToggleLiveCase} />
      )}
    </motion.div>
  );
}

function IdlePanel() {
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex h-full w-full items-center justify-center px-10 text-center"
    >
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">Arti</div>
        <h1 className="mt-3 text-4xl font-extralight tracking-tight text-foreground">
          Welcome, Melissa.
        </h1>
        <p className="mt-3 max-w-md text-sm font-light text-muted-foreground">
          Pick a destination from the left rail. Settings configures the OR. Builder lays out the
          wall display.
        </p>
      </div>
    </motion.div>
  );
}
