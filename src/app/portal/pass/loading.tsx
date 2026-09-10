import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function PassLoading() {
  return (
    <BusLoadingScreen
      message="Loading Digital Boarding Pass & QR Credentials..."
      subtitle="Verifying institutional transit pass cryptography"
      fullScreen={true}
    />
  );
}
