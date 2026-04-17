import { ShieldAlert, Pill, ThermometerSnowflake, type LucideIcon } from "lucide-react";

export type AlertTier = "Critical" | "Advisory" | "Info";

export interface AlertDef {
  icon: LucideIcon;
  tier: AlertTier;
  title: string;
  body: string;
  tone: "destructive" | "primary" | "muted";
}

/**
 * Smart alert prioritization (vs. flat alarm streams).
 * Three tiers — critical / advisory / informational — visually distinct
 * to combat alarm fatigue (Miller, Endsley situational awareness).
 *
 * Exported so the dashboard can inspect tier metadata (e.g., to refuse
 * dismissing Critical-tier alerts per the Arti safety rules).
 */
export const ALERTS: AlertDef[] = [
  {
    icon: ShieldAlert,
    tier: "Critical",
    title: "Penicillin allergy on file",
    body: "Cefazolin acceptable · administered 14 min ago. No further action.",
    tone: "destructive" as const,
  },
  {
    icon: Pill,
    tier: "Advisory",
    title: "Implant trial sizes prepped",
    body: "Glenosphere 36mm and 39mm staged on back table per Dr. Patel's preference.",
    tone: "primary" as const,
  },
  {
    icon: ThermometerSnowflake,
    tier: "Info",
    title: "Bair Hugger pre-warming complete",
    body: "Patient core 36.6°C — within normothermia target.",
    tone: "muted" as const,
  },
];

const tones = {
  destructive: {
    chip: "bg-destructive/15 text-destructive",
    bar: "bg-destructive",
  },
  primary: {
    chip: "bg-primary/15 text-primary",
    bar: "bg-primary",
  },
  muted: {
    chip: "bg-muted text-muted-foreground",
    bar: "bg-muted-foreground/40",
  },
};

interface Props {
  dismissed?: Set<number>;
  onDismiss?: (index: number) => void;
}

export function AlertStack({ dismissed, onDismiss }: Props = {}) {
  const visible = ALERTS.map((a, i) => ({ ...a, index: i })).filter(
    (a) => !dismissed?.has(a.index),
  );
  const dismissedCount = dismissed?.size ?? 0;

  return (
    <section className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            Arti · Prioritized
          </div>
          <h2 className="mt-1 text-lg font-light">Awareness</h2>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {visible.length} active · {dismissedCount} muted
        </div>
      </div>

      <ul className="space-y-2">
        {visible.map((a) => {
          const t = tones[a.tone];
          return (
            <li
              key={a.title}
              className="relative flex gap-4 overflow-hidden rounded-lg bg-surface-2/40 p-4 animate-fade-in"
            >
              <span className={`absolute inset-y-0 left-0 w-[3px] ${t.bar}`} />
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.chip}`}
              >
                <a.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${t.chip}`}
                  >
                    {a.tier}
                  </span>
                  <span className="text-sm font-medium">{a.title}</span>
                </div>
                <p className="mt-1 text-xs font-light leading-relaxed text-muted-foreground">
                  {a.body}
                </p>
              </div>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(a.index)}
                  className="self-start rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  aria-label={`Dismiss ${a.title}`}
                >
                  Dismiss
                </button>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-light text-muted-foreground">
            All alerts acknowledged.
          </li>
        )}
      </ul>
    </section>
  );
}
