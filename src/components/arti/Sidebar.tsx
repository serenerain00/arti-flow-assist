import {
  BookOpen,
  Calendar,
  Cpu,
  Home,
  LayoutDashboard,
  Power,
  Settings,
  Stethoscope,
  Sun,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarKey =
  | "home"
  | "case"
  | "schedule"
  | "surgeons"
  | "patients"
  | "consoles"
  | "library"
  | "calm"
  | "preferences";

interface Props {
  onSleep: () => void;
  /** Current active sidebar section — highlights the matching item. */
  activeKey?: SidebarKey;
  /** Click handlers per section. If omitted, the item renders as a dead button (pre-existing behavior). */
  onNavigate?: (key: SidebarKey) => void;
}

const ITEMS: Array<{ key: SidebarKey; icon: typeof Home; label: string }> = [
  { key: "home", icon: Home, label: "Home" },
  { key: "case", icon: LayoutDashboard, label: "Case" },
  { key: "schedule", icon: Calendar, label: "Schedule" },
  { key: "surgeons", icon: Stethoscope, label: "Surgeons" },
  { key: "patients", icon: Users, label: "Patients" },
  { key: "consoles", icon: Cpu, label: "Consoles" },
  { key: "library", icon: BookOpen, label: "Library" },
  { key: "calm", icon: Sun, label: "Calm" },
  { key: "preferences", icon: Settings, label: "Preferences" },
];

export function Sidebar({ onSleep, activeKey, onNavigate }: Props) {
  return (
    <aside className="flex w-24 shrink-0 flex-col items-center justify-between border-r border-border bg-surface/40 py-6">
      <div className="flex flex-col items-center gap-1">
        <div className="mb-6 flex h-10 w-10 items-center justify-center">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            arti
          </div>
        </div>

        {ITEMS.map((it) => {
          const active = activeKey === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={onNavigate ? () => onNavigate(it.key) : undefined}
              className={cn(
                "group flex w-full flex-col items-center gap-1.5 px-2 py-3 transition-colors",
                active ? "text-primary" : "text-muted-foreground/70 hover:text-foreground",
                !onNavigate && "cursor-default",
              )}
            >
              <it.icon className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-[10px] font-light tracking-wide">{it.label}</span>
            </button>
          );
        })}
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
