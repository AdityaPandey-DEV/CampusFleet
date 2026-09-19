"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TRANSIT_ZONES, TransitZone, Student } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import { extractTransactionIdFromImage } from "@/lib/ocrService";
import type { OcrExtractionResult } from "@/lib/ocrService";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Download,
  Sparkles,
  FileText,
  ArrowRight,
  Upload,
  QrCode,
  AlertCircle,
  Clock,
  ExternalLink,
  Compass,
  Check,
  Copy,
  ScanLine,
  RefreshCw,
  Eye,
  AlertTriangle,
  Lock,
  BusFront,
  CalendarCheck,
  Printer,
} from "lucide-react";
import {
  isStudentSubscriptionActive,
  getSubscriptionRemainingDays,
  getSubscriptionStatusLabel,
} from "@/lib/subscription-utils";

export interface PortalPaymentsProps {
  initialUser?: any;
  initialStudents?: Student[];
  initialPayments?: any[];
  initialZones?: TransitZone[];
}

export default function PortalPaymentsView({
  initialUser,
  initialStudents = [],
  initialPayments = [],
  initialZones = [],
}: PortalPaymentsProps = {}) {
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [payments, setPayments] = useState<any[]>(() => initialPayments.length > 0 ? initialPayments : store.getPayments());

  // Active student calculation
  const activeStudent: Student | null = useMemo(() => {
    if (!currentUser) return null;
    return (
      students.find(
        (s) =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    );
  }, [currentUser, students, activeChildId]);

  // Zone & Payment Plan State (Loaded dynamically from PostgreSQL by student's campus)
  const studentCampusId = activeStudent?.campusId || currentUser?.campusId;
  const [transitZones, setTransitZones] = useState<TransitZone[]>(() => store.getTransitZones(studentCampusId));
  const initialZone = activeStudent?.zoneCode || "ZONE_B";
  const [selectedZoneCode, setSelectedZoneCode] = useState<string>(initialZone);
  const currentZone = useMemo(() => {
    const studentZoneCode = activeStudent?.zoneCode || selectedZoneCode || "ZONE_B";
    if (studentCampusId) {
      const matchCampus = transitZones.find(
        (z) => z.code === studentZoneCode && z.campusId === studentCampusId
      );
      if (matchCampus) return matchCampus;
    }
    const matchCode = transitZones.find((z) => z.code === studentZoneCode);
    if (matchCode) return matchCode;
    return transitZones[0] || TRANSIT_ZONES[1];
  }, [selectedZoneCode, transitZones, activeStudent?.zoneCode, studentCampusId]);

  useEffect(() => {
    setTransitZones(store.getTransitZones(studentCampusId));
  }, [studentCampusId]);

  // Payment Amount (defaults to zone fee or remaining balance, with support for custom/partial transfers)
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>("");

  const remainingDue = useMemo(() => {
    const total = currentZone.semesterFee;
    const paid = Number(activeStudent?.totalFeePaid || 0);
    return Math.max(0, total - paid);
  }, [currentZone, activeStudent]);

  const amountToPay = useMemo(() => {
    if (paymentAmountInput && !isNaN(Number(paymentAmountInput)) && Number(paymentAmountInput) > 0) {
      return Number(paymentAmountInput);
    }
    return remainingDue > 0 ? remainingDue : currentZone.semesterFee;
  }, [paymentAmountInput, remainingDue, currentZone]);

  // Upload & OCR State
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [isScanningOcr, setIsScanningOcr] = useState<boolean>(false);
  const [detectedTransactionId, setDetectedTransactionId] = useState<string | null>(null);
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const [ocrFullText, setOcrFullText] = useState<string>("");
  const [transactionIdInput, setTransactionIdInput] = useState<string>("");
  const [manualInputRequired, setManualInputRequired] = useState<boolean>(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync store
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setPayments(store.getPayments());
      setTransitZones(store.getTransitZones(studentCampusId));
    });
    return unsub;
  }, []);

  // Update selectedZoneCode if student profile changes
  useEffect(() => {
    if (activeStudent?.zoneCode) {
      setSelectedZoneCode(activeStudent.zoneCode);
    }
  }, [activeStudent?.zoneCode]);

  // Fetch pending submissions for this student
  useEffect(() => {
    if (!activeStudent?.id) return;
    fetch(`/api/payments/approvals?studentId=${activeStudent.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.submissions) {
          const studentSubs = data.submissions.filter(
            (s: any) => s.student_id === activeStudent.id || s.student_id === activeStudent.userId
          );
          setPendingSubmissions(studentSubs);
        }
      })
      .catch(console.error);
  }, [activeStudent?.id, activeStudent?.userId, submitSuccess]);

  // Fetch staff-configured official payment QR and UPI VPA from database
  const [staffQrConfig, setStaffQrConfig] = useState<any>({
    upi_id: "gehubhimtal.transit@upi",
    merchant_name: `${store.getPrimaryCampus()?.name || "Campus"} Transport Department`,
    qr_image_url: "",
    instructions: "Scan via Google Pay, PhonePe, Paytm, or BHIM.",
  });

  useEffect(() => {
    fetch("/api/staff/qr-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setStaffQrConfig(data.config);
        }
      })
      .catch(console.error);
  }, []);

  // UPI Link
  const upiId = staffQrConfig.upi_id || "gehubhimtal.transit@upi";
  const upiPayUrl = useMemo(() => {
    const enrollment = activeStudent?.enrollmentNo && activeStudent?.enrollmentNo !== "PENDING"
      ? activeStudent.enrollmentNo
      : "STUDENT";
    return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(staffQrConfig.merchant_name || `${store.getPrimaryCampus()?.name || "Campus"} Transport`)}&am=${amountToPay}&cu=INR&tn=CampusFleet%20Pass%20${enrollment}%20Zone%20${selectedZoneCode}`;
  }, [amountToPay, selectedZoneCode, activeStudent, upiId, staffQrConfig.merchant_name]);

  // Handle Receipt File Selection & Trigger OCR
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFile(file);
    const objectUrl = URL.createObjectURL(file);
    setReceiptPreviewUrl(objectUrl);
    setSubmitError(null);
    setDuplicateError(null);
    setDetectedTransactionId(null);
    setDetectedAmount(null);
    setOcrFullText("");
    setManualInputRequired(false);

    // Trigger OCR Detection (extracts both Transaction ID AND Amount)
    setIsScanningOcr(true);
    setOcrStatus("Analyzing receipt image with OCR...");

    try {
      const result = await extractTransactionIdFromImage(file, (msg) => setOcrStatus(msg));
      setIsScanningOcr(false);
      setOcrStatus(null);
      setOcrFullText(result.fullText || "");

      if (result.transactionId) {
        setDetectedTransactionId(result.transactionId);
        setTransactionIdInput(result.transactionId);
        setManualInputRequired(false);
      } else {
        setDetectedTransactionId(null);
        setManualInputRequired(true);
      }

      // Extract amount from receipt
      if (result.amount && result.amount > 0) {
        setDetectedAmount(result.amount);
        setPaymentAmountInput(String(result.amount));
      }
    } catch (err) {
      console.warn("OCR failure:", err);
      setIsScanningOcr(false);
      setOcrStatus(null);
      setManualInputRequired(true);
    }
  };

  // Submit Payment for Staff Verification
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please sign in to submit fee payment.");
      return;
    }
    if (!receiptFile) {
      setSubmitError("Please upload your payment screenshot / receipt image.");
      return;
    }
    if (!transactionIdInput.trim()) {
      setSubmitError("Please enter your 12-digit UPI UTR or Bank Transaction Reference ID.");
      return;
    }

    // Client-side duplicate check against already uploaded receipts
    const isLocalDuplicate = pendingSubmissions.some(
      (s: any) => s.transaction_id === transactionIdInput.trim()
    );
    if (isLocalDuplicate) {
      setSubmitError("You have already submitted this transaction ID. Please use a new receipt for your next installment.");
      return;
    }

    // Check if this receipt will complete the full payment — show confirmation first
    const currentPaid = Number(activeStudent?.totalFeePaid || 0);
    const pendingAmount = pendingSubmissions
      .filter((s: any) => s.status === "PENDING_APPROVAL")
      .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
    const totalAfterThis = currentPaid + pendingAmount + amountToPay;
    const totalDue = currentZone.semesterFee;

    if (totalDue > 0 && totalAfterThis >= totalDue) {
      // This receipt completes the full fee — show confirmation step
      setShowFinalConfirmation(true);
      return;
    }

    // Otherwise submit directly
    await executeSubmit();
  };

  // Actual submission logic (called directly or after confirmation)
  const executeSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    setDuplicateError(null);

    try {
      // 1. Upload receipt to Vercel Blob Storage
      const formData = new FormData();
      formData.append("file", receiptFile as File);

      const uploadRes = await fetch("/api/payments/upload-receipt", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || "Failed to upload receipt to Vercel Blob Storage.");
      }

      const receiptBlobUrl = uploadData.url;

      // 2. Submit payment record for staff approval (with uniqueness check + amount tracking)
      const submitRes = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentId: activeStudent?.id || `stud-${currentUser.id}`,
          studentName: activeStudent?.fullName || currentUser.fullName,
          enrollmentNo: activeStudent?.enrollmentNo || "PENDING",
          zoneCode: currentZone.code || selectedZoneCode,
          amount: amountToPay,
          scannedAmount: detectedAmount,
          installmentNo: (pendingSubmissions.filter((s: any) => s.status !== "REJECTED").length || 0) + 1,
          totalInstallments: currentZone.installmentsAllowed || 3,
          receiptUrl: receiptBlobUrl,
          transactionId: transactionIdInput.trim(),
          autoDetected: Boolean(detectedTransactionId && detectedTransactionId === transactionIdInput.trim()),
          ocrFullText: ocrFullText.slice(0, 2000),
        }),
      });
      const submitData = await submitRes.json();

      if (!submitRes.ok || !submitData.success) {
        // Handle duplicate transaction ID specifically
        if (submitData.code === "DUPLICATE_TRANSACTION_ID") {
          setDuplicateError(submitData.error);
          throw new Error(submitData.error);
        }
        throw new Error(submitData.error || "Failed to record payment submission.");
      }

      // 3. Update local student state
      if (activeStudent) {
        activeStudent.paymentStatus = submitData.balance?.isFullyPaid ? "APPROVED" : "PENDING_APPROVAL";
        activeStudent.zoneCode = currentZone.code || selectedZoneCode;
        if (submitData.balance) {
          activeStudent.totalFeePaid = submitData.balance.totalPaid;
        }
      }

      const balanceMsg = submitData.balance
        ? ` Balance: ₹${submitData.balance.amountLeft.toLocaleString()} remaining.`
        : "";
      setSubmitSuccess(
        submitData.balance?.isFullyPaid
          ? "🎉 All installments submitted! Your receipts are queued for staff verification. Access will be unlocked automatically once approved."
          : `Payment receipt uploaded successfully!${balanceMsg} Transport staff has been notified.`
      );
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      setTransactionIdInput("");
      setPaymentAmountInput("");
      setDetectedTransactionId(null);
      setDetectedAmount(null);
      setOcrFullText("");
      setManualInputRequired(false);

      // Refresh store
      store.syncFromSupabase();
    } catch (err: any) {
      console.error("Payment submission failed:", err);
      if (!duplicateError) {
        setSubmitError(err.message || "Payment submission failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPassApproved = isStudentSubscriptionActive(activeStudent);
  const isSubscriptionExpired = activeStudent?.subscriptionExpiryDate
    ? Date.now() > new Date(activeStudent.subscriptionExpiryDate).getTime()
    : false;
  const remainingDays = getSubscriptionRemainingDays(activeStudent);
  const isPendingApproval =
    !isPassApproved &&
    (activeStudent?.paymentStatus === "PENDING_APPROVAL" ||
      pendingSubmissions.some((s) => s.status === "PENDING_APPROVAL"));

  return (
    <div className="space-y-8 animate-in fade-in max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-teal-600" />
            Pass & Fee Payment Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official semester transit subscription with UPI QR payments, multiple installment options, and Vercel Blob verification.
          </p>
        </div>

        {/* Status Chip */}
        <div>
          {isPassApproved ? (
            <span className="px-4 py-2 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Verified & Pass Active ({remainingDays}d left)
            </span>
          ) : isSubscriptionExpired ? (
            <span className="px-4 py-2 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Pass Expired • Renewal Needed
            </span>
          ) : isPendingApproval ? (
            <span className="px-4 py-2 rounded-2xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <Clock className="w-4 h-4 text-amber-600 animate-spin" />
              Receipt Under Staff Verification
            </span>
          ) : (
            <span className="px-4 py-2 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-extrabold text-xs flex items-center gap-1.5 shadow-sm">
              <Lock className="w-4 h-4 text-rose-600" />
              Payment Required For Access
            </span>
          )}
        </div>
      </div>

      {/* Main Status Hero Card */}
      <div
        className={`rounded-3xl p-6 text-white shadow-xl relative overflow-hidden transition-all ${
          isPassApproved
            ? "bg-gradient-to-r from-teal-800 via-emerald-800 to-blue-900"
            : isPendingApproval
            ? "bg-gradient-to-r from-amber-700 via-orange-800 to-slate-900"
            : "bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="text-xs uppercase font-extrabold tracking-wider text-teal-200 flex items-center gap-2">
              <Compass className="w-4 h-4" />
              {currentZone.name}
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight">
              {isPassApproved ? "Academic Term Transit Pass" : "Semester Transit Access Gate"}
            </div>
            <p className="text-xs text-slate-200 max-w-xl leading-relaxed">
              {currentZone.corridorDescription}. Covers all morning, afternoon, and evening shifts to Graphic Era Hill University (Bhimtal Campus).
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-mono">
              <span>Full Semester Fee: <strong>{formatCurrency(currentZone.semesterFee)}</strong></span>
              <span>•</span>
              <span>Paid So Far: <strong>{formatCurrency(activeStudent?.totalFeePaid || 0)}</strong></span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-center min-w-[200px]">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-300">
              Access Status
            </div>
            <div className="text-xl font-black mt-1">
              {isPassApproved ? "UNLOCKED" : isPendingApproval ? "AUDITING" : "LOCKED"}
            </div>
            <div className="text-[11px] text-teal-200 mt-1">
              {isPassApproved
                ? `Valid until ${formatDate(activeStudent?.subscriptionExpiryDate || "2026-12-31")}`
                : isPendingApproval
                ? "Awaiting Staff Review"
                : "Pay Fee to Unlock"}
            </div>
          </div>
        </div>
      </div>

      {/* Conditional Rendering:
          1. If Subscription Active: Deactivate payment controls & display Active Transit Subscription Certificate
          2. If Inactive/Expired: Display Zone Selection & UPI Payment Upload Form */}
      {isPassApproved ? (
        <div className="space-y-6">
          {/* Active Institutional Transit Subscription Dashboard */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-emerald-200 dark:border-emerald-900/60 shadow-xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner flex-shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider mb-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Billing Deactivated • Pass Active & Verified
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    Institutional Transit Subscription Active
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Your semester transit fees are settled. Fee payment & billing controls are deactivated until your current subscription ends.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>

            {/* Specifications Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 relative z-10">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">
                  Subscription Validity
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {formatDate(activeStudent?.subscriptionExpiryDate || "2026-12-31")}
                </div>
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {remainingDays} days remaining in cycle
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">
                  Corridor & Zone
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {currentZone.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {currentZone.corridorDescription}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">
                  Registered Commuter
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {activeStudent?.fullName || currentUser?.fullName}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  ID: {activeStudent?.enrollmentNo || "VERIFIED"}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400">
                  Transit Fee Status
                </div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(activeStudent?.totalFeePaid || currentZone.semesterFee)} Paid
                </div>
                <div className="text-[11px] text-slate-500">
                  Pass Active • No Action Required
                </div>
              </div>
            </div>

            {/* Quick Access to Operational Commute Pages */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3 relative z-10">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Operational Commute Portals Activated:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Link
                  href="/portal"
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 group-hover:scale-105 transition-transform">
                      <BusFront className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Commute Cockpit
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Timetable & alerts
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </Link>

                <Link
                  href="/portal/booking"
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 group-hover:scale-105 transition-transform">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Seat Booking
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Reserve shift seat
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </Link>

                <Link
                  href="/portal/pass"
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 group-hover:scale-105 transition-transform">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Digital QR Pass
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Dynamic QR ticket
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 transition-colors" />
                </Link>

                <Link
                  href="/portal/tracker"
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 group-hover:scale-105 transition-transform">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        Live Bus Radar
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Real-time GPS tracking
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Subscription Expiration Alert Banner */}
          {isSubscriptionExpired && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 to-rose-500/10 dark:from-amber-950/30 dark:to-rose-950/30 rounded-3xl border border-amber-300 dark:border-amber-800/80 flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Subscription Cycle Concluded • Pass Renewal Required
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your previous transit pass expired on <strong>{formatDate(activeStudent?.subscriptionExpiryDate || "2026-12-31")}</strong>. Operational commute features (Seat Booking, QR Pass, Radar) have been locked. Please submit fee payment below to reactivate your pass for the upcoming semester cycle.
                </p>
              </div>
            </div>
          )}

          {/* Registered Transit Corridor Overview (Configured in Student Profile) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-900/50 shadow-sm">
                <Compass className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-600 text-white tracking-wide">
                    {currentZone.code}
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {currentZone.name.split(":")[1]?.trim() || currentZone.name}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Registered Route Corridor: </span>
                  {currentZone.corridorDescription}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0 self-start md:self-center pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 w-full md:w-auto justify-between md:justify-end">
              <div className="text-left md:text-right">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Semester Fee</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(currentZone.semesterFee)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("open-student-profile"))}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors shadow-sm"
              >
                Change in Profile
              </button>
            </div>
          </div>

          {/* Step 1: UPI QR Code & Vercel Blob Receipt Upload */}
          {!isPendingApproval ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: UPI QR Code */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 flex items-center justify-center font-black text-sm">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      Scan QR Code to Pay
                    </h2>
                    <p className="text-xs text-slate-500">Scan via Google Pay, PhonePe, Paytm, or BHIM</p>
                  </div>
                </div>

                {/* QR Code Card */}
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-inner">
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center">
                    {staffQrConfig.qr_image_url ? (
                      <img
                        src={staffQrConfig.qr_image_url}
                        alt="Official Payment QR"
                        className="w-[190px] h-[190px] object-contain rounded-xl"
                      />
                    ) : (
                      <QRCodeSVG
                        value={upiPayUrl}
                        size={190}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: "/favicon.ico",
                          x: undefined,
                          y: undefined,
                          height: 28,
                          width: 28,
                          excavate: true,
                        }}
                      />
                    )}
                  </div>

                  <div className="text-center mt-4 space-y-1">
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(amountToPay)}
                    </div>
                    <div className="text-xs font-bold text-teal-600 dark:text-teal-400">
                      {amountToPay === currentZone.semesterFee ? "Semester Transit Fee" : "Custom Transfer Amount"}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Merchant: {staffQrConfig.merchant_name || "Graphic Era Hill University (Bhimtal)"}
                    </div>
                  </div>
                </div>

                {/* UPI ID Copy bar */}
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-between gap-2 text-xs">
                  <div className="font-mono text-slate-700 dark:text-slate-300 truncate">
                    {upiId}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(upiId);
                      setCopiedUpi(true);
                      setTimeout(() => setCopiedUpi(false), 2000);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1 shadow-sm transition-colors text-[11px]"
                  >
                    {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUpi ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <div>✓ Instant verification with institutional reference</div>
                <div>✓ Supports all NPCI UPI banking applications</div>
              </div>
            </div>

            {/* Right Col: Vercel Blob Receipt Upload + OCR + Staff Submit */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center font-black text-sm">
                  2
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Upload Receipt & Confirm Transaction ID
                  </h2>
                  <p className="text-xs text-slate-500">
                    Uploaded securely to Vercel Blob storage with automatic OCR UTR detection.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-5">
                {/* Vercel Blob File Dropzone */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!receiptPreviewUrl ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-3xl text-center cursor-pointer bg-slate-50 dark:bg-slate-800/40 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-sm text-slate-800 dark:text-white">
                        Click or drag & drop payment screenshot here
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Supports PNG, JPG, JPEG (Stored via Vercel Blob Storage)
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Uploaded Payment Receipt
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-blue-600 hover:underline font-bold"
                        >
                          Change Image
                        </button>
                      </div>

                      <div className="relative rounded-2xl overflow-hidden max-h-48 border border-slate-200 dark:border-slate-700 bg-black/5 flex items-center justify-center">
                        <img
                          src={receiptPreviewUrl}
                          alt="Payment Receipt Preview"
                          className="max-h-48 object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewModalUrl(receiptPreviewUrl)}
                          className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black text-white text-[11px] font-bold rounded-lg flex items-center gap-1 backdrop-blur"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Full
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* OCR Progress / Status */}
                {isScanningOcr && (
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-center gap-3 text-xs text-blue-800 dark:text-blue-300 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="font-bold">{ocrStatus || "Scanning receipt for UTR number..."}</span>
                  </div>
                )}

                {/* Auto-Detection Notification */}
                {detectedTransactionId && !isScanningOcr && (
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold">✓ Transaction ID Auto-Detected from Receipt!</div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Found UTR: <span className="font-mono font-bold text-slate-900 dark:text-white">{detectedTransactionId}</span>
                        {detectedAmount ? (
                          <> | Amount: <span className="font-mono font-bold text-slate-900 dark:text-white">₹{detectedAmount.toLocaleString()}</span></>
                        ) : null}
                        . Please verify or edit below if needed.
                      </div>
                    </div>
                  </div>
                )}

                {/* Duplicate Transaction ID Error */}
                {duplicateError && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300">
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold">⚠ Duplicate Transaction ID Detected</div>
                      <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                        {duplicateError}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback Notification if not detected */}
                {manualInputRequired && !isScanningOcr && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold">Could Not Auto-Detect Transaction ID</div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        Please write or copy your 12-digit UPI UTR number / Bank Reference ID manually below.
                      </div>
                    </div>
                  </div>
                )}

                {/* Running Balance Progress Bar */}
                {currentZone.semesterFee > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Payment Progress</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatCurrency(Number(activeStudent?.totalFeePaid || 0))} / {formatCurrency(currentZone.semesterFee)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          remainingDue <= 0
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : "bg-gradient-to-r from-blue-500 to-indigo-500"
                        }`}
                        style={{ width: `${Math.min(100, ((Number(activeStudent?.totalFeePaid || 0)) / currentZone.semesterFee) * 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Approved: {formatCurrency(Number(activeStudent?.totalFeePaid || 0))}</span>
                      <span className={remainingDue <= 0 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                        {remainingDue <= 0 ? "✓ Fully Paid" : `₹${remainingDue.toLocaleString()} remaining`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Amount Paid Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Amount Paid in this Receipt (₹) *</span>
                    <span className="text-[10px] text-slate-400">
                      Total Semester Fee: {formatCurrency(currentZone.semesterFee)}
                    </span>
                  </label>
                  <input
                    type="number"
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    placeholder={String(amountToPay)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    You can upload multiple receipts & transaction IDs if paying across multiple transfers.
                  </p>
                </div>

                {/* Transaction ID Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Transaction ID / UPI UTR Number *</span>
                    {detectedTransactionId && (
                      <span className="text-[10px] text-emerald-600 font-extrabold uppercase">
                        Auto-Filled from Receipt
                      </span>
                    )}
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 428194829104 (12-digit UPI UTR)"
                    value={transactionIdInput}
                    onChange={(e) => setTransactionIdInput(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono font-bold outline-none transition-colors ${
                      detectedTransactionId
                        ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 text-slate-900 dark:text-white"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500"
                    }`}
                  />
                  <p className="text-[10px] text-slate-400">
                    Available in your UPI app under Transaction Details (Google Pay, PhonePe, Paytm, or BHIM).
                  </p>
                </div>

                {/* Error Message */}
                {submitError && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 rounded-2xl border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                    <span>{submitError}</span>
                  </div>
                )}

                {/* Success Message */}
                {submitSuccess && (
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{submitSuccess}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isScanningOcr}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading to Vercel Blob & Submitting...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Send Receipt for Staff Verification</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-3xl p-10 border border-amber-200 dark:border-amber-800 shadow-sm flex flex-col items-center justify-center text-center space-y-4 mt-6">
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <Clock className="w-10 h-10 animate-spin" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                Payment Verification in Progress
              </h2>
              <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                Your payment receipt is currently under manual review by the campus transport staff. The UPI Payment form has been hidden while we process your existing transaction. Access will be unlocked automatically once approved.
              </p>
            </div>
          )}
        </>
      )}

      {/* Submission Status & Audit History */}
      {pendingSubmissions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Your Payment Submissions & Staff Review History
            </h3>
            <span className="text-xs text-slate-400">
              {pendingSubmissions.length} record(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Submitted At</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Receipt Image</th>
                  <th className="p-3">Staff Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingSubmissions.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 text-slate-500">{new Date(sub.created_at).toLocaleString()}</td>
                    <td className="p-3 font-bold">{sub.zone_code}</td>
                    <td className="p-3 font-black text-slate-900 dark:text-white">
                      {formatCurrency(sub.amount)}
                    </td>
                    <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {sub.transaction_id}
                    </td>
                    <td className="p-3">
                      <a
                        href={sub.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Blob
                      </a>
                    </td>
                    <td className="p-3">
                      {sub.status === "APPROVED" ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase">
                          ✓ Approved & Active
                        </span>
                      ) : sub.status === "REJECTED" ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] uppercase">
                          ❌ Rejected
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] uppercase">
                          ⏳ Awaiting Verification
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full-size Image Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-sm text-slate-800 dark:text-white">Receipt Screenshot Preview</span>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center max-h-[75vh] overflow-auto">
              <img src={previewModalUrl} alt="Receipt Screenshot" className="rounded-xl object-contain max-h-[70vh]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
