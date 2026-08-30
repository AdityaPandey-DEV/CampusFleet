"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, CheckCircle2, ShieldCheck, Download, Sparkles, FileText, ArrowRight } from "lucide-react";

export default function SubscriptionsAndBillingPage() {
  const [plans, setPlans] = useState(store.getPlans());
  const [payments, setPayments] = useState(store.getPayments());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptModal, setReceiptModal] = useState<any>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setPlans(store.getPlans());
      setPayments(store.getPayments());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
    });
    return unsub;
  }, []);

  const activeStudent = students.find(s => s.id === activeChildId) || students[0];
  const studentPayments = payments.filter(p => p.studentId === activeStudent?.id);

  const handleSimulatePayment = (plan: any) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const newReceipt = {
        id: `pay_${Date.now()}`,
        receiptNumber: `RCP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        studentId: activeStudent.id,
        studentName: activeStudent.fullName,
        planName: plan.name,
        amount: plan.price,
        status: "PAID",
        paymentMethod: "UPI",
        transactionRef: `UPI-TEST-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
      };
      // In demo store, prepend to payments
      alert(`Payment of ${formatCurrency(plan.price)} successful! Receipt #${newReceipt.receiptNumber} generated.`);
      setReceiptModal(newReceipt);
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <CreditCard className="w-7 h-7 text-teal-600" />
          Subscription Passes & Fee Receipts
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage campus transit subscriptions, generate test payments, and download official fee receipts.
        </p>
      </div>

      {/* Current Active Pass Card */}
      <div className="bg-gradient-to-r from-teal-800 to-blue-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-teal-200">
              Active Transport Subscription
            </div>
            <div className="text-2xl font-black mt-1">
              Academic Term Pass (6 Months)
            </div>
            <div className="text-xs text-teal-100 mt-1">
              Valid until: {formatDate(activeStudent?.subscriptionExpiryDate || "2026-12-31")} • Unlimited Daily Shifts
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-4 py-2 rounded-2xl bg-white/20 backdrop-blur font-bold text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-300" />
              Verified & Active
            </span>
          </div>
        </div>
      </div>

      {/* Subscription Plans Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-900 dark:text-white">
          Renew or Upgrade Campus Transit Pass
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(p => (
            <div
              key={p.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-500 transition-colors"
            >
              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {p.durationMonths} Month{p.durationMonths > 1 ? "s" : ""} Pass
                </div>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {p.name}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {formatCurrency(p.price)}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {p.description}
                </p>

                <ul className="text-xs space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                  {p.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleSimulatePayment(p)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Simulate Instant Payment ({formatCurrency(p.price)})
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History & Receipts */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Past Payment History & Invoices
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Receipt No.</th>
                <th className="p-3">Plan Details</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Method</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {studentPayments.map(pay => (
                <tr key={pay.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                    {pay.receiptNumber}
                  </td>
                  <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                    {pay.planName}
                  </td>
                  <td className="p-3 font-mono font-bold">
                    {formatCurrency(pay.amount)}
                  </td>
                  <td className="p-3 font-mono text-slate-500">
                    {pay.paymentMethod}
                  </td>
                  <td className="p-3 text-slate-500">
                    {formatDate(pay.createdAt)}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                      {pay.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => window.print()}
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                      title="Download PDF Receipt"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
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
