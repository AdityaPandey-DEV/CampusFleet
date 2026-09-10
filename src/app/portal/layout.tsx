"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import { SOSModal } from "@/components/common/SOSModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { StudentProfileModal } from "@/components/auth/StudentProfileModal";
import {
  BusFront,
  Compass,
  QrCode,
  CalendarCheck,
  CreditCard,
  Lock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
    });
    return unsub;
  }, []);

  // Strict Access Guard: Student portal can only be seen by enrolled students (or parents)
  const isAuthorizedStudent = !currentUser || currentUser.role === "student" || currentUser.role === "parent";

  useEffect(() => {
    if (currentUser && currentUser.role && currentUser.role !== "student" && currentUser.role !== "parent") {
      const destination = authService.getTargetRouteForRole(currentUser.role);
      router.replace(destination);
    }
  }, [currentUser, router]);

  const activeStudent = currentUser
    ? students.find(
        s =>
          (activeChildId && (s.id === activeChildId || s.userId === activeChildId)) ||
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  const isStudent = currentUser?.role === "student";
  const isPaymentApproved = Boolean(
    activeStudent?.paymentStatus === "APPROVED" ||
      activeStudent?.hasActiveSubscription ||
      currentUser?.role === "admin"
  );
  const isPaymentPage = pathname === "/portal/payments";
  const isAccessBlocked = isStudent && !isPaymentApproved && !isPaymentPage;

  if (currentUser && !isAuthorizedStudent) {
    const role = currentUser.role;
    const targetRoute = authService.getTargetRouteForRole(role);
    const roleTitle = role.toUpperCase();

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Student Portal Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            You are signed in as <strong>{currentUser.fullName}</strong> with role{" "}
            <span className="text-purple-400 font-bold uppercase">{roleTitle}</span>. The Student Portal is strictly reserved for enrolled students.
          </p>
          <div className="pt-2">
            <Link
              href={targetRoute}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-lg shadow-purple-600/30 transition-all active:scale-95"
            >
              <span>Switch to {roleTitle} Console ({targetRoute})</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/portal", label: "Overview", icon: BusFront, requiresPayment: false },
    { href: "/portal/tracker", label: "Live Tracker", icon: Compass, requiresPayment: true },
    { href: "/portal/pass", label: "QR Pass", icon: QrCode, requiresPayment: true },
    { href: "/portal/booking", label: "Book Shift", icon: CalendarCheck, requiresPayment: true },
    { href: "/portal/payments", label: "Pass & Billing", icon: CreditCard, requiresPayment: false },
  ];

  const processedNavLinks = navLinks.map(link => ({
    ...link,
    isLocked: link.requiresPayment && !isPaymentApproved,
  }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-6 overflow-x-hidden">
      {/* Zero-Overflow Unified Header with Vertical Slide-Down Command Panel */}
      <UnifiedAppHeader
        role="student"
        portalTitle="CampusFleet"
        portalSubtitle="Student & Mobility Portal"
        navLinks={processedNavLinks}
        showSOS={true}
        onOpenSOS={() => setIsSOSOpen(true)}
      />

      {/* Main Content Container with Top-to-Down Progressive Flow */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {isAccessBlocked ? (
          <div className="max-w-2xl mx-auto my-10 p-6 sm:p-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-6 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-block text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                Transport Pass Inactive • Payment Required
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                Semester Transit Access Locked
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Without verified transit fee payment, seat booking, digital dynamic QR pass, and live fleet telematics are restricted.
              </p>
            </div>

            {activeStudent?.paymentStatus === "PENDING_APPROVAL" ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border border-amber-200 dark:border-amber-800 text-left space-y-1">
                <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  Receipt Uploaded — Awaiting Transport Staff Verification
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Your payment receipt has been uploaded and is queued for verification by the university transport desk.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  How to Unlock Your Transit Pass:
                </div>
                <ol className="text-[11px] text-slate-500 space-y-1 list-decimal list-inside">
                  <li>Choose your residential transit zone and installment option.</li>
                  <li>Scan the university payment QR code and pay via UPI.</li>
                  <li>Upload your payment screenshot — OCR will extract your transaction ID.</li>
                  <li>Transport staff will verify and instantly unlock your full portal access.</li>
                </ol>
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/portal/payments"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 transition-transform active:scale-95"
              >
                <CreditCard className="w-4 h-4" />
                <span>Go to Pass & Fee Payment Gateway →</span>
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Modern Floating Bottom Navigation Bar for Mobile Commuters */}
      <MobileBottomNav isPaymentApproved={isPaymentApproved} />

      {/* SOS Modal */}
      <SOSModal
        isOpen={isSOSOpen}
        onClose={() => setIsSOSOpen(false)}
        studentId={activeStudent?.id || currentUser?.id || ""}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialRole="student"
      />

      {/* Incomplete Profile Completion Modal */}
      <StudentProfileModal />
    </div>
  );
}
