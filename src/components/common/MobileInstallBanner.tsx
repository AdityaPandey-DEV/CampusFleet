"use client";

import React, { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface MobileInstallBannerProps {
  onOpenInstallModal: () => void;
  isInstalled: boolean;
  canInstallNative: boolean;
  onPromptInstall: () => Promise<"accepted" | "dismissed" | "modal_needed">;
}

export function MobileInstallBanner({
  onOpenInstallModal,
  isInstalled,
  canInstallNative,
  onPromptInstall,
}: MobileInstallBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Only show if not installed and not dismissed in this session
    if (isInstalled) return;
    const dismissed = sessionStorage.getItem("cf_install_banner_dismissed");
    if (!dismissed) {
      setIsDismissed(false);
    }
  }, [isInstalled]);

  if (isInstalled || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("cf_install_banner_dismissed", "true");
  };

  const handleAction = async () => {
    if (canInstallNative) {
      const outcome = await onPromptInstall();
      if (outcome === "modal_needed") {
        onOpenInstallModal();
      }
    } else {
      onOpenInstallModal();
    }
  };

  return (
    <aside
      aria-label="App Installation"
      className="fixed bottom-3 inset-x-3 sm:hidden z-40 animate-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
    >
      <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-3 rounded-2xl border border-blue-500/40 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
          <div className="min-w-0">
            <div className="font-black text-xs text-white truncate flex items-center gap-1.5">
              <span>Install CampusFleet</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 font-mono">APP</span>
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              Guaranteed seats & live radar on home screen
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleAction}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
