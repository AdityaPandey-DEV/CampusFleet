"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { MobileBottomNav } from "@/components/common/MobileBottomNav";
import {
  ShieldCheck,
  Users,
  GitFork,
  Home,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function RoleManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  // Access barrier: Only admin and role_manager can access
  const isAuthorized =
    currentUser?.role === "admin" || currentUser?.role === "role_manager";

  if (currentUser && !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Access Restricted</h2>
          <p className="text-xs text-gray-300">
            Role & Capability Management requires Master Administrator or Role Manager permissions.
          </p>
          <div className="pt-2">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
            >
              <span>Return to Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navLinks = [
    { href: "/admin", label: "← Admin Hub", shortLabel: "Admin", icon: Home },
    { href: "/role-manager", label: "Hub", shortLabel: "Hub", icon: ShieldCheck },
    { href: "/role-manager/users", label: "User Directory", shortLabel: "Users", icon: Users },
    { href: "/role-manager/hierarchy", label: "Hierarchy Flowchart", shortLabel: "Hierarchy", icon: GitFork },
  ];

  let currentTitle = "Role & Access Manager";
  if (pathname.includes("/users")) currentTitle = "User Directory & RBAC";
  else if (pathname.includes("/hierarchy")) currentTitle = "Role Hierarchy Flowchart";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans transition-colors duration-200">
      <UnifiedAppHeader
        role="role_manager"
        portalTitle={currentTitle}
        portalSubtitle="Institutional access control, roles, and capability hierarchy"
        navLinks={navLinks}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>

      <MobileBottomNav navItems={navLinks} />
    </div>
  );
}
