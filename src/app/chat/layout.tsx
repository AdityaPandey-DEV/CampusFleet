"use client";

import React from "react";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import { usePathname } from "next/navigation";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col overflow-hidden">
      <UnifiedAppHeader
        portalTitle="Messages"
        portalSubtitle="CampusFleet Unified Chat & Commute Broadcast"
        navLinks={[]}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
