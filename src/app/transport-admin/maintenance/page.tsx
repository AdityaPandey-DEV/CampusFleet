import { getStaffServerData } from "@/lib/transport-admin-data";
import StaffMaintenanceView from "@/components/transport-admin/StaffMaintenanceView";

export const dynamic = "force-dynamic";

export default async function StaffMaintenancePage() {
  const data = await getStaffServerData("/transport-admin/maintenance");

  return <StaffMaintenanceView initialBuses={data.buses} />;
}
