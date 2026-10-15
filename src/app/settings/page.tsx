import { SettingsView } from "@/components/common/SettingsView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings | CampusFleet",
};

export default function GlobalSettingsPage() {
  return <SettingsView />;
}
