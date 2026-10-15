import { getStaffServerData } from "@/lib/staff-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import TransportManagerMergesView from "@/components/transport-manager/TransportManagerMergesView";

export const dynamic = "force-dynamic";

export default async function TransportManagerCombineBusesPage() {
  await getStaffServerData("/transport-manager/combine-buses");

  const [
    { data: dbSuggestions },
    { data: dbMergePoints },
  ] = await Promise.all([
    supabaseAdmin.from("bus_merge_suggestions").select("*").order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("bus_merge_points").select("*").order("code"),
  ]);

  return (
    <TransportManagerMergesView
      initialSuggestions={dbSuggestions || []}
      initialMergePoints={dbMergePoints || []}
    />
  );
}
