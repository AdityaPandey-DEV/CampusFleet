"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BusLoadingScreenProps {
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
  compact?: boolean;
}

const TRANSIT_DISPATCH_MESSAGES = [
  "Synchronizing corridor schedules...",
  "Connecting to Campus Telematics Gateway...",
  "Calibrating real-time GPS fleet positions...",
  "Validating digital manifests and bookings...",
  "Optimizing campus transit routing...",
];

export default function BusLoadingScreen({
  message,
  subtitle = "Smart Fleet Gateway",
  fullScreen = true,
  compact = false,
}: BusLoadingScreenProps) {
  const [activeMessageIdx, setActiveMessageIdx] = useState(0);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setActiveMessageIdx((prev) => (prev + 1) % TRANSIT_DISPATCH_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [message]);

  const currentMessage = message || TRANSIT_DISPATCH_MESSAGES[activeMessageIdx];

  const content = (
    <div
      className={`flex flex-col items-center justify-center select-none text-center ${
        compact ? "p-4" : "p-8 w-full max-w-md"
      }`}
    >
      {/* ── Dynamic Bus Animation Stage ────────────────────────────── */}
      <div className="relative w-64 h-28 flex flex-col items-center justify-end overflow-hidden">
        {/* Speed Wind Streaks (Top & Rear) */}
        <div className="absolute top-4 left-0 right-0 h-6 pointer-events-none overflow-hidden opacity-60">
          <div className="animate-wind-streak-1 absolute h-[1.5px] w-12 bg-gradient-to-r from-transparent via-emerald-400 to-transparent top-1" />
          <div className="animate-wind-streak-2 absolute h-[1px] w-16 bg-gradient-to-r from-transparent via-cyan-400 to-transparent top-3" />
        </div>

        {/* Bouncing Bus Container */}
        <div className="relative z-10 animate-bus-bounce origin-bottom mb-2">
          {/* Headlight Beam Cone (projects forward to the right) */}
          <div className="absolute -right-16 top-6 w-20 h-10 bg-gradient-to-r from-amber-300/35 via-amber-200/10 to-transparent clip-headlight pointer-events-none" />

          {/* Bus SVG Illustration */}
          <svg
            width="170"
            height="68"
            viewBox="0 0 170 68"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            {/* Bus Roof AC / Telematics Dome */}
            <rect x="52" y="5" width="56" height="5" rx="2.5" fill="#10B981" />
            <rect x="58" y="3" width="14" height="3" rx="1.5" fill="#047857" />
            <circle cx="102" cy="7" r="1.5" fill="#34D399" className="animate-pulse" />

            {/* Main Bus Chassis */}
            <path
              d="M12 10C12 7.79086 13.7909 6 16 6H144C154 6 162 13 164 22L167 40C168 44 165 48 160 48H12C8.68629 48 6 45.3137 6 42V16C6 12.6863 8.68629 10 12 10Z"
              className="fill-emerald-600 dark:fill-emerald-500"
            />

            {/* Lower Chassis Two-Tone Accent Stripe */}
            <path
              d="M6 38H167L164 45C163 47 161 48 159 48H12C8.68629 48 6 45.3137 6 42V38Z"
              className="fill-slate-900 dark:fill-slate-950"
            />

            {/* University Gold Livery Ribbon */}
            <rect x="6" y="34" width="160" height="3.5" fill="#F59E0B" />

            {/* LED Destination Marquee Board */}
            <rect x="135" y="10" width="22" height="6" rx="1" fill="#18181B" />
            <rect x="137" y="11.5" width="18" height="3" rx="0.5" fill="#FBBF24" className="animate-pulse" />

            {/* Front Windshield with Aerodynamic Slope */}
            <path
              d="M136 17H160L163 32H136V17Z"
              fill="#0F172A"
              fillOpacity="0.85"
            />
            {/* Windshield Glass Specular Shine */}
            <path
              d="M142 19L155 31H150L139 19H142Z"
              fill="white"
              fillOpacity="0.3"
            />

            {/* Passenger Side Windows */}
            <rect x="16" y="15" width="22" height="15" rx="2" fill="#0F172A" fillOpacity="0.75" />
            <rect x="42" y="15" width="26" height="15" rx="2" fill="#0F172A" fillOpacity="0.75" />
            <rect x="72" y="15" width="26" height="15" rx="2" fill="#0F172A" fillOpacity="0.75" />
            <rect x="102" y="15" width="28" height="15" rx="2" fill="#0F172A" fillOpacity="0.75" />

            {/* Window Tint Reflections */}
            <line x1="20" y1="16" x2="34" y2="29" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="46" y1="16" x2="64" y2="29" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="76" y1="16" x2="94" y2="29" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="106" y1="16" x2="126" y2="29" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />

            {/* Door Outline */}
            <rect x="102" y="15" width="14" height="31" rx="1" stroke="#334155" strokeWidth="0.8" fill="none" />

            {/* Front Headlight (Warm Amber Glow) */}
            <path d="M166 38L168 42H165L164 38H166Z" fill="#FEF08A" />
            <circle cx="166" cy="40" r="2.5" fill="#FBBF24" />

            {/* Rear Taillight (Red LED) */}
            <rect x="5" y="38" width="2" height="5" rx="0.5" fill="#EF4444" />
            <circle cx="6" cy="40" r="1.5" fill="#F87171" className="animate-ping" style={{ animationDuration: '1.2s' }} />

            {/* Wheel Arches (Fenders) */}
            <path d="M26 48C26 41 33 36 41 36C49 36 56 41 56 48H26Z" className="fill-slate-900 dark:fill-black" />
            <path d="M118 48C118 41 125 36 133 36C141 36 148 41 148 48H118Z" className="fill-slate-900 dark:fill-black" />

            {/* Rear Wheel (Spinning) */}
            <g transform="translate(41, 48)">
              <circle cx="0" cy="0" r="11" fill="#1E293B" />
              <circle cx="0" cy="0" r="8.5" fill="#334155" />
              <circle cx="0" cy="0" r="4.5" fill="#64748B" />
              <g className="animate-wheel-spin origin-center">
                <line x1="-7" y1="0" x2="7" y2="0" stroke="#CBD5E1" strokeWidth="1.5" />
                <line x1="0" y1="-7" x2="0" y2="7" stroke="#CBD5E1" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="2" fill="#F8FAFC" />
              </g>
            </g>

            {/* Front Wheel (Spinning) */}
            <g transform="translate(133, 48)">
              <circle cx="0" cy="0" r="11" fill="#1E293B" />
              <circle cx="0" cy="0" r="8.5" fill="#334155" />
              <circle cx="0" cy="0" r="4.5" fill="#64748B" />
              <g className="animate-wheel-spin origin-center">
                <line x1="-7" y1="0" x2="7" y2="0" stroke="#CBD5E1" strokeWidth="1.5" />
                <line x1="0" y1="-7" x2="0" y2="7" stroke="#CBD5E1" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="2" fill="#F8FAFC" />
              </g>
            </g>
          </svg>
        </div>

        {/* ── Asphalt Road Track with Scrolling Dashes ──────────────── */}
        <div className="relative w-full h-3 flex items-center justify-center overflow-hidden">
          {/* Road Surface */}
          <div className="absolute inset-0 bg-slate-300 dark:bg-slate-800 rounded-full" />
          {/* Upper Curb Line */}
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-slate-400 dark:bg-slate-700" />
          {/* Infinite Scrolling White Lane Markers */}
          <div className="absolute inset-0 flex items-center overflow-hidden">
            <div className="flex gap-4 w-[200%] animate-road-scroll">
              {Array.from({ length: 16 }).map((_, idx) => (
                <span
                  key={idx}
                  className="h-[2px] w-5 bg-white dark:bg-emerald-400 rounded-full shrink-0 opacity-80"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Road Reflection Glow */}
        <div className="w-48 h-1 bg-emerald-500/20 blur-sm rounded-full mt-0.5" />
      </div>

      {/* ── Status Typography & Live Pulse Indicator ──────────────── */}
      <div className="min-h-[56px] mt-4 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMessage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              {currentMessage}
            </p>
          </motion.div>
        </AnimatePresence>

        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 font-medium tracking-wide">
            {subtitle}
          </p>
        )}
      </div>

      {/* ── Precision Micro-Progress Bar ────────────────────────────── */}
      <div className="w-56 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mt-4 overflow-hidden relative shadow-inner">
        <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 rounded-full animate-indeterminate-progress" />
      </div>

      {/* ── Enterprise Badge ────────────────────────────────────────── */}
      <div className="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/15 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live Telematics Pipeline
      </div>
    </div>
  );

  if (!fullScreen) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md transition-colors">
      {content}
    </div>
  );
}
