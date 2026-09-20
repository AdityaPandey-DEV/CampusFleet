"use client";

import React from "react";
import { StudentSelfScanner } from "@/components/scanner/StudentSelfScanner";

export default function ScanQRPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 text-center border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Transit Scanner</h1>
          <p className="text-xs text-gray-500 mt-1">Scan a Bus QR to select a seat, or scan a Seat QR to board immediately.</p>
        </div>
        <div className="p-4 sm:p-6">
          <StudentSelfScanner onSuccess={() => { window.location.href = '/portal'; }} />
        </div>
      </div>
    </div>
  );
}
