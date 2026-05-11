import { useState } from "react";
import { ArrowLeft, ChevronRight, Cpu, FileText, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";
import { cn } from "@/lib/utils";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onOpenPacu?: () => void;
  onLogout: () => void;
  onPrompt: (text: string) => void;
  onBack: () => void;
  onOpenSmartSettings: () => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
  /** Session-scoped unlock state — owned by the parent so re-entering this
      screen (e.g. via "back from Smart Settings") doesn't re-prompt for the
      password. Resets on browser refresh. */
  unlocked: boolean;
  onUnlock: () => void;
}

/**
 * Admin Settings — password-gated landing for the three admin areas:
 *   1. Software Updates (with an "update available" blue dot)
 *   2. Support Logging
 *   3. Smart Settings (drills into device control)
 *
 * The password gate accepts ANY non-empty string in this prototype build;
 * real auth is a follow-up.
 */
export function AdminSettingsScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onOpenPacu,
  onLogout,
  onPrompt,
  onBack,
  onOpenSmartSettings,
  onSidebarNavigate,
  unlocked,
  onUnlock,
}: Props) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar
        onSleep={onSleep}
        onLogout={onLogout}
        activeKey="preferences"
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

        <main
          data-scroll
          className="relative min-h-0 flex-1 overflow-y-auto px-8 pt-10 pb-40 animate-fade-in"
        >
          <button
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.4em] text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.7} />
            Settings
          </button>

          {!unlocked ? (
            <PasswordGate onUnlock={onUnlock} />
          ) : (
            <UnlockedAdmin onOpenSmartSettings={onOpenSmartSettings} />
          )}
        </main>

        <ArtiInvoker
          placeholder="Ask Arti about admin settings…"
          onSubmit={onPrompt}
          suggestions={
            unlocked
              ? ["Show smart settings", "Are there software updates?", "Open support logs"]
              : ["Open admin settings"]
          }
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Password gate — accepts any non-empty string in this prototype.
// ─────────────────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) {
      setError("Enter any text to unlock (auth is a future build).");
      return;
    }
    onUnlock();
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-surface/40 p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
        <Lock className="h-5 w-5" strokeWidth={1.7} />
      </div>
      <h1 className="mt-4 text-2xl font-extralight tracking-tight text-foreground">
        Admin password required
      </h1>
      <p className="mt-1.5 text-sm font-light text-muted-foreground">
        Admin Settings are restricted. In this prototype any text unlocks the page — real auth comes
        later.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Password
          </span>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (error) setError(null);
            }}
            className="mt-2 w-full rounded-xl border border-border/60 bg-surface-2/60 px-3 py-2.5 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
            placeholder="any text…"
          />
        </label>
        {error && (
          <p className="font-mono text-[11px] uppercase tracking-wider text-warning">{error}</p>
        )}
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          Unlock
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// The three admin cards.
// ─────────────────────────────────────────────────────────────────────────

function UnlockedAdmin({ onOpenSmartSettings }: { onOpenSmartSettings: () => void }) {
  return (
    <div>
      <header className="mb-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
          Admin Settings · Unlocked
        </div>
        <h1 className="mt-2 text-4xl font-extralight tracking-tight">Admin tools</h1>
        <p className="mt-2 max-w-xl text-sm font-light text-muted-foreground">
          System-level controls for OR 326. Changes here can affect every team that uses this room.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AdminTile
          icon={RefreshCw}
          title="Software Updates"
          blurb="Firmware, voice models, device drivers."
          tag="System"
          updateAvailable
        />
        <AdminTile
          icon={FileText}
          title="Support Logging"
          blurb="Diagnostics, voice transcripts, error reports for support."
          tag="Diagnostics"
        />
        <AdminTile
          icon={Cpu}
          title="Smart Settings"
          blurb="Lights, displays, environment, audio, and access controls."
          tag="Devices"
          onClick={onOpenSmartSettings}
        />
      </ul>
    </div>
  );
}

function AdminTile({
  icon: Icon,
  title,
  blurb,
  tag,
  onClick,
  updateAvailable,
}: {
  icon: typeof Cpu;
  title: string;
  blurb: string;
  tag?: string;
  onClick?: () => void;
  updateAvailable?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        className={cn(
          "group relative flex w-full flex-col gap-3 rounded-2xl border border-border/60 bg-surface/40 p-6 text-left transition-all",
          interactive
            ? "hover:border-primary/40 hover:bg-surface/70"
            : "cursor-not-allowed opacity-90",
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-light text-foreground">{title}</h2>
            {tag && (
              <span className="rounded-full border border-border/60 bg-surface-2/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {tag}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-light text-muted-foreground">{blurb}</p>
        </div>
        {interactive && (
          <ChevronRight
            className="absolute right-5 top-5 h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
            strokeWidth={1.7}
          />
        )}
        {updateAvailable && (
          <span
            className="absolute right-3.5 top-3.5 flex h-2.5 w-2.5"
            aria-label="Update available"
            title="Update available"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sky-500" />
          </span>
        )}
      </button>
    </li>
  );
}
