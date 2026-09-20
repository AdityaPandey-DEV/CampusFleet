"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StudentSelfScanner } from "@/components/scanner/StudentSelfScanner";

export default function ScanPage() {
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in zoom-in-95">
      <Link 
        href="/portal/qr"
        className="absolute top-6 left-6 z-[110] p-3.5 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-xl border border-white/10 shadow-xl transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-6 h-6" />
      </Link>
      <StudentSelfScanner fullScreenMode={true} onSuccess={() => { window.location.href = '/portal'; }} />
    </div>
  );
}
