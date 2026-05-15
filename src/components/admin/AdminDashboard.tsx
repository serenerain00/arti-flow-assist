import { motion } from "framer-motion";
import {
  Camera,
  ClipboardList,
  Cpu,
  FileText,
  Printer,
  Stethoscope,
  Users,
  Video,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onOpenSurgeons: () => void;
  onOpenProcedures: () => void;
}

interface Tile {
  key: string;
  icon: typeof Stethoscope;
  label: string;
  enabled?: boolean;
}

const TILES: Tile[] = [
  { key: "surgeons", icon: Stethoscope, label: "Surgeons", enabled: true },
  { key: "procedures", icon: ClipboardList, label: "Procedures", enabled: true },
  { key: "team", icon: Users, label: "Team" },
  { key: "cameras", icon: Camera, label: "Cameras" },
  { key: "displays", icon: Video, label: "Displays" },
  { key: "print", icon: Printer, label: "Print" },
  { key: "devices", icon: Cpu, label: "Devices" },
  { key: "network", icon: Wifi, label: "Network" },
  { key: "reports", icon: FileText, label: "Reports" },
];

export function AdminDashboard({ onOpenSurgeons, onOpenProcedures }: Props) {
  return (
    <motion.div
      key="admin-dashboard"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full px-10 py-12"
    >
      <header className="mb-10">
        <div className="font-mono text-[10px] uppercase tracking-[0.5em] text-primary">
          Administrator · Setup
        </div>
        <h1 className="mt-2 text-4xl font-extralight tracking-tight">Settings</h1>
        <p className="mt-2 max-w-xl text-sm font-light text-muted-foreground">
          Configure the OR. Start with surgeons — the rest of the tiles come online as we build them
          out.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {TILES.map((tile) => {
          const interactive = !!tile.enabled;
          return (
            <li key={tile.key}>
              <button
                type="button"
                onClick={
                  tile.key === "surgeons"
                    ? onOpenSurgeons
                    : tile.key === "procedures"
                      ? onOpenProcedures
                      : undefined
                }
                disabled={!interactive}
                className={cn(
                  "group flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-6 text-center transition-all",
                  interactive
                    ? "hover:border-primary/40 hover:bg-surface/70"
                    : "cursor-not-allowed opacity-40",
                )}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border/60 bg-surface-2/60 text-primary">
                  <tile.icon className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-light text-foreground">{tile.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
