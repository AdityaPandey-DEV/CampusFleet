import { getStaffServerData } from "@/lib/staff-data";
import StaffFeeApprovalsView from "@/components/staff/StaffFeeApprovalsView";

export const dynamic = "force-dynamic";

export default async function StaffBillingApprovalsPage() {
  const data = await getStaffServerData("/staff/billing/approvals");

  return (
    <StaffFeeApprovalsView
      initialUser={data.session}
      initialRoutes={data.routes}
      initialBuses={data.buses}
      initialStudents={data.students}
    />
  );
}
