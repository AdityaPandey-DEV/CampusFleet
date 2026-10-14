import { SettingsView } from "@/components/common/SettingsView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | CampusFleet",
};

export default function SettingsPage() {
  return <SettingsView />;
}
