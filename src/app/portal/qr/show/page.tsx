"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UnifiedStudentDynamicQRPage from "../page";

/**
 * Consolidated Show QR Page
 * Directly re-exports the authoritative Unified Student Dynamic QR Pass
 * so that both /portal/qr and /portal/qr/show share the exact same 1-student 1-QR security engine.
 */
export default function ShowQRPage() {
  const router = useRouter();

  useEffect(() => {
    // Graceful URL normalization to /portal/qr
    if (typeof window !== "undefined" && window.location.pathname === "/portal/qr/show") {
      router.replace("/portal/qr");
    }
  }, [router]);

  return <UnifiedStudentDynamicQRPage />;
}
