"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { useTheme } from "@/components/common/ThemeProvider";

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
  const [campuses, setCampuses] = useState(() => store.getCampuses());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setNotifications(store.getNotifications());
      setIssues(store.getIssues());
      setCampuses(store.getCampuses());
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
    { href: "/admin/maintenance", label: "Maintenance Desk", icon: Wrench, badge: openIssues > 0 ? openIssues : undefined },
    { href: "/admin/staff", label: "Staff & RBAC", icon: Users },
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Access Restricted</h2>
          <p className="text-xs text-gray-300">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-yellow-600 to-orange-600 flex items-center justify-center text-white font-bold shadow-xs">
              <BusFront className="w-4 h-4" />
            </div>
            <span className="font-black text-base">Campus<span className="text-blue-600">Fleet</span> Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/staff"
            className="hidden sm:flex px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold"
          >
            Staff Ops
          </Link>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Vertical Slide-Down Navigation Sheet (Zero Overflow, Top-to-Bottom Flow) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border-b border-gray-200 dark:border-gray-800 shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300 max-h-[calc(100vh-3.5rem)] overflow-y-auto space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-gray-900 dark:text-white">
                {currentUser?.fullName || "Transport Controller"}
              </div>
              <div className="text-[10px] text-gray-500">{currentUser?.email || "Admin Operations Workspace"}</div>
            </div>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
              Admin Ops
            </span>
          </div>

          {/* Live Operations Clock Widget in Mobile Drawer */}
          <div className="flex items-center justify-between p-2 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
            <span className="text-[11px] font-bold text-gray-500">Live Campus Clock</span>

          </div>

          {/* Primary Mobile Quick Actions inside sliding drawer */}
          <div className="space-y-2">
            <Link
              href="/staff"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-600 text-white flex items-center justify-between shadow-lg shadow-blue-600/25 active:scale-98 transition-all"
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
                  <div className="text-[11px] text-blue-100 line-clamp-1">
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">
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
                        ? "bg-yellow-50 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end">
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between sticky top-0 h-screen z-30 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${
          isSidebarOpen ? "md:w-64" : "md:w-20"
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <BusFront className="w-5 h-5" />
              </div>
              {isSidebarOpen && (
                <div>
                  <div className="font-black text-lg tracking-tight">
                    Campus<span className="text-blue-600 dark:text-blue-400">Fleet</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
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
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {isSidebarOpen && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {isSidebarOpen && item.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? "← Collapse" : "→"}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
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
        <header className="hidden md:flex sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-6 py-3.5 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-mono truncate">
              CAMPUS FLEET OPS • SYSTEM v2.4
            </span>

          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Link
              href="/staff"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold transition-colors shadow-2xs"
              title="Open Staff Operations Panel"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Staff Ops →</span>
            </Link>

            {/* Unified User & Command Pill (Zero Overflow!) */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-2xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all text-xs font-bold text-gray-800 dark:text-gray-200 shadow-2xs active:scale-98"
                title="Admin Account & Settings"
              >
                <div className="w-6 h-6 rounded-xl bg-gradient-to-tr from-yellow-600 to-orange-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs">
                  {currentUser?.fullName
                    ? currentUser.fullName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "AD"}
                </div>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                  Admin
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
                    isProfileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Vertical Slide-Down Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-3 shadow-2xl z-50 animate-in slide-in-from-top-2 duration-200 space-y-3">
                  <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Super Administrator
                    </div>
                    <div className="font-black text-sm text-gray-900 dark:text-white truncate">
                      {currentUser?.fullName || "Operations Admin"}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {currentUser?.email || "Admin Workspace"}
                    </div>
                  </div>

                  {/* Switch to Staff Console */}
                  <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2">
                      Authorized Portals
                    </div>
                    <Link
                      href="/staff"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full text-left p-2 rounded-xl flex items-center gap-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-gradient-to-tr from-blue-600 to-blue-600 text-white">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <span>Staff Operations Console</span>
                    </Link>
                  </div>

                  {/* Theme Mode Segmented Switcher */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between px-2">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                      Appearance
                    </span>
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setTheme("light")}
                        className={`p-1 rounded-lg text-xs transition-all ${
                          theme === "light"
                            ? "bg-white dark:bg-gray-900 text-yellow-600 shadow-2xs"
                            : "text-gray-400 hover:text-gray-700"
                        }`}
                        title="Light Mode"
                      >
                        <Sun className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`p-1 rounded-lg text-xs transition-all ${
                          theme === "dark"
                            ? "bg-gray-900 text-blue-400 shadow-2xs"
                            : "text-gray-400 hover:text-gray-700"
                        }`}
                        title="Dark Mode"
                      >
                        <Moon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`p-1 rounded-lg text-xs transition-all ${
                          theme === "system"
                            ? "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 shadow-2xs"
                            : "text-gray-400 hover:text-gray-700"
                        }`}
                        title="System Default"
                      >
                        <Laptop className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Institutional Website Link & Sign Out Action */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1">
                    <Link
                      href="/?public=true"
                      onClick={() => setIsProfileOpen(false)}
                      className="w-full p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors flex items-center justify-between text-xs font-semibold"
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-blue-500" />
                        <span>Institutional Website</span>
                      </span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="w-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-bold"
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
    </div>
  );
}
