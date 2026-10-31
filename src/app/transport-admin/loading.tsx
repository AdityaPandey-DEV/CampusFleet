import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function TransportAdminLoading() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center">
      <BusLoadingScreen
        message="Loading Transport Admin Command Center..."
        subtitle="Graphic Era Hill University • Live Fleet Dispatch Hub"
        fullScreen={false}
      />
    </div>
  );
}
