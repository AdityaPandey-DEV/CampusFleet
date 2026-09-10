import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { AdminBillingView } from "@/components/admin/AdminBillingView";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?redirect=/admin/billing");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  let submissions: any[] = [];
  let payments: any[] = [];

  try {
    const [subRes, payRes] = await Promise.all([
      supabaseAdmin
        .from("payment_submissions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    if (subRes.data) submissions = subRes.data;
    if (payRes.data) payments = payRes.data;
  } catch (err) {
    console.error("Failed to query payments in Server Shell:", err);
  }

  return (
    <AdminBillingView
      initialSubmissions={submissions}
      initialPayments={payments}
      user={session}
    />
  );
}
