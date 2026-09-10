import BusLoadingScreen from "@/components/common/BusLoadingScreen";

export default function AdminMergesLoading() {
  return (
    <BusLoadingScreen
      message="Calculating Route Merge Candidates & Efficiencies..."
      subtitle="AI Graph Optimization & Route Efficiency Analyzer"
      fullScreen={true}
    />
  );
}
