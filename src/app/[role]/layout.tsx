"use client";

import React from "react";
import { useParams } from "next/navigation";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";

export default function DynamicRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { role: string };
}) {
  const roleSlug = params?.role || "portal";
  const roleTitle = roleSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-black font-sans pb-16">
      <UnifiedAppHeader
        role={roleSlug}
        portalTitle={`${roleTitle} Console`}
        portalSubtitle="Dynamic Role Operations Desk"
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
