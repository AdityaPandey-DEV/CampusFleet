"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BusFront, Compass, QrCode, CalendarCheck, CreditCard, Lock } from "lucide-react";

interface MobileBottomNavProps {
  isPaymentApproved?: boolean;
}

export function MobileBottomNav({ isPaymentApproved = true }: MobileBottomNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/portal",
      label: "Home",
      icon: BusFront,
      requiresPayment: false,
    },
    {
      href: "/portal/tracker",
      label: "Tracker",
      icon: Compass,
      requiresPayment: true,
    },
    {
      href: "/portal/pass",
      label: "Pass",
      icon: QrCode,
      requiresPayment: true,
    },
    {
      href: "/portal/booking",
      label: "Book",
      icon: CalendarCheck,
      requiresPayment: true,
    },
    {
      href: "/portal/payments",
      label: "Billing",
      icon: CreditCard,
      requiresPayment: false,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1.5 shadow-2xl safe-area-inset-bottom"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isLocked = item.requiresPayment && !isPaymentApproved;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all relative ${
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-extrabold"
                  : isLocked
                  ? "text-slate-400 dark:text-slate-600"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-all ${
                  isActive ? "bg-blue-100 dark:bg-blue-950/80 shadow-2xs" : ""
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
                {item.label}
              </span>
              {isLocked && (
                <Lock className="w-2.5 h-2.5 text-rose-500 absolute top-1 right-2" />
              )}
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
