import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertOctagon, Wrench, PackageSearch, Activity } from "lucide-react";
import type { ConsoleDevice } from "./consoles";

interface Props {
  open: boolean;
  onClose: () => void;
  console?: ConsoleDevice;
}

const SectionTitle = ({
  icon: Icon,
  title,
}: {
  icon: import("lucide-react").LucideIcon;
  title: string;
}) => (
  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
    <Icon className="h-3.5 w-3.5" />
    {title}
  </div>
);

export function EquipmentFailureModal({ open, onClose, console: device }: Props) {
  const steps = device?.troubleshooting ?? [
    "Re-seat the device cable at both ends.",
    "Power-cycle the unit.",
    "Escalate to bio-med if the fault persists.",
  ];
  const backup = device?.backup;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(95vw,72rem)] max-w-none flex-col overflow-hidden border-destructive/40 bg-surface/95 backdrop-blur-xl">
        <DialogHeader className="shrink-0 pb-6 border-b border-destructive/30">
          <DialogTitle className="flex items-center gap-4 text-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <div>{device ? `${device.shortName} signal lost` : "Equipment signal lost"}</div>
              <div className="mt-0.5 text-sm font-normal text-muted-foreground">
                {device
                  ? `${device.fullName} · ${device.manufacturer} ${device.model}`
                  : "Unknown device"}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="mt-3 text-sm">
            Arti detected a disconnect. Work through the steps below — backup options are listed at
            the bottom.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-2 md:grid-cols-2">
          {/* Device status */}
          <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5">
            <SectionTitle icon={Activity} title="Device status" />
            <div className="space-y-1.5 text-sm font-light">
              <div>
                <span className="text-foreground/70">State:</span>{" "}
                <span className="font-medium text-destructive">DISCONNECTED</span>
              </div>
              <div>
                <span className="text-foreground/70">Last reading:</span>{" "}
                {device?.statusDetail ?? "—"}
              </div>
              {device?.attachments?.length ? (
                <div>
                  <span className="text-foreground/70">Attachments:</span>{" "}
                  {device.attachments.join(" · ")}
                </div>
              ) : null}
            </div>
          </div>

          {/* Backup */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
            <SectionTitle icon={PackageSearch} title="Backup availability" />
            {backup ? (
              <div className="space-y-1.5 text-sm font-light">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      backup.available
                        ? "border-success/30 bg-success/15 text-success"
                        : "border-warning/30 bg-warning/15 text-warning"
                    }`}
                  >
                    {backup.available ? "Available" : "Not on hand"}
                  </span>
                  <span className="text-foreground">{backup.name}</span>
                </div>
                <div className="text-muted-foreground">{backup.location}</div>
              </div>
            ) : (
              <div className="text-sm font-light text-muted-foreground">
                No designated backup on file — page bio-med.
              </div>
            )}
          </div>

          {/* Troubleshooting */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-5 md:col-span-2">
            <SectionTitle icon={Wrench} title="Troubleshooting steps" />
            <ol className="space-y-2 text-sm font-light">
              {steps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground/90">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
