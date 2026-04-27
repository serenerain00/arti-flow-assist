import { useMemo, useState } from "react";
import { CircleDot, Cpu } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import { ConsoleTower3D } from "./ConsoleTower3D";
import { CONSOLES, type ConsoleDevice, type ConsoleId, type ConsoleStatus } from "./consoles";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onPrompt: (text: string) => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Voice-driven focus — set by focus_console tool. */
  focusedId: ConsoleId | null;
  onFocusChange: (id: ConsoleId | null) => void;
}

const STATUS_LEGEND: Array<{ status: ConsoleStatus; label: string; dot: string }> = [
  { status: "active", label: "Active", dot: "bg-cyan-300" },
  { status: "connected", label: "Connected", dot: "bg-emerald-400" },
  { status: "standby", label: "Standby", dot: "bg-sky-400" },
  { status: "warming", label: "Warming", dot: "bg-amber-400" },
  { status: "error", label: "Error", dot: "bg-rose-500" },
  { status: "offline", label: "Offline", dot: "bg-zinc-500" },
];

/**
 * OR-tower status screen. The user sees a stylized 3D stack of every
 * device on the tower with live status indicators, and a detail panel
 * for the currently-focused console (telemetry, attachments, voice
 * suggestions). The 3D tower tilts on cursor hover and rotates briefly
 * toward whichever console the user voice-focuses.
 */
export function ConsolesScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onPrompt,
  onSidebarNavigate,
  focusedId,
  onFocusChange,
}: Props) {
  // Local fallback when no focused console — show the first ACTIVE
  // device by default so the panel isn't empty on first load.
  const [localFocus, setLocalFocus] = useState<ConsoleId>(
    () => CONSOLES.find((c) => c.status === "active")?.id ?? CONSOLES[0].id,
  );
  const effectiveFocusId = focusedId ?? localFocus;

  const focused = useMemo<ConsoleDevice>(
    () => CONSOLES.find((c) => c.id === effectiveFocusId) ?? CONSOLES[0],
    [effectiveFocusId],
  );

  const handleFocus = (id: ConsoleId) => {
    setLocalFocus(id);
    onFocusChange(id);
  };

  const counts = useMemo(() => {
    const out: Record<ConsoleStatus, number> = {
      active: 0,
      connected: 0,
      standby: 0,
      warming: 0,
      error: 0,
      offline: 0,
    };
    for (const c of CONSOLES) out[c.status] += 1;
    return out;
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSleep={onSleep} activeKey="consoles" onNavigate={onSidebarNavigate} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar staffName={staffName} staffRole={staffRole} initials={initials} />

        <main data-scroll className="min-h-0 flex-1 overflow-y-auto px-8 py-6 animate-fade-in">
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-end justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                <Cpu className="h-3 w-3" />
                OR 326 · Equipment tower
              </div>
              <h1 className="mt-2 text-2xl font-light">Console status</h1>
              <div className="mt-1 text-sm font-light text-muted-foreground">
                Live telemetry from the integrated arthroscopy stack — light source through RF.
              </div>
            </div>

            {/* Status legend */}
            <div className="flex items-center gap-3 rounded-full border border-border bg-surface-2/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
              {STATUS_LEGEND.map((l) => (
                <div key={l.status} className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", l.dot)} />
                  <span className="text-muted-foreground">
                    {l.label}
                    <span className="ml-1 tabular-nums text-foreground/70">{counts[l.status]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Tower + detail split ──────────────────────────────── */}
          <div className="mt-6 grid min-h-[640px] grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
            {/* 3D tower */}
            <div className="relative min-h-[640px] overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-surface-2/40 to-background">
              <ConsoleTower3D
                consoles={CONSOLES}
                focusedId={effectiveFocusId}
                onFocus={handleFocus}
              />
            </div>

            {/* Detail panel */}
            <ConsoleDetailPanel device={focused} />
          </div>

          <div className="h-24" />
        </main>
      </div>

      <ArtiInvoker
        placeholder="Ask Arti about a console…"
        onSubmit={onPrompt}
        suggestions={[
          "Show the fluid pump",
          "Camera console status",
          "Is the RF console connected",
        ]}
      />
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────

function ConsoleDetailPanel({ device }: { device: ConsoleDevice }) {
  const STATUS_PILL: Record<
    ConsoleStatus,
    { label: string; chip: string; ring: string; pulse: boolean }
  > = {
    active: {
      label: "Active",
      chip: "bg-cyan-500/15 text-cyan-200",
      ring: "ring-cyan-300/40",
      pulse: true,
    },
    connected: {
      label: "Connected",
      chip: "bg-emerald-500/15 text-emerald-200",
      ring: "ring-emerald-300/40",
      pulse: false,
    },
    standby: {
      label: "Standby",
      chip: "bg-sky-500/15 text-sky-200",
      ring: "ring-sky-300/40",
      pulse: false,
    },
    warming: {
      label: "Warming",
      chip: "bg-amber-500/15 text-amber-200",
      ring: "ring-amber-300/40",
      pulse: true,
    },
    error: {
      label: "Error",
      chip: "bg-rose-500/15 text-rose-200",
      ring: "ring-rose-400/50",
      pulse: true,
    },
    offline: {
      label: "Offline",
      chip: "bg-zinc-700/40 text-zinc-300",
      ring: "ring-zinc-600/30",
      pulse: false,
    },
  };

  const pill = STATUS_PILL[device.status];

  return (
    <aside className="flex h-full flex-col gap-5 rounded-2xl border border-border bg-surface-2/60 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
          <CircleDot className="h-3 w-3" />
          {device.manufacturer} · {device.productLine}
        </div>
        <h2 className="mt-2 text-lg font-light leading-snug">{device.fullName}</h2>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Model {device.model}
        </div>
      </div>

      {/* Status pill */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider ring-1",
            pill.chip,
            pill.ring,
          )}
        >
          {pill.pulse && (
            <span className="relative flex h-1.5 w-1.5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
          )}
          {!pill.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          {pill.label}
        </span>
        <span className="text-[11px] font-light text-muted-foreground">{device.statusDetail}</span>
      </div>

      {/* Attachments */}
      {device.attachments.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Attachments
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {device.attachments.map((a) => (
              <span
                key={a}
                className="rounded-full border border-border bg-surface-3/40 px-2.5 py-1 text-[11px] font-light"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Telemetry */}
      <div className="flex-1">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Telemetry
        </div>
        <div className="mt-2 divide-y divide-border/50 rounded-lg border border-border/60">
          {device.telemetry.map((t) => (
            <div key={t.label} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
              <span className="text-[11px] font-light text-muted-foreground">{t.label}</span>
              <span className="text-right">
                <div className="text-sm font-light text-foreground tabular-nums">{t.value}</div>
                {t.detail && (
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                    {t.detail}
                  </div>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Voice suggestions */}
      <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Voice <span className="text-primary">›</span> "show me the {device.shortName.toLowerCase()}"{" "}
        · "is the {device.shortName.toLowerCase()} connected"
      </div>
    </aside>
  );
}
