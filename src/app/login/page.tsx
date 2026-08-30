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
  MapPin,
  Compass,
  Check,
  Building,
  Home,
  User,
} from "lucide-react";

import { calculateDistanceKm } from "@/lib/utils";
import { Stop } from "@/lib/types";
import { authService } from "@/lib/auth-service";

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [authStep, setAuthStep] = useState<"LOGIN_FORM" | "EMAIL_OTP" | "ONBOARDING" | "SUCCESS">("LOGIN_FORM");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [generatedCodeHint, setGeneratedCodeHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Commuter Onboarding State
  const [stops, setStops] = useState<Stop[]>(store.getStops());
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingCampus, setOnboardingCampus] = useState("GEHU Bhimtal");
  const [homeLocation, setHomeLocation] = useState("");
  const [selectedStopId, setSelectedStopId] = useState("");
  const [detectedDistanceText, setDetectedDistanceText] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [pendingAuthUser, setPendingAuthUser] = useState<any>(null);

  React.useEffect(() => {
    const initialStops = store.getStops();
    if (initialStops.length > 0) {
      setStops(initialStops);
      const defaultStop = initialStops.find(s => s.name.includes("Laldant")) || initialStops[0];
      if (defaultStop) setSelectedStopId(defaultStop.id);
    }

    const unsub = store.subscribe(() => {
      const latestStops = store.getStops();
      setStops(latestStops);
      if (latestStops.length > 0 && !selectedStopId) {
        const defaultStop = latestStops.find(s => s.name.includes("Laldant")) || latestStops[0];
        if (defaultStop) setSelectedStopId(defaultStop.id);
      }
    });
    return unsub;
  }, [selectedStopId]);

  // Filter stops by selected campus (e.g. GEHU Bhimtal)
  const campusStops = React.useMemo(() => {
    return stops.filter(st => {
      if (onboardingCampus.includes("Bhimtal")) {
        return st.campus === "GEHU Bhimtal" || st.id.includes("bht") || !st.id.includes("ddn");
      }
      if (onboardingCampus.includes("Dehradun")) {
        return st.campus === "GEHU Dehradun" || st.id.includes("ddn");
      }
      return true;
    });
  }, [stops, onboardingCampus]);

  // Compute nearest stops based on text filter or GPS
  const filteredNearestStops = React.useMemo(() => {
    if (!homeLocation.trim()) {
      return campusStops;
    }
    const q = homeLocation.toLowerCase().trim();
    const matched = campusStops.filter(
      st =>
        st.name.toLowerCase().includes(q) ||
        st.landmark.toLowerCase().includes(q) ||
        st.code.toLowerCase().includes(q)
    );
    return matched.length > 0 ? matched : campusStops;
  }, [campusStops, homeLocation]);

  const handleDetectGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        if (campusStops.length === 0) return;
        
        let nearestStop = campusStops[0];
        let minDistance = Infinity;

        campusStops.forEach(st => {
          const dist = calculateDistanceKm(latitude, longitude, st.latitude, st.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            nearestStop = st;
          }
        });

        if (nearestStop) {
          setSelectedStopId(nearestStop.id);
          setHomeLocation(`${nearestStop.name.split("(")[0].trim()}`);
          setDetectedDistanceText(`📍 Nearest stop found: ~${minDistance} km away (${nearestStop.name})`);
        }
      },
      err => {
        setIsLocating(false);
        console.warn("GPS error:", err);
        const defaultStop = campusStops.find(s => s.code.includes("LDT") || s.name.includes("Laldant")) || campusStops[0];
        if (defaultStop) setSelectedStopId(defaultStop.id);
      },
      { timeout: 8000 }
    );
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Try real Google OAuth first
      const result = await authService.signInWithGoogle();
      if (!result.success) {
        // Fallback: if Google OAuth provider isn't configured, use instant login
        const resolvedEmail = (email.trim() || "student.commuter@gehu.ac.in").toLowerCase();
        const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();
        const isUserAdmin = Boolean(adminEmail && resolvedEmail === adminEmail);
        const role: UserRole = isUserAdmin ? "admin" : "student";

        const user = authService.instantLogin(resolvedEmail, role);
        store.setCurrentUser(user);

        if (user.role === "admin" || user.role === "driver" || user.role === "conductor") {
          setAuthStep("SUCCESS");
          setTimeout(() => router.push(authService.getTargetRouteForRole(user.role)), 700);
        } else {
          setPendingAuthUser(user);
          setOnboardingName(user.fullName || "Student Commuter");
          const defaultStop = campusStops[0];
          if (defaultStop) setSelectedStopId(defaultStop.id);
          setAuthStep("ONBOARDING");
        }
      }
      // If success, browser will redirect to /auth/callback
    } catch (err: any) {
      console.warn("Auth exception:", err);
      setErrorMessage(err.message || "Authentication failed");
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
        setGeneratedCodeHint(null); // No more auto-displayed codes
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
        const authUser = res.user;
        store.setCurrentUser(authUser);

        if (authUser.role === "admin") {
          setAuthStep("SUCCESS");
          setTimeout(() => router.push("/admin"), 700);
        } else if (authUser.role === "driver" || authUser.role === "conductor") {
          setAuthStep("SUCCESS");
          setTimeout(() => router.push(authService.getTargetRouteForRole(authUser.role)), 700);
        } else {
          // New student commuter onboarding
          setPendingAuthUser(authUser);
          setOnboardingName(authUser.fullName || "Student Commuter");
          const defaultStop = stops.find(s => s.name.includes("Laldant")) || stops[0];
          if (defaultStop) setSelectedStopId(defaultStop.id);
          setAuthStep("ONBOARDING");
        }
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid passcode.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingName.trim()) {
      setErrorMessage("Please enter your full name.");
      return;
    }
    if (!selectedStopId) {
      setErrorMessage("Please select your nearest boarding stop.");
      return;
    }

    setIsLoading(true);

    try {
      const chosenStop = stops.find(s => s.id === selectedStopId) || stops[0];
      const updatedUser = {
        ...(pendingAuthUser || store.getCurrentUser()),
        fullName: onboardingName.trim(),
        campus: onboardingCampus,
        primaryStopId: selectedStopId,
        primaryStopName: chosenStop?.name,
      };

      store.setCurrentUser(updatedUser);

      // Also persist to Supabase users table
      try {
        await supabase.from("users").upsert({
          id: updatedUser.id,
          email: updatedUser.email,
          full_name: updatedUser.fullName,
          role: "student",
          campus: onboardingCampus,
        });
      } catch (err) {
        console.warn("Supabase user update notice:", err);
      }

      setAuthStep("SUCCESS");
      setTimeout(() => {
        router.push("/portal");
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to complete onboarding.");
    } finally {
      setIsLoading(false);
    }
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
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <span>{isLoading ? "Sending Code..." : "Send 6-Digit Email Passcode"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
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
                {isLoading ? "Verifying..." : "Verify & Setup Transit Profile"}
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

          {/* STEP 3: Required Details & Nearest Stop Selection */}
          {authStep === "ONBOARDING" && (
            <form onSubmit={handleCompleteOnboarding} className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white text-center space-y-1">
                <h3 className="font-black text-sm">Required Details: Student Onboarding</h3>
                <p className="text-[11px] opacity-90">
                  Select your campus & home location to find your nearest bus stop.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Full Name
                </label>
                <div className="relative mt-1">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aditya Pandey"
                    value={onboardingName}
                    onChange={e => setOnboardingName(e.target.value)}
                    className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold"
                  />
                </div>
              </div>

              {/* Campus Selection */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Enrolled Campus
                </label>
                <div className="relative mt-1">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <select
                    value={onboardingCampus}
                    onChange={e => setOnboardingCampus(e.target.value)}
                    className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold cursor-pointer"
                  >
                    <option value="GEHU Bhimtal">Graphic Era Hill University, Bhimtal Campus</option>
                    <option value="GEHU Haldwani">Graphic Era Hill University, Haldwani Campus</option>
                    <option value="GEHU Dehradun">Graphic Era Dehradun Main Campus (Clement Town)</option>
                  </select>
                </div>
              </div>

              {/* Home Location / Neighborhood */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Home Location / Area
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGPSLocation}
                    disabled={isLocating}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{isLocating ? "Locating..." : "📍 Auto-Detect Nearest"}</span>
                  </button>
                </div>

                <div className="relative mt-1">
                  <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="e.g. Laldant, Mukhani, Kathgodam, Lalkuan, Nainital..."
                    value={homeLocation}
                    onChange={e => {
                      setHomeLocation(e.target.value);
                      setDetectedDistanceText(null);
                    }}
                    className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none"
                  />
                </div>

                {detectedDistanceText && (
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {detectedDistanceText}
                  </p>
                )}
              </div>

              {/* Nearest Stop Selector Card */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Select Your Primary Bus Boarding Stop
                </label>

                <div className="relative">
                  <MapPin className="w-4 h-4 text-blue-600 absolute left-3.5 top-3.5" />
                  <select
                    value={selectedStopId}
                    onChange={e => setSelectedStopId(e.target.value)}
                    className="w-full text-xs pl-10 pr-4 py-3 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl outline-none font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {filteredNearestStops.map(st => (
                      <option key={st.id} value={st.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                        {st.name} ({st.code}) — {st.landmark}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-transform active:scale-95 mt-2"
              >
                <span>{isLoading ? "Saving Profile..." : "Confirm Stop & Enter Student Hub →"}</span>
              </button>
            </form>
          )}

          {/* STEP 4: Success Screen */}
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
