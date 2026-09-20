"use client";

import React from "react";
import { StudentSelfScanner } from "@/components/scanner/StudentSelfScanner";

export default function ScanQRPage() {
  return (
    <div className="h-[calc(100vh-140px)] w-full bg-black flex flex-col items-center justify-center animate-in fade-in overflow-hidden">
      <StudentSelfScanner fullScreenMode={true} onSuccess={() => { window.location.href = '/portal'; }} />
    </div>
  );
}
