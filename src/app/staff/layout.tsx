"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";

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
  description: string;
  icon: any;
  basePath: string;
  defaultHref: string;
  items: {
    href: string;
    label: string;
    shortLabel: string;
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
      description: "Approvals, passes & payment QR",
      icon: CreditCard,
      basePath: "/staff/billing",
      defaultHref: "/staff/billing/approvals",
      items: [
        { href: "/staff/billing/approvals", label: "Fee Approvals Queue", shortLabel: "Approvals", icon: ShieldCheck },
        { href: "/staff/billing", label: "Passes & Revenue", shortLabel: "Revenue", icon: CreditCard },
        { href: "/staff/billing/qr", label: "Payment QR & UPI", shortLabel: "UPI QR", icon: QrCode },
      ],
    },
    {
      id: "fleet",
      label: "Fleet & Corridors",
      description: "Buses, transit routes & stop visualizer",
      icon: BusFront,
      basePath: "/staff/fleet",
      defaultHref: "/staff/fleet/buses",
      items: [
        { href: "/staff/fleet/buses", label: "Bus Fleet Directory", shortLabel: "Buses", icon: BusFront },
        { href: "/staff/fleet/routes", label: "Routes & Transit Stops", shortLabel: "Routes", icon: Route },
        { href: "/staff/fleet/flowchart", label: "Route Stop Flowchart", shortLabel: "Flowchart", icon: GitBranch },
      ],
    },
    {
      id: "dispatch",
      label: "Trips & Dispatch",
      description: "Daily shifts, crew roster & fleet sizing",
      icon: Navigation,
      basePath: "/staff/dispatch",
      defaultHref: "/staff/dispatch/trips",
      items: [
        { href: "/staff/dispatch/trips", label: "Daily Shifts & Trips", shortLabel: "Trips", icon: Navigation },
        { href: "/staff/dispatch/crew", label: "Crew & Bus Allocation", shortLabel: "Crew", icon: Users },
        { href: "/staff/dispatch/merges", label: "Bus Merge Optimizer", shortLabel: "Merges", icon: GitMerge },
        { href: "/staff/dispatch/demand", label: "Demand & Fleet Sizing", shortLabel: "Demand", icon: BarChart3 },
      ],
    },
    {
      id: "academics",
      label: "Commuters & Academics",
      description: "Student roster, reservations & classes",
      icon: GraduationCap,
      basePath: "/staff/academics",
      defaultHref: "/staff/academics/students",
      items: [
        { href: "/staff/academics/students", label: "Student Roster & Passes", shortLabel: "Students", icon: GraduationCap },
        { href: "/staff/academics/reservations", label: "Shift Seat Reservations", shortLabel: "Bookings", icon: CalendarCheck },
        { href: "/staff/academics/classes", label: "Classes & Timetables", shortLabel: "Classes", icon: BookOpen },
        { href: "/staff/academics/campuses", label: "Campuses & Zones", shortLabel: "Campuses", icon: Building2 },
      ],
    },
    {
      id: "maintenance",
      label: "Workshop & Maintenance",
      description: "Bus defect reports, repairs & work proofs",
      icon: Wrench,
      basePath: "/staff/maintenance",
      defaultHref: "/staff/maintenance",
      items: [
        { href: "/staff/maintenance", label: "Defect Logging & Proof", shortLabel: "Workshop", icon: Wrench },
      ],
    },
    {
      id: "system",
      label: "System & Compliance",
      description: "Staff RBAC roles & Excel audit exports",
      icon: Shield,
      basePath: "/staff/system",
      defaultHref: "/staff/system/staff",
      items: [
        { href: "/staff/system/staff", label: "Staff & RBAC Directory", shortLabel: "Staff", icon: Users },
        { href: "/staff/system/reports", label: "Audit & XLSX Exports", shortLabel: "Reports", icon: FileBarChart },
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row transition-colors">
      {/* Mobile Top Navigation Bar (Single Sleek Sticky Header - No Duplicate Bars) */}
      <div className="md:hidden sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/80 dark:border-gray-800/80 shadow-sm">
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <Link href="/staff" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <BusFront className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs tracking-tight text-gray-900 dark:text-white">
                  Campus<span className="text-blue-600">Fleet</span>
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  STAFF
                </span>
              </div>
              {currentCategory ? (
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate max-w-[140px] flex items-center gap-1">
                  <span>{currentCategory.label}</span>
                </div>
              ) : (
                <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  Operations Console
                </div>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2">

            <div
              className="w-7 h-7 rounded-xl bg-blue-600 text-white font-mono font-black text-[10px] flex items-center justify-center shadow-sm"
              title={currentUser?.fullName || "Staff User"}
            >
              {userInitials}
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              className="p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 active:scale-95 transition-transform cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu with Backdrop Overlay (ONLY Main Categories) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 flex flex-col animate-in fade-in duration-200">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm"
          />

          {/* Drawer Content */}
          <div className="relative z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 max-h-[calc(100vh-3.5rem)] overflow-y-auto space-y-4 shadow-2xl">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-gray-900 dark:text-white">
                  {currentUser?.fullName || "Staff Controller"}
                </div>
                <div className="text-[10px] text-gray-400 font-mono">{currentUser?.email}</div>
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
                  className="flex-1 p-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 text-xs font-bold border border-yellow-200 dark:border-yellow-800 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Console</span>
                </Link>
              )}
              <Link
                href="/portal"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex-1 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Student Portal</span>
              </Link>
            </div>

            {/* ONLY Main Category Cards */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">
                Select Department Category
              </div>
              {navFolders.map((folder) => {
                const FolderIcon = folder.icon;
                const isCurrentCategoryActive = pathname.startsWith(folder.basePath);

                return (
                  <Link
                    key={folder.id}
                    href={folder.defaultHref}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all active:scale-[0.98] ${
                      isCurrentCategoryActive
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100 shadow-sm"
                        : "bg-gray-50/70 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isCurrentCategoryActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <FolderIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black tracking-tight truncate flex items-center gap-1.5">
                          <span>{folder.label}</span>
                          {isCurrentCategoryActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 dark:text-gray-400 truncate">
                          {folder.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 flex-shrink-0 pl-2">
                      <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-gray-200/60 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {folder.items.length} tools
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>

            <button
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-black flex items-center justify-center gap-2 border border-red-200 dark:border-red-900 cursor-pointer active:scale-98 transition-transform"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar with Folder Accordions */}
      <aside
        className={`hidden md:flex flex-col justify-between sticky top-0 h-screen z-30 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-5rem)]">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <Link href="/staff" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-green-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
                <BusFront className="w-5 h-5" />
              </div>
              {isSidebarOpen && (
                <div>
                  <div className="font-black text-base tracking-tight leading-none">
                    Campus<span className="text-blue-600">Fleet</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
                    Staff Operations
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Quick Context Chips */}
          {isSidebarOpen && (
            <div className="flex items-center justify-between gap-1 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-[11px]">
              <div className="truncate font-bold text-gray-700 dark:text-gray-300">
                {currentUser?.fullName || "Staff Console"}
              </div>

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
                      : "border-gray-200/80 dark:border-gray-800/80 bg-gray-50/40 dark:bg-gray-900/40"
                  }`}
                >
                  {/* Folder Header */}
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-black text-gray-800 dark:text-gray-200 hover:text-blue-600 transition-colors"
                    title={folder.label}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex-shrink-0">
                        <FolderIcon className="w-3.5 h-3.5" />
                      </div>
                      {isSidebarOpen && <span className="truncate">{folder.label}</span>}
                    </div>
                    {isSidebarOpen && (
                      <span className="text-gray-400">
                        {isFolderOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </button>

                  {/* Sub-portal Links */}
                  {(isFolderOpen || !isSidebarOpen) && (
                    <div className="p-1.5 space-y-0.5 border-t border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900 rounded-b-2xl">
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
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/60"
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
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2 bg-white dark:bg-gray-900">
          {isSidebarOpen && (
            <div className="flex items-center gap-1.5">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex-1 p-2 rounded-xl bg-yellow-50 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 text-[11px] font-bold border border-yellow-200 dark:border-yellow-800 flex items-center justify-center gap-1 hover:scale-102 transition-transform"
                  title="Switch to Admin Console"
                >
                  <Shield className="w-3 h-3" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                href="/portal"
                className="flex-1 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[11px] font-bold border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1 hover:scale-102 transition-transform"
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
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold"
              title={isSidebarOpen ? "Collapse" : "Expand"}
            >
              {isSidebarOpen ? "← Collapse" : "→"}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 overflow-y-auto">
        {children}
      </main>

      {/* Mobile Bottom Sub-Category Navigation Dock (Down side switcher like Conductor / Student panel) */}
      {currentCategory && currentCategory.items.length > 0 && (
        <nav
          aria-label="Staff Sub-Navigation Dock"
          className="md:hidden fixed bottom-3 inset-x-3 z-40 pointer-events-none"
        >
          <div className="max-w-md mx-auto pointer-events-auto">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-gray-200/80 dark:border-gray-800/80 rounded-3xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <div
                className="grid gap-1 items-center"
                style={{
                  gridTemplateColumns: `repeat(${currentCategory.items.length}, minmax(0, 1fr))`,
                }}
              >
                {currentCategory.items.map((sub) => {
                  const SubIcon = sub.icon;
                  const isActive = pathname === sub.href;
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 active:scale-95 ${
                        isActive
                          ? "bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/30"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60"
                      }`}
                    >
                      <SubIcon
                        className={`w-4 h-4 mb-0.5 ${
                          isActive ? "text-white" : "text-gray-500 dark:text-gray-400"
                        }`}
                      />
                      <span className="text-[10px] font-bold tracking-tight truncate max-w-full text-center">
                        {sub.shortLabel}
                      </span>
                      {isActive && (
                        <span className="w-1 h-1 rounded-full bg-white mt-0.5" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
