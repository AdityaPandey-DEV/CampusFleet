"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Wrench, AlertTriangle, CheckCircle2, ShieldAlert, Plus } from "lucide-react";

export default function MaintenanceDeskPage() {
  const [issues, setIssues] = useState(store.getIssues());
  const [maintenance, setMaintenance] = useState(store.getMaintenance());
  const [buses, setBuses] = useState(store.getBuses());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setIssues(store.getIssues());
      setMaintenance(store.getMaintenance());
      setBuses(store.getBuses());
    });
    return unsub;
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <Wrench className="w-7 h-7 text-blue-600" />
          Fleet Maintenance & Driver Issue Desk
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Track real-time driver incident dispatches, brake/engine overhauls, and statutory inspection compliance.
        </p>
      </div>

      {/* Driver Reported Incidents Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Driver-Reported Vehicle & Corridor Issues
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {issues.map(iss => (
            <div
              key={iss.id}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {iss.busNumber}
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {iss.issueType} • {iss.severity}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{iss.description}</p>
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/40">
                <span>By: {iss.reportedBy}</span>
                <span>{new Date(iss.reportedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white">
          Periodic Service & Workshop History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Bus Vehicle</th>
                <th className="p-3">Service Category</th>
                <th className="p-3">Odometer</th>
                <th className="p-3">Authorized Center</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Service Date</th>
                <th className="p-3">Next Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {maintenance.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {m.busNumber}
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">
                    {m.serviceType}
                  </td>
                  <td className="p-3 font-mono font-bold">
                    {m.odometerKm} km
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    {m.serviceCenter}
                  </td>
                  <td className="p-3 font-mono font-bold">
                    {formatCurrency(m.cost)}
                  </td>
                  <td className="p-3 text-slate-500">
                    {formatDate(m.serviceDate)}
                  </td>
                  <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">
                    {formatDate(m.nextDueDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
