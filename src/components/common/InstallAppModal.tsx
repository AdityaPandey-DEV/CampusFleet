"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  CheckCircle2,
  Monitor,
  Zap,
  Radio,
  QrCode,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  canInstallNative?: boolean;
  onPromptInstall?: () => Promise<"accepted" | "dismissed" | "modal_needed">;
  isIOS?: boolean;
  isAndroid?: boolean;
}

export function InstallAppModal({
  isOpen,
  onClose,
  canInstallNative = false,
  onPromptInstall,
  isIOS = false,
  isAndroid = false,
}: InstallAppModalProps) {
  // Default tab based on device detection
  const [selectedTab, setSelectedTab] = useState<"ios" | "android" | "desktop">(
    isIOS ? "ios" : isAndroid ? "android" : "desktop"
  );
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    if (isIOS) setSelectedTab("ios");
    else if (isAndroid) setSelectedTab("android");
    else setSelectedTab("desktop");
  }, [isIOS, isAndroid]);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (!onPromptInstall) return;
    setIsInstalling(true);
    const result = await onPromptInstall();
    setIsInstalling(false);
    if (result === "accepted") {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header with App Brand Banner */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-5 sm:p-6 overflow-hidden">
          {/* Ambient blur glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-white text-blue-600 p-2 shadow-lg flex items-center justify-center font-black flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-blue-600">
                <path d="M4 6 2 7" />
                <path d="M10 6h4" />
                <path d="m22 7-2-1" />
                <rect width="16" height="16" x="4" y="3" rx="2" />
                <path d="M4 11h16" />
                <path d="M8 15h.01" />
                <path d="M16 15h.01" />
                <path d="M6 19v2" />
                <path d="M18 21v-2" />
              </svg>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span>Progressive Web App</span>
              </div>
              <h3 className="text-xl font-black tracking-tight leading-tight mt-1">
                Install CampusFleet
              </h3>
              <p className="text-xs text-blue-100">
                Guaranteed seat reservations & live bus radar on your home screen
              </p>
            </div>
          </div>
        </div>

        {/* Device Switcher Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-1.5 gap-1.5 text-xs font-bold">
          <button
            onClick={() => setSelectedTab("ios")}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              selectedTab === "ios"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Apple iOS</span>
          </button>
          <button
            onClick={() => setSelectedTab("android")}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              selectedTab === "android"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Android</span>
          </button>
          <button
            onClick={() => setSelectedTab("desktop")}
            className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              selectedTab === "desktop"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>PC / Mac</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Native 1-Tap Action Button (if supported on device) */}
          {canInstallNative && !installSuccess && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border-2 border-blue-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  Instant Installation Available
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-bold">
                  1-Tap Setup
                </span>
              </div>
              <button
                onClick={handleNativeInstall}
                disabled={isInstalling}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{isInstalling ? "Opening Install Dialog..." : "Install CampusFleet App Now"}</span>
              </button>
            </div>
          )}

          {installSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>CampusFleet successfully installed! You can now launch it anytime from your home screen.</span>
            </div>
          )}

          {/* TAB 1: iOS Instructions */}
          {selectedTab === "ios" && (
            <div className="space-y-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Install on iPhone or iPad (Safari):
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div className="leading-snug pt-0.5">
                    Open <strong className="text-slate-900 dark:text-white">Safari</strong> and tap the{" "}
                    <strong className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 font-bold">
                      <Share2 className="w-3.5 h-3.5 inline" /> Share
                    </strong>{" "}
                    icon in the bottom navigation bar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div className="leading-snug pt-0.5">
                    Scroll down in the action sheet and tap{" "}
                    <strong className="text-slate-900 dark:text-white inline-flex items-center gap-1">
                      <PlusSquare className="w-3.5 h-3.5 text-blue-600 inline" /> Add to Home Screen
                    </strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div className="leading-snug pt-0.5">
                    Tap <strong className="text-blue-600 dark:text-blue-400 font-black">Add</strong> in the top right corner. The CampusFleet bus icon will appear on your home screen!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Android Instructions */}
          {selectedTab === "android" && (
            <div className="space-y-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Install on Android Phone (Chrome):
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div className="leading-snug pt-0.5">
                    Tap the{" "}
                    <strong className="text-slate-900 dark:text-white">three dots menu (⋮)</strong> in the top right corner of Chrome.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div className="leading-snug pt-0.5">
                    Select{" "}
                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold inline-flex items-center gap-1">
                      <Download className="w-3.5 h-3.5 inline" /> Install App
                    </strong>{" "}
                    or <strong className="text-slate-900 dark:text-white">Add to Home screen</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div className="leading-snug pt-0.5">
                    Tap <strong className="text-indigo-600 dark:text-indigo-400 font-black">Install</strong> on the confirmation pop-up.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Desktop Instructions */}
          {selectedTab === "desktop" && (
            <div className="space-y-3.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Install on Desktop (Chrome / Edge / Brave):
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div className="leading-snug pt-0.5">
                    Look at the right side of the URL address bar at the top of your browser.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div className="leading-snug pt-0.5">
                    Click the{" "}
                    <strong className="text-purple-600 dark:text-purple-400 font-bold inline-flex items-center gap-1">
                      <Download className="w-3.5 h-3.5 inline" /> Install CampusFleet
                    </strong>{" "}
                    icon (monitor with down arrow).
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="w-7 h-7 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div className="leading-snug pt-0.5">
                    Confirm by clicking <strong className="text-purple-600 dark:text-purple-400 font-black">Install</strong>. It launches in a dedicated distraction-free window!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Core Feature Benefits */}
          <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 space-y-2.5">
            <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              Why Install CampusFleet App?
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">1-Tap Fast Launch</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">15s Live GPS Radar</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Offline Digital Pass</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Parent Safety Alerts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
