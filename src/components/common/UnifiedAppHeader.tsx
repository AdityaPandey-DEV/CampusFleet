"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { useTheme } from "./ThemeProvider";
import {
  BusFront,
  GraduationCap,
  BookOpen,
  LayoutDashboard,
  Building2,
  FileCheck2,
  ChevronDown,
  LogOut,
  AlertOctagon,
  Users,
  Sun,
  Moon,
  Laptop,
  Check,
  Menu,
  X,
  Lock,
  Sparkles,
  Shield,
  Radio,
} from "lucide-react";

export interface NavLinkItem {
  href: string;
  label: string;
  icon?: any;
  requiresPayment?: boolean;
  isLocked?: boolean;
}

interface UnifiedAppHeaderProps {
  role?: UserRole;
  portalTitle?: string;
  portalSubtitle?: string;
  navLinks?: NavLinkItem[];
  showSOS?: boolean;
  onOpenSOS?: () => void;
  customActions?: React.ReactNode;
}

interface RolePortalOption {
  role: UserRole;
  label: string;
  shortLabel: string;
  path: string;
  icon: any;
  color: string;
  gradient: string;
  description: string;
}

const ROLE_PORTALS: RolePortalOption[] = [
  {
    role: "student",
    label: "Student & Mobility Portal",
    shortLabel: "Student",
    path: "/portal",
    icon: GraduationCap,
    color: "text-blue-500",
    gradient: "from-blue-600 to-indigo-600",
    description: "Seat bookings, live bus GPS tracking & digital QR pass",
  },
  {
    role: "teacher",
    label: "Teacher Attendance Desk",
    shortLabel: "Teacher",
    path: "/teacher",
    icon: BookOpen,
    color: "text-teal-500",
    gradient: "from-teal-600 to-cyan-600",
    description: "Real-time today's student arrivals and class roster verification",
  },
  {
    role: "admin",
    label: "Admin Operations Center",
    shortLabel: "Admin Ops",
    path: "/admin",
    icon: LayoutDashboard,
    color: "text-amber-500",
    gradient: "from-amber-600 to-orange-600",
    description: "Fleet command, routes, crew scheduling & finance reports",
  },
  {
    role: "staff",
    label: "Staff Operations Console",
    shortLabel: "Staff Ops",
    path: "/staff",
    icon: Building2,
    color: "text-indigo-500",
    gradient: "from-indigo-600 to-blue-600",
    description: "Fee approvals, payment QR generator, audits & shuttle merges",
  },
  {
    role: "driver",
    label: "Driver Telematics Console",
    shortLabel: "Driver HUD",
    path: "/driver",
    icon: BusFront,
    color: "text-emerald-500",
    gradient: "from-emerald-600 to-teal-600",
    description: "Live GPS broadcast, stop progression checklist & incident alerts",
  },
  {
    role: "conductor",
    label: "Conductor Manifest Console",
    shortLabel: "Conductor",
    path: "/conductor",
    icon: FileCheck2,
    color: "text-purple-500",
    gradient: "from-purple-600 to-pink-600",
    description: "High-speed optical QR boarding scanner & passenger radar",
  },
];

