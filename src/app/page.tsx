"use client";

import React from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/common/ThemeToggle";
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
} from "lucide-react";

export default function BusSyncLandingPage() {
  const rolePortals = [
    {
      title: "Student & Parent Portal",
      description: "Live bus radar, Delhi Metro-style route tracker, railway seat booking, digital QR pass, and SOS alert button.",
      href: "/portal",
      icon: BusFront,
      badge: "Mobile-First",
      color: "from-blue-600 to-indigo-600",
      features: ["Live ETA & Station Radar", "Digital QR Boarding Pass", "Railway Confirmed vs Waitlist WL-01", "Multi-Child Switcher"],
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
      description: "Final trip passenger manifest, camera QR scanner, and certified Biometric Hardware Adapter simulation with zero raw biometric storage.",
      href: "/staff/conductor",
      icon: ShieldCheck,
      badge: "Attendance & Manifest",
      color: "from-teal-600 to-cyan-600",
      features: ["Anti-Fraud QR Pass Scanner", "Biometric Hardware Adapter", "Live Boarding Counters", "Audited Manual Override"],
    },
    {
      title: "Admin Operations Center",
      description: "Fleet management, interactive Leaflet route builder, staff RBAC matrix, subscription billing, and CSV reports.",
      href: "/admin",
      icon: LayoutDashboard,
      badge: "Full Command Suite",
      color: "from-slate-900 via-blue-900 to-slate-900 dark:from-slate-800 dark:to-slate-900",
      features: ["Fleet & GPS Telematics HUD", "Interactive Route Builder", "Railway Waitlist Promotion Engine", "Recharts Analytics & CSV Exports"],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <BusFront className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Bus<span className="text-blue-600 dark:text-blue-400">Sync</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                Academic Transit Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/portal"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-transform active:scale-95"
            >
              Launch Demo Portal →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16 flex-1">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-xs font-bold text-blue-700 dark:text-blue-300 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Next-Generation Smart Campus Transport & Fleet Management
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Reliable Campus Mobility.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-400">
              Railway Precision.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Inspired by the operational clarity, route progression, and passenger trust of rapid transit systems. Featuring atomic seat allocation, automatic waitlist promotion, live GPS telematics, and QR/Biometric boarding verification.
          </p>
        </div>

        {/* Role Panels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rolePortals.map((portal, idx) => {
            const Icon = portal.icon;
            return (
              <Link
                key={idx}
                href={portal.href}
                className="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg hover:shadow-2xl hover:border-blue-500/60 transition-all duration-300 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${portal.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {portal.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {portal.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {portal.description}
                    </p>
                  </div>

                  {/* Feature Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {portal.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 pt-2 group-hover:translate-x-1 transition-transform">
                  <span>Enter {portal.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Feature Highlights Grid */}
        <div className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 rounded-3xl p-8 text-white shadow-xl space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-black">Architectural Excellence & Safety Highlights</h3>
            <p className="text-xs text-blue-200">Built for production reliability and institutional accreditation.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur">
              <div className="font-bold text-sm text-teal-300 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Railway Reservation Engine
              </div>
              <p className="text-slate-300 leading-relaxed">
                Atomic capacity locking, numbered waitlists (WL-01..), and instant auto-promotion of waitlisted students upon cancellation.
              </p>
            </div>

            <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur">
              <div className="font-bold text-sm text-blue-300 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Biometric Hardware Adapter
              </div>
              <p className="text-slate-300 leading-relaxed">
                Zero raw biometric templates stored in database. On-chip fingerprint verification with signed cryptographic tokens & fallback check-in.
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

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            BusSync © 2026 Smart Campus Transport Management System • Academic Major Project
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
