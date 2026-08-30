"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Student } from "@/lib/types";
import { GraduationCap, Search, ShieldCheck, ShieldAlert, Phone, User, CheckCircle2 } from "lucide-react";

export default function StudentManagementPage() {
  const [students, setStudents] = useState(store.getStudents());
  const [stops, setStops] = useState(store.getStops());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [guardians, setGuardians] = useState(store.getGuardians());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setStudents(store.getStudents());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
      setGuardians(store.getGuardians());
    });
    return unsub;
  }, []);

  const handleToggleSuspension = (student: Student) => {
    student.transportAccessSuspended = !student.transportAccessSuspended;
    store.setCurrentUser(store.getCurrentUser()); // trigger notify
    alert(`Transport access for ${student.fullName} has been ${student.transportAccessSuspended ? "SUSPENDED" : "RESTORED"}.`);
  };

  const filteredStudents = students.filter(
    s =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <GraduationCap className="w-7 h-7 text-blue-600" />
          Student & Guardian Transit Directory
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage enrolled students, linked guardian accounts, emergency contacts, and transport access privileges.
        </p>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student name, enrollment no..."
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
          />
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Roll / ID</th>
                <th className="p-3.5">Student Commuter</th>
                <th className="p-3.5">Campus & Department</th>
                <th className="p-3.5">Primary Pickup Stop</th>
                <th className="p-3.5">Emergency Contact</th>
                <th className="p-3.5">Transit Status</th>
                <th className="p-3.5 text-right">Access Privileges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map(s => {
                const stop = stops.find(st => st.id === s.primaryStopId);
                const isSuspended = s.transportAccessSuspended;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {s.enrollmentNo || "PENDING"}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{s.fullName}</div>
                      <div className="text-[10px] text-slate-500">{s.email}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.phone}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold text-slate-900 dark:text-white">{s.campus || "GEHU Bhimtal"}</div>
                      <div className="text-[10px] text-slate-500">{s.department} • {s.semester}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{stop?.name || "Campus Main Corridor"}</div>
                      <div className="text-[10px] text-slate-400">{stop?.landmark}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.emergencyContact?.name || "Guardian"} ({s.emergencyContact?.relationship || "Family"})
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {s.emergencyContact?.phone || s.phone}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                        ACTIVE PASS
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleToggleSuspension(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          isSuspended
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                        }`}
                      >
                        {isSuspended ? "Restore Access" : "Suspend Access"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