export function UnifiedAppHeader({
  role,
  portalTitle = "CampusFleet",
  portalSubtitle,
  navLinks,
  showSOS = false,
  onOpenSOS,
  customActions,
}: UnifiedAppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [activeChildId, setActiveChildId] = useState(store.getActiveChildId());

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setActiveChildId(store.getActiveChildId());
    });
    return unsub;
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Close mobile sheet on route change
  useEffect(() => {
    setIsMobileSheetOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  const effectiveRole = role || currentUser?.role || "student";
  const isAdmin = effectiveRole === "admin" || effectiveRole === "transport_manager";
  const isTeacher = effectiveRole === "teacher";
  const isStaff = effectiveRole === "staff";
  const isDriver = effectiveRole === "driver";
  const isConductor = effectiveRole === "conductor";

  // Strict role-based portal switching
  const allowedPortals = ROLE_PORTALS.filter(opt => {
    if (isAdmin) return opt.role === "admin" || opt.role === "staff";
    if (isStaff) return opt.role === "staff" || opt.role === "student";
    if (isDriver) return opt.role === "driver" || opt.role === "conductor" || opt.role === "student";
    if (isConductor) return opt.role === "conductor" || opt.role === "student";
    if (isTeacher) return opt.role === "student" || opt.role === "teacher";
    return opt.role === "student";
  });

  const currentPortalConfig =
    ROLE_PORTALS.find(p => p.role === effectiveRole) || ROLE_PORTALS[0];

  const handleSignOut = async () => {
    await store.logout();
    setIsProfileOpen(false);
    setIsMobileSheetOpen(false);
    router.push("/login");
  };

  const handlePortalSwitch = (opt: RolePortalOption) => {
    store.switchRole(opt.role);
    setIsProfileOpen(false);
    setIsMobileSheetOpen(false);
    router.push(opt.path);
  };

  const getRoleBadgeClasses = (r: string) => {
    switch (r) {
      case "admin":
      case "transport_manager":
        return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "teacher":
        return "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800";
      case "driver":
        return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "conductor":
        return "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "staff":
        return "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      default:
        return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
  };

  const initials = currentUser?.fullName
    ? currentUser.fullName
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "CF";

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Brand Identity / Left Section */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-shrink">
            <Link
              href={currentPortalConfig.path}
              className="flex items-center gap-2 sm:gap-2.5 group min-w-0"
              title={`${portalTitle} Home`}
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr ${currentPortalConfig.gradient} flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform flex-shrink-0`}
              >
                <currentPortalConfig.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                    Campus<span className="text-blue-600 dark:text-blue-400">Fleet</span>
                  </span>
                  <span
                    className={`hidden md:inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadgeClasses(
                      effectiveRole
                    )}`}
                  >
                    {currentPortalConfig.shortLabel}
                  </span>
                </div>
                {portalSubtitle && (
                  <p className="hidden sm:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {portalSubtitle}
                  </p>
                )}
              </div>
            </Link>
          </div>

          {/* Center Navigation Links (Desktop — Adaptive with No Overflow) */}
          {navLinks && navLinks.length > 0 && (
            <nav className="hidden lg:flex items-center gap-1 min-w-0 flex-1 justify-center max-w-xl">
              {navLinks.map(link => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shadow-xs"
                        : link.isLocked
                        ? "text-slate-400 dark:text-slate-500 hover:text-slate-600"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span>{link.label}</span>
                    {link.isLocked && <Lock className="w-3 h-3 text-rose-500" />}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Action Items & Command Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-w-0">
            {customActions && <div className="flex items-center gap-1.5">{customActions}</div>}

            {/* High-Visibility Emergency SOS Button (Compact & Tactile) */}
            {showSOS && onOpenSOS && (
              <button
                onClick={onOpenSOS}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-black shadow-sm shadow-rose-600/30 transition-transform active:scale-95 animate-pulse flex-shrink-0 cursor-pointer"
                title="Emergency SOS Dispatch Alert"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>SOS</span>
              </button>
            )}

            {/* Unified User & Workspace Pill (Replaces 6 Cluttered Buttons!) */}
            {currentUser ? (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-2.5 py-1 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all text-xs font-bold text-slate-800 dark:text-slate-200 shadow-2xs active:scale-98"
                  aria-expanded={isProfileOpen}
                  title="Open User & Workspace Menu"
                >
                  <div className="w-6 h-6 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-black shadow-2xs flex-shrink-0">
                    {initials}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {currentUser.fullName.split(" ")[0]}
                  </span>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${getRoleBadgeClasses(
                      currentUser.role
                    )}`}
                  >
                    {currentUser.role}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                      isProfileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Vertical Slide-Down Command Panel */}
                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 shadow-2xl z-50 animate-in slide-in-from-top-2 fade-in-95 duration-200 space-y-3 text-slate-900 dark:text-white">
                    {/* User Identity Box */}
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Active Session
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getRoleBadgeClasses(
                            currentUser.role
                          )}`}
                        >
                          {currentUser.role}
                        </span>
                      </div>
                      <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {currentUser.fullName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
                    </div>

                    {/* Linked Child / Multi-Student Selector (for Commuters/Parents) */}
                    {students.length > 1 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                          Switch Linked Student Profile
                        </div>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                          {students.slice(0, 4).map(s => (
                            <button
                              key={s.id}
                              onClick={() => {
                                store.setActiveChildId(s.id);
                                setIsProfileOpen(false);
                              }}
                              className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                s.id === activeChildId
                                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className="truncate min-w-0 flex-1">
                                <div className="truncate font-semibold">{s.fullName}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {s.department || "Student"}
                                </div>
                              </div>
                              {s.id === activeChildId && (
                                <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 ml-2" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Authorized Portal Switcher */}
                    {allowedPortals.length > 1 && (
                      <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                          Switch Operations Portal
                        </div>
                        <div className="space-y-1">
                          {allowedPortals.map(opt => {
                            const Icon = opt.icon;
                            const isCurrent = opt.role === effectiveRole;
                            return (
                              <button
                                key={opt.role}
                                onClick={() => handlePortalSwitch(opt)}
                                className={`w-full text-left p-2 rounded-xl flex items-center gap-2.5 transition-all ${
                                  isCurrent
                                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                <div
                                  className={`p-1.5 rounded-lg bg-gradient-to-tr ${opt.gradient} text-white flex-shrink-0`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold truncate">{opt.label}</div>
                                </div>
                                {isCurrent && (
                                  <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

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

                    {/* Sign Out Action */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={handleSignOut}
                        className="w-full p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-bold"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out of CampusFleet</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 flex items-center gap-1.5"
              >
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile Vertical Slide Sheet Trigger */}
            <button
              onClick={() => setIsMobileSheetOpen(!isMobileSheetOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle Navigation Sheet"
            >
              {isMobileSheetOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Vertical Slide-Down Sheet (Top-to-Bottom Flow, Zero Horizontal Overflow!) */}
      {isMobileSheetOpen && (
        <div className="lg:hidden fixed top-16 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300 max-h-[calc(100vh-4rem)] overflow-y-auto space-y-4">
          {/* User Brief Bar */}
          {currentUser && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {currentUser.fullName}
                </div>
                <div className="text-[10px] text-slate-500 truncate">{currentUser.email}</div>
              </div>
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getRoleBadgeClasses(
                  currentUser.role
                )}`}
              >
                {currentUser.role}
              </span>
            </div>
          )}

          {/* Navigation Links for Mobile */}
          {navLinks && navLinks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                Navigation
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {navLinks.map(link => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileSheetOpen(false)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                      <span className="truncate">{link.label}</span>
                      {link.isLocked && <Lock className="w-3 h-3 text-rose-500 ml-auto" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Operations Portal Switcher (Mobile) */}
          {allowedPortals.length > 1 && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                Switch Portal
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {allowedPortals.map(opt => {
                  const Icon = opt.icon;
                  const isCurrent = opt.role === effectiveRole;
                  return (
                    <button
                      key={opt.role}
                      onClick={() => handlePortalSwitch(opt)}
                      className={`flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-colors ${
                        isCurrent
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div
                        className={`p-1.5 rounded-lg bg-gradient-to-tr ${opt.gradient} text-white flex-shrink-0`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate font-semibold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Emergency & Utilities Bar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {showSOS && onOpenSOS && (
              <button
                onClick={() => {
                  setIsMobileSheetOpen(false);
                  onOpenSOS();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Emergency SOS</span>
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
