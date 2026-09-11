"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { useTheme } from "@/components/common/ThemeProvider";
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
  BookOpen,
  GitMerge,
  Building2,
  ArrowRight,
  ChevronDown,
  Sun,
  Moon,
  Laptop,
  Check,
  Globe,
  ExternalLink,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());

  const { theme, setTheme } = useTheme();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await store.logout();
    router.push("/");
  };
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

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  const openIssues = issues.filter(i => i.status === "OPEN").length;
  const unreadNotifs = notifications.filter(n => !n.isRead).length;

  const navItems = [
    { href: "/admin", label: "Overview HUD", icon: LayoutDashboard },
    { href: "/admin/classes", label: "Classes & Timetable", icon: BookOpen },
    { href: "/admin/merges", label: "Merge & Dispatch", icon: GitMerge },
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

  // Access Barrier: Only Admin (and transport_manager) can access the Admin Portal
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "transport_manager";
  if (currentUser && !isAdmin) {
    const role = currentUser.role;
    const isStaff = role === "staff";
    const isDriver = role === "driver";
    const isConductor = role === "conductor";

    const targetPortal = isStaff
      ? "/staff"
      : isDriver
      ? "/driver"
      : isConductor
      ? "/conductor"
      : "/portal";

    const targetLabel = isStaff
      ? "Go to Staff Operations Panel"
      : isDriver
      ? "Go to Driver Cockpit"
      : isConductor
      ? "Go to Conductor Console"
      : "Go to Student Portal";

    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Access Restricted</h2>
          <p className="text-xs text-slate-300">
            {isStaff
              ? "Staff members cannot access the Master Admin Console. Staff operations are managed in the Staff Operations Panel."
              : isDriver
              ? "Drivers cannot access the Master Admin Console. Please navigate to the Driver Telematics Console."
              : isConductor
              ? "Conductors cannot access the Master Admin Console. Please navigate to the Conductor Manifest Console."
              : "Administrator privileges are required to access the CampusFleet Operations Center."}
          </p>
          <div className="pt-2">
            <Link
              href={targetPortal}
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
            >
              <span>{targetLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold shadow-xs">
              <BusFront className="w-4 h-4" />
            </div>
            <span className="font-black text-base">Campus<span className="text-blue-600">Fleet</span> Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff"
            className="hidden sm:flex px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold"
          >
            Staff Ops
          </Link>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Vertical Slide-Down Navigation Sheet (Zero Overflow, Top-to-Bottom Flow) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300 max-h-[calc(100vh-3.5rem)] overflow-y-auto space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white">
                {currentUser?.fullName || "Transport Controller"}
              </div>
              <div className="text-[10px] text-slate-500">{currentUser?.email || "Admin Operations Workspace"}</div>
            </div>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Admin Ops
            </span>
          </div>

          {/* Primary Mobile Quick Actions inside sliding drawer */}
          <div className="space-y-2">
            <Link
              href="/staff"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between shadow-lg shadow-indigo-600/25 active:scale-98 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold flex-shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-black text-xs sm:text-sm text-white flex items-center gap-1.5 truncate">
                    <span>Staff Operations Console</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-white/20 uppercase font-mono font-bold flex-shrink-0">
                      STAFF
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-100 line-clamp-1">
                    Fee approvals, UPI QR manager & crew dispatch
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-white flex-shrink-0 ml-2" />
            </Link>

            <Link
              href="/portal"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center justify-between active:scale-98 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="font-bold text-xs truncate">Launch Student & Parent Portal</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
            </Link>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
              Operations Navigation
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsDataModalOpen(true);
              }}
              className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Data & Reset</span>
            </button>

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between sticky top-0 h-screen z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${
          isSidebarOpen ? "md:w-64" : "md:w-20"
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <BusFront className="w-5 h-5" />
              </div>
              {isSidebarOpen && (
                <div>
                  <div className="font-black text-lg tracking-tight">
                    Campus<span className="text-blue-600 dark:text-blue-400">Fleet</span>
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {isSidebarOpen && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {isSidebarOpen && item.badge && (
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
          {isSidebarOpen && (
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
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? "← Collapse" : "→"}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Desktop Bar (Zero Overflow!) */}
        <header className="hidden md:flex sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono truncate">
              CAMPUS FLEET OPS • SYSTEM v2.4
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={() => setIsDataModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-2xl hover:bg-amber-100 transition-colors shadow-2xs"
              title="Open Database Management & Reset Modal"
            >
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden lg:inline">Data & Reset</span>
            </button>

            <Link
              href="/staff"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-bold transition-colors shadow-2xs"
              title="Open Staff Operations Panel"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Staff Ops →</span>
            </Link>

            {/* Unified User & Command Pill (Zero Overflow!) */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs active:scale-98"
                title="Admin Account & Settings"
              >
                <div className="w-6 h-6 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">
                  AD
                </div>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Admin
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                    isProfileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Vertical Slide-Down Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200 space-y-3">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Super Administrator
                    </div>
                    <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {currentUser?.fullName || "Transport Controller"}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {currentUser?.email || "adityapandey.dev.in@gmail.com"}
                    </div>
                  </div>

                  {/* Switch to Staff Console */}
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                      Authorized Portals
                    </div>
                    <Link
                      href="/staff"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full text-left p-2 rounded-xl flex items-center gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span>Staff Operations Console</span>
                    </Link>
                  </div>

                  {/* Theme Mode Segmented Switcher */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Appearance
                    </span>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setTheme("light")}
                        className={`p-1 rounded-lg text-xs transition-all ${
                          theme === "light"
                            ? "bg-white dark:bg-slate-900 text-amber-600 shadow-2xs"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                        title="Light Mode"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`p-1 rounded-lg text-xs transition-all ${
                          theme === "dark"
                            ? "bg-slate-900 text-blue-400 shadow-2xs"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                        title="Dark Mode"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`p-1 rounded-lg text-xs transition-all ${
                          theme === "system"
                            ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xs"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                        title="System Default"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Institutional Website Link & Sign Out Action */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <Link
                      href="/?public=true"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-between text-xs font-semibold"
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span>Institutional Website</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="w-full p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-bold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                    store.wipeAllData();
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
                    Empties all routes, buses, and stops so the admin can configure their real campus.
                  </div>
                </div>
              </button>

              {/* Option 2: Restore Standard Template */}
              <button
                onClick={() => {
                  if (confirm("Load fresh campus transit template?")) {
                    store.resetToCleanTemplate();
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
