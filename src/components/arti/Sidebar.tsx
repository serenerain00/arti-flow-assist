import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Calendar,
  Cpu,
  Home,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sparkles,
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
  onLogout: () => void;
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
  { key: "preferences", icon: Settings, label: "Settings" },
];

export function Sidebar({ onSleep, onLogout, activeKey, onNavigate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

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

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Arti menu"
          className={cn(
            "flex flex-col items-center gap-1.5 px-2 py-3 transition-colors",
            menuOpen ? "text-primary" : "text-muted-foreground/70 hover:text-foreground",
          )}
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[10px] font-light tracking-wide">Arti</span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-1 left-full z-50 ml-3 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onSleep();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-popover-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Moon className="h-4 w-4" strokeWidth={1.5} />
              Sleep
            </button>
            <div className="h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-popover-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
