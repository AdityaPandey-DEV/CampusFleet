"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface BusLoadingScreenProps {
  message?: string;
  subtitle?: string;
  fullScreen?: boolean;
  compact?: boolean;
}

const DEFAULT_MESSAGES = [
  "Connecting to database...",
  "Fetching live data...",
  "Synchronizing records...",
  "Optimizing dashboard...",
  "Preparing transit system...",
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
      setActiveMessageIdx((prev) => (prev + 1) % DEFAULT_MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [message]);

  const currentMessage = message || DEFAULT_MESSAGES[activeMessageIdx];

  const content = (
    <div className={`flex flex-col items-center justify-center select-none text-center ${compact ? "p-4" : "p-8 w-full max-w-sm"}`}>

      {/* Flat Minimalist Spinner */}
      <div className="mb-6">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>

      {/* Dynamic Status Text */}
      <div className="min-h-[48px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-medium text-gray-900 dark:text-gray-100 tracking-tight"
          >
            {currentMessage}
          </motion.p>
        </AnimatePresence>

        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {subtitle}
          </p>
        )}
      </div>

      {/* Simple Status Indicator */}
      <div className="mt-8 flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[11px] text-gray-600 dark:text-gray-400 uppercase tracking-widest">
        <span className="w-1.5 h-1.5 bg-green-600" />
        System Live
      </div>
    </div>
  );

  if (!fullScreen) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-black transition-colors">
      {content}
    </div>
  );
}
