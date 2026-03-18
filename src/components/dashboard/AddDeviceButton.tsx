"use client";

import { useState, useEffect, useActionState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Terminal, Copy, Check, Clock, Loader2 } from "lucide-react";
import { generateJoinCodeAction, type JoinCodeState } from "@/app/actions/joinCodes";

const EXPIRES_SECONDS = 15 * 60; // 15 Minuten

export default function AddDeviceButton() {
  const [open, setOpen]       = useState(false);
  const [copied, setCopied]   = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const [state, formAction, isPending] = useActionState<JoinCodeState, FormData>(
    generateJoinCodeAction,
    null
  );

  // Countdown-Timer wenn Code vorhanden
  useEffect(() => {
    if (!state?.expiresAt) { setRemaining(null); return; }
    const update = () => {
      const secs = Math.max(0, Math.floor((new Date(state.expiresAt!).getTime() - Date.now()) / 1000));
      setRemaining(secs);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [state?.expiresAt]);

  const close = useCallback(() => {
    setOpen(false);
    setCopied(false);
  }, []);

  const installCmd = state?.code
    ? `curl -fsSL https://grdpcosbrvxuzgqigdwc.supabase.co/functions/v1/install | sudo bash`
    : "";

  function copyCmd() {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Neuen Pi hinzufügen
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="w-full max-w-md glass-panel rounded-2xl p-6 border border-border/60"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-foreground">Neuen Pi einrichten</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Generiere einen Code und führe ihn am Pi aus
                  </p>
                </div>
                <button onClick={close} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!state?.code ? (
                /* ── Schritt 1: Formular ── */
                <form action={formAction} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Standortname (optional)
                      </label>
                      <input
                        name="site_name"
                        placeholder="z.B. Musterstraße 12, Wien"
                        className="w-full rounded-lg border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Adresse (optional)
                      </label>
                      <input
                        name="site_address"
                        placeholder="z.B. Wien, 1010"
                        className="w-full rounded-lg border border-border/50 bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {state?.error && (
                    <p className="text-xs text-status-offline bg-status-offline/10 rounded-lg px-3 py-2">
                      {state.error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generiere...</>
                    ) : (
                      <><Plus className="h-4 w-4" /> Join Code generieren</>
                    )}
                  </button>
                </form>
              ) : (
                /* ── Schritt 2: Code anzeigen ── */
                <div className="space-y-4">
                  {/* Join Code */}
                  <div className="rounded-xl bg-surface-2 border border-border/40 p-4 text-center">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Join Code</p>
                    <p className="text-4xl font-mono font-extrabold tracking-[0.3em] text-primary">
                      {state.code}
                    </p>
                    {remaining !== null && (
                      <div className={`flex items-center justify-center gap-1.5 mt-3 text-xs font-medium ${
                        remaining < 60 ? "text-status-offline" : "text-muted-foreground"
                      }`}>
                        <Clock className="h-3.5 w-3.5" />
                        Gültig noch {formatTime(remaining)}
                      </div>
                    )}
                  </div>

                  {/* Install-Befehl */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      Am Pi ausführen:
                    </p>
                    <div className="relative rounded-lg bg-[hsl(220,15%,8%)] border border-border/40 px-3 py-2.5 pr-10">
                      <code className="text-xs text-status-online font-mono break-all">
                        {installCmd}
                      </code>
                      <button
                        onClick={copyCmd}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-status-online" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Schritt-für-Schritt */}
                  <div className="rounded-xl bg-surface-2 border border-border/40 p-4 space-y-2">
                    <p className="text-xs font-semibold text-foreground mb-2">So geht&apos;s:</p>
                    {[
                      "Pi ans Netz + Internet anschließen",
                      "SSH verbinden oder Monitor + Tastatur",
                      "Befehl oben einfügen → Enter",
                      `Join Code eingeben: ${state.code}`,
                      "Pi erscheint in ca. 30s im Dashboard",
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={close}
                    className="w-full rounded-lg border border-border/50 bg-surface-2 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-3 transition-colors"
                  >
                    Schließen
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
