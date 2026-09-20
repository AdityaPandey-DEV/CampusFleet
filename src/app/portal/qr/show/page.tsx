"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft } from "lucide-react";

export default function ShowQRPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(store.getCurrentUser());
    const students = store.getStudents();
    const currentU = store.getCurrentUser();
    if (currentU) {
      const activeChildId = store.getActiveChildId();
      const activeS = students.find(
        s => (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
        (currentU.studentId && s.id === currentU.studentId) ||
        s.userId === currentU.id ||
        s.id === currentU.id ||
        s.email?.toLowerCase() === currentU.email?.toLowerCase()
      ) || null;
      setActiveStudent(activeS);
    }
  }, []);

  const identityQrPayload = useMemo(() => {
    return JSON.stringify({
      studentId: activeStudent?.id || currentUser?.id || "st-student",
      studentName: activeStudent?.fullName || currentUser?.fullName || "Student",
      type: "STUDENT_IDENTITY"
    });
  }, [activeStudent, currentUser]);

  return (
    <div className="min-h-[calc(100vh-140px)] w-full p-6 animate-in fade-in flex flex-col items-center justify-center pb-24">
      <div className="w-full max-w-sm space-y-6 flex flex-col items-center">
        <Link 
          href="/portal/qr"
          className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        
        <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl border border-gray-200 dark:border-gray-800/60 flex flex-col items-center justify-center text-center space-y-6 w-full">
          <div className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Your Digital ID</div>
          <div className="p-5 bg-white rounded-3xl shadow-inner border border-gray-100 relative">
            <QRCodeSVG
              value={identityQrPayload}
              size={220}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: "/favicon.ico",
                x: undefined,
                y: undefined,
                height: 32,
                width: 32,
                excavate: true,
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
              {activeStudent?.fullName || currentUser?.fullName || "Student"}
            </div>
            <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {activeStudent?.id || currentUser?.id || "N/A"}
            </div>
          </div>
          <div className="text-[11px] font-bold text-gray-400 max-w-[200px] leading-relaxed">
            Show this screen to the conductor if you are unable to self-scan.
          </div>
        </div>
      </div>
    </div>
  );
}
