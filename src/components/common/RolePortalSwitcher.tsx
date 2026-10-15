"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { UserRole } from "@/lib/types";
import { getCardIcon } from "@/modules";
import { ChevronDown } from "lucide-react";

export interface RolePortalOption {
  role: UserRole;
  label: string;
  shortLabel: string;
  path: string;
  icon: any;
  color: string;
  description: string;
  parentRoleKey?: string | null;
}

interface RolePortalSwitcherProps {
  align?: "left" | "right" | "auto";
}

export function RolePortalSwitcher({ align = "auto" }: RolePortalSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [portalOptions, setPortalOptions] = useState<RolePortalOption[]>([]);
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

  // Fetch all role portal definitions directly from database
  useEffect(() => {
    fetch("/api/rbac/roles")
      .then((r) => r.json())
      .then((data) => {
        if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
          const dynamicOptions: RolePortalOption[] = data.roles.map((r: any) => ({
            role: r.key,
            label: r.name,
            shortLabel: r.shortLabel || r.name,
            path: r.portalPath || (r.key === "admin" ? "/admin" : r.key === "role_manager" ? "/role-manager" : "/transport-admin"),
            icon: getCardIcon(r.icon || "ShieldCheck"),
            color: r.color || "bg-blue-600  text-blue-400",
            description: r.description || "",
            parentRoleKey: r.parentRoleKey || null,
          }));
          setPortalOptions(dynamicOptions);
        }
      })
      .catch((err) => console.error("Failed to load portal roles:", err));
  }, []);

  // Pure dynamic hierarchy resolution from database (Zero hardcoded role strings!)
  const userRole = (currentUser?.role || "student") as string;
  const accessibleRoles = useMemo(() => {
    const allowed = new Set<string>([userRole]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const opt of portalOptions) {
        if (opt.parentRoleKey && allowed.has(opt.parentRoleKey) && !allowed.has(opt.role)) {
          allowed.add(opt.role);
          expanded = true;
        }
      }
    }
    return allowed;
  }, [userRole, portalOptions]);

  const allowedOptions = portalOptions.filter((opt) => accessibleRoles.has(opt.role));

  // If user has only 1 portal option or none, do not show switcher
  if (allowedOptions.length <= 1) {
    return null;
  }

  // Match current portal option based on pathname
  const currentOption =
    allowedOptions.find((opt) => {
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300/80 dark:border-gray-700/80 text-xs font-bold text-gray-800 dark:text-gray-200 shadow-sm transition-all active:scale-95 group"
        title="Switch Portal & Active Role"
      >
        <div className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
          <CurrentIcon className="w-3 h-3" />
        </div>

        <span className="hidden sm:inline font-black tracking-tight">{currentOption.shortLabel}</span>
        <span className="text-[10px] text-gray-400 font-normal">Switch</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${getDropdownAlignmentClass()} mt-2 w-72 max-w-[calc(100vw-32px)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-2.5 shadow-2xl z-50 animate-in slide-in-from-top-2 fade-in duration-200 space-y-1 text-gray-900 dark:text-white`}>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Switch Portal & Desk
              </div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                {currentUser?.fullName || "Active Session"}
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold uppercase">
              {currentUser?.role || "student"}
            </span>
          </div>

          <div className="space-y-1 pt-1">
            {allowedOptions.map((opt) => {
              const Icon = opt.icon;
              const isCurrent = opt.path === currentOption.path;

              return (
                <button
                  key={opt.role}
                  onClick={() => handleSelectPortal(opt)}
                  className={`w-full text-left p-2.5 rounded-2xl flex items-start gap-3 transition-all ${
                    isCurrent
                      ? "bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800/80 border border-transparent"
                  }`}
                >
                  <div className={`p-2 rounded-xl ${opt.color} text-white flex-shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                        {opt.label}
                      </span>
                      {isCurrent && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 ml-1" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
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
