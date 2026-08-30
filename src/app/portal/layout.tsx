"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SOSModal } from "@/components/common/SOSModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { StudentProfileModal } from "@/components/auth/StudentProfileModal";
import {
  BusFront,
  Compass,
  QrCode,
  CalendarCheck,
  CreditCard,
  Bell,
  AlertOctagon,
  Users,
  Shield,
  LogOut,
  ChevronDown,
  Key,
} from "lucide-react";
import { RolePortalSwitcher } from "@/components/common/RolePortalSwitcher";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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
  const [notifications, setNotifications] = useState(store.getNotifications());
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [isChildMenuOpen, setIsChildMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await store.logout();
    router.push("/login");
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
      setNotifications(store.getNotifications());
    });
    return unsub;
  }, []);

  const activeStudent = students.find(s => s.id === activeChildId) || students[0];
  const unreadNotifs = notifications.filter(n => !n.isRead).length;

  const navLinks = [
    { href: "/portal", label: "Overview", icon: BusFront },
    { href: "/portal/tracker", label: "Live Tracker", icon: Compass },
    { href: "/portal/pass", label: "QR Pass", icon: QrCode },
    { href: "/portal/booking", label: "Book Shift", icon: CalendarCheck },
    { href: "/portal/payments", label: "Pass & Billing", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-0 overflow-x-hidden">
      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <Link href="/portal" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <BusFront className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  Campus<span className="text-blue-600 dark:text-blue-400">Ride</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  Student & Parent Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Header Actions */}
          <div className="hidden md:flex items-center gap-2.5 sm:gap-3">
            {/* User Profile / Multi-Child Selector or Sign In button */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsChildMenuOpen(!isChildMenuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span className="max-w-[120px] truncate">
                    {currentUser.fullName.split(" ")[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {isChildMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 py-1">
                      Linked Children / Profiles
                    </div>
                    {students.map(s => (
                      <button
                        key={s.id}
                        onClick={() => {
                          store.setActiveChildId(s.id);
                          setIsChildMenuOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                          s.id === activeChildId
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div>
                          <div>{s.fullName}</div>
                          <div className="text-[10px] text-slate-400">{s.department}</div>
                        </div>
                        {s.id === activeChildId && (
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-transform active:scale-95"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Universal Cross-Portal Role Switcher */}
            <RolePortalSwitcher />

            {(currentUser?.role === "admin" || currentUser?.role === "transport_manager") && (
              <Link
                href="/admin"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors"
              >
                <span>Admin Operations →</span>
              </Link>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Emergency SOS Trigger */}
            <button
              onClick={() => setIsSOSOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/30 transition-all active:scale-95 animate-pulse"
              title="Emergency SOS Button"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>

            {/* Auth / Account Switcher */}
            <button
              onClick={() => setIsAuthOpen(true)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Sign In / Switch Account"
            >
              <Key className="w-4 h-4 text-blue-600" />
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Clean Header Trigger (No Overflow!) */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setIsSOSOpen(true)}
              className="px-2.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-sm active:scale-95"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>SOS</span>
            </button>

            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Open Navigation Drawer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sliding Drawer Navbar (Off-Canvas Menu) */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end animate-in fade-in">
          {/* Dark Overlay */}
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Sliding Drawer Container */}
          <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-10 flex flex-col justify-between p-5 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-700 to-teal-500 flex items-center justify-center text-white font-bold">
                    <BusFront className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-black text-sm text-slate-900 dark:text-white">CampusRide</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mobile Portal</div>
                  </div>
                </div>

                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* User Identity Card */}
              {currentUser ? (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Logged In Commuter
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {currentUser.fullName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
                  <span className="inline-block mt-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {currentUser.role}
                  </span>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                >
                  <Key className="w-4 h-4" />
                  <span>Sign In with University Account</span>
                </Link>
              )}

              {/* Navigation Links */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                  Navigation
                </div>
                {navLinks.map(link => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-black shadow-sm"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                {(currentUser?.role === "admin" || currentUser?.role === "transport_manager") && (
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Admin Operations Console →</span>
                  </Link>
                )}
              </div>

              {/* Controls Section */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3">
                  Settings & Controls
                </div>

                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Theme Mode</span>
                  <ThemeToggle />
                </div>

                <div className="px-3">
                  <RolePortalSwitcher align="left" />
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setIsSOSOpen(true);
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Emergency SOS Hotline</span>
              </button>

              {currentUser && (
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    handleSignOut();
                  }}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 hover:text-rose-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
        {navLinks.map(link => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-bold scale-105"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{link.label}</span>
            </Link>
          );
        })}
      </nav>

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
