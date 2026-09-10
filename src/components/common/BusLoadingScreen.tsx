"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BusLoadingScreenProps {
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
  compact?: boolean;
}

const DEFAULT_MESSAGES = [
  "Connecting to CampusFleet Realtime Database...",
  "Fetching Live GPS Coordinates & Route Schedules...",
  "Synchronizing Institutional Passes & Seat Manifests...",
  "Optimizing Smart Multi-Stop Campus Transit...",
  "Preparing High-Precision Commuter Dashboard...",
];

export default function BusLoadingScreen({
  message,
  subtitle = "Graphic Era Hill University Smart Fleet Gateway",
  fullScreen = true,
  compact = false,
}: BusLoadingScreenProps) {
  const [activeMessageIdx, setActiveMessageIdx] = useState(0);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setActiveMessageIdx((prev) => (prev + 1) % DEFAULT_MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [message]);

  const currentMessage = message || DEFAULT_MESSAGES[activeMessageIdx];

  const content = (
    <div className={`relative flex flex-col items-center justify-center select-none text-center ${compact ? "p-6" : "p-8 max-w-lg w-full"}`}>
      {/* Background Ambient Glow (Warm Golden Yellow) */}
      <div className="absolute -top-12 -bottom-12 -left-12 -right-12 bg-gradient-to-b from-amber-500/15 via-yellow-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Animation Stage */}
      <div className="relative w-full flex flex-col items-center justify-center overflow-hidden mb-6 py-4">
        {/* Speed lines in background */}
        <div className="absolute inset-0 flex flex-col justify-around opacity-30 pointer-events-none">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
            className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ repeat: Infinity, duration: 0.85, ease: "linear", delay: 0.25 }}
            className="w-40 h-0.5 bg-gradient-to-r from-transparent via-yellow-400 to-transparent rounded-full"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ repeat: Infinity, duration: 1.3, ease: "linear", delay: 0.55 }}
            className="w-32 h-0.5 bg-gradient-to-r from-transparent via-orange-400 to-transparent rounded-full"
          />
        </div>

        {/* The Animated Indian College Yellow Bus */}
        <motion.div
          animate={{
            y: [0, -3.5, 0, -2, 0],
            rotate: [0, -0.4, 0, 0.4, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: "easeInOut",
          }}
          className="relative z-10 flex items-center justify-center"
        >
          {/* Headlight beam casting forward onto road */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-36 h-24 pointer-events-none opacity-50"
            style={{
              background: "radial-gradient(ellipse at left, rgba(253, 224, 71, 0.85) 0%, rgba(245, 158, 11, 0.25) 50%, transparent 80%)",
              transform: "translate(88%, -15%) rotate(5deg)",
              filter: "blur(5px)",
            }}
          />

          {/* SVG Iconic Indian Institutional Yellow Bus */}
          <svg
            className={compact ? "w-36 h-20" : "w-52 h-28"}
            viewBox="0 0 240 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Iconic Indian School/College Bus Chrome Golden Yellow Gradient */}
              <linearGradient id="busYellowBodyGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="40%" stopColor="#f59e0b" />
                <stop offset="85%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>

              {/* Tinted Window Glass */}
              <linearGradient id="windowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>

              {/* Iconic University Navy Belt Stripe */}
              <linearGradient id="navyStripeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="50%" stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>

              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {/* Bus Shadow */}
            <ellipse cx="120" cy="110" rx="92" ry="6" fill="#000000" fillOpacity="0.45" filter="blur(4px)" />

            {/* Bus Body — Golden Yellow */}
            <path
              d="M 30 90 L 30 42 C 30 30 38 24 50 24 L 180 24 C 200 24 214 34 218 52 L 222 75 C 224 82 220 90 212 90 Z"
              fill="url(#busYellowBodyGrad)"
              stroke="#b45309"
              strokeWidth="2.5"
            />

            {/* Front Bumper & Grill Accent */}
            <path d="M 215 78 L 223 78 C 225 84 222 90 215 90 Z" fill="#1e293b" />
            <line x1="216" y1="83" x2="221" y2="83" stroke="#94a3b8" strokeWidth="1" />
            <line x1="216" y1="86" x2="220" y2="86" stroke="#94a3b8" strokeWidth="1" />

            {/* Rear Bumper */}
            <rect x="28" y="80" width="4" height="10" rx="2" fill="#1e293b" />

            {/* Aerodynamic White Roof AC Unit */}
            <rect x="70" y="18" width="80" height="7" rx="3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            <line x1="80" y1="21" x2="140" y2="21" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />

            {/* Front Windshield */}
            <path
              d="M 172 32 L 195 32 C 205 32 212 40 214 50 L 172 50 Z"
              fill="url(#windowGrad)"
              stroke="#475569"
              strokeWidth="1.5"
            />

            {/* Passenger Windows (with window divider pillars) */}
            <rect x="42" y="32" width="26" height="20" rx="3" fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />
            <rect x="74" y="32" width="28" height="20" rx="3" fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />
            <rect x="108" y="32" width="28" height="20" rx="3" fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />
            <rect x="142" y="32" width="24" height="20" rx="3" fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />

            {/* Destination LED Board (Front Header) */}
            <rect x="175" y="27" width="28" height="4" rx="1" fill="#0f172a" />
            <line x1="178" y1="29" x2="200" y2="29" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />

            {/* Iconic Indian University Navy Belt Stripe */}
            <path d="M 30 63 L 218 63 L 220 73 L 30 73 Z" fill="url(#navyStripeGrad)" stroke="#0f172a" strokeWidth="0.5" />

            {/* Official GEHU CAMPUSFLEET Lettering on the Belt */}
            <text x="68" y="70.5" fill="#ffffff" fontSize="6.5" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.12em">
              GEHU CAMPUSFLEET
            </text>

            {/* Dual Headlights (Bright Glowing Xenon Yellow) */}
            <circle cx="218" cy="80" r="4.5" fill="#fef08a" filter="url(#glowEffect)" />
            <circle cx="218" cy="80" r="3" fill="#ffffff" />

            {/* Taillight (Red LED Glow) */}
            <rect x="29" y="74" width="3" height="9" rx="1" fill="#ef4444" filter="url(#glowEffect)" />

            {/* Wheel Arches */}
            <path d="M 60 90 A 16 16 0 0 1 92 90 Z" fill="#0b0f17" />
            <path d="M 160 90 A 16 16 0 0 1 192 90 Z" fill="#0b0f17" />

            {/* Front Wheel (Heavy-Duty Truck Rim) */}
            <g transform="translate(176, 90)">
              <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#475569" strokeWidth="2" />
              <circle cx="0" cy="0" r="7" fill="#334155" />
              {/* Spinning wheel spokes */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.55, ease: "linear" }}
              >
                <line x1="-10" y1="0" x2="10" y2="0" stroke="#f59e0b" strokeWidth="1.8" />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="#f59e0b" strokeWidth="1.8" />
              </motion.g>
              <circle cx="0" cy="0" r="3.5" fill="#fbbf24" />
            </g>

            {/* Rear Wheel (Heavy-Duty Truck Rim) */}
            <g transform="translate(76, 90)">
              <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#475569" strokeWidth="2" />
              <circle cx="0" cy="0" r="7" fill="#334155" />
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.55, ease: "linear" }}
              >
                <line x1="-10" y1="0" x2="10" y2="0" stroke="#f59e0b" strokeWidth="1.8" />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="#f59e0b" strokeWidth="1.8" />
              </motion.g>
              <circle cx="0" cy="0" r="3.5" fill="#fbbf24" />
            </g>

            {/* Indian Regulatory Emergency Exit Decal */}
            <text x="34" y="60" fill="#991b1b" fontSize="4.5" fontWeight="900" fontFamily="sans-serif">
              EMERGENCY
            </text>
          </svg>
        </motion.div>

        {/* Animated Road with Scrolling Yellow Highway Markers */}
        <div className="relative w-4/5 h-4 mt-[-4px] overflow-hidden flex items-center justify-center">
          {/* Road Asphalt */}
          <div className="absolute inset-0 bg-slate-800 dark:bg-slate-900 border-t border-slate-700/60 rounded-full" />

          {/* Scrolling Dashes */}
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: -120 }}
            transition={{ repeat: Infinity, duration: 0.75, ease: "linear" }}
            className="flex space-x-6 whitespace-nowrap"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="inline-block w-6 h-1 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Modern Golden Amber Progress Bar */}
      <div className="w-full max-w-xs h-1.5 bg-slate-200 dark:bg-slate-800/80 rounded-full overflow-hidden mb-5 border border-slate-300/40 dark:border-slate-700/50 shadow-inner">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.9)]"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.7,
            ease: "easeInOut",
          }}
          style={{ width: "60%" }}
        />
      </div>

      {/* Dynamic Status Text */}
      <div className="min-h-[48px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight"
          >
            {currentMessage}
          </motion.p>
        </AnimatePresence>

        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium tracking-wide">
            {subtitle}
          </p>
        )}
      </div>

      {/* Institutional Yellow Telemetry Badge */}
      <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        Live Database Sync • 60 FPS Telemetry
      </div>
    </div>
  );

  if (!fullScreen) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/90 dark:bg-[#070b14]/95 backdrop-blur-md transition-colors">
      {content}
    </div>
  );
}
