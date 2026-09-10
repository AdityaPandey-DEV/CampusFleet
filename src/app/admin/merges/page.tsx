import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminMergesView from "@/components/admin/AdminMergesView";

export const dynamic = "force-dynamic";

/**
 * Server Component: Bus Merge & Progressive Dispatch Command Hub
 * - Server-side authorization check (Admin / Operations)
 * - Queries active merge proposals, transit hubs, and dispatch queues
 * - Fast server render
 */
export default async function AdminBusMergeDispatchPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/merges");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbSuggestions },
    { data: dbMergePoints },
  ] = await Promise.all([
    supabaseAdmin.from("bus_merge_suggestions").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("bus_merge_points").select("*").order("code"),
  ]);

  return (
    <AdminMergesView
      initialSuggestions={dbSuggestions || []}
      initialMergePoints={dbMergePoints || []}
    />
  );
}
