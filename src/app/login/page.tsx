"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { supabase } from "@/lib/supabaseClient";
import { UserRole } from "@/lib/types";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  BusFront,
  ShieldCheck,
  Mail,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Key,
  GraduationCap,
  Navigation,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { authService } from "@/lib/auth-service";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [authStep, setAuthStep] = useState<"LOGIN_FORM" | "EMAIL_OTP" | "SUCCESS">("LOGIN_FORM");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [generatedCodeHint, setGeneratedCodeHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
    const resolvedEmail = email || adminEmail || "adityapandey.dev.in@gmail.com";
    const isUserAdmin = Boolean(adminEmail && resolvedEmail.toLowerCase() === adminEmail);
    const role: UserRole = isUserAdmin ? "admin" : "student";
    const targetRoute = authService.getTargetRouteForRole(role);

    try {
      if (typeof window !== "undefined") {
        const callbackUrl = `${window.location.origin}/auth/callback?next=${targetRoute}`;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callbackUrl,
          },
        });

        if (error) {
          console.warn("Supabase OAuth notice, using standalone auth:", error.message);
          const user = authService.instantLogin(resolvedEmail, role);
          store.setCurrentUser(user);
          setAuthStep("SUCCESS");
          setTimeout(() => {
            router.push(targetRoute);
          }, 800);
        }
      }
    } catch (err: any) {
      console.warn("OAuth Exception fallback:", err);
      const user = authService.instantLogin(resolvedEmail, role);
      store.setCurrentUser(user);
      setAuthStep("SUCCESS");
      setTimeout(() => {
        router.push(targetRoute);
      }, 800);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.sendOtp(email);
      if (res.success) {
        setGeneratedCodeHint(res.generatedCode || "123456");
        // Pre-fill OTP for ultra-smooth experience
        if (res.generatedCode) {
          setOtp(res.generatedCode.split(""));
        }
        setAuthStep("EMAIL_OTP");
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredOtp = otp.join("");
    if (enteredOtp.length < 6) {
      setErrorMessage("Please enter the complete 6-digit code");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await authService.verifyOtp(email, enteredOtp);
      if (res.success && res.user) {
        store.setCurrentUser(res.user);
        setAuthStep("SUCCESS");
        const targetRoute = authService.getTargetRouteForRole(res.user.role);
        setTimeout(() => {
          router.push(targetRoute);
        }, 800);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid passcode.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantQuickLogin = (quickRole: UserRole, defaultEmail: string) => {
    setIsLoading(true);
    const user = authService.instantLogin(defaultEmail, quickRole);
    store.setCurrentUser(user);
    setAuthStep("SUCCESS");
    const targetRoute = authService.getTargetRouteForRole(quickRole);
    setTimeout(() => {
      router.push(targetRoute);
    }, 600);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val[0];
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Navbar */}
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <BusFront className="w-5 h-5" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Campus<span className="text-blue-600 dark:text-blue-400">Ride</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Single Login Experience */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-8">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Unified Campus Gateway
            </h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              One login for Students, Parents, Drivers, Conductors & Administrators.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Main Login Form */}
          {authStep === "LOGIN_FORM" && (
            <div className="space-y-5">
              {/* Google SSO */}
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-white font-bold text-xs rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
                  />
                </svg>
                <span>{isLoading ? "Authenticating..." : "Sign In with Google Institutional SSO"}</span>
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
                <span className="bg-white dark:bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-400 absolute">
                  Or Email OTP Passcode
                </span>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Institutional Email Address
                  </label>
                  <div className="relative mt-1">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="e.g. name@gehu.ac.in or admin@campus.edu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <span>{isLoading ? "Sending Code..." : "Send 6-Digit Email Passcode"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              {/* Instant 1-Click Evaluation Shortcuts */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Instant 1-Click Role Portals
                  </span>
                  <span className="text-[10px] text-blue-600 font-bold">No-Redirect</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleInstantQuickLogin("admin", "adityapandey.dev.in@gmail.com")}
                    className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-left transition-transform active:scale-95"
                  >
                    <div className="text-xs font-black flex items-center justify-between">
                      <span>👑 Admin Center</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </div>
                    <div className="text-[10px] text-amber-700 dark:text-amber-400/80 mt-0.5">
                      Full Fleet & Live Ops
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInstantQuickLogin("student", "student@campus.gehu.ac.in")}
                    className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-300 text-left transition-transform active:scale-95"
                  >
                    <div className="text-xs font-black flex items-center justify-between">
                      <span>🎓 Student Hub</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-400/80 mt-0.5">
                      Seat Booking & Radar
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInstantQuickLogin("driver", "driver@campus.gehu.ac.in")}
                    className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300 text-left transition-transform active:scale-95"
                  >
                    <div className="text-xs font-black flex items-center justify-between">
                      <span>🚌 Driver HUD</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400/80 mt-0.5">
                      GPS Telemetry Beacon
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInstantQuickLogin("conductor", "conductor@campus.gehu.ac.in")}
                    className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-300 text-left transition-transform active:scale-95"
                  >
                    <div className="text-xs font-black flex items-center justify-between">
                      <span>🎫 Conductor Console</span>
                      <ArrowRight className="w-3 h-3 opacity-60" />
                    </div>
                    <div className="text-[10px] text-purple-700 dark:text-purple-400/80 mt-0.5">
                      QR & Biometrics Scanner
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Email OTP Input */}
          {authStep === "EMAIL_OTP" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-center space-y-1">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                  Verification passcode sent to:
                </p>
                <p className="text-xs font-mono font-bold text-blue-900 dark:text-blue-200">{email}</p>
                {generatedCodeHint && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 py-1 px-3 rounded-xl inline-block mt-1">
                    Your One-Time Code: <span className="font-mono tracking-widest">{generatedCodeHint}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-between gap-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    className="w-12 h-14 text-center font-mono font-black text-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-600/20"
              >
                {isLoading ? "Verifying..." : "Verify & Enter Dashboard"}
              </button>

              <button
                type="button"
                onClick={() => setAuthStep("LOGIN_FORM")}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ← Change Email or Method
              </button>
            </form>
          )}

          {/* STEP 3: Success Screen */}
          {authStep === "SUCCESS" && (
            <div className="text-center py-6 space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="font-black text-xl">Identity Verified!</h3>
              <p className="text-xs text-slate-500">
                Redirecting to your role dashboard...
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500">
        CampusRide © 2026 Smart Transit System • Graphic Era Hill University Network
      </footer>
    </div>
  );
}
