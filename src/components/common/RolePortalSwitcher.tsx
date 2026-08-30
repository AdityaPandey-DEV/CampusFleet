"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";
import { UserRole } from "@/lib/types";
import {
  LayoutDashboard,
  GraduationCap,
  BusFront,
  FileCheck2,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";

interface RolePortalOption {
  role: UserRole;
  label: string;
  shortLabel: string;
  path: string;
  icon: any;
  color: string;
  description: string;
}

const PORTAL_OPTIONS: RolePortalOption[] = [
  {
    role: "student",
    label: "Student & Mobility Portal",
    shortLabel: "Student Hub",
    path: "/portal",
    icon: GraduationCap,
    color: "from-blue-600 to-indigo-600 text-blue-400",
    description: "Seat reservations, live tracking, and digital QR boarding pass",
  },
  {
    role: "admin",
    label: "Admin Operations Center",
    shortLabel: "Admin Ops",
    path: "/admin",
    icon: LayoutDashboard,
    color: "from-amber-600 to-orange-600 text-amber-400",
    description: "Fleet CRUD, live dispatch, telemetry logs, and financial reports",
  },
  {
    role: "driver",
    label: "Driver Telematics Console",
    shortLabel: "Driver HUD",
    path: "/staff/driver",
    icon: BusFront,
    color: "from-emerald-600 to-teal-600 text-emerald-400",
    description: "GPS telemetry beacon, route progression checklist, and SOS",
  },
  {
    role: "conductor",
    label: "Conductor Manifest Console",
    shortLabel: "Conductor",
    path: "/staff/conductor",
    icon: FileCheck2,
    color: "from-purple-600 to-pink-600 text-purple-400",
    description: "Biometric and QR passenger validation & real-time manifest",
  },
];

interface RolePortalSwitcherProps {
  align?: "left" | "right" | "auto";
}

export function RolePortalSwitcher({ align = "auto" }: RolePortalSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userRole = currentUser?.role || "student";
  const isAdmin = userRole === "admin" || userRole === "transport_manager";
  const isStaff = userRole === "driver" || userRole === "conductor";

  // Strict Hierarchy Filter:
  // Admin: Student, Admin, Driver, Conductor
  // Staff: Student, Driver, Conductor (No Admin)
  // Student: Student only (Switcher Hidden)
  const allowedOptions = PORTAL_OPTIONS.filter(opt => {
    if (isAdmin) return true;
    if (isStaff) return opt.role !== "admin";
    return opt.role === "student";
  });

  // If student only has 1 option, do not show switcher
  if (!isAdmin && !isStaff) {
    return null;
  }

  // Match current portal option based on pathname
  const currentOption =
    allowedOptions.find(opt => {
      if (opt.path === "/admin") return pathname.startsWith("/admin");
      if (opt.path === "/portal") return pathname.startsWith("/portal");
      return pathname.startsWith(opt.path);
    }) || allowedOptions[0];

  const CurrentIcon = currentOption.icon;

  const handleSelectPortal = (option: RolePortalOption) => {
    store.switchRole(option.role);
    setIsOpen(false);
    router.push(option.path);
  };

  const getDropdownAlignmentClass = () => {
    if (align === "left") return "left-0";
    if (align === "right") return "right-0";
    return "left-0 sm:left-auto sm:right-0";
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800/80 hover:from-slate-200 dark:hover:from-slate-700 border border-slate-300/80 dark:border-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-sm transition-all active:scale-95 group"
        title="Switch Portal & Active Role"
      >
        <div className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
          <CurrentIcon className="w-3 h-3" />
        </div>

        <span className="hidden sm:inline font-black tracking-tight">{currentOption.shortLabel}</span>
        <span className="text-[10px] text-slate-400 font-normal">Switch</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${getDropdownAlignmentClass()} mt-2 w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-2.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1 text-slate-900 dark:text-white`}>
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {isAdmin ? "Admin Superuser Switcher" : "Staff Console Switcher"}
              </div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {currentUser?.fullName || "Active Session"}
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold uppercase">
              {currentUser?.role || "student"}
            </span>
          </div>

          <div className="space-y-1 pt-1">
            {allowedOptions.map(opt => {
              const Icon = opt.icon;
              const isCurrent = opt.path === currentOption.path;

              return (
                <button
                  key={opt.role}
                  onClick={() => handleSelectPortal(opt)}
                  className={`w-full text-left p-2.5 rounded-2xl flex items-start gap-3 transition-all ${
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-transparent"
                  }`}
                >
                  <div className={`p-2 rounded-xl bg-gradient-to-tr ${opt.color} text-white flex-shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {opt.label}
                      </span>
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
