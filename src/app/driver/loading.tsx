import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function DriverLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Loading Driver Telematics Cockpit..."
        subtitle="Graphic Era Hill University • Live GPS Navigation & Route Console"
        fullScreen={false}
      />
    </div>
  );
}
