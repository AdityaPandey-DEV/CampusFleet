"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { store } from "@/lib/store";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";

export default function CardsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(() => store.getCurrentUser());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const cardName = segments[segments.length - 1] || "Operations";
  const formattedTitle = cardName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-black font-sans pb-16">
      <UnifiedAppHeader
        role={currentUser?.role || "transport_admin"}
        portalTitle={`${formattedTitle} Desk`}
        portalSubtitle="CampusFleet System Capability"
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
