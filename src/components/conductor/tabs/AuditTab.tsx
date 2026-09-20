"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { Student } from "@/lib/types";

interface AuditTabProps {
  attendanceRecords: any[];
  students: Student[];
}

export function AuditTab({ attendanceRecords, students }: AuditTabProps) {
  return (
    <div className="bg-white dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300 min-w-0">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-600 dark:text-green-400 flex items-center justify-center font-bold shadow-sm">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black text-lg text-gray-900 dark:text-white">
            Institutional Attendance Audit Log
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Signed records of all optical QR scans and conductor overrides.
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800/60 overflow-hidden">
        {attendanceRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 font-mono">
            No attendance records logged yet today.
          </div>
        ) : (
          attendanceRecords.slice(0, 15).map(record => {
            const s = students.find(stud => stud.id === record.studentId || stud.userId === record.studentId);
            return (
              <div key={record.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-gray-50 dark:hover:bg-gray-900/40 rounded-xl transition-colors">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-sm mb-1">
                    {s?.fullName || record.studentId} • <span className={record.status === "BOARDED" ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}>{record.status}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                    Method: {record.method} • Verified by: {record.verifiedBy} • Token: {record.signatureToken}
                  </div>
                  {record.notes && (
                    <div className="text-[11px] text-gray-400 italic mt-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                      Note: {record.notes}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md self-start sm:self-center whitespace-nowrap">
                  {new Date(record.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
