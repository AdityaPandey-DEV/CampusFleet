import { getStaffServerData } from "@/lib/transport-admin-data";
import StaffFeeApprovalsView from "@/components/transport-admin/StaffFeeApprovalsView";

export const dynamic = "force-dynamic";

export default async function StaffBillingApprovalsPage() {
  const data = await getStaffServerData("/transport-admin/billing/approvals");

  return (
    <StaffFeeApprovalsView
      initialUser={data.session}
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStudents={data.students}
    />
  );
}
