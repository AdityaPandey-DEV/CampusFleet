import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function ChatLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Connecting to CampusFleet Chat Mesh..."
        subtitle="Secure Real-Time Operations & Student Channels"
        fullScreen={false}
      />
    </div>
  );
}
