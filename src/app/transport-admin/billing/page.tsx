import { getStaffServerData } from "@/lib/transport-admin-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { StaffBillingView } from "@/components/transport-admin/StaffBillingView";

export const dynamic = "force-dynamic";

export default async function StaffBillingPage() {
  const { session } = await getStaffServerData("/transport-admin/billing");

  let submissions: any[] = [];
  let payments: any[] = [];

  try {
    const [subRes, payRes] = await Promise.all([
      supabaseAdmin.from("payment_submissions").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false }),
    ]);

    if (subRes.data) submissions = subRes.data;
    if (payRes.data) payments = payRes.data;
  } catch (err) {
    console.error("Failed to query payments for staff billing:", err);
  }

  return (
    <StaffBillingView
      initialSubmissions={submissions}
      initialPayments={payments}
      user={session}
    />
  );
}
