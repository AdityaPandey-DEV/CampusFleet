"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { RolePortalSwitcher } from "@/components/common/RolePortalSwitcher";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  GitMerge,
  BarChart3,
  BusFront,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Upload,
  Sparkles,
  Search,
  Eye,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  RefreshCw,
  LogOut,
  Sliders,
  Check,
  X,
  FileText,
  Building2,
  MapPin,
  ChevronRight,
  CalendarDays,
  RotateCcw,
  History,
} from "lucide-react";

export default function StaffOperationsPanel() {
  const [activeTab, setActiveTab] = useState<
    "APPROVALS" | "QR_SETTINGS" | "AUDIT_EXCEL" | "DEMAND_FLEET" | "MERGE_OPTIMIZER" | "DAILY_OPERATIONS"
  >("APPROVALS");

  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [buses, setBuses] = useState(store.getBuses());
  const [stops, setStops] = useState(store.getStops());
  const [students, setStudents] = useState(store.getStudents());
  const [trips, setTrips] = useState(store.getTrips());
  const [bookings, setBookings] = useState(store.getBookings());

  // Submissions State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");

  // QR Config State
  const [qrConfig, setQrConfig] = useState({
    upi_id: "gehubhimtal.transit@upi",
    merchant_name: "GEHU Bhimtal Transport Department",
    qr_image_url: "",
    instructions: "Scan via Google Pay, PhonePe, Paytm, or BHIM UPI. Ensure the 12-digit UTR is visible on the receipt.",
    account_number: "50200012345678",
    ifsc_code: "HDFC0001234",
    bank_name: "HDFC Bank, Haldwani Branch",
  });
  const [isSavingQr, setIsSavingQr] = useState(false);
  const [isUploadingQrImage, setIsUploadingQrImage] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  // Route Analytics & Demand
  const [routeAnalytics, setRouteAnalytics] = useState<any[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Bus Merge State
  const [mergeSuggestions, setMergeSuggestions] = useState<any[]>([]);
  const [isLoadingMerges, setIsLoadingMerges] = useState(true);

  // Daily Operations Rollover State
  const [isRolloverLoading, setIsRolloverLoading] = useState(false);
  const [rolloverStatus, setRolloverStatus] = useState<any>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset).toISOString().split("T")[0];
  });

  const fetchRolloverStatus = async () => {
    try {
      const res = await fetch("/api/cron/daily-rollover");
      const data = await res.json();
      if (data.success) {
        setRolloverStatus(data);
      }
    } catch (e) {
      console.warn("Failed to fetch rollover status", e);
    }
  };

  const handleExecuteRollover = async (targetDateParam?: string, force = false) => {
    setIsRolloverLoading(true);
    try {
      const res = await fetch("/api/cron/daily-rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDate: targetDateParam,
          force,
          triggeredBy: currentUser?.fullName || "Transport Staff Operations",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${data.message}`);
        await store.reloadFromDatabase();
        fetchRolloverStatus();
      } else {
        alert(data.message || "Rollover failed");
      }
    } catch (err: any) {
      alert("Rollover error: " + err.message);
    } finally {
      setIsRolloverLoading(false);
    }
  };

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Initial Load & Subscriptions
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setRoutes(store.getRoutes());
      setBuses(store.getBuses());
      setStops(store.getStops());
      setStudents(store.getStudents());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
    });
    fetchSubmissions();
    fetchQrConfig();
    fetchRouteAnalytics();
    fetchMergeSuggestions();
    fetchRolloverStatus();
    return unsub;
  }, []);

  // Fetch Submissions
  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch("/api/payments/approvals");
      const data = await res.json();
      if (data.success && data.submissions) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Fetch QR Config
  const fetchQrConfig = async () => {
    try {
      const res = await fetch("/api/staff/qr-config");
      const data = await res.json();
      if (data.success && data.config) {
        setQrConfig((prev) => ({ ...prev, ...data.config }));
      }
    } catch (err) {
      console.error("Error loading QR config:", err);
    }
  };

  // Fetch Route Analytics
  const fetchRouteAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch("/api/staff/route-analytics");
      const data = await res.json();
      if (data.success && data.analytics) {
        setRouteAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Error loading route analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Fetch Merge Suggestions
  const fetchMergeSuggestions = async () => {
    setIsLoadingMerges(true);
    try {
      const res = await fetch("/api/merges");
      const data = await res.json();
      if (data.success && data.suggestions) {
        setMergeSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Error loading merge suggestions:", err);
    } finally {
      setIsLoadingMerges(false);
    }
  };

  // 2. Payment Approval Handlers
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
        showToast(`✓ Approved payment of ₹${sub.amount_paid} for ${sub.student?.full_name || "Student"}!`);
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
          rejectionReason: rejectionReason || "Transaction reference could not be verified on bank statement.",
          reviewedBy: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Payment rejected. Student prompted to re-upload.");
        setRejectModalId(null);
        setRejectionReason("");
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

  // 3. QR Config Handlers
  const handleSaveQrConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingQr(true);
    try {
      const res = await fetch("/api/staff/qr-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...qrConfig,
          updated_by: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✓ Official University Payment QR & UPI VPA updated!");
      } else {
        alert(data.error || "Failed to update QR config");
      }
    } catch (err: any) {
      alert("Error saving QR config: " + err.message);
    } finally {
      setIsSavingQr(false);
    }
  };

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingQrImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/payments/upload-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setQrConfig((prev) => ({ ...prev, qr_image_url: data.url }));
        showToast("✓ Custom QR image uploaded to Vercel Blob CDN!");
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Upload error: " + err.message);
    } finally {
      setIsUploadingQrImage(false);
    }
  };

  // 4. Excel (.xlsx) Export Handler
  const handleExportToExcel = () => {
    const exportData = filteredSubmissions.map((sub, idx) => ({
      "S.No": idx + 1,
      "Submission ID": sub.id,
      "Student Name": sub.student?.full_name || "N/A",
      "Enrollment / Roll No": sub.student?.enrollment_no || "PENDING",
      "Department": sub.student?.department || "General",
      "Transit Zone": sub.zone_code || "ZONE_B",
      "Amount Paid (INR)": sub.amount_paid || 0,
      "Installment #": sub.installment_number || 1,
      "Transaction ID / UTR": sub.transaction_id || "NOT_PROVIDED",
      "Approval Status": sub.status,
      "Reviewed By": sub.reviewed_by || "Pending Review",
      "Reviewed At": sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleString() : "-",
      "Submitted Timestamp": new Date(sub.created_at).toLocaleString(),
      "Receipt Image URL": sub.receipt_url || "-",
      "Staff Notes": sub.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-fit column widths
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length + 3, 14),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Payment Audit");

    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `CampusFleet_Fee_Audit_${todayStr}.xlsx`);
    showToast("✓ Exported fee audit report to Excel (.xlsx)!");
  };

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        sub.student?.full_name?.toLowerCase().includes(q) ||
        sub.student?.enrollment_no?.toLowerCase().includes(q) ||
        sub.transaction_id?.toLowerCase().includes(q) ||
        sub.zone_code?.toLowerCase().includes(q)
      );
    });
  }, [submissions, statusFilter, searchFilter]);

  // Derived Summary Counts
  const pendingCount = submissions.filter((s) => s.status === "PENDING_APPROVAL").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const totalApprovedAmount = submissions
    .filter((s) => s.status === "APPROVED")
    .reduce((acc, s) => acc + (Number(s.amount_paid) || 0), 0);

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-20 transition-colors">
      {/* Staff Header */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 py-3 sm:px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20 flex-shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Transport Staff Operations
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  Supervisory Console
                </span>
              </div>
              <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                CampusFleet Operations Command
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end min-w-0">
            {/* Quick Crew Jump */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-bold mr-2">
              <Link
                href="/driver"
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                title="Launch Driver HUD"
              >
                <BusFront className="w-3.5 h-3.5" />
                <span>Driver HUD</span>
              </Link>
              <Link
                href="/conductor"
                className="px-2.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-1"
                title="Launch Conductor Terminal"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Conductor</span>
              </Link>
            </div>

            <RolePortalSwitcher />
            <ThemeToggle />
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Exit to Portal"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/90 border border-blue-300 dark:border-blue-700 rounded-2xl text-xs font-bold text-blue-900 dark:text-blue-200 text-center animate-in fade-in shadow-lg flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                Pending Approvals
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {pendingCount}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Awaiting Staff Review</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                Approved Revenue
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-900 dark:text-emerald-300 mt-1">
                ₹{totalApprovedAmount.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{approvedCount} Verified Submissions</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
                Transit Corridors
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {routes.length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{stops.length} Managed Bus Stops</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-purple-600 dark:text-purple-400">
                Merge Opportunities
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {mergeSuggestions.filter((s) => s.status === "PENDING").length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Potential Fuel Savings</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 flex items-center justify-center font-bold">
              <GitMerge className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 dark:bg-slate-900/90 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("APPROVALS")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "APPROVALS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Fee Approvals ({pendingCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("QR_SETTINGS")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "QR_SETTINGS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Payment QR & UPI</span>
          </button>

          <button
            onClick={() => setActiveTab("AUDIT_EXCEL")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "AUDIT_EXCEL"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Audit & Excel Export</span>
          </button>

          <button
            onClick={() => setActiveTab("DEMAND_FLEET")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "DEMAND_FLEET"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Demand & Fleet Sizing</span>
          </button>

          <button
            onClick={() => setActiveTab("MERGE_OPTIMIZER")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "MERGE_OPTIMIZER"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GitMerge className="w-4 h-4" />
            <span>Bus Merge Optimizer</span>
          </button>

          <button
            onClick={() => setActiveTab("DAILY_OPERATIONS")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "DAILY_OPERATIONS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Daily Operations</span>
          </button>
        </div>

        {/* TAB 1: Payment Approvals Queue */}
        {activeTab === "APPROVALS" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Student Fee Submissions & Approval Queue</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify Vercel Blob uploaded receipts, inspect transaction IDs, and activate commuter passes.
                </p>
              </div>

              {/* Filters */}
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
              </div>
            </div>

            {/* List Table / Cards */}
            {isLoadingSubmissions ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span>Loading payment queue from database...</span>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-mono space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <div>No payment submissions found matching your filters.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredSubmissions.map((sub) => {
                  const isPending = sub.status === "PENDING_APPROVAL";
                  const isApproved = sub.status === "APPROVED";
                  const isRejected = sub.status === "REJECTED";

                  return (
                    <div
                      key={sub.id}
                      className={`p-4 sm:p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isPending
                          ? "bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-800/40 my-2"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        {/* Receipt Thumbnail */}
                        {sub.receipt_url ? (
                          <div
                            onClick={() => setPreviewImageUrl(sub.receipt_url)}
                            className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex-shrink-0 cursor-pointer relative group"
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
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <CreditCard className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {sub.student?.full_name || "Student Commuter"}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                              {sub.zone_code || "ZONE_B"}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Installment #{sub.installment_number || 1}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
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

                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                            <span>Roll: <strong className="text-slate-700 dark:text-slate-300">{sub.student?.enrollment_no || "Pending"}</strong></span>
                            <span>•</span>
                            <span>Amount: <strong className="text-emerald-600 dark:text-emerald-400 font-black">₹{Number(sub.amount_paid).toLocaleString("en-IN")}</strong></span>
                            <span>•</span>
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
                              UTR: {sub.transaction_id || "NOT_DETECTED"}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Submitted: {new Date(sub.created_at).toLocaleString()}
                            {sub.reviewed_by && ` • Reviewed by ${sub.reviewed_by}`}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end lg:self-center flex-shrink-0">
                        {sub.receipt_url && (
                          <button
                            onClick={() => setPreviewImageUrl(sub.receipt_url)}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 text-slate-700 dark:text-slate-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        )}

                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleApprovePayment(sub)}
                              disabled={actionLoadingId === sub.id}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{actionLoadingId === sub.id ? "Approving..." : "Approve & Unlock"}</span>
                            </button>

                            <button
                              onClick={() => setRejectModalId(sub.id)}
                              disabled={actionLoadingId === sub.id}
                              className="px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        ) : isApproved ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> Pass Active
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
            )}
          </div>
        )}

        {/* TAB 2: Payment QR & UPI Settings Manager */}
        {activeTab === "QR_SETTINGS" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* Form */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>University Payment QR & UPI VPA Configuration</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update the official receiving account details and QR code displayed to all students during fee payments.
                </p>
              </div>

              <form onSubmit={handleSaveQrConfig} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Official Receiving UPI ID / VPA *
                  </label>
                  <input
                    type="text"
                    required
                    value={qrConfig.upi_id}
                    onChange={(e) => setQrConfig({ ...qrConfig, upi_id: e.target.value })}
                    placeholder="e.g. gehubhimtal.transit@upi"
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    All dynamic student payment links will point to this VPA.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Merchant / Beneficiary Name
                    </label>
                    <input
                      type="text"
                      value={qrConfig.merchant_name}
                      onChange={(e) => setQrConfig({ ...qrConfig, merchant_name: e.target.value })}
                      placeholder="e.g. GEHU Bhimtal Transport"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank Name & Branch
                    </label>
                    <input
                      type="text"
                      value={qrConfig.bank_name}
                      onChange={(e) => setQrConfig({ ...qrConfig, bank_name: e.target.value })}
                      placeholder="e.g. HDFC Bank, Haldwani"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank Account Number (Optional Fallback)
                    </label>
                    <input
                      type="text"
                      value={qrConfig.account_number}
                      onChange={(e) => setQrConfig({ ...qrConfig, account_number: e.target.value })}
                      placeholder="e.g. 50200012345678"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      IFSC Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={qrConfig.ifsc_code}
                      onChange={(e) => setQrConfig({ ...qrConfig, ifsc_code: e.target.value })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono uppercase outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Student Payment Instructions Note
                  </label>
                  <textarea
                    rows={2}
                    value={qrConfig.instructions}
                    onChange={(e) => setQrConfig({ ...qrConfig, instructions: e.target.value })}
                    placeholder="Instructions displayed to students below the QR code..."
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                {/* Upload Official Bank / Standee QR Image */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Custom Physical Bank QR Image</div>
                      <div className="text-[11px] text-slate-400">
                        Upload your university bank counter standee QR code image (saved to Vercel Blob).
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={qrFileInputRef}
                      onChange={handleUploadQrImage}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef.current?.click()}
                      disabled={isUploadingQrImage}
                      className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 rounded-xl font-bold text-xs flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingQrImage ? "Uploading..." : "Upload QR Image"}</span>
                    </button>
                  </div>
                  {qrConfig.qr_image_url && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate">
                      ✓ Active CDN QR: {qrConfig.qr_image_url}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingQr}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingQr ? "Saving to Database..." : "Save & Publish Payment Settings"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Live Student Preview Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Student Screen Live Preview</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Exact preview of the payment QR presented to students.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="text-xs font-black text-slate-900 dark:text-white">{qrConfig.merchant_name}</div>
                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">{qrConfig.upi_id}</div>

                {qrConfig.qr_image_url ? (
                  <div className="w-44 h-44 mx-auto rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 p-2 bg-white shadow-inner flex items-center justify-center">
                    <img
                      src={qrConfig.qr_image_url}
                      alt="Uploaded QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 mx-auto rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-3 bg-white shadow-inner flex items-center justify-center">
                    <QRCodeSVG
                      value={`upi://pay?pa=${qrConfig.upi_id}&pn=${encodeURIComponent(qrConfig.merchant_name)}&cu=INR`}
                      size={150}
                      level="H"
                    />
                  </div>
                )}

                <div className="text-[10px] text-slate-500 dark:text-slate-400 px-2 leading-relaxed">
                  {qrConfig.instructions}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Financial Audit Report & Excel Export */}
        {activeTab === "AUDIT_EXCEL" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Institutional Payment Audit & Excel Export</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full immutable ledger of student fees, bank UTRs, and reviewer approval records.
                </p>
              </div>

              {/* Big Export to Excel Button */}
              <button
                onClick={handleExportToExcel}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Audit to Excel (.xlsx)</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search audit records by name, roll no, transaction UTR..."
                className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none font-mono"
              />
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Roll No</th>
                    <th className="p-3.5">Zone</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Inst.</th>
                    <th className="p-3.5">Transaction ID / UTR</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Reviewer</th>
                    <th className="p-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-mono">
                        No financial audit rows found.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {sub.student?.full_name || "Student"}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {sub.student?.enrollment_no || "Pending"}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                            {sub.zone_code || "ZONE_B"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(sub.amount_paid).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 font-mono">#{sub.installment_number || 1}</td>
                        <td className="p-3.5 font-mono text-slate-800 dark:text-slate-200">
                          {sub.transaction_id || "-"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              sub.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                                : sub.status === "PENDING_APPROVAL"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                          {sub.reviewed_by || "-"}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-400">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Route Commuter Demand & Bus Fleet Allocation */}
        {activeTab === "DEMAND_FLEET" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>Route Commuter Demand & Algorithmic Bus Fleet Allocation</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculated fleet sizing using active commuter volume, corridor stops, and 10% peak surge buffer.
                  </p>
                </div>
                <button
                  onClick={fetchRouteAnalytics}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
                  <span>Refresh Demand Data</span>
                </button>
              </div>
            </div>

            {isLoadingAnalytics ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span>Analyzing commuter load and route models...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {routeAnalytics.map((item) => {
                  const isUnderAllocated = item.fleetStatus === "UNDER_ALLOCATED";
                  const isOverAllocated = item.fleetStatus === "OVER_ALLOCATED";

                  return (
                    <div
                      key={item.routeId}
                      className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {item.routeCode} • {item.direction === "HOME_TO_CAMPUS" ? "Morning Inbound" : "Evening Return"}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isUnderAllocated
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300"
                              : isOverAllocated
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300"
                          }`}
                        >
                          {item.fleetStatus}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-black text-base text-slate-900 dark:text-white">{item.routeName}</h4>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          Distance: {item.totalDistanceKm} km • Corridor Capacity: {item.avgBusCapacity} seats/bus
                        </div>
                      </div>

                      {/* Demand vs Allocation Comparison Box */}
                      <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Total Demand</div>
                          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                            {item.totalCommuterDemand}
                          </div>
                          <div className="text-[9px] text-slate-400">{item.paidStudents} Paid</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                            Recommended
                          </div>
                          <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                            {item.recommendedBuses} Buses
                          </div>
                          <div className="text-[9px] text-slate-400">+10% buffer</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Currently Active</div>
                          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                            {item.assignedBusesCount} Buses
                          </div>
                          <div className="text-[9px] text-slate-400">{item.utilizationRate}% Utilized</div>
                        </div>
                      </div>

                      {/* Corridor Stops Breakdown */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Passenger Volume by Stop:</span>
                          <span className="font-mono text-[10px] text-slate-400">{item.stops.length} Stops</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs">
                          {item.stops.map((st: any) => (
                            <div
                              key={st.stopId}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-[11px]"
                            >
                              <span className="truncate max-w-[200px] text-slate-800 dark:text-slate-200">
                                {st.stopName}
                              </span>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-blue-600 dark:text-blue-400 font-bold">
                                  {st.registeredCount} Students
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Bus Merge Suggestions & Optimizer */}
        {activeTab === "MERGE_OPTIMIZER" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Dynamic Bus Merge Optimizer & Consolidation</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identifies under-capacity buses converging at Bus Merge Points to consolidate passengers, reducing fuel burn and carbon emissions.
                </p>
              </div>
              <button
                onClick={fetchMergeSuggestions}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMerges ? "animate-spin" : ""}`} />
                <span>Check Real-Time Merges</span>
              </button>
            </div>

            {isLoadingMerges ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                <span>Checking active trip telemetry at merge points...</span>
              </div>
            ) : mergeSuggestions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-mono space-y-2">
                <Zap className="w-8 h-8 mx-auto text-emerald-500" />
                <div>All active routes are currently operating at optimal capacity. No merge actions required.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mergeSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-purple-800/60 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-black">
                        Merge Point: {sug.mergePointName || "Tikonia Chauraha"}
                      </span>
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                        {sug.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400">Source Vehicle</div>
                        <div className="font-black text-slate-900 dark:text-white mt-0.5">{sug.sourceBusName}</div>
                        <div className="text-slate-500 text-[11px] mt-1 font-mono">
                          Occupancy: <strong className="text-amber-600">{sug.sourceOccupancy} passengers</strong>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400">Receiving Vehicle</div>
                        <div className="font-black text-slate-900 dark:text-white mt-0.5">{sug.targetBusName}</div>
                        <div className="text-slate-500 text-[11px] mt-1 font-mono">
                          Seats Available: <strong className="text-emerald-600">{sug.remainingSeats} remaining</strong>
                        </div>
                      </div>
                    </div>

                    {/* Savings Callout */}
                    <div className="p-3 rounded-2xl bg-purple-100/70 dark:bg-purple-950/40 text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between font-mono">
                      <span>Combined: {sug.combinedOccupancy} / {sug.targetCapacity} seats</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ⚡ Save ~7.5L Diesel
                      </span>
                    </div>

                    {sug.status === "PENDING" && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/merges", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                suggestionId: sug.id,
                                action: "APPROVE",
                                reviewedBy: currentUser?.fullName || "Transport Staff",
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              showToast("✓ Bus merge approved! Passengers consolidated to single vehicle.");
                              fetchMergeSuggestions();
                            }
                          } catch (err: any) {
                            alert("Merge error: " + err.message);
                          }
                        }}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                      >
                        Approve Bus Merge & Consolidate Fleet
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Daily Fleet Operations & Day Rollover */}
        {activeTab === "DAILY_OPERATIONS" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Operational Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-80 h-full bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-mono font-bold text-blue-300 mb-2">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Operational Transit Date: {rolloverStatus?.targetDate || selectedHistoryDate}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black">
                    Daily Transit Lifecycle & Automated Day Rollover
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl mt-1">
                    Historical records (trips, bookings, QR verification scans, audit trails) are preserved permanently in PostgreSQL.
                    Each operational day starts fresh with 0 seat occupancy and clean conductor manifests.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleExecuteRollover(rolloverStatus?.targetDate || selectedHistoryDate, true)}
                    disabled={isRolloverLoading}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RotateCcw className={`w-4 h-4 ${isRolloverLoading ? "animate-spin" : ""}`} />
                    <span>{isRolloverLoading ? "Executing Rollover..." : "Execute Today Rollover"}</span>
                  </button>

                  <button
                    onClick={() => {
                      const now = new Date();
                      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000);
                      const tomorrowStr = tomorrow.toISOString().split("T")[0];
                      handleExecuteRollover(tomorrowStr, true);
                    }}
                    disabled={isRolloverLoading}
                    className="px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Pre-Schedule Tomorrow</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Operational Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
                  Today's Active Trips
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {trips.filter((t) => t.tripDate === (rolloverStatus?.targetDate || selectedHistoryDate)).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Morning & Evening Shifts</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                  Today's Bookings
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {bookings.filter((b) => b.bookingDate === (rolloverStatus?.targetDate || selectedHistoryDate)).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Active Reservations</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-purple-600 dark:text-purple-400">
                  Total Historical Trips
                </div>
                <div className="text-2xl font-black font-mono mt-1">{trips.length}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Retained in PostgreSQL</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                  Fleet Readiness
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {buses.filter((b) => b.status === "ACTIVE").length} / {buses.length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Buses In Service</div>
              </div>
            </div>

            {/* Trips List Filtered by Date */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Operational Trips for Date:</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Filter by date to view historical runs, conductor assignments, and live statuses.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedHistoryDate}
                    onChange={(e) => setSelectedHistoryDate(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none"
                  />
                  <button
                    onClick={() => {
                      const now = new Date();
                      const istOffset = 5.5 * 60 * 60 * 1000;
                      setSelectedHistoryDate(new Date(now.getTime() + istOffset).toISOString().split("T")[0]);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Trips Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-black text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Trip Code</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Bus Number</th>
                      <th className="p-3">Shift</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Manifest</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {trips.filter((t) => !selectedHistoryDate || t.tripDate === selectedHistoryDate).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No trips scheduled for {selectedHistoryDate}. Click "Execute Today Rollover" to generate runs for this date.
                        </td>
                      </tr>
                    ) : (
                      trips
                        .filter((t) => !selectedHistoryDate || t.tripDate === selectedHistoryDate)
                        .map((t) => {
                          const r = routes.find((route) => route.id === t.routeId);
                          const b = buses.find((bus) => bus.id === t.busId);
                          const isCompleted = t.status === "COMPLETED";
                          const isInTransit = t.status === "IN_PROGRESS";

                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                {t.tripCode}
                              </td>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                {r?.name || t.routeId}
                              </td>
                              <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                                {b?.busNumber || t.busId}
                              </td>
                              <td className="p-3 font-mono">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                  {t.shiftId}
                                </span>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isCompleted
                                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                      : isInTransit
                                      ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 animate-pulse"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px]">
                                {t.manifestLocked ? "Locked 🔒" : "Open for Booking"}
                              </td>
                              <td className="p-3 font-mono text-slate-500">{t.tripDate}</td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Architecture Policy Card */}
            <div className="bg-blue-50/60 dark:bg-blue-950/30 rounded-3xl p-5 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-2">
              <div className="font-black text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Enterprise Transit Lifecycle Guarantee</span>
              </div>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                • <strong>Immutability:</strong> Old trips and passenger attendance records are never deleted from PostgreSQL, preserving full compliance and safety history.<br />
                • <strong>Fresh Morning Starts:</strong> Each day's trips are independent instances generated from route schedules. Student seat selection on <code className="px-1 rounded bg-blue-200/50 dark:bg-blue-900/50">/portal/booking</code> connects only to today's active trip, ensuring 100% seat availability.<br />
                • <strong>Self-Healing:</strong> If no external cron runner is active, the application automatically initiates today's operational runs on the first request of the day.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Lightbox Modal for Receipt Image */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Student Payment Receipt Verification</span>
              </h4>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 flex items-center justify-center">
              <img src={previewImageUrl} alt="Full Receipt" className="max-h-full max-w-full object-contain rounded-xl" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open high-res image in new tab</span>
              </a>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white">
            <h4 className="font-bold text-base text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>Reject Payment Submission</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide a clear reason for rejecting this payment. The student will be notified and asked to re-upload.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Transaction UTR does not match university bank statement, amount is incorrect..."
              className="w-full text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRejectModalId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
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
