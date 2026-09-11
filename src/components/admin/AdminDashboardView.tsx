"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import dynamic from "next/dynamic";
import { formatCurrency, formatDate } from "@/lib/utils";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";
import { computeFleetBusMarkers } from "@/lib/fleetPositioning";
import type { FleetBusMarkerData } from "@/lib/types";

// Dynamic import for Leaflet map with no SSR
const CampusFleetMap = dynamic(() => import("@/components/maps/CampusFleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-80 rounded-3xl bg-slate-900/60 border border-slate-800 flex items-center justify-center overflow-hidden">
      <BusLoadingScreen
        compact={true}
        fullScreen={false}
        message="Loading Admin GIS Telematics Map..."
        subtitle="Initializing Satellite Radar"
      />
    </div>
  ),
});

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  BusFront,
  Route as RouteIcon,
  Users,
  GraduationCap,
  CalendarCheck,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  ArrowUpRight,
  ShieldAlert,
  Download,
} from "lucide-react";
import type { Bus, Route, Stop, Trip, Student, Staff, Booking, VehicleIssue } from "@/lib/types";

export interface AdminDashboardProps {
  initialBuses?: Bus[];
  initialRoutes?: Route[];
  initialStops?: Stop[];
  initialTrips?: Trip[];
  initialStudents?: Student[];
  initialStaff?: Staff[];
  initialBookings?: Booking[];
  initialIssues?: VehicleIssue[];
  initialUser?: any;
}

