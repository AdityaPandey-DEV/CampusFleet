"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { TRANSIT_ZONES, TransitZone, Student } from "@/lib/types";
import type { OcrExtractionResult } from "@/lib/ocrService";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";
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
}: PortalPaymentsProps) {
  const router = useRouter();
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
  const remainingDue = useMemo(() => {
    const total = currentZone.semesterFee;
    const paid = Number(activeStudent?.totalFeePaid || 0);
    return Math.max(0, total - paid);
  }, [currentZone, activeStudent]);

  const amountToPay = useMemo(() => {
    return remainingDue > 0 ? remainingDue : currentZone.semesterFee;
  }, [remainingDue, currentZone]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isRazorpayLoading, setIsRazorpayLoading] = useState<boolean>(false);

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



  // Razorpay Express Checkout
  const handleRazorpayCheckout = async () => {
    if (!currentUser) {
      alert("Please sign in to proceed with payment.");
      return;
    }
    
    setIsRazorpayLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    
    try {
      const studentId = activeStudent?.id || `stud-${currentUser.id}`;
      
      const orderRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountToPay, studentId }),
      });
      
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to initialize payment gateway.");
      }
      
      const options = {
        key: orderData.key_id,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: "CampusFleet Transit",
        description: `Transit Pass - ${currentZone.name}`,
        order_id: orderData.order.id,
        handler: async function (response: any) {
           try {
             const verifyRes = await fetch("/api/payments/razorpay/verify", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({
                 razorpay_order_id: response.razorpay_order_id,
                 razorpay_payment_id: response.razorpay_payment_id,
                 razorpay_signature: response.razorpay_signature,
               }),
             });
             
             const verifyData = await verifyRes.json();
             
             if (verifyRes.ok && verifyData.success) {
               setSubmitSuccess("🎉 Payment Successful! Your transit pass will be unlocked momentarily.");
               setTimeout(() => {
                 window.location.reload();
               }, 2500);
             } else {
               setSubmitError(`Payment verification failed: ${verifyData.error || "Unknown error"}`);
             }
           } catch (err: any) {
             setSubmitError(`Verification error: ${err.message}`);
           }
        },
        prefill: {
          name: activeStudent?.fullName || currentUser.fullName || "",
          email: activeStudent?.email || currentUser.email || "",
          contact: activeStudent?.phone || "",
        },
        theme: {
          color: "#2563eb",
        },
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setSubmitError(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsRazorpayLoading(false);
    }
  };

  const isPassApproved = isStudentSubscriptionActive(activeStudent);
  const isSubscriptionExpired = activeStudent?.subscriptionExpiryDate
    ? Date.now() > new Date(activeStudent.subscriptionExpiryDate).getTime()
    : false;
  const remainingDays = getSubscriptionRemainingDays(activeStudent);
  const currentPaid = Number(activeStudent?.totalFeePaid || 0);
  const pendingAmountVal = pendingSubmissions
    .filter((s: any) => s.status === "PENDING_APPROVAL" || s.status === "APPROVED")
    .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
  const totalSubmittedOrApproved = currentPaid + pendingAmountVal;
  
  const isFullySubmitted =
    !isPassApproved &&
    (currentZone?.semesterFee > 0 && totalSubmittedOrApproved >= currentZone.semesterFee);

  return (
    <div className="space-y-8 animate-in fade-in max-w-5xl mx-auto pb-12">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-teal-600" />
            Pass & Fee Payment Gateway
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            You can upload multiple receipts until your total semester fee is paid.
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
          ) : isFullySubmitted ? (
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
            : isFullySubmitted
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
              {isPassApproved ? "UNLOCKED" : isFullySubmitted ? "AUDITING" : "LOCKED"}
            </div>
            <div className="text-[11px] text-teal-200 mt-1">
              {isPassApproved
                ? `Valid until ${formatDate(activeStudent?.subscriptionExpiryDate || "2026-12-31")}`
                : isFullySubmitted
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
                onClick={() => router.push("/portal/onboarding")}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors shadow-sm"
              >
                Change in Profile
              </button>
            </div>
          </div>

          {/* Step 1: UPI QR Code & Vercel Blob Receipt Upload */}
          {!isFullySubmitted ? (
            <div className="space-y-8">
              
              {/* Razorpay Express Checkout */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border-2 border-blue-500 shadow-xl flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full uppercase tracking-widest">Recommended</span>
                </div>
                <ShieldCheck className="w-12 h-12 text-blue-500" />
                <div>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white">Instant Pass Activation</h2>
                   <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">Pay securely with UPI, Cards, or Netbanking. Your transit pass will be unlocked instantly without waiting for staff verification.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRazorpayCheckout}
                  disabled={isRazorpayLoading}
                  className="w-full max-w-sm py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-lg flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 mt-4"
                >
                  {isRazorpayLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                  {isRazorpayLoading ? "Connecting to Secure Gateway..." : `Pay ${formatCurrency(amountToPay)} Securely`}
                </button>
              </div>

            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-3xl p-10 border border-amber-200 dark:border-amber-800 shadow-sm flex flex-col items-center justify-center text-center space-y-4 mt-6">
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <Clock className="w-10 h-10 animate-spin" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                All Receipts Submitted — Verification in Progress
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


    </div>
  );
}
