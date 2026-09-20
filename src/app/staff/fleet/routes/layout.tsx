import React from "react";
import { getStaffServerData } from "@/lib/staff-data";
import { RoutesProvider } from "@/components/staff/routes/RoutesContext";

export const dynamic = "force-dynamic";

export default async function RoutesLayout({ children }: { children: React.ReactNode }) {
  const data = await getStaffServerData("/staff/fleet/routes");

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
