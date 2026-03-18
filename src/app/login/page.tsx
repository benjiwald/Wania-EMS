"use client";
import { useState } from "react";
import { signIn } from "@/app/actions/auth";
import { Activity, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    try {
      await signIn(formData);
    } catch {
      setError("E-Mail oder Passwort ungültig.");
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-primary/[0.02] blur-[100px]" />
      </div>
      {/* Grid pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />

      <div className="relative z-10 w-full max-w-[400px] px-6">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <Activity className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            WANIA <span className="text-primary">EMS</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Energie Management System</p>
        </div>

        {/* Form */}
        <div className="glass-panel rounded-2xl p-8">
          <form action={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                E-Mail
              </label>
              <input id="email" name="email" type="email" placeholder="name@wania.at" required
                className="w-full h-12 rounded-xl border border-border bg-surface-1 px-4 text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-all text-sm" />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                Passwort
              </label>
              <input id="password" name="password" type="password" placeholder="••••••••" required
                className="w-full h-12 rounded-xl border border-border bg-surface-1 px-4 text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-all text-sm" />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90 transition-all group disabled:opacity-60"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <>Anmelden <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground/60">
          © {new Date().getFullYear()} WANIA Energie GmbH
        </p>
      </div>
    </div>
  );
}
