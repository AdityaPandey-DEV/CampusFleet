"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { AuthModal } from "@/components/auth/AuthModal";
import { StudentParentProductDemo } from "@/components/landing/StudentParentProductDemo";
import {
  BusFront,
  Navigation,
  ShieldCheck,
  QrCode,
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
  Smartphone,
  CreditCard,
  BellRing,
  Eye,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  Building2,
  PhoneCall,
  Flame,
  FileCheck2,
  Download,
} from "lucide-react";
import { usePWAInstall } from "@/lib/usePWAInstall";
import { InstallAppModal } from "@/components/common/InstallAppModal";
import { MobileInstallBanner } from "@/components/common/MobileInstallBanner";

export default function CampusFleetLandingPage() {
  const [buses, setBuses] = useState(store.getBuses());
  const [stops, setStops] = useState(store.getStops());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { isInstalled, isIOS, isAndroid, canInstallNative, promptInstall } = usePWAInstall();

  const handleInstallClick = async () => {
    if (canInstallNative) {
      const outcome = await promptInstall();
      if (outcome === "modal_needed") {
        setIsInstallModalOpen(true);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setBuses(store.getBuses());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const getDashboardLink = () => {
    if (!currentUser) return "/portal";
    if (currentUser.role === "admin") return "/admin";
    if (currentUser.role === "staff" || currentUser.role === "transport_manager" || currentUser.role === "supervisor") return "/staff";
    if (currentUser.role === "driver") return "/driver";
    if (currentUser.role === "conductor") return "/conductor";
    if (currentUser.role === "teacher") return "/teacher";
    return "/portal";
  };

  const getDashboardLabel = () => {
    if (!currentUser) return "Launch Student Portal";
    if (currentUser.role === "admin") return "Admin Console →";
    if (currentUser.role === "staff" || currentUser.role === "transport_manager") return "Staff Operations →";
    if (currentUser.role === "driver") return "Driver Cockpit →";
    if (currentUser.role === "conductor") return "Conductor Manifest →";
    if (currentUser.role === "teacher") return "Teacher Desk →";
    return "My Student Portal →";
  };

  const faqs = [
    {
      q: "How does guaranteed seat reservation work for students?",
      a: "CampusFleet eliminates university bus standing and rush. Students select their preferred morning (07:30 AM / 08:30 AM) or evening (04:30 PM) shift on an interactive 2x2 bus chassis (redBus-style). If the 42-seat bus is full, subsequent bookings automatically receive numbered waitlists (WL-01, WL-02) and get promoted instantly if any student cancels.",
    },
    {
      q: "How can parents track their son or daughter's daily transit?",
      a: "Parents receive live 15-second telemetry updates with a Delhi Metro-style route tracker. You can see exact bus speed, the current stop passed (e.g. Tikonia, Ranibagh), estimated arrival time at your boarding point, and an automated SMS confirmation the moment your student boards via digital QR scan.",
    },
    {
      q: "What is the Cryptographic Digital QR Bus Pass and how is it verified?",
      a: "No more fragile plastic bus passes or paper receipts. Each student commuter has an encrypted digital pass on their phone featuring a rotating HMAC-SHA256 signature and live timestamp counter. Bus conductors scan the QR pass with their optical terminal in under 1 second to confirm route access, seat allocation, and fee validity.",
    },
    {
      q: "How do we pay semester transit fees using UPI?",
      a: "Students and parents can select their residential corridor (Zone A: Campus Local, Zone B: Haldwani / Kathgodam, Zone C: Outstation Express) and choose either full semester payment or a 2-part installment plan. Scan the official university UPI QR code via Google Pay, PhonePe, Paytm, or BHIM; automated OCR matches the transaction UTR number and unlocks your pass immediately.",
    },
    {
      q: "What safety mechanisms exist in case of an emergency?",
      a: "The Student & Parent Portal includes a 1-Tap SOS Emergency button that instantly transmits GPS telemetry coordinates to university transport security and supervisors. Furthermore, all drivers and conductors are institutional personnel with verified background checks, visible photo credentials, and direct emergency call buttons.",
    },
  ];

  return (
    <div className="min-h-screen relative text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white w-full max-w-[100vw] overflow-x-hidden">
      {/* Background Ambience */}
      <div 
        className="fixed inset-0 pointer-events-none -z-10 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: "url('https://i.pinimg.com/1200x/d5/d6/ee/d5d6ee25a387c59190016f514dc8d08d.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-slate-50/85 dark:bg-slate-950/90 backdrop-blur-[2px] transition-colors duration-300" />
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/10 via-transparent to-slate-100/90 dark:from-blue-950/40 dark:via-slate-950/70 dark:to-slate-950 transition-colors duration-300" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.14),transparent_70%)]" />
      </div>

      {/* Top Navbar */}
      <UnifiedAppHeader
        portalTitle="CampusFleet"
        portalSubtitle="Student & Parent Transit Portal"
        showInstall={true}
        onOpenInstall={handleInstallClick}
        mobilePrimaryAction={{
          label: getDashboardLabel(),
          href: getDashboardLink(),
          subtitle: currentUser
            ? "Seat booking, digital pass & live GPS radar"
            : "Sign in with university or Google account",
          icon: Smartphone,
        }}
        navLinks={[
          { href: "/portal/booking", label: "Seat Booking", icon: BusFront },
          { href: "/portal/pass", label: "Digital Pass", icon: QrCode },
          { href: "/portal/tracker", label: "Live Radar", icon: Navigation },
          { href: "/portal/payments", label: "Pass Fees", icon: CreditCard },
        ]}
        customActions={
          !currentUser ? (
            <Link
              href="/portal"
              className="hidden sm:flex px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 items-center gap-1.5 whitespace-nowrap"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Launch Portal</span>
            </Link>
          ) : (
            <Link
              href={getDashboardLink()}
              className="hidden xl:flex px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-xl border border-blue-200/80 dark:border-blue-800/80 transition-all items-center gap-1.5 whitespace-nowrap"
            >
              <span>{getDashboardLabel()}</span>
            </Link>
          )
        }
      />

      {/* Main Student & Parent Product Experience */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-14 space-y-12 sm:space-y-20 lg:space-y-24 flex-1 w-full min-w-0">
        
        {/* HERO SECTION */}
        <div className="text-center space-y-4 sm:space-y-6 max-w-3xl mx-auto pt-1 sm:pt-6">
          {/* Institutional Trust Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-blue-50/90 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[11px] sm:text-xs font-black border border-blue-200/80 dark:border-blue-800/80 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 animate-pulse" />
            <span className="truncate">University Transit Network for Students & Parents</span>
          </div>

          {/* Main Value Proposition Title */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.18] sm:leading-[1.12]">
            Safe, Guaranteed & Stress-Free Campus Commute.
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed px-1">
            Eliminate morning bus rush and standing for an hour. Reserve your guaranteed seat (redBus-style), track live bus radar in real time, and board with an encrypted digital QR pass on your phone.
          </p>

          {/* Action Buttons: Stacked on Mobile, Row on Desktop */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 pt-2 w-full max-w-md sm:max-w-none mx-auto">
            <Link
              href={getDashboardLink()}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition-all active:scale-95 text-center"
            >
              <span>{currentUser ? "Open My Student Portal" : "Enter Student & Parent Portal"}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>

            <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Link
                href="/portal/booking"
                className="w-full sm:w-auto px-2.5 sm:px-5 py-3 bg-white/90 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs flex items-center justify-center gap-1.5 transition-all backdrop-blur-md text-center"
              >
                <BusFront className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">Reserve Seat</span>
              </Link>

              <Link
                href="/portal/pass"
                className="w-full sm:w-auto px-2.5 sm:px-5 py-3 bg-slate-100/90 dark:bg-slate-800/60 hover:bg-slate-200/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 transition-all backdrop-blur-md flex items-center justify-center gap-1.5 text-center"
              >
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Digital Pass</span>
              </Link>

              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full sm:w-auto px-2.5 sm:px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/60 dark:to-indigo-950/60 hover:from-blue-100 dark:hover:from-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm rounded-2xl border border-blue-200/90 dark:border-blue-800/80 shadow-xs flex items-center justify-center gap-1.5 transition-all backdrop-blur-md text-center cursor-pointer group"
              >
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 group-hover:translate-y-0.5 transition-transform" />
                <span className="truncate">Install App</span>
              </button>
            </div>
          </div>

          {/* Commuter Trust Metric Strip */}
          <div className="pt-2 sm:pt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] sm:text-xs">100% Reserved Seating</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
              <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs">15s Live GPS Radar</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/70 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="text-[11px] sm:text-xs">Parent Boarding Alerts</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE LIVE PRODUCT DEMO SIMULATOR */}
        <div id="interactive-demo" className="space-y-4">
          <div className="text-center space-y-1.5 max-w-2xl mx-auto px-1">
            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold border border-indigo-200/60 dark:border-indigo-800/60">
              Interactive Product Demo
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white">
              See How It Works in Real-Time
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Experience the 4 cornerstone features built for university students and parents — test drive seat selection, bus radar, holographic passes, and fee billing right now.
            </p>
          </div>

          <StudentParentProductDemo />
        </div>

        {/* SECTION 3: 4 KEY VALUE PILLARS FOR STUDENTS & PARENTS */}
        <div className="space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold border border-blue-200/60 dark:border-blue-800/60">
              Everyday Commute Upgrades
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Everything Students & Parents Need
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Designed from ground up to replace university transport headaches with clarity, safety, and modern convenience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pillar 1: Guaranteed Seating */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shadow-inner">
                <BusFront className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                  Guaranteed Seating
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  redBus-Style Seat Selection & Shifts
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Choose your exact seat (window or aisle) on a visual 2x2 bus chassis layout. Book for morning (07:30 AM / 08:30 AM) and return evening shifts with guaranteed seat assurance.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>No standing in overcrowded aisles on mountain highways</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Numbered Railway-style waitlist (WL-01..) with auto-promotion</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Shift switching when lecture or exam timings change</span>
                </div>
              </div>
            </div>

            {/* Pillar 2: Live Bus Radar */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black shadow-inner">
                <Navigation className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                  Real-Time Tracking
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Live GPS Radar & Metro-Style Progress
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Never wait in the rain or cold wondering where your bus is. View exact vehicle GPS coordinates updated every 15 seconds with estimated arrival time at your pickup stop.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Station countdown timers (e.g. Tikonia 4m away)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Delhi Metro-style station progression bar</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>OpenStreetMap & Leaflet live satellite map overlay</span>
                </div>
              </div>
            </div>

            {/* Pillar 3: Cryptographic Pass */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shadow-inner">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                  Mobile Identity
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Anti-Fraud Digital QR Transit Pass
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Say goodbye to lost plastic cards or water-damaged fee slips. Your verified digital pass lives securely on your smartphone with dynamic rotating anti-counterfeit security.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>1-second optical camera scan by bus conductors</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Rotating HMAC-SHA256 token prevents screenshot sharing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Full student photo, enrollment number, and assigned stop</span>
                </div>
              </div>
            </div>

            {/* Pillar 4: Zone Billing & UPI */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800/80 shadow-sm hover:shadow-xl transition-all space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black shadow-inner">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                  Pass Billing
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Zone Fees, Installments & UPI QR
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Transparent corridor pricing based on distance. Pay easily from home via official university UPI QR code with installment plans and instant digital receipt verification.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Zero cash queues at university finance accounts windows</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Support for Google Pay, PhonePe, Paytm, and BHIM</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Instant pass unlocking upon OCR transaction verification</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: PARENT PEACE-OF-MIND & SAFETY SECTION */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-12 shadow-2xl border border-blue-800/40 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-400/30">
                Designed with Parents in Mind
              </span>
              <h2 className="text-2xl sm:text-4xl font-black">
                Total Safety & Peace of Mind for Families
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                As a parent, your child’s commute shouldn’t be a source of daily anxiety. CampusFleet gives you 360° visibility into their university transit journey.
              </p>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 border border-white/15 text-xs font-bold self-stretch md:self-auto justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Campus Safety Certified</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Feature 1 */}
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center font-bold">
                <BellRing className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Boarding SMS Alerts</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Instant confirmation when your student’s QR pass is scanned by the conductor at their designated pickup stop.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600/30 text-teal-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Verified Bus Crew</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                View verified photo credentials, commercial heavy vehicle license status, and direct contact of the driver and conductor.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Geofenced Campus Entry</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Automatic 80-meter geofence triggers notify parents when the fleet bus safely enters university campus gates.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center font-bold">
                <Flame className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">1-Tap Emergency SOS</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Students and parents can trigger an urgent broadcast to campus transport control with live coordinates if assistance is needed.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 4: SIDE-BY-SIDE COMPARISON TABLE */}
        <div className="space-y-6">
          <div className="text-center space-y-2 max-w-2xl mx-auto px-1">
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold border border-slate-200 dark:border-slate-700">
              The CampusFleet Advantage
            </span>
            <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Traditional University Buses vs. CampusFleet
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              See why universities are upgrading from chaotic manual transport to guaranteed digital operations.
            </p>
          </div>

          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40">
                    <th className="py-4 px-6 font-black uppercase text-slate-400 w-1/3">Feature</th>
                    <th className="py-4 px-6 font-black uppercase text-rose-600 dark:text-rose-400 w-1/3">
                      Traditional College Bus
                    </th>
                    <th className="py-4 px-6 font-black uppercase text-emerald-600 dark:text-emerald-400 w-1/3 bg-emerald-50/40 dark:bg-emerald-950/20">
                      CampusFleet Smart Platform
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">Seat Allocation</td>
                    <td className="py-4 px-6 text-slate-500">First-come rush, standing in aisles, severe overcrowding</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      100% Guaranteed Reserved Seat (redBus UI + Waitlist)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">Bus Location & ETA</td>
                    <td className="py-4 px-6 text-slate-500">Calling driver repeatedly, waiting blindly at road stops</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      Live 15s GPS Radar + Metro-Style Stop Progression
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">Boarding Pass</td>
                    <td className="py-4 px-6 text-slate-500">Physical cardboard cards, easily torn, lost, or forged</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      Cryptographic Dynamic QR Pass on Smartphone
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">Fee Payments</td>
                    <td className="py-4 px-6 text-slate-500">Waiting in bank/accounts lines, physical cash slips</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      Direct UPI QR scan + instant pass activation
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-slate-200">Parent Peace of Mind</td>
                    <td className="py-4 px-6 text-slate-500">Zero updates, no idea if child boarded or reached campus</td>
                    <td className="py-4 px-6 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      Real-time boarding confirmation + geofence alerts
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Comparison Cards (Ultra-readable, zero horizontal scroll) */}
          <div className="md:hidden space-y-3">
            {[
              {
                feature: "Seat Allocation",
                traditional: "First-come rush, standing in aisles, severe overcrowding",
                smart: "100% Guaranteed Reserved Seat (redBus UI + Waitlist)",
              },
              {
                feature: "Bus Location & ETA",
                traditional: "Calling driver repeatedly, waiting blindly at road stops",
                smart: "Live 15s GPS Radar + Metro-Style Stop Progression",
              },
              {
                feature: "Boarding Pass",
                traditional: "Physical cardboard cards, easily torn, lost, or forged",
                smart: "Cryptographic Dynamic QR Pass on Smartphone",
              },
              {
                feature: "Fee Payments",
                traditional: "Waiting in bank/accounts lines, physical cash slips",
                smart: "Direct UPI QR scan + instant pass activation",
              },
              {
                feature: "Parent Peace of Mind",
                traditional: "Zero updates, no idea if child boarded or reached campus",
                smart: "Real-time boarding confirmation + geofence alerts",
              },
            ].map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  {item.feature}
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50">
                    <span className="w-4 h-4 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-700 dark:text-rose-300 flex items-center justify-center font-black text-[10px] shrink-0 mt-0.5">✕</span>
                    <span className="leading-snug">{item.traditional}</span>
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.smart}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: FAQS ACCORDION */}
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold border border-blue-200/60 dark:border-blue-800/60">
              Help Center
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Clear answers for students and parents about daily transit operations.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900 dark:text-white hover:text-blue-600 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180 text-blue-600" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 6: FINAL HIGH-CONVERTING CTA BANNER */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-14 text-center space-y-5 sm:space-y-6 shadow-2xl relative overflow-hidden">
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-xl sm:text-4xl font-black tracking-tight leading-tight">
              Ready for a Guaranteed Daily Seat?
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed px-1">
              Sign in with your university account or Google identity to reserve your bus seat, activate your digital QR pass, and access live transit radar.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full max-w-md sm:max-w-none mx-auto">
            <Link
              href={getDashboardLink()}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-white text-blue-600 hover:bg-blue-50 font-black text-xs sm:text-sm rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-center"
            >
              <span>{currentUser ? "Open My Commuter Portal" : "Enter Student & Parent Portal"}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>

            <Link
              href="/portal/booking"
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-blue-900/50 hover:bg-blue-900/70 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/20 transition-all active:scale-95 text-center"
            >
              <span>View Available Shifts & Seats</span>
            </Link>

            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 bg-blue-500/30 hover:bg-blue-500/50 text-white font-bold text-xs sm:text-sm rounded-2xl border border-white/30 transition-all active:scale-95 flex items-center justify-center gap-2 text-center cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install Web App (PWA)</span>
            </button>
          </div>
        </div>

      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* FOOTER */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0">
                <BusFront className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-slate-900 dark:text-white">CampusFleet</div>
                <div className="text-[11px] text-slate-400">Student & Parent Transit Network</div>
              </div>
            </div>

            {/* Quick Links for Students & Parents */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-semibold">
              <Link href="/portal" className="hover:text-blue-600 transition-colors">Student Portal</Link>
              <Link href="/portal/booking" className="hover:text-blue-600 transition-colors">Seat Booking</Link>
              <Link href="/portal/pass" className="hover:text-blue-600 transition-colors">Digital Pass</Link>
              <Link href="/portal/payments" className="hover:text-blue-600 transition-colors">Pass Fees & UPI</Link>
              <Link href="/portal/tracker" className="hover:text-blue-600 transition-colors">Live GPS Radar</Link>
              <button
                type="button"
                onClick={handleInstallClick}
                className="hover:text-blue-600 transition-colors font-bold text-blue-600 dark:text-blue-400 cursor-pointer inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            </div>
          </div>

          {/* Discreet Institutional Crew & Staff Access */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <div className="text-center sm:text-left">
              CampusFleet © 2026 • Graphic Era Hill University (GEHU) Bhimtal Campus • Major Academic Project
            </div>

            {/* Discreet Institutional Links */}
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 font-mono text-[10px] sm:text-[11px]">
              <span className="text-slate-400">Institutional:</span>
              <Link href="/staff" className="text-blue-600 dark:text-blue-400 hover:underline">
                Staff Console
              </Link>
              <span>•</span>
              <Link href="/driver" className="text-blue-600 dark:text-blue-400 hover:underline">
                Driver Cockpit
              </Link>
              <span>•</span>
              <Link href="/conductor" className="text-blue-600 dark:text-blue-400 hover:underline">
                Conductor Terminal
              </Link>
              <span>•</span>
              <Link href="/admin" className="text-blue-600 dark:text-blue-400 hover:underline">
                Admin Center
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Persistent Floating Install Banner */}
      <MobileInstallBanner
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isInstalled={isInstalled}
        canInstallNative={canInstallNative}
        onPromptInstall={promptInstall}
      />

      {/* PWA Install Guidance & 1-Tap Trigger Modal */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        canInstallNative={canInstallNative}
        onPromptInstall={promptInstall}
        isIOS={isIOS}
        isAndroid={isAndroid}
      />
    </div>
  );
}
