"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, Download, FileText, CheckCircle2, Search, ArrowUpRight } from "lucide-react";

export default function AdminBillingPage() {
  const [payments, setPayments] = useState(store.getPayments());
  const [plans, setPlans] = useState(store.getPlans());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setPayments(store.getPayments());
      setPlans(store.getPlans());
    });
    return unsub;
  }, []);

  const totalRevenue = payments.reduce((acc, p) => acc + (p.status === "PAID" ? p.amount : 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <CreditCard className="w-7 h-7 text-blue-600" />
          Subscription Plans & Revenue Accounting
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Monitor campus transit pass revenue, payment statuses, waivers, and fee receipts.
        </p>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Collected Revenue</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Payment Reconciliation
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Subscription Plans</div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {plans.length} Standard Tiers
          </div>
          <div className="text-xs text-slate-500">
            Monthly, Quarterly & 6-Month Semester Passes
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Dues / Waivers</div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            ₹0.00
          </div>
          <div className="text-xs text-slate-500">
            No delinquent accounts recorded
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            Recent Payment Transactions
          </h3>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Print Ledger
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Receipt No.</th>
                <th className="p-3">Student Passenger</th>
                <th className="p-3">Plan Details</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Gateway Ref</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map(pay => (
                <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {pay.receiptNumber}
                  </td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {pay.studentName}
                  </td>
                  <td className="p-3 text-slate-700 dark:text-slate-300">
                    {pay.planName}
                  </td>
                  <td className="p-3 font-mono font-bold">
                    {formatCurrency(pay.amount)}
                  </td>
                  <td className="p-3 font-mono text-slate-500">
                    {pay.transactionRef}
                  </td>
                  <td className="p-3 text-slate-500">
                    {formatDate(pay.createdAt)}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      {pay.status}
                    </span>
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
