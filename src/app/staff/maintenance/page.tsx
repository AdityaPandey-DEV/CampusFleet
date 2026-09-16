import { getStaffServerData } from "@/lib/staff-data";
import StaffMaintenanceView from "@/components/staff/StaffMaintenanceView";

export const dynamic = "force-dynamic";

export default async function StaffMaintenancePage() {
  const data = await getStaffServerData("/staff/maintenance");

  return <StaffMaintenanceView initialBuses={data.buses} />;
}
