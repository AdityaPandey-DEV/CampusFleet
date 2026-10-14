import { getStaffServerData } from "@/lib/transport-admin-data";
import StaffPaymentQRView from "@/components/transport-admin/StaffPaymentQRView";

export const dynamic = "force-dynamic";

export default async function StaffBillingQRPage() {
  const data = await getStaffServerData("/transport-admin/billing/qr");

  return <StaffPaymentQRView initialUser={data.session} />;
}
