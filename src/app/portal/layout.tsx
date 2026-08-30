"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SOSModal } from "@/components/common/SOSModal";
import { AuthModal } from "@/components/auth/AuthModal";
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

export default function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());
  const [notifications, setNotifications] = useState(store.getNotifications());
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [isChildMenuOpen, setIsChildMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-0">
      {/* Top Universal Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
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

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Multi-Child Selector for Parents */}
            <div className="relative">
              <button
                onClick={() => setIsChildMenuOpen(!isChildMenuOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline max-w-[120px] truncate">
                  {activeStudent?.fullName.split(" ")[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {isChildMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 py-1">
                    Linked Children
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

            {/* Switch Panel Shortcut */}
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Switch Portal Role"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (Delhi Metro / App First Ergonomics) */}
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
        studentId={activeStudent?.id || "stud-1"}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialRole="student"
      />
    </div>
  );
}
