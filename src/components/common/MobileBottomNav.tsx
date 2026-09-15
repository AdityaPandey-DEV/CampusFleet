"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BusFront, Compass, QrCode, CalendarCheck, CreditCard, Zap, User } from "lucide-react";

interface MobileBottomNavProps {
  isPaymentApproved?: boolean;
}

export function MobileBottomNav({ isPaymentApproved = true }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = isPaymentApproved
    ? [
        {
          href: "/portal/profile",
          label: "Profile",
          icon: User,
        },
        {
          href: "/portal/booking",
          label: "Seat Booking",
          icon: CalendarCheck,
        },
        {
          href: "/portal/pass",
          label: "Digital Pass",
          icon: QrCode,
        },
        {
          href: "/portal/tracker",
          label: "Live Radar",
          icon: Compass,
        },
        {
          href: "/portal/running-late",
          label: "Running Late",
          icon: Zap,
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
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800/80 px-4 py-2 shadow-2xl safe-area-inset-bottom"
    >
      <div
        className={`max-w-md mx-auto grid gap-1.5 ${
          isPaymentApproved ? "grid-cols-5" : "grid-cols-1"
        }`}
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex ${
                isPaymentApproved ? "flex-col" : "flex-row gap-2 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
              } items-center justify-center py-1.5 px-1 rounded-2xl transition-all relative ${
                isPaymentApproved
                  ? isActive
                    ? "text-blue-600 dark:text-blue-400 font-extrabold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  : "font-black text-xs"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isPaymentApproved && isActive ? "bg-blue-100 dark:bg-blue-950/80 shadow-2xs" : ""
                }`}
              >
                <Icon className={isPaymentApproved ? "w-4 h-4" : "w-5 h-5 text-white"} />
              </div>
              <span className={isPaymentApproved ? "text-[10px] tracking-tight mt-0.5 truncate max-w-full" : "text-xs font-bold"}>
                {item.label}
              </span>
              {isPaymentApproved && isActive && (
                <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
