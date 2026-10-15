"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";
import { UserRole } from "@/lib/types";
import { useTheme } from "./ThemeProvider";
import { getCardIcon } from "@/modules";
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
  Navigation,
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
  userPhotoUrl?: string | null;
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
  parentRoleKey?: string | null;
}

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
  userPhotoUrl,
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

  const [dynamicRolePortals, setDynamicRolePortals] = useState<RolePortalOption[]>([]);

  useEffect(() => {
    fetch("/api/rbac/roles")
      .then((r) => r.json())
      .then((data) => {
        if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
          const mapped: RolePortalOption[] = data.roles.map((r: any) => ({
            role: r.key,
            label: r.name,
            shortLabel: r.shortLabel || r.name,
            path: r.portalPath || `/${r.key.replace(/_/g, "-")}`,
            icon: getCardIcon(r.icon || "ShieldCheck"),
            color: r.color || "text-blue-500",
            gradient: r.gradient || "bg-blue-600 ",
            description: r.description || "",
            parentRoleKey: r.parentRoleKey || null,
          }));
          setDynamicRolePortals(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const portalViewRole = role || currentUser?.role || (dynamicRolePortals[0]?.role || "student");
  const userAccountRole = currentUser?.role || portalViewRole;
  const adminEmail = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "adityapandey.dev.in@gmail.com").toLowerCase();
  const isActualAdmin =
    userAccountRole === "admin" ||
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

  // Pure dynamic hierarchy resolution from database (Zero hardcoded roles!)
  const effectiveUserRole = isActualAdmin ? "admin" : (userAccountRole as string);
  const accessibleRoles = useMemo(() => {
    const allowed = new Set<string>([effectiveUserRole]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const opt of dynamicRolePortals) {
        if (opt.parentRoleKey && allowed.has(opt.parentRoleKey) && !allowed.has(opt.role)) {
          allowed.add(opt.role);
          expanded = true;
        }
      }
    }
    return allowed;
  }, [effectiveUserRole, dynamicRolePortals]);

  const allowedPortals = dynamicRolePortals.filter(opt => accessibleRoles.has(opt.role));

  const normalizedPortalViewRole = String(portalViewRole).toLowerCase().replace(/-/g, "_");

  const currentPortalConfig =
    dynamicRolePortals.find(p => 
      p.role === portalViewRole || 
      p.role === normalizedPortalViewRole ||
      (p.path && (pathname === p.path || pathname.startsWith(p.path + "/")))
    ) || {
      role: portalViewRole,
      label: portalTitle || "CampusFleet Desk",
      shortLabel: portalTitle 
        ? portalTitle.replace(/\s+(Desk|Console|Portal)$/i, "") 
        : (portalViewRole ? String(portalViewRole).replace(/[-_]/g, " ").toUpperCase() : "DESK"),
      path: pathname,
      icon: getCardIcon("Compass"),
      color: "text-blue-500",
      gradient: "bg-blue-600 ",
      description: portalSubtitle || "",
    };

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

  const getRoleBadgeClasses = (roleKey: string) => {
    const portal = dynamicRolePortals.find(
      p => p.role === roleKey || p.role === roleKey?.replace(/-/g, "_")
    );
    const colorStr = portal?.color || "";
    if (colorStr.includes("yellow") || colorStr.includes("amber")) {
      return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
    if (colorStr.includes("indigo") || colorStr.includes("purple") || colorStr.includes("violet")) {
      return "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
    }
    if (colorStr.includes("green") || colorStr.includes("emerald")) {
      return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    }
    if (colorStr.includes("pink") || colorStr.includes("rose")) {
      return "bg-pink-100 dark:bg-pink-950/60 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800";
    }
    if (colorStr.includes("blue") || colorStr.includes("sky") || colorStr.includes("cyan")) {
      return "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
    // Dynamic fallback hash palette for custom database roles:
    const palettes = [
      "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    ];
    let hash = 0;
    const key = roleKey || "";
    for (let i = 0; i < key.length; i++) hash = (hash << 5) - hash + key.charCodeAt(i);
    return palettes[Math.abs(hash) % palettes.length];
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
      // Dynamic GPS Tracker shortcut for portal / commuter path
      if (pathname.startsWith("/portal") && pathname !== "/portal/tracker") {
        return {
          label: "Live GPS Bus Radar",
          href: "/portal/tracker",
          subtitle: "Real-time transit tracker & telemetry",
          icon: Radio,
        };
      }
      // If user has other accessible portals from database hierarchy, offer quick-switch to alternate portal
      const alternatePortal = allowedPortals.find(p => p.path !== pathname && !pathname.startsWith(p.path));
      if (alternatePortal) {
        return {
          label: alternatePortal.label,
          href: alternatePortal.path,
          subtitle: alternatePortal.description || `Switch to ${alternatePortal.label}`,
          icon: alternatePortal.icon,
        };
      }
      return null;
    })();

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800/80 shadow-xs transition-colors overflow-x-clip">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          {/* Brand Identity / Left Section (Strictly Non-Shrinkable) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 z-10 min-w-0">
            <Link
              href={currentPortalConfig.path}
              className="flex items-center gap-2 sm:gap-2.5 group flex-shrink-0"
              title={`${portalTitle} Home`}
            >
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl  ${currentPortalConfig.gradient} flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform flex-shrink-0`}
              >
                <currentPortalConfig.icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-gray-900 dark:text-white whitespace-nowrap">
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
                  <p className="hidden 2xl:block text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate max-w-[180px]">
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
                          ? "text-gray-900 dark:text-white font-medium"
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-white font-normal"
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
                <Link href={`/${pathname.split('/')[1] === 'portal' ? 'portal' : (currentUser.role || 'portal')}/settings`} title="Open Settings" className="block w-9 h-9 rounded-full overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors">
                  {(userPhotoUrl || activeStudent?.photoUrl) ? (
                    <img src={userPhotoUrl || activeStudent?.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                  )}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
          
          <div className="flex items-center lg:hidden z-10">

            {/* Mobile Vertical Slide Sheet Trigger */}
            <button
              onClick={() => setIsMobileSheetOpen(true)}
              className="lg:hidden p-1.5 border border-gray-900 dark:border-white rounded-md text-gray-900 dark:text-white transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Open Navigation Sheet"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide Sheet with Blurred Backdrop */}
      {isMobileSheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          {/* Blurred Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsMobileSheetOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="relative bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto animate-in slide-in-from-top-4 duration-300 max-h-[85vh] rounded-b-2xl pb-4">

          {/* Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {portalTitle}
            </div>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="p-1.5 border border-gray-900 dark:border-white rounded-md text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
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
                    className="block text-base font-medium text-gray-700 dark:text-gray-300"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Separator */}
            <div className="h-px w-full bg-gray-200 dark:bg-gray-800 my-2" />

            {/* Profile Section */}
            {currentUser && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  {(userPhotoUrl || activeStudent?.photoUrl) ? (
                    <img src={userPhotoUrl || activeStudent?.photoUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 text-yellow-600 flex items-center justify-center font-bold text-sm">
                      {initials}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">{currentUser.fullName}</span>
                    <Link
                      href="/portal/profile"
                      onClick={() => setIsMobileSheetOpen(false)}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Settings
                    </Link>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="text-base font-medium text-gray-700 dark:text-gray-300 text-left w-full"
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
                  className="text-base font-medium text-gray-700 dark:text-gray-300 block w-full"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
    </>
  );
}
