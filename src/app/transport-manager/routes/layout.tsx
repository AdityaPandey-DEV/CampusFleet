import React from "react";
import { getStaffServerData } from "@/lib/staff-data";
import { RoutesProvider } from "@/components/transport-admin/routes/RoutesContext";

export const dynamic = "force-dynamic";

export default async function TransportManagerRoutesLayout({ children }: { children: React.ReactNode }) {
  const data = await getStaffServerData("/transport-manager/routes");

  return (
    <RoutesProvider
      initialRoutes={data.routes}
      initialStops={data.stops}
      initialBuses={data.buses}
    >
      {children}
    </RoutesProvider>
  );
}
