"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  BusFront,
  Navigation,
  ShieldCheck,
  LayoutDashboard,
  QrCode,
  Compass,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Users,
  CheckCircle2,
  Lock,
  Radio,
  MapPin,
  Clock,
  Key,
  LogOut,
  User,
} from "lucide-react";
import { RolePortalSwitcher } from "@/components/common/RolePortalSwitcher";
import { supabase } from "@/lib/supabaseClient";

export default function CampusRideLandingPage() {
  const [buses, setBuses] = useState(store.getBuses());
  const [stops, setStops] = useState(store.getStops());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setBuses(store.getBuses());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase signout:", e);
    }
    store.setCurrentUser(null as any);
  };

  const getDashboardLink = () => {
    if (!currentUser) return "/portal";
    if (currentUser.role === "admin" || currentUser.role === "transport_manager") return "/admin";
    if (currentUser.role === "driver") return "/staff/driver";
    if (currentUser.role === "conductor") return "/staff/conductor";
    return "/portal";
  };

  const getDashboardLabel = () => {
    if (!currentUser) return "Launch Portal";
    if (currentUser.role === "admin" || currentUser.role === "transport_manager") return "Admin Console →";
    if (currentUser.role === "driver") return "Driver Cockpit →";
    if (currentUser.role === "conductor") return "Conductor Manifest →";
    return "My Student Portal →";
  };

  const rolePortals = [
    {
      title: "Student & Parent Portal",
      description: "Live bus radar, Delhi Metro-style route tracker, redBus seat selector, and anti-fraud digital QR pass.",
      href: "/portal",
      icon: BusFront,
      badge: "Mobile-First",
      color: "from-blue-600 to-indigo-600",
      features: ["Live ETA & Station Radar", "redBus Seat Selection", "Railway Confirmed vs Waitlist WL-01", "Digital QR Boarding Pass"],
    },
    {
      title: "Driver Console",
      description: "Assigned route checklist, trip start/end lifecycle, live GPS coordinate telemetry broadcaster, and incident reporting.",
      href: "/staff/driver",
      icon: Navigation,
      badge: "In-Cabin Console",
      color: "from-emerald-600 to-teal-600",
      features: ["One-Tap Trip Start & End", "Live 15s GPS Broadcaster", "Turn-by-Turn Stop Checklist", "Instant Incident Dispatch"],
    },
    {
      title: "Conductor Manifest Desk",
      description: "Live optical camera QR scanner with cryptographic token verification, anti-counterfeit boarding checks, and passenger manifest.",
      href: "/staff/conductor",
      icon: ShieldCheck,
      badge: "Attendance & Manifest",
      color: "from-teal-600 to-cyan-600",
      features: ["Live Camera QR Pass Scanner", "Anti-Replay Security Check", "Live Boarding Counters", "Audited Manual Override"],
    },
    {
      title: "Admin Operations Center",
      description: "Fleet management, interactive Leaflet route builder, staff RBAC matrix, subscription billing, and CSV reports.",
      href: "/admin",
      icon: LayoutDashboard,
      badge: "Full Command Suite",
      color: "from-slate-900 via-blue-900 to-slate-900 dark:from-slate-800 dark:to-slate-900",
      features: ["Dynamic Bus & Stop Allocation", "Interactive Route Builder", "Railway Waitlist Promotion Engine", "Recharts Analytics & CSV Exports"],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white w-full max-w-[100vw] overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
              <BusFront className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white truncate block">
                Campus<span className="text-blue-600 dark:text-blue-400">Ride</span>
              </span>
              <span className="hidden md:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                Academic Transit Platform
              </span>
            </div>
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            <RolePortalSwitcher />
            <ThemeToggle />

            {currentUser ? (
              <>
                <Link
                  href={getDashboardLink()}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors max-w-[140px] truncate"
                >
                  <User className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{currentUser.fullName.split(" ")[0]}</span>
                </Link>

                <Link
                  href={getDashboardLink()}
                  className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-transform active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">{getDashboardLabel()}</span>
                  <span className="sm:hidden">Portal →</span>
                </Link>

                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-2 sm:px-3 sm:py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold border border-rose-200 dark:border-rose-900/50 flex-shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-transform active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12 sm:space-y-16 flex-1">
        {/* Main Headline */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800/80 shadow-sm animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            Next-Gen University Fleet & Seat Allocation Engine
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Academic Transit, Reimagined for Modern Universities.
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Eliminate bus overcrowding with railway-style guaranteed seat reservations, waitlist promotion (WL-01..), live telemetry radar, and cryptographic QR pass boarding verification.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={getDashboardLink()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-600/25 flex items-center gap-2 transition-all active:scale-95"
            >
              <span>{getDashboardLabel()}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/portal/booking"
              className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2 transition-all"
            >
              <BusFront className="w-4 h-4 text-blue-600" />
              <span>Book Bus Seat</span>
            </Link>
          </div>
        </div>

        {/* Live Network Quick Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-black font-mono text-blue-600 dark:text-blue-400">
              {buses.length || 8}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
              <BusFront className="w-3.5 h-3.5 text-blue-500" />
              <span>Active Fleet Buses</span>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400">
              {routes.length || 4}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-teal-500" />
              <span>Transit Corridors</span>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {stops.length || 18}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
              <span>Campus Stops</span>
            </div>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              100%
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Guaranteed Seating</span>
            </div>
          </div>
        </div>

        {/* 4 Multi-Role System Cards */}
        <div className="space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Role-Specific Operations Desks
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Select your role to access dedicated consoles, telemetry broadcasts, and verification manifests.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rolePortals.map((portal, idx) => {
              const Icon = portal.icon;
              return (
                <div
                  key={idx}
                  className="group bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${portal.color} flex items-center justify-center text-white shadow-md`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {portal.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        {portal.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {portal.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {portal.features.map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={portal.href}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm group-hover:bg-blue-600 group-hover:text-white"
                  >
                    <span>Launch Desk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Project Architecture & Engineering Callout */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl border border-blue-900/50">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-400/30">
              High-Speed Optical QR Radar
            </span>
            <h3 className="text-xl sm:text-2xl font-black">
              Enterprise Transit Dispatch Architecture
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Designed from first principles to solve peak-hour university bus congestion with real-time seat reservations, geofenced passenger attendance, and live telematics.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur">
              <div className="font-bold text-sm text-teal-300 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Railway Reservation Engine
              </div>
              <p className="text-slate-300 leading-relaxed">
                Atomic capacity locking, numbered waitlists (WL-01..), and instant auto-promotion of waitlisted students upon seat cancellation.
              </p>
            </div>

            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur">
              <div className="font-bold text-sm text-blue-300 flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Cryptographic QR Pass Security
              </div>
              <p className="text-slate-300 leading-relaxed">
                Anti-counterfeit dynamic QR radar scanning with rotating HMAC-SHA256 signature tokens and anti-replay verification for student boarding.
              </p>
            </div>

            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur">
              <div className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                <Compass className="w-4 h-4" />
                Live Geospatial Telematics
              </div>
              <p className="text-slate-300 leading-relaxed">
                OpenStreetMap + Leaflet visual engine with route polylines, 80m geofencing circles, and dynamic Haversine ETA computation.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            CampusRide © 2026 Smart Campus Transport Management System • Academic Major Project
          </div>
          <div className="flex items-center gap-4">
            <span>Next.js 14 App Router</span>
            <span>•</span>
            <span>Supabase PostgreSQL</span>
            <span>•</span>
            <span>Tailwind CSS</span>
            <span>•</span>
            <span>Leaflet Maps</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
