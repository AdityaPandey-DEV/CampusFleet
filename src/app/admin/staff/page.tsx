"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Staff, UserRole } from "@/lib/types";
import { Users, ShieldCheck, Plus, CheckCircle2, AlertTriangle, Key } from "lucide-react";

export default function StaffManagementPage() {
  const [staff, setStaff] = useState(store.getStaff());
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => setStaff(store.getStaff()));
    return unsub;
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Users className="w-7 h-7 text-blue-600" />
          Staff Registry & Role-Based Access Control (RBAC)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage drivers, conductors, supervisors, permission matrices, and enforce shift overlap prevention.
        </p>
      </div>

      {/* Staff Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {staff.map(member => (
          <div
            key={member.id}
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  {member.employeeCode}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                  {member.fullName}
                </h3>
                <div className="text-xs text-slate-500">{member.email}</div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-black uppercase">
                {member.role}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold">Category</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{member.category}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold">Rank</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">{member.rank}</div>
              </div>
            </div>

            {/* Explicit Permissions Matrix */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <Key className="w-3 h-3 text-amber-500" />
                Explicit Granted Permissions
              </span>
              <div className="flex flex-wrap gap-1.5">
                {member.permissions.map(perm => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300 font-medium"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
