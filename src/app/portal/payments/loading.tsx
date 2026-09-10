import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function PaymentsLoading() {
  return (
    <BusLoadingScreen
      message="Loading Semester Pass Fees & Payment History..."
      subtitle="Connecting to Institutional Accounts Ledger"
      fullScreen={true}
    />
  );
}
