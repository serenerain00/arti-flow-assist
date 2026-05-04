import { CheckCircle, Clock, MapPin, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { CaseItem } from "./cases";

interface Props {
  activeCase?: CaseItem;
  onOpenPatientDetails?: () => void;
}

function secsFromScheduled(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  // Positive = seconds until start (countdown). Negative = seconds since start (elapsed).
  return Math.floor((target.getTime() - now.getTime()) / 1000);
}

function formatSecs(abs: number): string {
  const hh = Math.floor(abs / 3600);
  const mm = Math.floor((abs % 3600) / 60);
  const ss = String(abs % 60).padStart(2, "0");
  return hh > 0 ? `${hh}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}

export function CaseHeader({ activeCase, onOpenPatientDetails }: Props) {
  const [secs, setSecs] = useState(() => activeCase ? secsFromScheduled(activeCase.time) : 32 * 60 + 14);

  // Reset whenever the active case changes.
  useEffect(() => {
    setSecs(activeCase ? secsFromScheduled(activeCase.time) : 32 * 60 + 14);
  }, [activeCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const i = setInterval(() => setSecs((s) => s - 1), 1000);
    return () => clearInterval(i);
  }, []);

  const countdown = secs > 0; // true = before scheduled start, false = past it
  const timeDisplay = formatSecs(Math.abs(secs));

  const status = activeCase?.status;

  const patientDisplay = activeCase
    ? `${activeCase.patientName} · ${activeCase.patientAgeSex}${activeCase.side ? ` · ${activeCase.side} shoulder` : ""}`
    : "Marcus Chen · 62M · Right shoulder";

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-7">
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div
              className={`font-mono text-[10px] uppercase tracking-[0.3em] ${
                status === "completed"
                  ? "text-success"
                  : status === "delayed"
                    ? "text-warning"
                    : status === "cancelled"
                      ? "text-destructive"
                      : "text-primary"
              }`}
            >
              {status === "in-progress"
                ? "In Progress · Pre-Op"
                : status === "completed"
                  ? "Completed"
                  : status === "delayed"
                    ? "Delayed · Pre-Op"
                    : status === "cancelled"
                      ? "Cancelled"
                      : "Next Case · Pre-Op"}
            </div>
            <span className="rounded-full border border-border bg-surface-3/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Medtronix VIP plan
            </span>
          </div>

          <h1 className="mt-2 text-4xl font-extralight tracking-tight">
            {activeCase?.procedure ?? "Reverse Total Shoulder"}
            <span className="text-muted-foreground/60"> · {activeCase?.procedureShort ?? "RSA"}</span>
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-light text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-primary heartbeat" />
              {patientDisplay}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> {activeCase?.room ?? "OR 326"}
            </span>
            <span>{activeCase?.surgeon ?? "Dr. Anika Patel"} · Lead surgeon</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {onOpenPatientDetails && (
            <button
              onClick={onOpenPatientDetails}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <User className="h-4 w-4 text-primary" />
              Patient Info
            </button>
          )}

          {/* Right column — status-aware. Each branch renders the timer
              shape that matches what the OR team actually wants to see for
              that case state, instead of a single elapsed/countdown switch. */}
          {(status === "next" || status === "scheduled") && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {countdown ? "Incision in" : "Overdue by"}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <Clock
                  className={`h-5 w-5 ${countdown ? "text-primary" : "text-warning"}`}
                />
                <span
                  className={`font-mono text-5xl font-thin tabular-nums tracking-tight ${
                    countdown ? "" : "text-warning"
                  }`}
                >
                  {timeDisplay}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Scheduled {activeCase?.time}
              </div>
            </div>
          )}

          {status === "in-progress" && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                In Progress
              </div>
              <div className="mt-1 font-mono text-3xl font-thin tabular-nums text-primary heartbeat">
                {activeCase?.time}
              </div>
            </div>
          )}

          {status === "delayed" && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning">
                {countdown ? "Delayed · starts in" : "Delayed by"}
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-2">
                <Clock className="h-5 w-5 text-warning" />
                <span className="font-mono text-5xl font-thin tabular-nums tracking-tight text-warning">
                  {timeDisplay}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-warning/70">
                Originally {activeCase?.time}
              </div>
            </div>
          )}

          {status === "completed" && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-success">
                Completed
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <span className="font-mono text-3xl font-thin tabular-nums tracking-tight">
                  {activeCase?.time}
                </span>
              </div>
            </div>
          )}

          {status === "cancelled" && (
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-destructive">
                Cancelled
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-mono text-3xl font-thin tabular-nums tracking-tight">
                  {activeCase?.time}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
