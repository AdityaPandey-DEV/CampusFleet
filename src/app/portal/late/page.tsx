import React from "react";
import RunningLateRecoveryView from "@/components/portal/RunningLateRecoveryView";
import { store } from "@/lib/store";

export const metadata = {
  title: "Running Late - CampusFleet",
};

export default function RunningLatePage() {
  return (
    <div className="animate-in fade-in">
      <RunningLateRecoveryView />
    </div>
  );
}
