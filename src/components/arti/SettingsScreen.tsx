import { ChevronRight, Lock, Settings2, User2 } from "lucide-react";
import { Sidebar, type SidebarKey } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ArtiInvoker } from "./ArtiInvoker";

interface Props {
  staffName: string;
  staffRole: string;
  initials: string;
  onSleep: () => void;
  onOpenPacu?: () => void;
  onLogout: () => void;
  onPrompt: (text: string) => void;
  onOpenAdmin: () => void;
  onSidebarNavigate?: (key: SidebarKey) => void;
}

/**
 * Settings landing page — the entry point off the sidebar's "Preferences"
 * icon. Two cards: General (a placeholder for now) and Admin Settings
 * (gated by a password on the next screen).
 */
export function SettingsScreen({
  staffName,
  staffRole,
  initials,
  onSleep,
  onOpenPacu,
  onLogout,
  onPrompt,
  onOpenAdmin,
  onSidebarNavigate,
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
          <header className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
              Preferences · Settings
            </div>
            <h1 className="mt-2 text-4xl font-extralight tracking-tight">Settings</h1>
            <p className="mt-2 max-w-xl text-sm font-light text-muted-foreground">
              Personal preferences and administrative controls for OR 326.
            </p>
          </header>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingsTile
              icon={User2}
              title="General"
              blurb="Voice settings, theme, notification preferences, accessibility."
              tag="Personal"
              disabled
            />
            <SettingsTile
              icon={Lock}
              title="Admin Settings"
              blurb="Software updates, support logging, smart device controls. Password protected."
              tag="Restricted"
              onClick={onOpenAdmin}
            />
          </ul>
        </main>

        <ArtiInvoker
          placeholder="Ask Arti about settings…"
          onSubmit={onPrompt}
          suggestions={[
            "Open admin settings",
            "Show smart settings",
            "Are there any software updates?",
          ]}
        />
      </div>
    </div>
  );
}

function SettingsTile({
  icon: Icon,
  title,
  blurb,
  tag,
  onClick,
  disabled,
}: {
  icon: typeof Settings2;
  title: string;
  blurb: string;
  tag?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || !onClick}
        className="group flex w-full items-start gap-4 rounded-2xl border border-border/60 bg-surface/40 p-6 text-left transition-all enabled:hover:border-primary/40 enabled:hover:bg-surface/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
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
        {onClick && !disabled && (
          <ChevronRight
            className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
            strokeWidth={1.7}
          />
        )}
      </button>
    </li>
  );
}
