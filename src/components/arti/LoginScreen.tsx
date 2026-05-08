import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RippleCanvas } from "./RippleCanvas";

interface Props {
  onAuthenticated: () => void;
}

const DEMO_EMAIL = "demo";
const DEMO_PASSWORD = "vision123";

export function LoginScreen({ onAuthenticated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const ok = email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
    if (ok) {
      onAuthenticated();
      return;
    }
    setSubmitting(false);
    setError("Invalid email or password.");
  };

  return (
    <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <RippleCanvas intensity={0.5} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 w-full max-w-md px-8"
      >
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-light tracking-tight text-foreground">Arti</h1>
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Login to use Arti
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border/60 bg-card/70 p-8 shadow-xl backdrop-blur-md"
        >
          <h2 className="mb-6 text-center text-2xl font-medium text-foreground">Login</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                disabled={submitting}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={submitting}
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" className="mt-6 w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setError("Password reset is not available in this demo.")}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setError("Registration is not available in this demo.")}
            >
              Register
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
