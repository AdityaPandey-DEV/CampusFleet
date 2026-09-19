"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  QrCode,
  CalendarCheck,
  CreditCard,
  Zap,
  User,
  LayoutDashboard,
} from "lucide-react";

interface MobileBottomNavProps {
  isPaymentApproved?: boolean;
}

export function MobileBottomNav({ isPaymentApproved = true }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = isPaymentApproved
    ? [
        {
          href: "/portal",
          label: "Hub",
          icon: LayoutDashboard,
        },
        {
          href: "/portal/booking",
          label: "Seats",
          icon: CalendarCheck,
        },
        {
          href: "/portal/pass",
          label: "Pass",
          icon: QrCode,
          highlight: true,
        },
        {
          href: "/portal/tracker",
          label: "Radar",
          icon: Compass,
        },
        {
          href: "/portal/profile",
          label: "Profile",
          icon: User,
        },
      ]
    : [
        {
          href: "/portal/payments",
          label: "Activate Transit Pass",
          icon: CreditCard,
        },
      ];

  return (
    <nav
      aria-label="Mobile Navigation Dock"
      className="md:hidden fixed bottom-3 inset-x-3 z-50 pointer-events-none"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl border border-white/60 dark:border-gray-800/80 rounded-3xl p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          <div
            className={`grid gap-1 items-center ${
              isPaymentApproved ? "grid-cols-5" : "grid-cols-1"
            }`}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              if (!isPaymentApproved) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 text-white font-black text-xs shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-transform"
                  >
                    <Icon className="w-4 h-4" />
                    <span>Activate Transit Pass & Pay Fees →</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 group active:scale-95 ${
                    isActive
                      ? item.highlight
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 -translate-y-1"
                        : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <div className="relative">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isActive
                          ? item.highlight
                            ? "text-white scale-110"
                            : "scale-110"
                          : "group-hover:scale-105"
                      }`}
                    />
                    {item.highlight && !isActive && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] tracking-tight mt-1 truncate max-w-full font-medium ${
                      isActive ? (item.highlight ? "text-white font-bold" : "font-black") : ""
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
