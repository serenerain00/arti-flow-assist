import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Surgeon } from "./types";
import { cn } from "@/lib/utils";

export interface SurgeonDraft {
  firstName: string;
  lastName: string;
  email: string;
  loginEnabled: boolean;
}

interface Props {
  /** When present, edits the surgeon. When null, creates a new one. */
  surgeon: Surgeon | null;
  /** Called whenever the form's draft changes — drives the Save button's enabled state. */
  onChange: (draft: SurgeonDraft, isValid: boolean) => void;
}

function isEmailish(value: string) {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function SurgeonInfoForm({ surgeon, onChange }: Props) {
  const [firstName, setFirstName] = useState(surgeon?.firstName ?? "");
  const [lastName, setLastName] = useState(surgeon?.lastName ?? "");
  const [email, setEmail] = useState(surgeon?.email ?? "");
  const [loginEnabled, setLoginEnabled] = useState(surgeon?.loginEnabled ?? false);

  useEffect(() => {
    const draft: SurgeonDraft = { firstName, lastName, email, loginEnabled };
    const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && isEmailish(email);
    onChange(draft, valid);
  }, [firstName, lastName, email, loginEnabled, onChange]);

  return (
    <div className="space-y-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Required fields <span className="text-primary">*</span>
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1fr_auto] md:items-start">
        <Field
          label="First Name"
          required
          value={firstName}
          onChange={setFirstName}
          placeholder="Joe"
          autoFocus
        />
        <Field
          label="Last Name"
          required
          value={lastName}
          onChange={setLastName}
          placeholder="Smith"
        />
        <div className="flex flex-col items-center gap-2 md:pt-7">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Surgeon Login
          </span>
          <Toggle value={loginEnabled} onChange={setLoginEnabled} />
        </div>
      </div>

      <Field
        label="Email"
        required
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="jsmith@email.com"
      />
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-primary">*</span>}
      </span>
      <div className="relative mt-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2.5 pr-9 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label}`}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-surface-3/60 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
          >
            <X className="h-3 w-3" strokeWidth={2} />
          </button>
        )}
      </div>
    </label>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full border border-border/60 transition-colors",
        value ? "bg-primary/80" : "bg-surface-3/60",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full bg-foreground/90 shadow transition-transform",
          value ? "translate-x-6" : "translate-x-0.5",
        )}
      >
        {!value && <X className="h-3 w-3 text-background" strokeWidth={2.5} />}
      </span>
    </button>
  );
}
