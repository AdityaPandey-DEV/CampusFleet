"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";
import { CampusTimeHUD } from "@/components/common/CampusTimeHUD";
import {
  BusFront,
  CreditCard,
  QrCode,
  ShieldCheck,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Route,
  GitBranch,
  Navigation,
  Users,
  GitMerge,
  BarChart3,
  GraduationCap,
  CalendarCheck,
  BookOpen,
  Building2,
  Wrench,
  Shield,
  FileBarChart,
  LogOut,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface NavFolder {
  id: string;
  label: string;
  icon: any;
  basePath: string;
  items: {
    href: string;
    label: string;
    icon: any;
    badge?: number;
  }[];
}

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Folder open/closed state (default open the active folder)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    billing: true,
    fleet: true,
    dispatch: false,
    academics: false,
    maintenance: false,
    system: false,
  });

  const toggleFolder = (folderId: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    // Automatically expand the folder corresponding to current path
    if (pathname.includes("/staff/billing")) setOpenFolders((p) => ({ ...p, billing: true }));
    if (pathname.includes("/staff/fleet")) setOpenFolders((p) => ({ ...p, fleet: true }));
    if (pathname.includes("/staff/dispatch")) setOpenFolders((p) => ({ ...p, dispatch: true }));
    if (pathname.includes("/staff/academics")) setOpenFolders((p) => ({ ...p, academics: true }));
    if (pathname.includes("/staff/maintenance")) setOpenFolders((p) => ({ ...p, maintenance: true }));
    if (pathname.includes("/staff/system")) setOpenFolders((p) => ({ ...p, system: true }));
  }, [pathname]);

  const handleSignOut = async () => {
    await store.logout();
    router.push("/login");
  };

  const navFolders: NavFolder[] = [
    {
      id: "billing",
      label: "Finance & Billing",
      icon: CreditCard,
      basePath: "/staff/billing",
      items: [
        { href: "/staff/billing/approvals", label: "Fee Approvals Queue", icon: ShieldCheck },
        { href: "/staff/billing", label: "Passes & Revenue", icon: CreditCard },
        { href: "/staff/billing/qr", label: "Payment QR & UPI", icon: QrCode },
      ],
    },
    {
      id: "fleet",
      label: "Fleet & Corridors",
      icon: BusFront,
      basePath: "/staff/fleet",
      items: [
        { href: "/staff/fleet/buses", label: "Bus Fleet Directory", icon: BusFront },
        { href: "/staff/fleet/routes", label: "Routes & Transit Stops", icon: Route },
        { href: "/staff/fleet/flowchart", label: "Route Stop Flowchart", icon: GitBranch },
      ],
    },
    {
      id: "dispatch",
      label: "Trips & Dispatch",
      icon: Navigation,
      basePath: "/staff/dispatch",
      items: [
        { href: "/staff/dispatch/trips", label: "Daily Shifts & Trips", icon: Navigation },
        { href: "/staff/dispatch/crew", label: "Crew & Bus Allocation", icon: Users },
        { href: "/staff/dispatch/merges", label: "Bus Merge Optimizer", icon: GitMerge },
        { href: "/staff/dispatch/demand", label: "Demand & Fleet Sizing", icon: BarChart3 },
      ],
    },
    {
      id: "academics",
      label: "Commuters & Academics",
      icon: GraduationCap,
      basePath: "/staff/academics",
      items: [
        { href: "/staff/academics/students", label: "Student Roster & Passes", icon: GraduationCap },
        { href: "/staff/academics/reservations", label: "Shift Seat Reservations", icon: CalendarCheck },
        { href: "/staff/academics/classes", label: "Classes & Timetables", icon: BookOpen },
        { href: "/staff/academics/campuses", label: "Campuses & Zones", icon: Building2 },
      ],
    },
    {
      id: "maintenance",
      label: "Workshop & Maintenance",
      icon: Wrench,
      basePath: "/staff/maintenance",
      items: [
        { href: "/staff/maintenance", label: "Defect Logging & Proof", icon: Wrench },
      ],
    },
    {
      id: "system",
      label: "System & Compliance",
      icon: Shield,
      basePath: "/staff/system",
      items: [
        { href: "/staff/system/staff", label: "Staff & RBAC Directory", icon: Users },
        { href: "/staff/system/reports", label: "Audit & XLSX Exports", icon: FileBarChart },
      ],
    },
  ];

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "transport_manager";
  const currentCategory = navFolders.find((f) => pathname.startsWith(f.basePath));
  const currentSubItem = currentCategory?.items.find((item) => pathname === item.href);

  const userInitials = currentUser?.fullName
    ? currentUser.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "ST";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
      {/* Mobile Top Navigation Bar (Single Sleek Sticky Header) */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <Link href="/staff" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <BusFront className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs tracking-tight text-slate-900 dark:text-white">
                  Campus<span className="text-blue-600">Fleet</span>
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  STAFF
                </span>
              </div>
              {currentSubItem && (
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                  {currentSubItem.label}
                </div>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <CampusTimeHUD showSimControl={false} />
            <div
              className="w-7 h-7 rounded-xl bg-blue-600 text-white font-mono font-black text-[10px] flex items-center justify-center shadow-sm"
              title={currentUser?.fullName || "Staff User"}
            >
              {userInitials}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-95 transition-transform cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Horizontal Category Sub-Nav Pills on Mobile (1-Tap Sibling Switching) */}
        {currentCategory && currentCategory.items.length > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200/50 dark:border-slate-800/50 overflow-x-auto no-scrollbar">
            {currentCategory.items.map((sub) => {
              const SubIcon = sub.icon;
              const isActive = pathname === sub.href;
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <SubIcon className="w-3 h-3" />
                  <span>{sub.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile Drawer Menu with Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 flex flex-col animate-in fade-in">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Drawer Content */}
          <div className="relative z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 max-h-[calc(100vh-3.5rem)] overflow-y-auto space-y-4 shadow-2xl">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  {currentUser?.fullName || "Staff Controller"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{currentUser?.email}</div>
              </div>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {currentUser?.role?.toUpperCase() || "STAFF"}
              </span>
            </div>

            {/* Quick links */}
            <div className="flex gap-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Console</span>
                </Link>
              )}
              <Link
                href="/portal"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Student Portal</span>
              </Link>
            </div>

            {/* Folder Accordions on Mobile */}
            <div className="space-y-2 pt-1">
              {navFolders.map((folder) => {
                const FolderIcon = folder.icon;
                const isFolderOpen = openFolders[folder.id];
                const isCurrentCategoryActive = pathname.startsWith(folder.basePath);

                return (
                  <div
                    key={folder.id}
                    className={`rounded-2xl border overflow-hidden transition-colors ${
                      isCurrentCategoryActive
                        ? "border-blue-300 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-950/10"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                    }`}
                  >
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <FolderIcon className={`w-4 h-4 ${isCurrentCategoryActive ? "text-blue-600" : "text-slate-500"}`} />
                        <span>{folder.label}</span>
                      </div>
                      {isFolderOpen ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {isFolderOpen && (
                      <div className="p-1.5 space-y-1 bg-white dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800">
                        {folder.items.map((sub) => {
                          const SubIcon = sub.icon;
                          const isActive = pathname === sub.href;
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                isActive
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5" />
                              <span>{sub.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-900 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar with Folder Accordions */}
      <aside
        className={`hidden md:flex flex-col justify-between sticky top-0 h-screen z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-5rem)]">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <Link href="/staff" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
                <BusFront className="w-5 h-5" />
              </div>
              {isSidebarOpen && (
                <div>
                  <div className="font-black text-base tracking-tight leading-none">
                    Campus<span className="text-blue-600">Fleet</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                    Staff Operations
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Quick Context Chips */}
          {isSidebarOpen && (
            <div className="flex items-center justify-between gap-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]">
              <div className="truncate font-bold text-slate-700 dark:text-slate-300">
                {currentUser?.fullName || "Staff Console"}
              </div>
              <CampusTimeHUD showSimControl={false} />
            </div>
          )}

          {/* Folder Accordions List */}
          <nav className="space-y-2">
            {navFolders.map((folder) => {
              const FolderIcon = folder.icon;
              const isFolderOpen = openFolders[folder.id];
              const isFolderActive = pathname.startsWith(folder.basePath);

              return (
                <div
                  key={folder.id}
                  className={`rounded-2xl border transition-all ${
                    isFolderActive
                      ? "border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/20"
                      : "border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40"
                  }`}
                >
                  {/* Folder Header */}
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    title={folder.label}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex-shrink-0">
                        <FolderIcon className="w-3.5 h-3.5" />
                      </div>
                      {isSidebarOpen && <span className="truncate">{folder.label}</span>}
                    </div>
                    {isSidebarOpen && (
                      <span className="text-slate-400">
                        {isFolderOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </button>

                  {/* Sub-portal Links */}
                  {(isFolderOpen || !isSidebarOpen) && (
                    <div className="p-1.5 space-y-0.5 border-t border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 rounded-b-2xl">
                      {folder.items.map((sub) => {
                        const SubIcon = sub.icon;
                        const isActive = pathname === sub.href;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                              isActive
                                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                            }`}
                            title={sub.label}
                          >
                            <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            {isSidebarOpen && <span className="truncate">{sub.label}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-white dark:bg-slate-900">
          {isSidebarOpen && (
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex-1 p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-800 flex items-center justify-center gap-1 hover:scale-102 transition-transform"
                  title="Switch to Admin Console"
                >
                  <Shield className="w-3 h-3" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                href="/portal"
                className="flex-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1 hover:scale-102 transition-transform"
                title="Switch to Student Portal"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Portal</span>
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
              title={isSidebarOpen ? "Collapse" : "Expand"}
            >
              {isSidebarOpen ? "← Collapse" : "→"}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
