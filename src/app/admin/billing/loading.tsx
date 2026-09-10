import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminBillingLoading() {
  return (
    <BusLoadingScreen
      message="Loading Student Fee Ledgers & Invoices..."
      subtitle="Connecting to Institutional Finance Database"
      fullScreen={true}
    />
  );
}
