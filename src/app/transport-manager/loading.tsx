import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function TransportManagerLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Loading Transport Manager Cockpit..."
        subtitle="Graphic Era Hill University • Dynamic Allocation Engine"
        fullScreen={false}
      />
    </div>
  );
}
