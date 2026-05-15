import { Activity, LayoutGrid, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminNavKey = "settings" | "builder" | "live-case";

interface Props {
  activeKey?: AdminNavKey;
  onNavigate: (key: AdminNavKey) => void;
  /** Live Case is gated by the bottom-right "case in progress" switch. */
  liveCaseEnabled: boolean;
}

const ITEMS: Array<{ key: AdminNavKey; icon: typeof Settings; label: string }> = [
  { key: "settings", icon: Settings, label: "Settings" },
  { key: "builder", icon: LayoutGrid, label: "Builder" },
  { key: "live-case", icon: Activity, label: "Live Case" },
];

export function AdminSidebar({ activeKey, onNavigate, liveCaseEnabled }: Props) {
  return (
    <aside className="flex h-full w-24 shrink-0 flex-col items-center border-r border-border bg-surface/40 py-6">
      <div className="mb-8 flex h-10 w-10 items-center justify-center">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          arti
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        {ITEMS.map((it) => {
          const active = activeKey === it.key;
          const gated = it.key === "live-case" && !liveCaseEnabled;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => {
                if (gated) return;
                onNavigate(it.key);
              }}
              disabled={gated}
              aria-disabled={gated}
              title={gated ? "Toggle 'Live Case' on to enable" : undefined}
              className={cn(
                "group relative flex w-full flex-col items-center gap-1.5 px-2 py-3 transition-colors",
                active
                  ? "text-primary"
                  : gated
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              <it.icon className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-[10px] font-light tracking-wide">{it.label}</span>
              {it.key === "live-case" && liveCaseEnabled && (
                <span
                  className="absolute right-3 top-2 flex h-2.5 w-2.5"
                  aria-label="Live"
                  title="Live case active"
                >
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
