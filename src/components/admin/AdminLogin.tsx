import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Lock, ShieldCheck } from "lucide-react";

interface Props {
  onLogin: () => void;
}

export function AdminLogin({ onLogin }: Props) {
  const [pw, setPw] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!pw.trim()) return;
    onLogin();
  };

  const canSubmit = pw.trim().length > 0;

  return (
    <motion.div
      key="admin-login"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex h-full w-full items-center justify-center px-8"
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-surface/50 p-8 shadow-xl backdrop-blur-md">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
          <Lock className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <h1 className="mt-5 text-2xl font-extralight tracking-tight text-foreground">
          Administrator
        </h1>
        <p className="mt-1.5 text-sm font-light text-muted-foreground">
          Enter your admin password to continue. Any text unlocks in this prototype.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Password
            </span>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="mt-2 w-full rounded-md border border-border/60 bg-surface-2/60 px-3 py-2.5 text-sm font-light text-foreground focus:border-primary/50 focus:outline-none"
              placeholder="••••••••"
            />
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            className={
              "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.3em] text-primary-foreground transition-all " +
              (canSubmit
                ? "hover:bg-primary/90 hover:shadow-[0_0_18px_-4px_var(--primary)]"
                : "cursor-not-allowed opacity-40")
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Login
          </button>
        </form>
      </div>
    </motion.div>
  );
}
