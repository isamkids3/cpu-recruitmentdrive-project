"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, KeyRound, Sparkles, AlertCircle, Loader2 } from "lucide-react";

interface PinAuthModalProps {
  isOpen: boolean;
  onAuthenticated: (apiKey: string, boothToken?: string) => void;
  title?: string;
  subtitle?: string;
  onCancel?: () => void;
}

export const PinAuthModal: React.FC<PinAuthModalProps> = ({
  isOpen,
  onAuthenticated,
  title = "Booth Station Access",
  subtitle = "Enter the station Booth PIN to unlock the live multimodal agent stream.",
  onCancel,
}) => {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // Rate-limiting lockout timer (5 wrong tries -> 30s lockout)
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  const verifyPin = async (inputPin: string) => {
    if (lockoutRemaining > 0) {
      setError(`Too many attempts. Locked out for ${lockoutRemaining}s.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: inputPin.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 5) {
          setLockoutRemaining(30);
          setFailedAttempts(0);
          throw new Error("5 failed attempts. Locked out for 30 seconds.");
        }
        throw new Error(data.error || "Authentication failed");
      }

      if (data.apiKey) {
        setFailedAttempts(0);
        sessionStorage.setItem("booth_pin", inputPin.trim());
        sessionStorage.removeItem("booth_api_key");
        onAuthenticated(data.apiKey, data.boothToken);
      } else {
        throw new Error("No API key returned from server");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid PIN or server error";
      setError(msg);
      sessionStorage.removeItem("booth_pin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedPin = sessionStorage.getItem("booth_pin");
    if (cachedPin && cachedPin.trim().length > 0) {
      verifyPin(cachedPin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError("Please enter the Booth PIN.");
      return;
    }
    await verifyPin(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300 font-sans">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-slate-100">
        {/* Cyberpunk corner accents */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400"></div>

        {/* Ambient glow background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
            <ShieldCheck className="w-8 h-8 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-wider uppercase bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            CS Club AI Agent Security Gate
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            {title}
          </h2>
          <p className="text-sm text-slate-400 mb-6 max-w-xs leading-relaxed">
            {subtitle}
          </p>

          {error && (
            <div className="w-full mb-5 flex items-center gap-2.5 p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs text-left animate-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4 text-cyan-400" />
              </div>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={pin}
                disabled={lockoutRemaining > 0}
                onChange={(e) => setPin(e.target.value)}
                placeholder={
                  lockoutRemaining > 0
                    ? `Locked out (${lockoutRemaining}s)`
                    : "Enter Booth PIN"
                }
                autoFocus
                className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-700/80 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl text-center font-mono text-lg tracking-widest text-cyan-300 placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm transition-all outline-none disabled:opacity-50"
              />
            </div>

            <div className="flex gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-3.5 px-4 rounded-xl font-medium text-sm bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !pin || lockoutRemaining > 0}
                className="flex-1 py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-semibold shadow-[0_0_25px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-slate-950" />
                    <span>Authenticate</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between w-full font-mono">
            <span>MODEL: 3.1-flash-live</span>
            <span className="text-cyan-400 font-semibold">AUTHORIZED STAFF ONLY</span>
          </div>
        </div>
      </div>
    </div>
  );
};
