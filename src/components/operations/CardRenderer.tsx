"use client";

import React from "react";
import dynamic from "next/dynamic";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";

// Dynamically import views
const TransportManagerBusesView = dynamic(
  () => import("@/components/transport-manager/TransportManagerBusesView"),
  { loading: () => <BusLoadingScreen message="Loading bus fleet..." subtitle="Operations" /> }
);

const CorridorsManager = dynamic(
  () => import("@/components/transport-admin/routes/corridors/CorridorsManager"),
  { loading: () => <BusLoadingScreen message="Loading routes & corridors..." subtitle="Operations" /> }
);

const TransportManagerTripsView = dynamic(
  () => import("@/components/transport-manager/TransportManagerTripsView"),
  { loading: () => <BusLoadingScreen message="Loading live trips..." subtitle="Operations" /> }
);

const TransportManagerCrewView = dynamic(
  () => import("@/components/transport-manager/TransportManagerCrewView"),
  { loading: () => <BusLoadingScreen message="Loading driver dispatch..." subtitle="Operations" /> }
);

const StaffFeeApprovalsView = dynamic(
  () => import("@/components/transport-admin/StaffFeeApprovalsView"),
  { loading: () => <BusLoadingScreen message="Loading billing approvals..." subtitle="Operations" /> }
);

const StaffStudentsView = dynamic(
  () => import("@/components/transport-admin/StaffStudentsView"),
  { loading: () => <BusLoadingScreen message="Loading students & passes..." subtitle="Operations" /> }
);

const StaffMaintenanceView = dynamic(
  () => import("@/components/transport-admin/StaffMaintenanceView"),
  { loading: () => <BusLoadingScreen message="Loading workshop maintenance..." subtitle="Operations" /> }
);

const StaffReportsView = dynamic(
  () => import("@/components/transport-admin/StaffReportsView"),
  { loading: () => <BusLoadingScreen message="Loading reports..." subtitle="Operations" /> }
);

const UsersView = dynamic(
  () => import("@/components/users/UsersView"),
  { loading: () => <BusLoadingScreen message="Loading user directory..." subtitle="Operations" /> }
);

const HierarchyFlowchartView = dynamic(
  () => import("@/modules/rbac/HierarchyFlowchartView"),
  { loading: () => <BusLoadingScreen message="Loading hierarchy flowchart..." subtitle="Operations" /> }
);

const TransportManagerDemandView = dynamic(
  () => import("@/components/transport-manager/TransportManagerDemandView"),
  { loading: () => <BusLoadingScreen message="Loading passenger demand..." subtitle="Operations" /> }
);

const TransportManagerMergesView = dynamic(
  () => import("@/components/transport-manager/TransportManagerMergesView"),
  { loading: () => <BusLoadingScreen message="Loading bus merge console..." subtitle="Operations" /> }
);

interface CardRendererProps {
  cardKey: string;
  data: any;
  extra?: any;
}

export function CardRenderer({ cardKey, data, extra }: CardRendererProps) {
  const normalizedKey = cardKey.toLowerCase().replace(/-/g, "_");

  switch (normalizedKey) {
    case "buses":
      return (
        <TransportManagerBusesView
          initialBuses={data.buses || []}
          initialRoutes={data.routes || []}
          initialTrips={data.trips || []}
        />
      );

    case "routes":
      return <CorridorsManager />;

    case "trips":
      return (
        <TransportManagerTripsView
          initialTrips={data.trips || []}
          initialBuses={data.buses || []}
          initialRoutes={data.routes || []}
          initialShifts={data.shifts || []}
          initialStaff={data.staff || []}
          initialBookings={data.bookings || []}
        />
      );

    case "drivers":
    case "crew":
      return (
        <TransportManagerCrewView
          initialTrips={data.trips || []}
          initialBuses={data.buses || []}
          initialRoutes={data.routes || []}
          initialStaff={data.staff || []}
          initialUsers={data.users || []}
        />
      );

    case "billing":
    case "approvals":
    case "fees":
      return (
        <StaffFeeApprovalsView
          initialUser={data.session}
          initialRoutes={data.routes || []}
          initialBuses={data.buses || []}
          initialStudents={data.students || []}
        />
      );

    case "students":
    case "passes":
      return (
        <StaffStudentsView
          initialStudents={data.students || []}
          initialStops={data.stops || []}
          initialRoutes={data.routes || []}
          initialGuardians={extra?.guardians || []}
          initialClasses={extra?.classes || []}
        />
      );

    case "maintenance":
    case "repairs":
      return <StaffMaintenanceView initialBuses={data.buses || []} />;

    case "reports":
      return (
        <StaffReportsView
          initialBookings={extra?.bookings || data.bookings || []}
          initialPayments={extra?.payments || []}
        />
      );

    case "users":
      return <UsersView initialUsers={extra?.users || data.users || []} initialUser={data.session} />;

    case "hierarchy":
      return (
        <HierarchyFlowchartView
          initialRoles={extra?.roles || []}
          initialCards={extra?.cards || []}
        />
      );

    case "demand":
      return (
        <TransportManagerDemandView
          initialRoutes={data.routes || []}
          initialBuses={data.buses || []}
          initialStudents={data.students || []}
          initialTrips={data.trips || []}
        />
      );

    case "combine_buses":
    case "merges":
      return (
        <TransportManagerMergesView
          initialSuggestions={extra?.suggestions || []}
          initialMergePoints={extra?.mergePoints || []}
        />
      );

    default:
      return (
        <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Operation Desk: {cardKey}</h2>
          <p className="text-sm text-gray-500 mt-2">This card capability is active and configured in your role permissions.</p>
        </div>
      );
  }
}
