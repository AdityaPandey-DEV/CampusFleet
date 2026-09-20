import React from "react";
import { getSession } from "@/lib/jwt";
import { supabaseAdmin } from "@/lib/supabaseClient";
import ClientPortalLayout from "./ClientPortalLayout";
import { cacheGet, cacheSet } from "@/lib/redis";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  let isSubscribed = false;

  if (session && session.role === "student") {
    // 1. Check Redis Cache for instant resolution
    const cacheKey = `student:subscription:${session.userId}`;
    const cachedStatus = await cacheGet(cacheKey);
    
    if (cachedStatus !== null) {
      isSubscribed = Boolean(cachedStatus);
    } else {
      // 2. Fallback to Supabase if not in Redis
      const { data } = await supabaseAdmin.from("students_full")
          .select("has_active_subscription, payment_status")
          .or(`user_id.eq.${session.userId},email.eq.${session.email}`)
          .limit(1)
          .maybeSingle();
          
      if (data) {
          isSubscribed = Boolean(data.has_active_subscription) || data.payment_status === "APPROVED" || data.payment_status === "COMPLETED";
          // 3. Cache it in Redis for 5 minutes
          await cacheSet(cacheKey, isSubscribed, 300);
      }
    }
  } else if (session && session.role !== "student") {
    isSubscribed = true; // Admins, Staff, Drivers have inherent access
  }

  return (
    <ClientPortalLayout initialIsSubscribed={isSubscribed}>
      {children}
    </ClientPortalLayout>
  );
}
