import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function PortalLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Loading Student Transit Portal..."
        subtitle="Graphic Era Hill University • Reserved Seat Pass & Route Telematics"
        fullScreen={false}
      />
    </div>
  );
}
