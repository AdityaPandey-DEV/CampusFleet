import { getStaffServerData } from "@/lib/staff-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StaffMergesView from "@/components/staff/StaffMergesView";

export const dynamic = "force-dynamic";

export default async function StaffDispatchMergesPage() {
  await getStaffServerData("/staff/dispatch/merges");

  const [
    { data: dbSuggestions },
    { data: dbMergePoints },
  ] = await Promise.all([
    supabaseAdmin.from("bus_merge_suggestions").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("bus_merge_points").select("*").order("code"),
  ]);

  return (
    <StaffMergesView
      initialSuggestions={dbSuggestions || []}
      initialMergePoints={dbMergePoints || []}
    />
  );
}
