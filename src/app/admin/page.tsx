"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import BusSyncMap from "@/components/maps/BusSyncMap";
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
  Route,
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

export default function AdminDashboardOverview() {
  const [buses, setBuses] = useState(store.getBuses());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [stops, setStops] = useState(store.getStops());
  const [trips, setTrips] = useState(store.getTrips());
  const [students, setStudents] = useState(store.getStudents());
  const [staff, setStaff] = useState(store.getStaff());
  const [bookings, setBookings] = useState(store.getBookings());
  const [issues, setIssues] = useState(store.getIssues());
  const [liveLocation, setLiveLocation] = useState(store.getLiveLocation());
  const [notifications, setNotifications] = useState(store.getNotifications());

  useEffect(() => {
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
  }, []);

  const activeBuses = buses.filter(b => b.status === "ACTIVE").length;
  const confirmedBookings = bookings.filter(b => b.status === "CONFIRMED" || b.status === "BOARDED").length;
  const waitlistedBookings = bookings.filter(b => b.status === "WAITLISTED").length;
  const boardedCount = bookings.filter(b => b.status === "BOARDED").length;
  const openIssues = issues.filter(i => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const sosAlerts = notifications.filter(n => n.type === "SOS");

  // Chart Data: Route Demand & Capacity
  const routeDemandData = [
    { name: "RT-101 (North)", capacity: 40, booked: 38, waitlist: 4 },
    { name: "RT-202 (Metro)", capacity: 45, booked: 42, waitlist: 2 },
    { name: "RT-303 (South)", capacity: 36, booked: 28, waitlist: 0 },
    { name: "RT-404 (Ring)", capacity: 42, booked: 35, waitlist: 1 },
  ];

  // 7-day Attendance Trend Data
  const attendanceTrendData = [
    { day: "Mon", boarded: 142, absent: 8 },
    { day: "Tue", boarded: 148, absent: 6 },
    { day: "Wed", boarded: 145, absent: 9 },
    { day: "Thu", boarded: 152, absent: 5 },
    { day: "Fri", boarded: 150, absent: 7 },
    { day: "Today", boarded: boardedCount, absent: 2 },
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
            className="px-4 py-2 bg-white text-rose-700 font-bold text-xs rounded-xl hover:bg-rose-50"
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
            QR & Biometric Sensor Ready
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
                Live Fleet Tracking & Dispatch Control
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring 5 active campus transit corridors with real-time GPS pings.
              </p>
            </div>
            <Link
              href="/admin/routes"
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Route Config →
            </Link>
          </div>

          <BusSyncMap
            buses={buses}
            routes={routes}
            stops={stops}
            liveLocation={liveLocation}
            height="380px"
            interactive={true}
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
