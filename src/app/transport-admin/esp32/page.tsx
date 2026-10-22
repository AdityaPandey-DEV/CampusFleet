import { getHardwareDeskServerData } from "@/lib/transport-admin-data";
import ESP32CardHolderIssuanceView from "@/components/transport-admin/ESP32CardHolderIssuanceView";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ESP32 Hardware Terminals & Bus Pairing | CampusFleet",
  description: "Map and manage physical IoT ESP32 RFID readers and GPS terminals to campus bus assets.",
};

export default async function StaffESP32ManagementPage() {
  const data = await getHardwareDeskServerData("/transport-admin/esp32");

  return (
    <ESP32CardHolderIssuanceView
      initialBuses={data.buses}
      initialRoutes={data.routes}
      initialStops={data.stops}
    />
  );
}
