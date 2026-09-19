"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";
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
  ArrowRight,
  Download,
  Smartphone,
  Globe,
  ExternalLink,
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
  showInstall?: boolean;
  onOpenInstall?: () => void;
  customActions?: React.ReactNode;
  mobilePrimaryAction?: {
    label: string;
    href: string;
    subtitle?: string;
    icon?: any;
  };
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
  showInstall = false,
  onOpenInstall,
  customActions,
  mobilePrimaryAction,
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

  const portalViewRole = role || currentUser?.role || "student";
  const userAccountRole = currentUser?.role || portalViewRole;
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "adityapandey.dev.in@gmail.com").toLowerCase();
  const isActualAdmin =
    userAccountRole === "admin" ||
    userAccountRole === "transport_manager" ||
    currentUser?.email?.toLowerCase() === adminEmail;

  // Real authenticated student identity matching
  const activeStudent = currentUser
    ? students.find(
        s =>
          (currentUser.studentId && s.id === currentUser.studentId) ||
          s.userId === currentUser.id ||
          s.email?.toLowerCase() === currentUser.email?.toLowerCase()
      ) || null
    : null;

  // Strict role-based portal switching
  const allowedPortals = ROLE_PORTALS.filter(opt => {
    if (isActualAdmin) return opt.role === "admin" || opt.role === "staff";
    if (userAccountRole === "conductor") return opt.role === "conductor";
    if (userAccountRole === "driver") return opt.role === "driver" || opt.role === "conductor";
    if (userAccountRole === "staff" || userAccountRole === "supervisor") return opt.role === "staff";
    if (userAccountRole === "teacher") return opt.role === "teacher";
    if (userAccountRole === "student") return opt.role === "student";
    return false;
  });

  const currentPortalConfig =
    ROLE_PORTALS.find(p => p.role === portalViewRole) || ROLE_PORTALS[0];

  const handleSignOut = async () => {
    await store.logout();
    setIsProfileOpen(false);
    setIsMobileSheetOpen(false);
    router.push("/");
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

  const resolvedMobileAction =
    mobilePrimaryAction ||
    (() => {
      if (portalViewRole === "teacher") {
        return {
          label: "Student & Mobility Portal",
          href: "/portal",
          subtitle: "Bus routes, stops, schedules & student passes",
          icon: GraduationCap,
        };
      }
      if (portalViewRole === "driver") {
        return {
          label: "Conductor Manifest Console",
          href: "/conductor",
          subtitle: "Passenger QR verification & manifest",
          icon: FileCheck2,
        };
      }
      if (portalViewRole === "conductor") {
        return {
          label: "Driver Telematics HUD",
          href: "/driver",
          subtitle: "Live vehicle telemetry & trip dashboard",
          icon: BusFront,
        };
      }
      if (portalViewRole === "staff") {
        return isActualAdmin
          ? {
              label: "Master Admin Console",
              href: "/admin",
              subtitle: "Fleet command, routes, crew & settings",
              icon: LayoutDashboard,
            }
          : {
              label: "Student & Mobility Portal",
              href: "/portal",
              subtitle: "Student bookings & digital pass status",
              icon: GraduationCap,
            };
      }
      if (portalViewRole === "student" && pathname !== "/portal/tracker") {
        return {
          label: "Live GPS Bus Radar",
          href: "/portal/tracker",
          subtitle: "Real-time transit tracker & telemetry",
          icon: Radio,
        };
      }
      return null;
    })();

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-xs transition-colors overflow-x-clip">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Brand Identity / Left Section (Strictly Non-Shrinkable) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 z-10 min-w-0">
            <Link
              href={currentPortalConfig.path}
              className="flex items-center gap-2 sm:gap-2.5 group flex-shrink-0"
              title={`${portalTitle} Home`}
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr ${currentPortalConfig.gradient} flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform flex-shrink-0`}
              >
                <currentPortalConfig.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                    Campus<span className="text-blue-600 dark:text-blue-400">Fleet</span>
                  </span>
                  <span
                    className={`hidden md:inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getRoleBadgeClasses(
                      portalViewRole
                    )}`}
                  >
                    {currentPortalConfig.shortLabel}
                  </span>
                </div>
                {portalSubtitle && (
                  <p className="hidden 2xl:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                    {portalSubtitle}
                  </p>
                )}
              </div>
            </Link>
          </div>

          {/* Center Navigation Links (Minimalist Plain Text) */}
          {navLinks && navLinks.length > 0 && (
            <div className="hidden lg:flex items-center justify-center flex-1 min-w-0 px-8">
              <nav className="flex items-center gap-6">
                {navLinks.map(link => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`text-sm transition-colors ${
                        isActive
                          ? "text-slate-900 dark:text-white font-medium"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-white font-normal"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Right Action Items (Minimalist User & Sign Out) */}
          <div className="hidden lg:flex items-center gap-6 flex-shrink-0 z-10">
            {currentUser ? (
              <div className="flex items-center gap-4">
                <Link href="/portal/profile" title="Open Settings" className="block w-9 h-9 rounded-full overflow-hidden border border-slate-200 hover:border-slate-300 transition-colors">
                  {activeStudent?.photoUrl ? (
                    <img src={activeStudent.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                  )}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
          
          <div className="flex items-center lg:hidden z-10">

            {/* Mobile Vertical Slide Sheet Trigger */}
            <button
              onClick={() => setIsMobileSheetOpen(true)}
              className="lg:hidden p-1.5 border border-slate-900 dark:border-white rounded-md text-slate-900 dark:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open Navigation Sheet"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Slide Sheet */}
      {isMobileSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white dark:bg-slate-950 overflow-y-auto animate-in slide-in-from-top-4 duration-300">
          
          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {portalTitle}
            </div>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="p-1.5 border border-slate-900 dark:border-white rounded-md text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Navigation Links */}
            {navLinks && navLinks.length > 0 && (
              <div className="space-y-5">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileSheetOpen(false)}
                    className="block text-base font-medium text-slate-700 dark:text-slate-300"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Separator */}
            <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-2" />

            {/* Profile Section */}
            {currentUser && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  {activeStudent?.photoUrl ? (
                    <img src={activeStudent.photoUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 text-amber-600 flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{currentUser.fullName}</span>
                    <Link
                      href="/portal/profile"
                      onClick={() => setIsMobileSheetOpen(false)}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Settings
                    </Link>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="text-base font-medium text-slate-700 dark:text-slate-300 text-left w-full"
                >
                  Sign Out
                </button>
              </div>
            )}
            
            {!currentUser && (
              <div className="space-y-6">
                <Link
                  href="/login"
                  onClick={() => setIsMobileSheetOpen(false)}
                  className="text-base font-medium text-slate-700 dark:text-slate-300 block w-full"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
