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
      {/* Background Ambient Glow */}
      <div className="absolute -top-12 -bottom-12 -left-12 -right-12 bg-gradient-to-b from-blue-600/10 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Animation Stage */}
      <div className="relative w-full flex flex-col items-center justify-center overflow-hidden mb-6 py-4">
        {/* Speed lines in background */}
        <div className="absolute inset-0 flex flex-col justify-around opacity-25 pointer-events-none">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className="w-24 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "linear", delay: 0.3 }}
            className="w-40 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent rounded-full"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: "-100%" }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "linear", delay: 0.6 }}
            className="w-32 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full"
          />
        </div>

        {/* The Animated Bus and Light Beam */}
        <motion.div
          animate={{
            y: [0, -3, 0, -2, 0],
            rotate: [0, -0.5, 0, 0.5, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.6,
            ease: "easeInOut",
          }}
          className="relative z-10 flex items-center justify-center"
        >
          {/* Headlight beam casting forward */}
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-20 pointer-events-none opacity-40"
            style={{
              background: "radial-gradient(ellipse at left, rgba(96, 165, 250, 0.8) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 80%)",
              transform: "translate(90%, -20%) rotate(4deg)",
              filter: "blur(4px)",
            }}
          />

          {/* Detailed SVG Modern Campus Transit Bus */}
          <svg
            className={compact ? "w-36 h-20" : "w-52 h-28"}
            viewBox="0 0 240 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="busBodyGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="windowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#1e293b" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="stripeGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {/* Bus Shadow */}
            <ellipse cx="120" cy="110" rx="90" ry="6" fill="#000000" fillOpacity="0.4" filter="blur(4px)" />

            {/* Bus Body */}
            <path
              d="M 30 90 L 30 42 C 30 30 38 24 50 24 L 180 24 C 200 24 214 34 218 52 L 222 75 C 224 82 220 90 212 90 Z"
              fill="url(#busBodyGrad)"
              stroke="#60a5fa"
              strokeWidth="2"
            />

            {/* Roof Aerodynamic Ac Unit */}
            <rect x="70" y="18" width="80" height="7" rx="3" fill="#1e293b" stroke="#3b82f6" strokeWidth="1" />

            {/* Front Windshield */}
            <path
              d="M 172 32 L 195 32 C 205 32 212 40 214 50 L 172 50 Z"
              fill="url(#windowGrad)"
              stroke="#60a5fa"
              strokeWidth="1.5"
            />

            {/* Side Windows */}
            <rect x="42" y="32" width="26" height="20" rx="3" fill="url(#windowGrad)" stroke="#38bdf8" strokeWidth="1" />
            <rect x="74" y="32" width="28" height="20" rx="3" fill="url(#windowGrad)" stroke="#38bdf8" strokeWidth="1" />
            <rect x="108" y="32" width="28" height="20" rx="3" fill="url(#windowGrad)" stroke="#38bdf8" strokeWidth="1" />
            <rect x="142" y="32" width="24" height="20" rx="3" fill="url(#windowGrad)" stroke="#38bdf8" strokeWidth="1" />

            {/* Destination LED Board */}
            <rect x="175" y="27" width="28" height="4" rx="1" fill="#0f172a" />
            <line x1="178" y1="29" x2="200" y2="29" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />

            {/* Modern Accent Stripe */}
            <path d="M 30 65 L 218 65 L 220 72 L 30 72 Z" fill="url(#stripeGrad)" opacity="0.9" />

            {/* Headlights (Bright Glowing Yellow/White) */}
            <circle cx="218" cy="80" r="4" fill="#fef08a" filter="url(#glowEffect)" />
            <circle cx="218" cy="80" r="2.5" fill="#ffffff" />

            {/* Taillight (Red Glow) */}
            <rect x="29" y="74" width="3" height="8" rx="1" fill="#ef4444" filter="url(#glowEffect)" />

            {/* Wheel Arches */}
            <path d="M 60 90 A 16 16 0 0 1 92 90 Z" fill="#0b0f17" />
            <path d="M 160 90 A 16 16 0 0 1 192 90 Z" fill="#0b0f17" />

            {/* Front Wheel */}
            <g transform="translate(176, 90)">
              <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#475569" strokeWidth="2" />
              <circle cx="0" cy="0" r="7" fill="#334155" />
              {/* Spinning wheel spokes */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
              >
                <line x1="-10" y1="0" x2="10" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="#94a3b8" strokeWidth="1.5" />
              </motion.g>
              <circle cx="0" cy="0" r="3" fill="#38bdf8" />
            </g>

            {/* Rear Wheel */}
            <g transform="translate(76, 90)">
              <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#475569" strokeWidth="2" />
              <circle cx="0" cy="0" r="7" fill="#334155" />
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
              >
                <line x1="-10" y1="0" x2="10" y2="0" stroke="#94a3b8" strokeWidth="1.5" />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="#94a3b8" strokeWidth="1.5" />
              </motion.g>
              <circle cx="0" cy="0" r="3" fill="#38bdf8" />
            </g>

            {/* Institutional CampusFleet Decal */}
            <text x="82" y="60" fill="#ffffff" fontSize="7" fontWeight="900" fontFamily="sans-serif" letterSpacing="0.08em">
              CAMPUSFLEET
            </text>
          </svg>
        </motion.div>

        {/* Animated Road with Scrolling Lane Markers */}
        <div className="relative w-4/5 h-4 mt-[-4px] overflow-hidden flex items-center justify-center">
          {/* Road Asphalt */}
          <div className="absolute inset-0 bg-slate-800 dark:bg-slate-900 border-t border-slate-700/60 rounded-full" />

          {/* Scrolling Dashes */}
          <motion.div
            initial={{ x: 0 }}
            animate={{ x: -120 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="flex space-x-6 whitespace-nowrap"
          >
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="inline-block w-6 h-1 bg-amber-400/90 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Modern Glowing Progress Bar */}
      <div className="w-full max-w-xs h-1.5 bg-slate-200 dark:bg-slate-800/80 rounded-full overflow-hidden mb-5 border border-slate-300/40 dark:border-slate-700/50 shadow-inner">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.8,
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

      {/* Subtle Telemetry Badge */}
      <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
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
