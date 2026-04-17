import { Home, LayoutDashboard, Calendar, User, BookOpen, Settings, Power } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { icon: Home, label: "Home", active: true },
  { icon: LayoutDashboard, label: "Case" },
  { icon: Calendar, label: "Schedule" },
  { icon: User, label: "Patient" },
  { icon: BookOpen, label: "Library" },
  { icon: Settings, label: "Preferences" },
];

interface Props {
  onSleep: () => void;
}

export function Sidebar({ onSleep }: Props) {
  return (
    <aside className="flex w-24 shrink-0 flex-col items-center justify-between border-r border-border bg-surface/40 py-6">
      <div className="flex flex-col items-center gap-1">
        <div className="mb-6 flex h-10 w-10 items-center justify-center">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            arti
          </div>
        </div>

        {ITEMS.map((it) => (
          <button
            key={it.label}
            className={cn(
              "group flex w-full flex-col items-center gap-1.5 px-2 py-3 transition-colors",
              it.active
                ? "text-primary"
                : "text-muted-foreground/70 hover:text-foreground"
            )}
          >
            <it.icon className="h-5 w-5" strokeWidth={1.5} />
            <span className="text-[10px] font-light tracking-wide">{it.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onSleep}
        className="flex flex-col items-center gap-1.5 px-2 py-3 text-muted-foreground/60 transition-colors hover:text-foreground"
        aria-label="Put Arti to sleep"
      >
        <Power className="h-5 w-5" strokeWidth={1.5} />
        <span className="text-[10px] font-light">Sleep</span>
      </button>
    </aside>
  );
}
