"use client";

import React, { useState, useEffect } from "react";
import {
  BusFront,
  Navigation,
  QrCode,
  CreditCard,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  Wifi,
  Zap,
  Disc,
  ArrowDown,
  BellRing,
  Smartphone,
  Check,
} from "lucide-react";

export function StudentParentProductDemo() {
  const [activeTab, setActiveTab] = useState<"radar" | "seats" | "qr" | "billing">("radar");

  // --- DEMO 1: LIVE RADAR STATE ---
  const [isBusMoving, setIsBusMoving] = useState(true);
  const [etaSeconds, setEtaSeconds] = useState(220); // 3m 40s

  const stops = [
    { name: "Haldwani Tikonia", time: "07:20 AM", passed: true, dist: "Origin" },
    { name: "Kathgodam Rly Station", time: "07:35 AM", passed: true, dist: "Passed 4m ago" },
    { name: "Ranibagh Toll Plaza", time: "07:50 AM", passed: false, current: true, dist: "Arriving in 3m" },
    { name: "Bhimtal Lake Crossing", time: "08:15 AM", passed: false, dist: "6.5 km away" },
    { name: "GEHU Bhimtal Campus", time: "08:35 AM", passed: false, isCampus: true, dist: "Terminus" },
  ];

  useEffect(() => {
    if (!isBusMoving) return;
    const interval = setInterval(() => {
      setEtaSeconds(prev => (prev > 10 ? prev - 5 : 220));
    }, 1500);
    return () => clearInterval(interval);
  }, [isBusMoving]);

  // --- DEMO 2: REDBUS SEAT SELECTION STATE ---
  const [selectedSeat, setSelectedSeat] = useState<string>("3A");
  const [selectedShift, setSelectedShift] = useState<"morning" | "evening">("morning");
  const bookedSeats = new Set(["1A", "1B", "2D", "3B", "4A", "4B", "5C"]);

  const seatRows = [
    {
      row: 1,
      left: [
        { id: "1A", label: "1A", window: true },
        { id: "1B", label: "1B", window: false },
      ],
      right: [
        { id: "1C", label: "1C", window: false },
        { id: "1D", label: "1D", window: true },
      ],
    },
    {
      row: 2,
      left: [
        { id: "2A", label: "2A", window: true },
        { id: "2B", label: "2B", window: false },
      ],
      right: [
        { id: "2C", label: "2C", window: false },
        { id: "2D", label: "2D", window: true },
      ],
    },
    {
      row: 3,
      left: [
        { id: "3A", label: "3A", window: true },
        { id: "3B", label: "3B", window: false },
      ],
      right: [
        { id: "3C", label: "3C", window: false },
        { id: "3D", label: "3D", window: true },
      ],
    },
    {
      row: 4,
      left: [
        { id: "4A", label: "4A", window: true },
        { id: "4B", label: "4B", window: false },
      ],
      right: [
        { id: "4C", label: "4C", window: false },
        { id: "4D", label: "4D", window: true },
      ],
    },
    {
      row: 5,
      left: [
        { id: "5A", label: "5A", window: true },
        { id: "5B", label: "5B", window: false },
      ],
      right: [
        { id: "5C", label: "5C", window: false },
        { id: "5D", label: "5D", window: true },
      ],
    },
  ];

  // --- DEMO 3: DIGITAL QR PASS STATE ---
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());
  const [scanStatus, setScanStatus] = useState<"ready" | "scanning" | "verified">("ready");

  useEffect(() => {
    const timer = setInterval(() => {
      setQrTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSimulateScan = () => {
    setScanStatus("scanning");
    setTimeout(() => {
      setScanStatus("verified");
      setTimeout(() => setScanStatus("ready"), 5000);
    }, 900);
  };

  // --- DEMO 4: ZONE PASS & UPI BILLING STATE ---
  const [selectedZone, setSelectedZone] = useState<"ZONE_A" | "ZONE_B" | "ZONE_C">("ZONE_B");
  const [isInstallment, setIsInstallment] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  const zones = {
    ZONE_A: { name: "Zone A: Campus Local & Bhimtal", fee: 8500, installment: 4500, coverage: "Bhimtal, Sattal, Bhowali town" },
    ZONE_B: { name: "Zone B: Haldwani & Kathgodam Corridor", fee: 14500, installment: 7500, coverage: "Tikonia, Kathgodam, Ranibagh, Jeolikote" },
    ZONE_C: { name: "Zone C: Outstation & Extended Express", fee: 18500, installment: 9500, coverage: "Lalkuan, Rudrapur, Pantnagar, Kaladhungi" },
  };

  const activeZoneInfo = zones[selectedZone];

  const handleSimulatePayment = () => {
    setPaymentDone(true);
    setTimeout(() => {
      setPaymentDone(false);
      setIsUpiModalOpen(false);
    }, 4000);
  };

  return (
    <div className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl sm:rounded-[2.5rem] border border-slate-200/90 dark:border-slate-800/90 shadow-2xl p-3.5 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 transition-all min-w-0 overflow-hidden">
      {/* Demo Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-3 sm:gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 sm:pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 text-[11px] sm:text-xs font-black tracking-wide uppercase mb-1.5 sm:mb-2 border border-blue-200/60 dark:border-blue-800/60">
            <Sparkles className="w-3.5 h-3.5" />
            Interactive Live Simulator
          </div>
          <h2 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Test Drive the Student & Parent Commute
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
            Click through real features built into CampusFleet to see how guaranteed seats, live GPS radar, and digital QR passes keep university students safe and punctually connected.
          </p>
        </div>

        {/* Live Simulator Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold self-stretch md:self-auto justify-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Interactive Sandbox Active</span>
        </div>
      </div>

      {/* Feature Tab Selectors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <button
          onClick={() => setActiveTab("radar")}
          className={`p-2.5 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 sm:gap-3 ${
            activeTab === "radar"
              ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/25 scale-[1.01] sm:scale-[1.02]"
              : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-1.5 sm:p-2 rounded-xl ${activeTab === "radar" ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"}`}>
              <Navigation className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-md ${activeTab === "radar" ? "bg-white/20 text-white" : "bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
              Telemetry
            </span>
          </div>
          <div>
            <div className="font-black text-xs sm:text-sm leading-tight">1. Live Bus Radar</div>
            <div className={`text-[10px] sm:text-[11px] line-clamp-1 mt-0.5 ${activeTab === "radar" ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>
              Metro-style progress & ETA
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("seats")}
          className={`p-2.5 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 sm:gap-3 ${
            activeTab === "seats"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/25 scale-[1.01] sm:scale-[1.02]"
              : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-1.5 sm:p-2 rounded-xl ${activeTab === "seats" ? "bg-white/20 text-white" : "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400"}`}>
              <BusFront className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-md ${activeTab === "seats" ? "bg-white/20 text-white" : "bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
              redBus UI
            </span>
          </div>
          <div>
            <div className="font-black text-xs sm:text-sm leading-tight">2. Seat Booking</div>
            <div className={`text-[10px] sm:text-[11px] line-clamp-1 mt-0.5 ${activeTab === "seats" ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
              Clickable 2x2 & Waitlist
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("qr")}
          className={`p-2.5 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 sm:gap-3 ${
            activeTab === "qr"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-600/25 scale-[1.01] sm:scale-[1.02]"
              : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-1.5 sm:p-2 rounded-xl ${activeTab === "qr" ? "bg-white/20 text-white" : "bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"}`}>
              <QrCode className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-md ${activeTab === "qr" ? "bg-white/20 text-white" : "bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
              Anti-Fraud
            </span>
          </div>
          <div>
            <div className="font-black text-xs sm:text-sm leading-tight">3. Digital QR Pass</div>
            <div className={`text-[10px] sm:text-[11px] line-clamp-1 mt-0.5 ${activeTab === "qr" ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>
              Holographic token & scan
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`p-2.5 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 sm:gap-3 ${
            activeTab === "billing"
              ? "bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/25 scale-[1.01] sm:scale-[1.02]"
              : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className={`p-1.5 sm:p-2 rounded-xl ${activeTab === "billing" ? "bg-white/20 text-white" : "bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400"}`}>
              <CreditCard className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
            <span className={`text-[9px] sm:text-[10px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-md ${activeTab === "billing" ? "bg-white/20 text-white" : "bg-slate-200/60 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
              Pass Billing
            </span>
          </div>
          <div>
            <div className="font-black text-xs sm:text-sm leading-tight">4. Zone Passes & UPI</div>
            <div className={`text-[10px] sm:text-[11px] line-clamp-1 mt-0.5 ${activeTab === "billing" ? "text-purple-100" : "text-slate-500 dark:text-slate-400"}`}>
              Corridor fee & UPI QR
            </div>
          </div>
        </button>
      </div>

      {/* Interactive Display Canvas */}
      <div className="bg-slate-50/70 dark:bg-slate-950/60 rounded-3xl border border-slate-200/70 dark:border-slate-800/80 p-3.5 sm:p-6 lg:p-8 overflow-hidden min-h-[440px] flex flex-col justify-center">
        
        {/* TAB 1: LIVE RADAR SIMULATOR */}
        {activeTab === "radar" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Telemetry HUD Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black flex-shrink-0">
                  <BusFront className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">Bus UK-04-TA-1829</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      ON SCHEDULE
                    </span>
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Route 1: Haldwani - Kathgodam - Bhimtal Express</div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                <div className="text-left sm:text-right">
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase">NEXT STATION ETA</div>
                  <div className="text-base sm:text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                    {Math.floor(etaSeconds / 60)}m {etaSeconds % 60}s
                  </div>
                </div>
                <button
                  onClick={() => setIsBusMoving(!isBusMoving)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
                >
                  {isBusMoving ? "Pause Radar" : "Resume Radar"}
                </button>
              </div>
            </div>

            {/* Delhi Metro-Style Interactive Stop Progression */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider">METRO TRANSIT PROGRESSION LINE</span>
                <span className="flex items-center gap-1.5 text-blue-600 font-mono text-[10px] sm:text-xs">
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  15s Satellite Refresh
                </span>
              </div>

              {/* Desktop / Tablet: Clean Horizontal Track with Station Circles */}
              <div className="hidden sm:block space-y-4 pt-2">
                <div className="relative flex items-center justify-between px-6 sm:px-12">
                  {/* The Background Line (Behind the circles, perfectly centered) */}
                  <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-400 w-1/2 rounded-full transition-all duration-700" />
                  </div>

                  {/* 5 Distinct Station Dots */}
                  {stops.map((stop, i) => (
                    <div key={i} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full border-4 flex items-center justify-center transition-all ${
                          stop.passed
                            ? "bg-blue-600 border-white dark:border-slate-900 text-white shadow-md"
                            : stop.current
                            ? "bg-white dark:bg-slate-900 border-blue-600 text-blue-600 ring-4 ring-blue-500/25 scale-125 shadow-xl animate-pulse"
                            : "bg-slate-100 dark:bg-slate-800 border-white dark:border-slate-900 text-slate-400"
                        }`}
                      >
                        {stop.passed ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : stop.current ? (
                          <BusFront className="w-4 h-4" />
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Station Labels Row (Below track) */}
                <div className="grid grid-cols-5 gap-2 text-center pt-2">
                  {stops.map((stop, i) => (
                    <div key={i} className="space-y-1">
                      <div
                        className={`text-xs font-bold leading-snug px-1 ${
                          stop.current ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {stop.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{stop.time}</div>
                      <span
                        className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          stop.current
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {stop.dist}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile: Vertical Station Timeline (Zero horizontal squishing, 100% responsive on smartphones) */}
              <div className="sm:hidden space-y-2 py-1">
                {stops.map((stop, i) => (
                  <div key={i} className="relative flex items-start gap-3 pl-1">
                    {/* Vertical Connector Line between stations */}
                    {i < stops.length - 1 && (
                      <div className={`absolute left-[17px] top-6 bottom-[-8px] w-0.5 ${
                        stop.passed ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                      }`} />
                    )}

                    {/* Station Node Icon */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                          stop.passed
                            ? "bg-blue-600 border-white dark:border-slate-900 text-white shadow-2xs"
                            : stop.current
                            ? "bg-white dark:bg-slate-900 border-blue-600 text-blue-600 ring-2 ring-blue-500/30 scale-110 shadow-sm animate-pulse"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                        }`}
                      >
                        {stop.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : stop.current ? (
                          <BusFront className="w-3.5 h-3.5" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                        )}
                      </div>
                    </div>

                    {/* Station Information */}
                    <div className="flex-1 min-w-0 pb-2.5 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60">
                      <div className="min-w-0">
                        <div className={`text-xs font-bold truncate ${
                          stop.current ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-800 dark:text-slate-200"
                        }`}>
                          {stop.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {stop.time}
                        </div>
                      </div>

                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
                        stop.current
                          ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          : stop.passed
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}>
                        {stop.dist}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Student & Parent Notification Ribbon */}
              <div className="p-3 sm:p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-medium leading-tight">
                  <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>
                    <strong>Parent Radar SMS Alert:</strong> Bus departed Haldwani Tikonia at 07:20 AM. Student onboard.
                  </span>
                </div>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold whitespace-nowrap self-end sm:self-auto">
                  Delivered to +91 99*** 43210
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REDBUS-STYLE SEAT SELECTOR SIMULATOR */}
        {activeTab === "seats" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Shift & Capacity Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Commute Shift:</span>
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    onClick={() => setSelectedShift("morning")}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedShift === "morning"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Morning 07:30 AM
                  </button>
                  <button
                    onClick={() => setSelectedShift("evening")}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedShift === "evening"
                        ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Evening 04:30 PM
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] sm:text-xs font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded bg-indigo-600 text-white flex items-center justify-center text-[8px] sm:text-[9px]">✓</span>
                  <span>Your Pick</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded bg-slate-300 dark:bg-slate-700 opacity-60" />
                  <span>Booked</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-center">
              {/* Bus Chassis Visualization (Clean 2x2 with central aisle) */}
              <div className="md:col-span-7 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center w-full min-w-0">
                
                {/* Windshield & Driver Cabin Header */}
                <div className="w-full max-w-[280px] sm:max-w-[340px] pb-2.5 sm:pb-3 mb-3 sm:mb-4 border-b-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] sm:text-xs text-slate-500 font-bold px-1 sm:px-3">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Passenger Door</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-mono text-[10px] sm:text-[11px] bg-slate-100 dark:bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg">
                    <Disc className="w-3.5 h-3.5 text-slate-500" />
                    <span>STEERING / DRIVER</span>
                  </div>
                </div>

                {/* 2x2 Clean Bus Row Layout */}
                <div className="w-full max-w-[280px] sm:max-w-[340px] space-y-2 sm:space-y-2.5">
                  {seatRows.map(rowObj => (
                    <div key={rowObj.row} className="flex items-center justify-between gap-1.5 sm:gap-2">
                      {/* Left Pair (Window, Aisle) */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {rowObj.left.map(seat => {
                          const isBooked = bookedSeats.has(seat.id);
                          const isSelected = selectedSeat === seat.id;
                          return (
                            <button
                              key={seat.id}
                              disabled={isBooked}
                              onClick={() => setSelectedSeat(seat.id)}
                              className={`w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-11 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex flex-col items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-md sm:shadow-lg shadow-indigo-600/30 scale-105 ring-2 ring-indigo-400"
                                  : isBooked
                                  ? "bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed border border-slate-200/50 dark:border-slate-800"
                                  : "bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              <span>{seat.label}</span>
                              <span className="text-[7px] sm:text-[8px] opacity-75 font-mono">
                                {seat.window ? "WIN" : "AIS"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Central Walking Aisle */}
                      <div className="flex-1 flex items-center justify-center px-1">
                        <div className="h-5 sm:h-6 w-full border-b border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center">
                          <span className="text-[8px] sm:text-[9px] text-slate-300 dark:text-slate-600 font-mono uppercase tracking-wider sm:tracking-widest">
                            AISLE
                          </span>
                        </div>
                      </div>

                      {/* Right Pair (Aisle, Window) */}
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {rowObj.right.map(seat => {
                          const isBooked = bookedSeats.has(seat.id);
                          const isSelected = selectedSeat === seat.id;
                          return (
                            <button
                              key={seat.id}
                              disabled={isBooked}
                              onClick={() => setSelectedSeat(seat.id)}
                              className={`w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-11 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs flex flex-col items-center justify-center transition-all ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-md sm:shadow-lg shadow-indigo-600/30 scale-105 ring-2 ring-indigo-400"
                                  : isBooked
                                  ? "bg-slate-100 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed border border-slate-200/50 dark:border-slate-800"
                                  : "bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                              }`}
                            >
                              <span>{seat.label}</span>
                              <span className="text-[7px] sm:text-[8px] opacity-75 font-mono">
                                {seat.window ? "WIN" : "AIS"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[9px] sm:text-[10px] text-slate-400 mt-3 sm:mt-4 uppercase tracking-widest font-mono">
                  ← Rear Passenger Emergency Exit →
                </div>
              </div>

              {/* Instant Reservation Status Card */}
              <div className="md:col-span-5 space-y-4 w-full">
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Reservation Status</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      CONFIRMED (CNF)
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">Allocated Seat:</span>
                      <span className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {selectedSeat} (Window)
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      <strong>Bus:</strong> UK-04-TA-1829 • 42 Seater AC Deluxe
                    </div>
                  </div>

                  {/* Railway-style waitlist explanation */}
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      Zero Overcrowding Guarantee:
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                      If capacity reaches 42/42, subsequent bookings receive <strong>WL-01, WL-02</strong>. When an enrolled student cancels, waitlisted students are automatically promoted with SMS alerts!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CRYPTOGRAPHIC DIGITAL QR PASS SIMULATOR */}
        {activeTab === "qr" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-xl mx-auto w-full">
            {/* Holographic Security Pass */}
            <div className="relative rounded-3xl p-4 sm:p-6 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white shadow-2xl border border-blue-500/30 overflow-hidden">
              {/* Glowing Background Radial */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 flex items-center justify-center font-black flex-shrink-0">
                    <BusFront className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-[11px] sm:text-xs font-black tracking-wider uppercase">CampusFleet Pass</div>
                    <div className="text-[9px] sm:text-[10px] text-blue-300 font-mono">GEHU Bhimtal</div>
                  </div>
                </div>
                <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
                  ACTIVE COMMUTER
                </span>
              </div>

              {/* Student Identity + QR Layout */}
              <div className="py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                {/* Student Info */}
                <div className="space-y-2 sm:space-y-3 text-center sm:text-left flex-1">
                  <div>
                    <div className="text-lg sm:text-xl font-black">Parth Dalakoti</div>
                    <div className="text-[11px] sm:text-xs text-blue-200 font-mono">Enrollment: PV-23620010</div>
                  </div>

                  <div className="text-xs space-y-1 text-slate-300">
                    <div><strong>Dept:</strong> B.Tech CSE (7th Sem)</div>
                    <div><strong>Zone:</strong> Zone B (Haldwani - Bhimtal)</div>
                    <div><strong>Seat:</strong> Morning 07:20 AM (#3A)</div>
                  </div>
                </div>

                {/* Simulated Cryptographic QR Code */}
                <div className="relative p-3 sm:p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center space-y-1 flex-shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 bg-slate-900 rounded-xl p-2 flex items-center justify-center relative overflow-hidden">
                    <QrCode className="w-24 h-24 sm:w-28 sm:h-28 text-white" />
                    {/* Pulsing scanning beam */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                  </div>
                  <div className="text-[8px] sm:text-[9px] font-mono text-slate-500 font-bold">
                    HMAC-SHA256 ROTATING
                  </div>
                </div>
              </div>

              {/* Dynamic Live Timestamp Token */}
              <div className="border-t border-white/10 pt-3 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE KEY: CF-{qrTimestamp.toString().slice(-6)}
                </span>
                <span>Anti-Counterfeit Protection</span>
              </div>
            </div>

            {/* Simulate Conductor Optical Scanner Action */}
            <div className="text-center space-y-2.5 sm:space-y-3">
              <button
                onClick={handleSimulateScan}
                disabled={scanStatus === "scanning"}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 mx-auto transition-all active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span>
                  {scanStatus === "scanning"
                    ? "Verifying Rotating Token..."
                    : scanStatus === "verified"
                    ? "✓ Boarding Authorized by Conductor"
                    : "Simulate Conductor QR Scan"}
                </span>
              </button>

              {scanStatus === "verified" && (
                <div className="p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs space-y-1 animate-in zoom-in-95">
                  <div className="font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>BOARDING VERIFIED: Parth Dalakoti (#3A) • Route 1</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center">
                    Instant Parent SMS sent to Manoj Kumar Dalakoti (+91 99176 94307). Attendance logged.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ZONE PASS & UPI BILLING SIMULATOR */}
        {activeTab === "billing" && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl mx-auto w-full">
            <div className="text-center space-y-1">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Transparent Transit Fees & Instant UPI Activation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No long queues at the university accounts window. Select your residential corridor, pay via any UPI app, and unlock your digital pass.
              </p>
            </div>

            {/* Zone Selector Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {(Object.keys(zones) as Array<keyof typeof zones>).map(key => {
                const z = zones[key];
                const isSelected = selectedZone === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedZone(key)}
                    className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20 scale-[1.01] sm:scale-[1.02]"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">{z.name}</div>
                    <div className={`text-base sm:text-lg font-black font-mono mt-1 ${isSelected ? "text-white" : "text-purple-600 dark:text-purple-400"}`}>
                      ₹{z.fee.toLocaleString()}
                    </div>
                    <div className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? "text-purple-200" : "text-slate-400"}`}>
                      {z.coverage}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pricing Breakdown & Installment Option */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">{activeZoneInfo.name}</div>
                  <div className="text-[11px] sm:text-xs text-slate-400">Semester Transit Subscription (Includes Morning + Evening)</div>
                </div>

                <div className="text-left sm:text-right pt-1 sm:pt-0">
                  <div className="text-[10px] sm:text-xs text-slate-400 line-through">₹{(activeZoneInfo.fee + 2000).toLocaleString()}</div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                    ₹{isInstallment ? activeZoneInfo.installment.toLocaleString() : activeZoneInfo.fee.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Installment Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 leading-snug">
                  Pay in 2 Installments (₹{activeZoneInfo.installment.toLocaleString()} today, balance in 60 days)
                </span>
                <button
                  onClick={() => setIsInstallment(!isInstallment)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 flex-shrink-0 ${
                    isInstallment ? "bg-purple-600" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                      isInstallment ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* UPI Demo Trigger */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Official GEHU University UPI Verified</span>
                </div>

                <button
                  onClick={() => setIsUpiModalOpen(!isUpiModalOpen)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 text-center"
                >
                  {isUpiModalOpen ? "Close UPI QR Demo" : "View University UPI QR Demo →"}
                </button>
              </div>

              {/* UPI QR Modal Demonstration */}
              {isUpiModalOpen && (
                <div className="p-4 sm:p-5 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/60 flex flex-col sm:flex-row items-center gap-4 sm:gap-5 animate-in fade-in">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white p-2 sm:p-2.5 rounded-2xl border border-purple-300 shadow-md flex items-center justify-center flex-shrink-0 relative">
                    <QrCode className="w-24 h-24 sm:w-28 sm:h-28 text-slate-900" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-[8px] sm:text-[9px] shadow-sm">
                        GEHU
                      </div>
                    </div>
                  </div>

                  <div className="text-xs space-y-2 text-center sm:text-left flex-1 w-full">
                    <div className="font-black text-purple-900 dark:text-purple-200 text-xs sm:text-sm">
                      Scan with Google Pay, PhonePe, Paytm, or BHIM
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
                      Official VPA: <code className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 font-bold font-mono">gehu.transport@sbi</code>
                    </div>
                    
                    {!paymentDone ? (
                      <button
                        onClick={handleSimulatePayment}
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 mx-auto sm:mx-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Simulate 1-Tap UPI Payment</span>
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Payment Verified! Digital Pass Instantly Unlocked.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


