import { getStaffServerData } from "@/lib/staff-data";
import StaffPaymentQRView from "@/components/staff/StaffPaymentQRView";

export const dynamic = "force-dynamic";

export default async function StaffBillingQRPage() {
  const data = await getStaffServerData("/staff/billing/qr");

  return <StaffPaymentQRView initialUser={data.session} />;
}
