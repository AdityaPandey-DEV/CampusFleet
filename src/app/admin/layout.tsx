"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AuthModal } from "@/components/auth/AuthModal";
import {
  LayoutDashboard,
  BusFront,
  Route,
  Navigation,
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  Wrench,
  FileBarChart,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  Radio,
  AlertTriangle,
  Key,
  Database,
  Trash2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [notifications, setNotifications] = useState(store.getNotifications());
  const [issues, setIssues] = useState(store.getIssues());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setNotifications(store.getNotifications());
      setIssues(store.getIssues());
    });
    return unsub;
  }, []);

  const openIssues = issues.filter(i => i.status === "OPEN").length;
  const unreadNotifs = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { href: "/admin", label: "Overview HUD", icon: LayoutDashboard },
    { href: "/admin/buses", label: "Bus Fleet", icon: BusFront },
    { href: "/admin/routes", label: "Routes & Stops", icon: Route },
    { href: "/admin/trips", label: "Trips & Shifts", icon: Navigation },
    { href: "/admin/reservations", label: "Reservations & WL", icon: CalendarCheck },
    { href: "/admin/staff", label: "Staff & RBAC", icon: Users },
    { href: "/admin/students", label: "Students & Roster", icon: GraduationCap },
    { href: "/admin/billing", label: "Passes & Revenue", icon: CreditCard },
    { href: "/admin/maintenance", label: "Maintenance Desk", icon: Wrench, badge: openIssues > 0 ? openIssues : undefined },
    { href: "/admin/reports", label: "Reports & Exports", icon: FileBarChart },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-black text-lg">Campus<span className="text-blue-600">Ride</span> Admin</span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
            Exit
          </Link>
        </div>
      </div>

      {/* Desktop Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 md:z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex flex-col justify-between ${
          isMobileMenuOpen ? "left-0 w-64 shadow-2xl" : "-left-64 md:left-0"
        } ${isSidebarOpen ? "md:w-64" : "md:w-20"}`}
      >
        <div className="p-4 space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <BusFront className="w-5 h-5" />
              </div>
              {(isSidebarOpen || isMobileMenuOpen) && (
                <div>
                  <div className="font-black text-lg tracking-tight">
                    Campus<span className="text-blue-600 dark:text-blue-400">Ride</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Operations Center
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {(isSidebarOpen || isMobileMenuOpen) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {(isSidebarOpen || isMobileMenuOpen) && item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {(isSidebarOpen || isMobileMenuOpen) && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <div className="text-[10px] uppercase font-bold text-slate-400">Logged in as</div>
              <div className="font-bold text-slate-800 dark:text-slate-200 truncate">Transport Controller</div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Hub Online
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Switch to Landing Portal"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Admin Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Desktop Bar */}
        <header className="hidden md:flex sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono">
              CAMPUS FLEET OPS • SYSTEM v2.4
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDataModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Data & Reset</span>
            </button>

            <Link
              href="/portal"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Student Portal →
            </Link>
            <Link
              href="/staff/driver"
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:underline"
            >
              Driver Console
            </Link>
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              <Key className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentUser ? currentUser.fullName : "Sign In"}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        initialRole="transport_manager"
      />

      {/* Database State Management Modal */}
      {isDataModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-2xl">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg">Production Fleet Data Controls</h3>
                  <p className="text-xs text-slate-500">Switch database state or clear test entries</p>
                </div>
              </div>
              <button
                onClick={() => setIsDataModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Clean Production State */}
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to WIPE all stops, buses, and routes to start fresh with 0 entries for your real college?")) {
                    store.clearAllProductionData();
                    setIsDataModalOpen(false);
                    alert("Database wiped! You now have a clean slate to add your university's real stops and buses.");
                  }
                }}
                className="w-full p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/70 text-left flex items-start gap-3 transition-colors group"
              >
                <div className="p-2 bg-rose-100 dark:bg-rose-900/60 text-rose-600 rounded-xl group-hover:scale-105 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-rose-700 dark:text-rose-300">
                    Wipe to Clean Production State (0 Stops, 0 Buses)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Empties all demo routes, buses, and stops so the admin can configure their real campus.
                  </div>
                </div>
              </button>

              {/* Option 2: Restore Standard Template */}
              <button
                onClick={() => {
                  if (confirm("Load fresh campus transit template?")) {
                    store.resetToDefaults();
                    setIsDataModalOpen(false);
                    alert("Default academic transit template loaded!");
                  }
                }}
                className="w-full p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/70 text-left flex items-start gap-3 transition-colors group"
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-blue-700 dark:text-blue-300">
                    Load Standard Academic Template
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Pre-loads 5 campus stations, 2 corridors, and active fleet vehicles.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
