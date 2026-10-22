"use client";

import React from "react";
import Link from "next/link";
import { ScanLine, QrCode } from "lucide-react";

export default function QRConnectPage() {
  return (
    <div className="min-h-[calc(100vh-140px)] w-full p-6 animate-in fade-in zoom-in-95 flex flex-col items-center justify-center pb-24">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <QrCode className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">QR Connect</h1>
          <p className="text-xs font-bold text-gray-500">Choose how you want to board</p>
        </div>

        <Link 
          href="/portal/qr/show"
          className="w-full flex items-center gap-4 p-5 bg-white dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/60 rounded-3xl shadow-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer"
        >
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <QrCode className="w-7 h-7" />
          </div>
          <div className="text-left">
            <div className="text-lg font-black text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Show My QR</div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5">Let the conductor scan you</div>
          </div>
        </Link>

        <Link 
          href="/portal/qr/scan"
          className="w-full flex items-center gap-4 p-5 bg-white dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/60 rounded-3xl shadow-xl hover:border-green-500 dark:hover:border-green-500 transition-all hover:scale-[1.02] active:scale-95 group cursor-pointer"
        >
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-green-50 dark:bg-green-900/40 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:bg-green-600 group-hover:text-white transition-colors">
            <ScanLine className="w-7 h-7" />
          </div>
          <div className="text-left">
            <div className="text-lg font-black text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">Scan Bus QR</div>
            <div className="text-xs text-gray-500 font-semibold mt-0.5">Self-check into your seat</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
