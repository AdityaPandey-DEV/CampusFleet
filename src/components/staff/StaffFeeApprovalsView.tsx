"use client";

import React, { useState, useEffect, useMemo } from "react";
import { store } from "@/lib/store";
import * as XLSX from "xlsx";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  CreditCard,
  Eye,
  Check,
  FileSpreadsheet,
  Download,
  AlertCircle,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import type { UserAccount, Route, Bus, Student } from "@/lib/types";

interface StaffFeeApprovalsViewProps {
  initialUser?: any;
  initialRoutes?: Route[];
  initialBuses?: Bus[];
  initialStudents?: Student[];
}

export default function StaffFeeApprovalsView({
  initialUser,
  initialStudents = [],
}: StaffFeeApprovalsViewProps) {
  const [currentUser] = useState(initialUser || store.getCurrentUser());
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & State
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch("/api/payments/approvals");
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error("Failed to fetch payment submissions:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const toggleStudentExpansion = (studentId: string) => {
    const newSet = new Set(expandedStudentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setExpandedStudentIds(newSet);
  };

  const handleApprovePayment = async (sub: any) => {
    setActionLoadingId(sub.id);
    try {
      const res = await fetch("/api/payments/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub.id,
          action: "APPROVE",
          reviewedBy: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ Approved payment of ₹${sub.amount} for ${sub.student?.full_name || sub.student_name || "Student"}!`);
        fetchSubmissions();
        store.syncFromSupabase();
      } else {
        alert(data.error || "Approval failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectModalId) return;
    setActionLoadingId(rejectModalId);
    try {
      const res = await fetch("/api/payments/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: rejectModalId,
          action: "REJECT",
          rejectionReason: rejectReason || "Transaction reference could not be verified on bank statement.",
          reviewedBy: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Payment rejected. Student prompted to re-upload.");
        setRejectModalId(null);
        setRejectReason("");
        fetchSubmissions();
      } else {
        alert(data.error || "Rejection failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportToExcel = () => {
    if (filteredSubmissions.length === 0) {
      alert("No records to export.");
      return;
    }

    const exportData = filteredSubmissions.map((sub, idx) => ({
      "S.No": idx + 1,
      "Submission ID": sub.id,
      "Student Name": sub.student?.full_name || sub.student_name || "N/A",
      "Department": sub.student?.department || "General",
      "Transit Zone": sub.zone_code || "ZONE_B",
      "Amount Paid (INR)": sub.amount || 0,
      "Installment #": sub.installment_number || 1,
      "Transaction ID / UTR": sub.transaction_id || "NOT_PROVIDED",
      "Approval Status": sub.status,
      "Reviewed By": sub.reviewed_by || "Pending Review",
      "Reviewed At": sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleString() : "-",
      "Submitted Timestamp": new Date(sub.created_at).toLocaleString(),
      "Receipt Image URL": sub.receipt_url || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length + 3, 14),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Approvals");

    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `CampusFleet_Fee_Approvals_${todayStr}.xlsx`);
    showToast("✓ Exported fee approvals report to Excel (.xlsx)!");
  };

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        sub.student?.full_name?.toLowerCase().includes(q) ||
        sub.student_name?.toLowerCase().includes(q) ||
        sub.transaction_id?.toLowerCase().includes(q) ||
        sub.zone_code?.toLowerCase().includes(q)
      );
    });
  }, [submissions, statusFilter, searchFilter]);

  // Group filtered submissions by student
  const groupedStudents = useMemo(() => {
    const groups: Record<string, { student: any; submissions: any[] }> = {};
    filteredSubmissions.forEach((sub) => {
      const studentId = sub.student_id;
      if (!groups[studentId]) {
        groups[studentId] = {
          student: sub.student || {
            id: studentId,
            full_name: sub.student_name || "Unknown Student",
            total_fee_due: 0,
            total_fee_paid: 0,
            payment_status: "UNKNOWN",
          },
          submissions: [],
        };
      }
      groups[studentId].submissions.push(sub);
    });
    return Object.values(groups);
  }, [filteredSubmissions]);

  const pendingCount = submissions.filter((s) => s.status === "PENDING_APPROVAL").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const totalApprovedAmount = submissions
    .filter((s) => s.status === "APPROVED")
    .reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
              Pending Review
            </div>
            <div className="text-2xl font-black font-mono mt-0.5 text-slate-900 dark:text-white">
              {pendingCount}
            </div>
            <div className="text-[10px] text-slate-400">Awaiting clearance</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
              Approved Passes
            </div>
            <div className="text-2xl font-black font-mono mt-0.5 text-slate-900 dark:text-white">
              {approvedCount}
            </div>
            <div className="text-[10px] text-slate-400">Active students</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
              Collected Revenue
            </div>
            <div className="text-2xl font-black font-mono mt-0.5 text-slate-900 dark:text-white">
              ₹{totalApprovedAmount.toLocaleString("en-IN")}
            </div>
            <div className="text-[10px] text-slate-400">Verified via bank UTR</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
              Total Submissions
            </div>
            <div className="text-2xl font-black font-mono mt-0.5 text-slate-900 dark:text-white">
              {submissions.length}
            </div>
            <div className="text-[10px] text-slate-400">All-time uploads</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Approvals Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Student Fee Submissions & Approval Queue</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify bank UTRs and approve student payment plans collectively.
            </p>
          </div>

          {/* Action buttons & filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search name, roll no, UTR..."
                className="text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
            >
              <option value="ALL">All Statuses ({submissions.length})</option>
              <option value="PENDING_APPROVAL">Pending Review ({pendingCount})</option>
              <option value="APPROVED">Approved ({approvedCount})</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <button
              onClick={handleExportToExcel}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Download spreadsheet report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel Export</span>
            </button>

            <button
              onClick={fetchSubmissions}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSubmissions ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Grouped List of Students */}
        {isLoadingSubmissions ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span>Loading payment submissions from database...</span>
          </div>
        ) : groupedStudents.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 font-mono space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <div>No payment submissions found matching your filters.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedStudents.map((group) => {
              const { student, submissions: studentSubmissions } = group;
              const isExpanded = expandedStudentIds.has(student.id);
              
              const totalFee = Number(student.total_fee_due) || 0;
              const totalPaid = Number(student.total_fee_paid) || 0;
              const pendingSubmissions = studentSubmissions.filter((s) => s.status === "PENDING_APPROVAL");
              const hasPending = pendingSubmissions.length > 0;

              return (
                <div key={student.id} className={`rounded-2xl border transition-colors ${isExpanded ? "border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-900 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80"}`}>
                  
                  {/* Student Header (Clickable) */}
                  <div 
                    onClick={() => toggleStudentExpansion(student.id)}
                    className="p-4 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${hasPending ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 dark:text-white">{student.full_name}</h4>
                          {hasPending && (
                            <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                              {pendingSubmissions.length} Pending
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {student.department || "General"}
                        </div>
                        {(student.email || student.phone) && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                            {student.email && <span>{student.email}</span>}
                            {student.email && student.phone && <span>•</span>}
                            {student.phone && <span>{student.phone}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total Fee Status</div>
                        <div className="text-sm font-black font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400">₹{totalPaid.toLocaleString("en-IN")}</span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                          <span className="text-slate-900 dark:text-slate-300">₹{totalFee.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Submissions List */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-b-2xl space-y-3">
                      {/* Individual Receipts */}
                      <div className="space-y-3">
                        {studentSubmissions.map((sub) => {
                          const isPending = sub.status === "PENDING_APPROVAL";
                          const isApproved = sub.status === "APPROVED";

                          return (
                            <div
                              key={sub.id}
                              className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                                isPending
                                  ? "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50"
                                  : "bg-white/60 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-90 hover:opacity-100"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Thumbnail */}
                                {sub.receipt_url ? (
                                  <div
                                    onClick={() => setPreviewImageUrl(sub.receipt_url)}
                                    className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex-shrink-0 cursor-pointer relative group shadow-sm"
                                  >
                                    <img
                                      src={sub.receipt_url}
                                      alt="Receipt"
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                      <Eye className="w-4 h-4" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                                    <CreditCard className="w-5 h-5" />
                                  </div>
                                )}

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                                      Receipt #{sub.receipt_number?.slice(-6) || "Upload"}
                                    </span>
                                    <span
                                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                        isPending
                                          ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
                                          : isApproved
                                          ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                                          : "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200"
                                      }`}
                                    >
                                      {sub.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex flex-wrap gap-2">
                                    <span>Amount: <strong className="text-slate-700 dark:text-slate-300">₹{Number(sub.amount).toLocaleString("en-IN")}</strong></span>
                                    <span>•</span>
                                    <span>{sub.transaction_id?.startsWith('pay_') ? 'RZP Txn' : 'UTR'}: {sub.transaction_id}</span>
                                    {sub.receipt_number?.startsWith('order_') && (
                                      <>
                                        <span>•</span>
                                        <span>RZP Order: {sub.receipt_number}</span>
                                      </>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    {new Date(sub.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                {sub.receipt_url && (
                                  <button
                                    onClick={() => setPreviewImageUrl(sub.receipt_url)}
                                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg"
                                    title="View Receipt"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}

                                {isPending ? (
                                  <>
                                    <button
                                      onClick={() => handleApprovePayment(sub)}
                                      disabled={actionLoadingId === sub.id}
                                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      {actionLoadingId === sub.id ? "..." : "Approve"}
                                    </button>
                                    <button
                                      onClick={() => setRejectModalId(sub.id)}
                                      disabled={actionLoadingId === sub.id}
                                      className="px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg"
                                    >
                                      Reject
                                    </button>
                                  </>
                                ) : isApproved ? (
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Check className="w-4 h-4" /> Verified
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                    <X className="w-4 h-4" /> Rejected
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Preview Lightbox Modal */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full bg-slate-900 rounded-3xl p-4 border border-slate-700 space-y-3 cursor-default"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-300">Payment Receipt Inspection</span>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden max-h-[70vh] flex items-center justify-center bg-black">
              <img
                src={previewImageUrl}
                alt="Receipt Inspection"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <span>Reject Payment Submission</span>
            </h4>
            <p className="text-xs text-slate-500">
              Provide a clear reason for rejecting this fee submission. The student will be prompted to re-upload.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. UTR not found on bank statement, blurry screenshot..."
              rows={3}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalId(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                disabled={actionLoadingId === rejectModalId}
                className="px-4 py-2 text-xs font-black rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
              >
                {actionLoadingId === rejectModalId ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