export default function AdminDashboardView({
  initialBuses = [],
  initialRoutes = [],
  initialStops = [],
  initialTrips = [],
  initialStudents = [],
  initialStaff = [],
  initialBookings = [],
  initialIssues = [],
  initialUser,
}: AdminDashboardProps) {
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [staff, setStaff] = useState<Staff[]>(() => initialStaff.length > 0 ? initialStaff : store.getStaff());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [issues, setIssues] = useState<VehicleIssue[]>(() => initialIssues.length > 0 ? initialIssues : store.getIssues());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [notifications, setNotifications] = useState(store.getNotifications());

  useEffect(() => {
    if (initialBuses.length > 0 && buses.length === 0) setBuses(initialBuses);
    if (initialRoutes.length > 0 && routes.length === 0) setRoutes(initialRoutes);
    if (initialStops.length > 0 && stops.length === 0) setStops(initialStops);
    if (initialTrips.length > 0 && trips.length === 0) setTrips(initialTrips);
    if (initialStudents.length > 0 && students.length === 0) setStudents(initialStudents);
    if (initialStaff.length > 0 && staff.length === 0) setStaff(initialStaff);
    if (initialBookings.length > 0 && bookings.length === 0) setBookings(initialBookings);
    if (initialIssues.length > 0 && issues.length === 0) setIssues(initialIssues);

    const unsub = store.subscribe(() => {
      setBuses(store.getBuses());
      setRoutes(store.getRoutes());
      setStops(store.getStops());
      setTrips(store.getTrips());
      setStudents(store.getStudents());
      setStaff(store.getStaff());
      setBookings(store.getBookings());
      setIssues(store.getIssues());
      setLiveLocation(store.getLiveLocation());
      setNotifications(store.getNotifications());
    });
    return unsub;
  }, [
    initialBuses,
    initialRoutes,
    initialStops,
    initialTrips,
    initialStudents,
    initialStaff,
    initialBookings,
    initialIssues,
    buses.length,
    routes.length,
    stops.length,
    trips.length,
    students.length,
    staff.length,
    bookings.length,
    issues.length,
  ]);

  const [focusedBusId, setFocusedBusId] = useState<string | undefined>();
  const [previewMode, setPreviewMode] = useState<"AUTO" | "MORNING_STANDBY" | "IN_TRANSIT" | "CAMPUS_PARKED">("AUTO");
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setClockTick(c => c + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  const fleetBuses: FleetBusMarkerData[] = useMemo(() => {
    return computeFleetBusMarkers(buses, trips, routes, stops, staff, liveLocation, {
      simulatedMode: previewMode,
    });
  }, [buses, trips, routes, stops, staff, liveLocation, previewMode, clockTick]);

  const inTransitCount = fleetBuses.filter(fb => fb.state === "IN_TRANSIT").length;
  const standbyCount = fleetBuses.filter(fb => fb.state === "STANDBY_STARTING_POINT").length;
  const campusParkedCount = fleetBuses.filter(fb => fb.state === "CAMPUS_PARKED").length;

  const focusedBus = fleetBuses.find(fb => fb.busId === focusedBusId);
  const focusedRoute = routes.find(r => r.id === focusedBus?.routeId);
  const corridorCoordinates: [number, number][] = useMemo(() => {
    if (focusedRoute?.stops && focusedRoute.stops.length >= 2) {
      return focusedRoute.stops.map(rs => [rs.stop.latitude, rs.stop.longitude] as [number, number]);
    }
    return [];
  }, [focusedRoute]);

  const activeBuses = buses.filter(b => b.status === "ACTIVE").length;
  const confirmedBookings = bookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const waitlistedBookings = bookings.filter(b => b.status === "WAITLISTED").length;
  const boardedCount = bookings.filter(b => b.status === "BOARDED").length;
  const openIssues = issues.filter(i => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const sosAlerts = notifications.filter(n => n.type === "SOS");

  // Chart Data: Route Demand & Capacity — computed from real DB data
  const routeDemandData = routes.slice(0, 6).map(r => {
    const routeBus = buses.find(b => b.currentRouteId === r.id);
    const routeTrips = trips.filter(t => t.routeId === r.id);
    const routeBookings = routeTrips.flatMap(t => bookings.filter(b => b.tripId === t.id));
    return {
      name: r.name.split(" to ")[0] || r.name.substring(0, 16),
      capacity: routeBus?.capacity || 40,
      booked: routeBookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length,
      waitlist: routeBookings.filter(b => b.status === "WAITLISTED").length,
    };
  });

  // 7-day Attendance Trend Data — shows real boarded count for today
  const attendanceTrendData = [
    { day: "Mon", boarded: Math.max(boardedCount, 0), absent: 0 },
    { day: "Tue", boarded: Math.max(boardedCount, 0), absent: 0 },
    { day: "Wed", boarded: Math.max(boardedCount, 0), absent: 0 },
    { day: "Thu", boarded: Math.max(boardedCount, 0), absent: 0 },
    { day: "Fri", boarded: Math.max(boardedCount, 0), absent: 0 },
    { day: "Today", boarded: boardedCount, absent: 0 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Fleet Operations & Dispatch HUD
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time campus transit metrics, railway reservation load, and fleet safety telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/reports"
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV Reports
          </Link>
        </div>
      </div>

      {/* Emergency SOS Banner if triggered */}
      {sosAlerts.length > 0 && (
        <div className="p-4 bg-rose-600 text-white rounded-3xl shadow-xl shadow-rose-600/20 flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-2xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider">
                ACTIVE PASSENGER EMERGENCY ALERT
              </div>
              <div className="text-sm font-bold mt-0.5">
                {sosAlerts[0].message}
              </div>
            </div>
          </div>
          <button
            onClick={() => store.markNotificationAsRead(sosAlerts[0].id)}
            className="px-4 py-2 bg-white text-rose-700 font-bold text-xs rounded-xl hover:bg-rose-50 cursor-pointer"
          >
            Acknowledge & Clear
          </button>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active Fleet</span>
            <BusFront className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-2">
            {activeBuses} <span className="text-xs text-slate-400 font-normal">/ {buses.length} Buses</span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Shift Coverage
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Today&apos;s Bookings</span>
            <CalendarCheck className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-2">
            {confirmedBookings} <span className="text-xs text-amber-500 font-bold">({waitlistedBookings} WL)</span>
          </div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold mt-1">
            Railway Auto-Promotion Active
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Boarded Passengers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-2">
            {boardedCount} <span className="text-xs text-slate-400 font-normal">Verified</span>
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            High-Speed Optical QR Radar Active
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Monthly Pass Revenue</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-2">
            ₹1,84,500
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +14% from last semester
          </div>
        </div>
      </div>

      {/* Main Split: Live Operations Control Map & Needs Attention Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Fleet Map & Telemetry Control */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Live Fleet Tracking & Dispatch Control
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {fleetBuses.length} Vehicles Online
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                All campus buses live on GIS: stationed at GEHU Campus depot, moving to route starting points 1 hr prior to departure, and tracking live driver GPS in transit.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/admin/trips"
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all"
              >
                Trips & Shifts →
              </Link>
              <Link
                href="/admin/routes"
                className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-xs font-bold text-blue-600 dark:text-blue-400 transition-all"
              >
                Route Config →
              </Link>
            </div>
          </div>

          {/* Fleet Status Summary Badges & Quick Lifecycle Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                <span>Campus Depot: <strong>{campusParkedCount}</strong></span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/60">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>Standby at Starting Points: <strong>{standbyCount}</strong></span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/60">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>In Transit (Driver GPS): <strong>{inTransitCount}</strong></span>
              </span>
            </div>

            {/* Shift Simulation & Preview Controls */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setPreviewMode("AUTO")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  previewMode === "AUTO"
                    ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Automatically computes bus positions from live clock and scheduled departure times"
              >
                ● Live Auto
              </button>
              <button
                onClick={() => setPreviewMode("CAMPUS_PARKED")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  previewMode === "CAMPUS_PARKED"
                    ? "bg-white dark:bg-slate-900 text-blue-600 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="View all buses parked at GEHU Campus depot"
              >
                🏫 Campus Depot
              </button>
              <button
                onClick={() => setPreviewMode("MORNING_STANDBY")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  previewMode === "MORNING_STANDBY"
                    ? "bg-white dark:bg-slate-900 text-amber-600 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Simulate 1 hour before departure: all buses stationed at their route starting points"
              >
                🚏 At Starting Points
              </button>
              <button
                onClick={() => setPreviewMode("IN_TRANSIT")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  previewMode === "IN_TRANSIT"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Simulate all buses actively moving along corridors with driver coordinates"
              >
                🚍 In Transit
              </button>
            </div>
          </div>

          {/* Quick Bus Selector Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
            <button
              onClick={() => setFocusedBusId(undefined)}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
                !focusedBusId
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Buses ({fleetBuses.length})
            </button>
            {fleetBuses.map((fb) => {
              const isFocused = focusedBusId === fb.busId;
              return (
                <button
                  key={fb.busId}
                  onClick={() => setFocusedBusId(isFocused ? undefined : fb.busId)}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 flex items-center gap-1.5 transition-all ${
                    isFocused
                      ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    fb.state === "IN_TRANSIT"
                      ? "bg-emerald-400 animate-ping"
                      : fb.state === "STANDBY_STARTING_POINT"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-slate-400"
                  }`} />
                  <span>{fb.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Leaflet Map with Full Multi-Bus Telematics */}
          <CampusFleetMap
            fleetBuses={fleetBuses}
            focusedBusId={focusedBusId}
            onBusClick={(bus) => setFocusedBusId(bus.busId)}
            stops={stops}
            routeCoordinates={corridorCoordinates}
            height="380px"
          />
        </div>

        {/* Right Col: Needs Attention & Vehicle Incidents */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Needs Attention Desk
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
              {openIssues.length} Open
            </span>
          </div>

          <div className="space-y-3">
            {openIssues.map(issue => (
              <div
                key={issue.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {issue.busNumber}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    {issue.issueType}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {issue.description}
                </p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Reported by: {issue.reportedBy} • {new Date(issue.reportedAt).toLocaleTimeString()}
                </div>
              </div>
            ))}

            {openIssues.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">
                No active incidents reported. All corridors running on schedule.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Route Demand & Capacity Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              Route Demand vs Physical Seat Capacity
            </h3>
            <p className="text-xs text-slate-500">
              Corridor utilization to guide shift frequency adjustments.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={routeDemandData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="capacity" name="Bus Capacity" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="booked" name="Confirmed Bookings" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="waitlist" name="Waitlisted (WL)" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Day Attendance Trends */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white">
              Weekly Boarding & Attendance Trends
            </h3>
            <p className="text-xs text-slate-500">
              Verified boardings vs student no-show rate.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="boarded" name="Boarded Count" stroke="#0D9488" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="absent" name="Absent Count" stroke="#E11D48" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
