import { Activity, Stethoscope, UserCog, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActiveRole } from "@/hooks/useArtiVoice";

export type { ActiveRole };

interface RoleDef {
  id: ActiveRole;
  label: string;
  icon: React.ElementType;
  activeClass: string;
  indicatorClass: string;
}

const ROLES: RoleDef[] = [
  {
    id: "nurse",
    label: "Circulating Nurse",
    icon: Activity,
    activeClass: "border-primary/50 bg-primary/10 text-primary",
    indicatorClass: "bg-primary",
  },
  {
    id: "scrub",
    label: "Scrub Tech",
    icon: UserCog,
    activeClass: "border-success/50 bg-success/10 text-success",
    indicatorClass: "bg-success",
  },
  {
    id: "surgeon",
    label: "Surgeon",
    icon: Stethoscope,
    activeClass: "border-accent/50 bg-accent/10 text-accent",
    indicatorClass: "bg-accent",
  },
  {
    id: "anesthesia",
    label: "Anesthesia",
    icon: Wind,
    activeClass: "border-warning/50 bg-warning/10 text-warning",
    indicatorClass: "bg-warning",
  },
];

interface Props {
  activeRole: ActiveRole;
  onRoleChange: (role: ActiveRole) => void;
}

export function RoleSwitcherBar({ activeRole, onRoleChange }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-border/40 bg-surface/30 px-8 py-3">
      <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/50">
        View
      </span>
      {ROLES.map(({ id, label, icon: Icon, activeClass, indicatorClass }) => {
        const isActive = activeRole === id;
        return (
          <button
            key={id}
            onClick={() => onRoleChange(id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-light transition-all duration-200",
              isActive
                ? activeClass
                : "border-border/50 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <Icon
              className={cn("h-3.5 w-3.5", !isActive && "text-muted-foreground/50")}
              strokeWidth={1.8}
            />
            {label}
            {isActive && (
              <span className={cn("h-1.5 w-1.5 rounded-full", indicatorClass)} />
            )}
          </button>
        );
      })}
    </div>
  );
}
