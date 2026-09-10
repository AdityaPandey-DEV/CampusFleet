"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  CreditCard,
  Download,
  FileText,
  CheckCircle2,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  Check,
  X,
  Eye,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface AdminBillingViewProps {
  initialSubmissions: any[];
  initialPayments: any[];
  user: any;
}

export function AdminBillingView({
  initialSubmissions,
  initialPayments,
  user,
}: AdminBillingViewProps) {
  const [payments, setPayments] = useState(initialPayments?.length ? initialPayments : store.getPayments());
  const [plans, setPlans] = useState(store.getPlans());
  const [activeTab, setActiveTab] = useState<"APPROVALS" | "LEDGER">("APPROVALS");

  // Submissions State
  const [submissions, setSubmissions] = useState<any[]>(initialSubmissions || []);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSubmissions = () => {
    setIsLoadingSubmissions(true);
    fetch("/api/payments/approvals")
      .then((res) => res.json())
      .then((data) => {
        setIsLoadingSubmissions(false);
        if (data.success && data.submissions) {
          setSubmissions(data.submissions);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch payment approvals:", err);
        setIsLoadingSubmissions(false);
      });
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setPayments(store.getPayments());
      setPlans(store.getPlans());
    });
    return unsub;
  }, []);

  const pendingCount = submissions.filter((s) => s.status === "PENDING_APPROVAL").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const totalRevenue = payments.reduce((acc: number, p: any) => acc + (p.status === "PAID" ? p.amount : 0), 0);

  const handleApprove = async (submissionId: string) => {
    setActionLoadingId(submissionId);
    const reviewerName = user?.fullName || store.getCurrentUser()?.fullName || "Transport Admin";
    try {
      const res = await fetch("/api/payments/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          action: "APPROVE",
          reviewedBy: reviewerName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage("✓ Payment Approved! Student transit pass unlocked and active.");
        setTimeout(() => setToastMessage(null), 3500);
        fetchSubmissions();
        store.syncFromSupabase();
      } else {
        alert(data.error || "Approval failed");
      }
    } catch (err: any) {
      alert("Failed to approve payment: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalId) return;
    setActionLoadingId(rejectModalId);
    const reviewerName = user?.fullName || store.getCurrentUser()?.fullName || "Transport Admin";
    try {
      const res = await fetch("/api/payments/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: rejectModalId,
          action: "REJECT",
          rejectionReason: rejectionReason.trim() || "Transaction ID / Screenshot could not be verified.",
          reviewedBy: reviewerName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage("Payment submission rejected.");
        setTimeout(() => setToastMessage(null), 3500);
        setRejectModalId(null);
        setRejectionReason("");
        fetchSubmissions();
        store.syncFromSupabase();
      } else {
        alert(data.error || "Rejection failed");
      }
    } catch (err: any) {
      alert("Failed to reject payment: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center justify-between animate-in slide-in-from-top">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-blue-600" />
            Fee Management & Staff Payment Approvals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review Vercel Blob receipts, verify UPI UTR numbers, and approve student transport passes.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab("APPROVALS")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === "APPROVALS"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Staff Approvals ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("LEDGER")}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
              activeTab === "LEDGER"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Financial Ledger</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Pending Verification
          </div>
          <div className="text-3xl font-black text-amber-600 font-mono">
            {pendingCount} Receipts
          </div>
          <div className="text-xs text-slate-500">
            Awaiting finance staff approval to unlock passes
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved Submissions
          </div>
          <div className="text-3xl font-black text-emerald-600 font-mono">
            {approvedCount} Passes
          </div>
          <div className="text-xs text-slate-500">
            Verified with unlocked student transport access
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-blue-500">
            Total Reconciled Revenue
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">
            {formatCurrency(totalRevenue)}
          </div>
          <div className="text-xs text-slate-500">
            Across all approved semester subscription fees
          </div>
        </div>
      </div>

      {/* Tab 1: Staff Approvals (Vercel Blob Receipts) */}
      {activeTab === "APPROVALS" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Student Payment Verification Queue</span>
                {pendingCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-extrabold">
                    {pendingCount} Action Required
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect Vercel Blob screenshots, verify UTR, and approve to unlock student portal access.
              </p>
            </div>

            <button
              onClick={fetchSubmissions}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300"
            >
              Refresh Queue
            </button>
          </div>

          {isLoadingSubmissions ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold">
              Loading payment submission records...
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="font-bold text-sm text-slate-700 dark:text-slate-300">
                No payment submissions yet
              </div>
              <div className="text-xs text-slate-400">
                When students pay and upload receipts on the portal, they will appear here for verification.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Student Commuter</th>
                    <th className="p-3">Zone & Installment</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Transaction ID (UTR)</th>
                    <th className="p-3">Receipt (Vercel Blob)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Staff Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {submissions.map((sub) => {
                    const isPending = sub.status === "PENDING_APPROVAL";
                    const isActionLoading = actionLoadingId === sub.id;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {sub.student_name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {sub.enrollment_no || "ENR-PENDING"}
                          </div>
                        </td>

                        <td className="p-3">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {sub.zone_code}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            Inst. {sub.installment_no} of {sub.total_installments}
                          </div>
                        </td>

                        <td className="p-3 font-black text-slate-900 dark:text-white font-mono">
                          {formatCurrency(sub.amount)}
                        </td>

                        <td className="p-3">
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            {sub.transaction_id}
                          </div>
                          {sub.auto_detected && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              ✓ OCR Detected
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewImageUrl(sub.receipt_url)}
                              className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 w-12 h-12 flex-shrink-0"
                            >
                              <img
                                src={sub.receipt_url}
                                alt="Receipt thumbnail"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </button>
                            <a
                              href={sub.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </td>

                        <td className="p-3">
                          {sub.status === "APPROVED" ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase">
                              ✓ Approved
                            </span>
                          ) : sub.status === "REJECTED" ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] uppercase">
                              ❌ Rejected
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] uppercase">
                              ⏳ Pending
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => handleApprove(sub.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-1 transition-transform active:scale-95 disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve & Unlock</span>
                              </button>

                              <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={() => {
                                  setRejectModalId(sub.id);
                                  setRejectionReason("");
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold text-xs rounded-xl transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              Reviewed by {sub.reviewed_by || "Staff"}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: General Ledger Table */}
      {activeTab === "LEDGER" && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Institutional Fee Accounting Ledger
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
                {payments.map((pay: any) => (
                  <tr key={pay.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-bold text-blue-600">{pay.receiptNumber || pay.receipt_number}</td>
                    <td className="p-3 font-medium">{pay.studentName || pay.student_name}</td>
                    <td className="p-3 text-slate-500">{pay.planName || pay.plan_name}</td>
                    <td className="p-3 font-black font-mono">{formatCurrency(pay.amount)}</td>
                    <td className="p-3 font-mono text-slate-400">{pay.transactionRef || pay.transaction_ref}</td>
                    <td className="p-3 text-slate-500">{formatDate(pay.createdAt || pay.created_at)}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold text-[10px] uppercase">
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Receipt Preview */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" /> Vercel Blob Receipt Screenshot
              </span>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img src={previewImageUrl} alt="Full Receipt" className="rounded-xl object-contain max-h-[70vh]" />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-black text-base text-rose-600">Reject Payment Submission</span>
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Please specify the reason for rejecting this receipt (e.g. invalid UTR, blurred screenshot, amount mismatch).
            </p>

            <textarea
              rows={3}
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full text-xs p-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
