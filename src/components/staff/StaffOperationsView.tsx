"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { store } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { UnifiedAppHeader } from "@/components/common/UnifiedAppHeader";
import BusLoadingScreen from "@/components/common/BusLoadingScreen";
import * as XLSX from "xlsx";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  GitMerge,
  BarChart3,
  BusFront,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Upload,
  Sparkles,
  Search,
  Eye,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  RefreshCw,
  LogOut,
  Sliders,
  Check,
  X,
  FileText,
  Building2,
  MapPin,
  ChevronRight,
  CalendarDays,
  RotateCcw,
  History,
  UserCheck,
  BadgeAlert,
  Shield,
  Phone,
  Award,
  LayoutDashboard,
  Plus,
  GitBranch,
  ArrowDown,
  Navigation,
  Route as RouteIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { Route, Bus, Stop, Student, Trip, Booking, Staff, UserAccount } from "@/lib/types";

export interface StaffOperationsProps {
  initialUser?: any;
  initialRoutes?: Route[];
  initialBuses?: Bus[];
  initialStops?: Stop[];
  initialStudents?: Student[];
  initialTrips?: Trip[];
  initialBookings?: Booking[];
  initialStaff?: Staff[];
  initialUsers?: UserAccount[];
}

export default function StaffOperationsView({
  initialUser,
  initialRoutes = [],
  initialBuses = [],
  initialStops = [],
  initialStudents = [],
  initialTrips = [],
  initialBookings = [],
  initialStaff = [],
  initialUsers = [],
}: StaffOperationsProps = {}) {
  const [activeTab, setActiveTab] = useState<
    "APPROVALS" | "QR_SETTINGS" | "AUDIT_EXCEL" | "DEMAND_FLEET" | "ROUTE_FLOWCHART" | "MERGE_OPTIMIZER" | "DAILY_OPERATIONS" | "CREW_ASSIGNMENT"
  >("APPROVALS");

  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [buses, setBuses] = useState<Bus[]>(() => initialBuses.length > 0 ? initialBuses : store.getBuses());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [trips, setTrips] = useState<Trip[]>(() => initialTrips.length > 0 ? initialTrips : store.getTrips());
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.length > 0 ? initialBookings : store.getBookings());
  const [staff, setStaff] = useState<Staff[]>(() => initialStaff.length > 0 ? initialStaff : store.getStaff());
  const [users, setUsers] = useState<UserAccount[]>(() => initialUsers.length > 0 ? initialUsers : store.getUsers());

  // Crew Assignment State
  const [crewSearchQuery, setCrewSearchQuery] = useState("");
  const [selectedTripForCrew, setSelectedTripForCrew] = useState<any | null>(null);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState("");
  const [conductorSearchQuery, setConductorSearchQuery] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedConductorId, setSelectedConductorId] = useState("");
  const [isAssigningCrew, setIsAssigningCrew] = useState(false);
  const [crewAssignError, setCrewAssignError] = useState<string | null>(null);
  const [crewDate, setCrewDate] = useState(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().split("T")[0];
  });

  // Route Flowchart & Bus Dispatch State
  const [flowchartRouteId, setFlowchartRouteId] = useState<string>(() => initialRoutes[0]?.id || "");
  const [flowchartSearchQuery, setFlowchartSearchQuery] = useState("");
  const [isAssignBusModalOpen, setIsAssignBusModalOpen] = useState(false);
  const [assignTargetStop, setAssignTargetStop] = useState<{
    stopId: string;
    stopName: string;
    stopCode: string;
    stopSequence: number;
    arrivalOffset: number;
  } | null>(null);
  const [assignBusFormData, setAssignBusFormData] = useState({
    busId: "",
    departureTime: "07:20",
    driverId: "",
    conductorId: "",
  });
  const [isAssigningFlowchartBus, setIsAssigningFlowchartBus] = useState(false);
  const [assignFlowchartError, setAssignFlowchartError] = useState<string | null>(null);

  // Submissions State
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED">("ALL");

  // QR Config State
  const [qrConfig, setQrConfig] = useState({
    upi_id: "gehubhimtal.transit@upi",
    merchant_name: "GEHU Bhimtal Transport Department",
    qr_image_url: "",
    instructions: "Scan via Google Pay, PhonePe, Paytm, or BHIM UPI. Ensure the 12-digit UTR is visible on the receipt.",
    account_number: "50200012345678",
    ifsc_code: "HDFC0001234",
    bank_name: "HDFC Bank, Haldwani Branch",
  });
  const [isSavingQr, setIsSavingQr] = useState(false);
  const [isUploadingQrImage, setIsUploadingQrImage] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  // Route Analytics & Demand
  const [routeAnalytics, setRouteAnalytics] = useState<any[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Bus Merge State
  const [mergeSuggestions, setMergeSuggestions] = useState<any[]>([]);
  const [isLoadingMerges, setIsLoadingMerges] = useState(true);

  // Daily Operations Rollover State
  const [isRolloverLoading, setIsRolloverLoading] = useState(false);
  const [rolloverStatus, setRolloverStatus] = useState<any>(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    return new Date(now.getTime() + istOffset).toISOString().split("T")[0];
  });

  const fetchRolloverStatus = async () => {
    try {
      const res = await fetch("/api/cron/daily-rollover");
      const data = await res.json();
      if (data.success) {
        setRolloverStatus(data);
      }
    } catch (e) {
      console.warn("Failed to fetch rollover status", e);
    }
  };

  const handleExecuteRollover = async (targetDateParam?: string, force = false) => {
    setIsRolloverLoading(true);
    try {
      const res = await fetch("/api/cron/daily-rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDate: targetDateParam,
          force,
          triggeredBy: currentUser?.fullName || "Transport Staff Operations",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ ${data.message}`);
        await store.reloadFromDatabase();
        fetchRolloverStatus();
      } else {
        alert(data.message || "Rollover failed");
      }
    } catch (err: any) {
      alert("Rollover error: " + err.message);
    } finally {
      setIsRolloverLoading(false);
    }
  };

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Initial Load & Subscriptions
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setRoutes(store.getRoutes());
      setBuses(store.getBuses());
      setStops(store.getStops());
      setStudents(store.getStudents());
      setTrips(store.getTrips());
      setBookings(store.getBookings());
      setStaff(store.getStaff());
      setUsers(store.getUsers());
    });
    fetchSubmissions();
    fetchQrConfig();
    fetchRouteAnalytics();
    fetchMergeSuggestions();
    fetchRolloverStatus();
    return unsub;
  }, []);

  // Fetch Submissions
  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const res = await fetch("/api/payments/approvals");
      const data = await res.json();
      if (data.success && data.submissions) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error("Error loading submissions:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Fetch QR Config
  const fetchQrConfig = async () => {
    try {
      const res = await fetch("/api/staff/qr-config");
      const data = await res.json();
      if (data.success && data.config) {
        setQrConfig((prev) => ({ ...prev, ...data.config }));
      }
    } catch (err) {
      console.error("Error loading QR config:", err);
    }
  };

  // Fetch Route Analytics
  const fetchRouteAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch("/api/staff/route-analytics");
      const data = await res.json();
      if (data.success && data.analytics) {
        setRouteAnalytics(data.analytics);
      }
    } catch (err) {
      console.error("Error loading route analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  // Fetch Merge Suggestions
  const fetchMergeSuggestions = async () => {
    setIsLoadingMerges(true);
    try {
      const res = await fetch("/api/merges");
      const data = await res.json();
      if (data.success && data.suggestions) {
        setMergeSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("Error loading merge suggestions:", err);
    } finally {
      setIsLoadingMerges(false);
    }
  };

  // 2. Payment Approval Handlers
  const handleApprovePayment = async (sub: any) => {
    setActionLoadingId(sub.id);
    try {
      const res = await fetch("/api/payments/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: sub.id,
          action: "APPROVE",
          reviewedBy: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ Approved payment of ₹${sub.amount_paid} for ${sub.student?.full_name || "Student"}!`);
        fetchSubmissions();
        store.syncFromSupabase();
      } else {
        alert(data.error || "Approval failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectModalId) return;
    setActionLoadingId(rejectModalId);
    try {
      const res = await fetch("/api/payments/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: rejectModalId,
          action: "REJECT",
          rejectionReason: rejectionReason || "Transaction reference could not be verified on bank statement.",
          reviewedBy: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Payment rejected. Student prompted to re-upload.");
        setRejectModalId(null);
        setRejectionReason("");
        fetchSubmissions();
      } else {
        alert(data.error || "Rejection failed");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. QR Config Handlers
  const handleSaveQrConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingQr(true);
    try {
      const res = await fetch("/api/staff/qr-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...qrConfig,
          updated_by: currentUser?.fullName || "Transport Operations Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("✓ Official University Payment QR & UPI VPA updated!");
      } else {
        alert(data.error || "Failed to update QR config");
      }
    } catch (err: any) {
      alert("Error saving QR config: " + err.message);
    } finally {
      setIsSavingQr(false);
    }
  };

  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingQrImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/payments/upload-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setQrConfig((prev) => ({ ...prev, qr_image_url: data.url }));
        showToast("✓ Custom QR image uploaded to Vercel Blob CDN!");
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Upload error: " + err.message);
    } finally {
      setIsUploadingQrImage(false);
    }
  };

  // 4. Excel (.xlsx) Export Handler
  const handleExportToExcel = () => {
    const exportData = filteredSubmissions.map((sub, idx) => ({
      "S.No": idx + 1,
      "Submission ID": sub.id,
      "Student Name": sub.student?.full_name || "N/A",
      "Enrollment / Roll No": sub.student?.enrollment_no || "PENDING",
      "Department": sub.student?.department || "General",
      "Transit Zone": sub.zone_code || "ZONE_B",
      "Amount Paid (INR)": sub.amount_paid || 0,
      "Installment #": sub.installment_number || 1,
      "Transaction ID / UTR": sub.transaction_id || "NOT_PROVIDED",
      "Approval Status": sub.status,
      "Reviewed By": sub.reviewed_by || "Pending Review",
      "Reviewed At": sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleString() : "-",
      "Submitted Timestamp": new Date(sub.created_at).toLocaleString(),
      "Receipt Image URL": sub.receipt_url || "-",
      "Staff Notes": sub.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-fit column widths
    const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
      wch: Math.max(key.length + 3, 14),
    }));
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Payment Audit");

    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `CampusFleet_Fee_Audit_${todayStr}.xlsx`);
    showToast("✓ Exported fee audit report to Excel (.xlsx)!");
  };

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        sub.student?.full_name?.toLowerCase().includes(q) ||
        sub.student?.enrollment_no?.toLowerCase().includes(q) ||
        sub.transaction_id?.toLowerCase().includes(q) ||
        sub.zone_code?.toLowerCase().includes(q)
      );
    });
  }, [submissions, statusFilter, searchFilter]);

  // Derived Summary Counts
  const pendingCount = submissions.filter((s) => s.status === "PENDING_APPROVAL").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const totalApprovedAmount = submissions
    .filter((s) => s.status === "APPROVED")
    .reduce((acc, s) => acc + (Number(s.amount_paid) || 0), 0);

  // Filtered Crew for Crew Assignment:
  // 1. DRIVERS: strictly users/staff where role === 'driver' (conductors cannot drive!)
  const eligibleDrivers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; license?: string; role: string; employeeCode?: string }>();
    staff
      .filter((s) => s.role === "driver")
      .forEach((s) => {
        map.set(s.id, {
          id: s.id,
          name: s.fullName,
          phone: s.phone,
          license: s.licenseNo || "HMV-COMMERCIAL",
          role: "driver",
          employeeCode: s.employeeCode,
        });
      });
    users
      .filter((u) => u.role === "driver")
      .forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, {
            id: u.id,
            name: u.fullName,
            phone: u.phone || "—",
            license: "HMV-COMMERCIAL",
            role: "driver",
          });
        }
      });
    const list = Array.from(map.values());
    if (!driverSearchQuery.trim()) return list;
    const q = driverSearchQuery.toLowerCase();
    return list.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        (d.license && d.license.toLowerCase().includes(q))
    );
  }, [staff, users, driverSearchQuery]);

  // 2. CONDUCTORS: BOTH conductors AND qualified drivers are eligible! ("a driver can be a conductor but conductor cant")
  const eligibleConductors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string; role: string; isActingDriver?: boolean; employeeCode?: string }>();
    staff
      .filter((s) => s.role === "conductor")
      .forEach((s) => {
        map.set(s.id, {
          id: s.id,
          name: s.fullName,
          phone: s.phone,
          role: "conductor",
          isActingDriver: false,
          employeeCode: s.employeeCode,
        });
      });
    users
      .filter((u) => u.role === "conductor")
      .forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, {
            id: u.id,
            name: u.fullName,
            phone: u.phone || "—",
            role: "conductor",
            isActingDriver: false,
          });
        }
      });
    // Add qualified drivers as eligible conductors
    staff
      .filter((s) => s.role === "driver")
      .forEach((s) => {
        if (!map.has(s.id)) {
          map.set(s.id, {
            id: s.id,
            name: s.fullName,
            phone: s.phone,
            role: "driver",
            isActingDriver: true,
            employeeCode: s.employeeCode,
          });
        }
      });
    users
      .filter((u) => u.role === "driver")
      .forEach((u) => {
        if (!map.has(u.id)) {
          map.set(u.id, {
            id: u.id,
            name: u.fullName,
            phone: u.phone || "—",
            role: "driver",
            isActingDriver: true,
          });
        }
      });
    const list = Array.from(map.values());
    if (!conductorSearchQuery.trim()) return list;
    const q = conductorSearchQuery.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [staff, users, conductorSearchQuery]);

  const openCrewModal = (t: any) => {
    setSelectedTripForCrew(t);
    setSelectedDriverId(t.driverId || "");
    setSelectedConductorId(t.conductorId || "");
    setDriverSearchQuery("");
    setConductorSearchQuery("");
    setCrewAssignError(null);
    setCrewModalOpen(true);
  };

  const handleSaveCrewAssignment = async () => {
    if (!selectedTripForCrew) return;
    setIsAssigningCrew(true);
    setCrewAssignError(null);

    try {
      const res = await fetch("/api/staff/assign-crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: selectedTripForCrew.id,
          busId: selectedTripForCrew.busId,
          driverId: selectedDriverId,
          conductorId: selectedConductorId,
          assignedBy: currentUser?.fullName || "Transport Operations Staff",
        }),
      });

      const data = await res.json();
      if (data.success) {
        await store.assignTripCrew(selectedTripForCrew.id, selectedDriverId, selectedConductorId);
        showToast(data.message || "✓ Crew assigned to bus successfully!");
        setCrewModalOpen(false);
        setSelectedTripForCrew(null);
        await store.syncFromSupabase();
      } else {
        setCrewAssignError(data.error || "Failed to assign crew.");
      }
    } catch (err: any) {
      setCrewAssignError(err.message || "Network error while assigning crew.");
    } finally {
      setIsAssigningCrew(false);
    }
  };

  // Active route for Corridor Flowchart
  const selectedFlowchartRoute = useMemo(() => {
    if (!routes || routes.length === 0) return null;
    return routes.find((r) => r.id === flowchartRouteId) || routes[0];
  }, [routes, flowchartRouteId]);

  // Extract stops in ordered sequence for flowchart
  const flowchartStops = useMemo(() => {
    if (!selectedFlowchartRoute) return [];

    let rawList: any[] = [];
    if (Array.isArray(selectedFlowchartRoute.stops) && selectedFlowchartRoute.stops.length > 0) {
      rawList = selectedFlowchartRoute.stops;
    } else if (Array.isArray((selectedFlowchartRoute as any).stops_data) && (selectedFlowchartRoute as any).stops_data.length > 0) {
      rawList = (selectedFlowchartRoute as any).stops_data;
    } else if (Array.isArray((selectedFlowchartRoute as any).route_stops) && (selectedFlowchartRoute as any).route_stops.length > 0) {
      rawList = (selectedFlowchartRoute as any).route_stops;
    }

    const resolved = rawList.map((item: any, idx: number) => {
      const stopId = item.stopId || item.stop_id || item.id || `stop-${idx}`;
      const foundStop = item.stop || stops.find((s) => s.id === stopId);
      const name = foundStop?.name || item.name || `Stop ${idx + 1}`;
      const code = foundStop?.code || item.code || `STP-${idx + 1}`;
      const landmark = foundStop?.landmark || item.landmark || "";
      const sequence = typeof item.stopOrder === "number" ? item.stopOrder : idx + 1;
      const arrivalOffset = typeof item.arrivalOffsetMinutes === "number" ? item.arrivalOffsetMinutes : idx * 12;

      // Count students registered for this primary stop
      const enrolledStudents = students.filter(
        (st) => st.primaryStopId === stopId || (st.primaryRouteId === selectedFlowchartRoute.id && idx === 0)
      );

      // Find trips that originate or are deployed starting from this stop
      const assignedTrips = trips.filter((t) => {
        if (t.routeId !== selectedFlowchartRoute.id) return false;
        const currentIdx = t.currentStopIndex ?? 0;
        return currentIdx === idx;
      });

      return {
        stopId,
        name,
        code,
        landmark,
        sequence,
        index: idx,
        arrivalOffset,
        enrolledCount: enrolledStudents.length,
        assignedTrips,
      };
    });

    if (!flowchartSearchQuery.trim()) return resolved;
    const q = flowchartSearchQuery.toLowerCase();
    return resolved.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.landmark.toLowerCase().includes(q)
    );
  }, [selectedFlowchartRoute, stops, students, trips, flowchartSearchQuery]);

  const handleOpenAssignModal = (targetStop: {
    stopId: string;
    stopName: string;
    stopCode: string;
    stopSequence: number;
    arrivalOffset: number;
  }) => {
    setAssignTargetStop(targetStop);
    const activeBus = buses.find((b) => b.status === "ACTIVE") || buses[0];
    
    // Calculate expected time based on 07:20 AM baseline + arrivalOffset
    const baseHour = 7;
    const baseMin = 20 + targetStop.arrivalOffset;
    const totalMins = baseHour * 60 + baseMin;
    const hrs = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
    const mins = String(totalMins % 60).padStart(2, "0");

    setAssignBusFormData({
      busId: activeBus?.id || "",
      departureTime: `${hrs}:${mins}`,
      driverId: "",
      conductorId: "",
    });
    setAssignFlowchartError(null);
    setIsAssignBusModalOpen(true);
  };

  const handleSaveBusAssignmentToStop = async () => {
    if (!assignTargetStop || !selectedFlowchartRoute) {
      setAssignFlowchartError("Please select a valid stop and corridor route.");
      return;
    }
    if (!assignBusFormData.busId) {
      setAssignFlowchartError("Please select an operational bus from the fleet.");
      return;
    }

    setIsAssigningFlowchartBus(true);
    setAssignFlowchartError(null);

    try {
      const chosenBus = buses.find((b) => b.id === assignBusFormData.busId);
      const chosenBusLabel = chosenBus ? chosenBus.busNumber.split(" ")[0] : "BUS";
      const tripCode = `${selectedFlowchartRoute.code}-${chosenBusLabel}-S${assignTargetStop.stopSequence}-${Date.now().toString().slice(-4)}`;
      const today = new Date().toISOString().split("T")[0];

      const newTripData = {
        tripCode,
        routeId: selectedFlowchartRoute.id,
        busId: assignBusFormData.busId,
        shiftId: "shift-morning-01",
        driverId: assignBusFormData.driverId || "",
        conductorId: assignBusFormData.conductorId || "",
        tripDate: today,
        status: "SCHEDULED" as const,
        delayMinutes: 0,
        manifestLocked: false,
        currentStopIndex: Math.max(0, assignTargetStop.stopSequence - 1),
      };

      await store.createTrip(newTripData);
      setTrips(store.getTrips());

      showToast(`✓ Bus ${chosenBus?.busNumber || chosenBusLabel} assigned starting from ${assignTargetStop.stopName}!`);
      setIsAssignBusModalOpen(false);
      setAssignTargetStop(null);
    } catch (err: any) {
      console.error("Error creating trip assignment:", err);
      setAssignFlowchartError(err.message || "Failed to assign bus to this stop.");
    } finally {
      setIsAssigningFlowchartBus(false);
    }
  };

  const handleUnassignTrip = async (tripId: string, busLabel: string) => {
    if (!confirm(`Are you sure you want to unassign ${busLabel} from this stop?`)) return;
    try {
      await store.deleteTrip(tripId);
      setTrips(store.getTrips());
      showToast(`✓ Unassigned ${busLabel} from service successfully!`);
    } catch (err: any) {
      console.error("Error unassigning trip:", err);
      showToast(`Failed to unassign: ${err.message || "Unknown error"}`);
    }
  };

  // Access Barrier: Only Staff and Admin can access the Staff Panel; Drivers, Conductors & Students are restricted
  const isAuthorizedStaff = currentUser?.role === "staff" || currentUser?.role === "admin" || currentUser?.role === "transport_manager";
  if (currentUser && !isAuthorizedStaff) {
    const isDriver = currentUser.role === "driver";
    const isConductor = currentUser.role === "conductor";
    const targetPortal = isDriver ? "/driver" : isConductor ? "/conductor" : "/portal";
    const targetLabel = isDriver ? "Go to Driver Cockpit" : isConductor ? "Go to Conductor Console" : "Go to Student Portal";
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 border border-slate-700 shadow-2xl text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Access Restricted</h2>
          <p className="text-xs text-slate-300">
            {isDriver || isConductor
              ? "Drivers and Conductors cannot access the Staff Operations Panel. Financial approvals, audit reporting, and fleet management are restricted to Staff personnel."
              : "Staff or Administrator privileges are required to access the Staff Operations Panel."}
          </p>
          <div className="pt-2">
            <Link
              href={targetPortal}
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
            >
              <span>{targetLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-20 transition-colors">
      {/* Zero-Overflow Staff Header with Vertical Command Slide */}
      <UnifiedAppHeader
        role="staff"
        portalTitle="CampusFleet"
        portalSubtitle="Transport Staff Operations & Supervisory Console"
        customActions={
          (currentUser?.role === "admin" || currentUser?.role === "transport_manager") ? (
            <Link
              href="/admin"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 text-xs font-bold transition-all shadow-2xs"
              title="Return to Admin Hub"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Admin Hub</span>
            </Link>
          ) : null
        }
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 min-w-0">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/90 border border-blue-300 dark:border-blue-700 rounded-2xl text-xs font-bold text-blue-900 dark:text-blue-200 text-center animate-in fade-in shadow-lg flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Top Metric Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                Pending Approvals
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {pendingCount}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Awaiting Staff Review</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                Approved Revenue
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-900 dark:text-emerald-300 mt-1">
                ₹{totalApprovedAmount.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{approvedCount} Verified Submissions</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
                Transit Corridors
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {routes.length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{stops.length} Managed Bus Stops</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-black tracking-wider text-purple-600 dark:text-purple-400">
                Merge Opportunities
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {mergeSuggestions.filter((s) => s.status === "PENDING").length}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">Potential Fuel Savings</div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 flex items-center justify-center font-bold">
              <GitMerge className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab Selector Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-200/80 dark:bg-slate-900/90 rounded-2xl border border-slate-300 dark:border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("APPROVALS")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "APPROVALS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Fee Approvals ({pendingCount})</span>
          </button>

          <button
            onClick={() => setActiveTab("QR_SETTINGS")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "QR_SETTINGS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Payment QR & UPI</span>
          </button>

          <button
            onClick={() => setActiveTab("AUDIT_EXCEL")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "AUDIT_EXCEL"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Audit & Excel Export</span>
          </button>

          <button
            onClick={() => setActiveTab("DEMAND_FLEET")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "DEMAND_FLEET"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Demand & Fleet Sizing</span>
          </button>

          <button
            onClick={() => setActiveTab("ROUTE_FLOWCHART")}
            className={`flex-1 min-w-[160px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "ROUTE_FLOWCHART"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Route Stops & Bus Dispatch</span>
          </button>

          <button
            onClick={() => setActiveTab("MERGE_OPTIMIZER")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "MERGE_OPTIMIZER"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GitMerge className="w-4 h-4" />
            <span>Bus Merge Optimizer</span>
          </button>

          <button
            onClick={() => setActiveTab("DAILY_OPERATIONS")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "DAILY_OPERATIONS"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Daily Operations</span>
          </button>

          <button
            onClick={() => setActiveTab("CREW_ASSIGNMENT")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 text-xs font-black rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "CREW_ASSIGNMENT"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Crew & Bus Allocation</span>
          </button>
        </div>

        {/* TAB 1: Payment Approvals Queue */}
        {activeTab === "APPROVALS" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Student Fee Submissions & Approval Queue</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verify Vercel Blob uploaded receipts, inspect transaction IDs, and activate commuter passes.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search name, roll no, UTR..."
                    className="text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs font-bold px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none"
                >
                  <option value="ALL">All Statuses ({submissions.length})</option>
                  <option value="PENDING_APPROVAL">Pending Review ({pendingCount})</option>
                  <option value="APPROVED">Approved ({approvedCount})</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>

            {/* List Table / Cards */}
            {isLoadingSubmissions ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <BusLoadingScreen
                  compact={true}
                  fullScreen={false}
                  message="Loading student payment queue from database..."
                  subtitle="Synchronizing Realtime Audit Manifests"
                />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-mono space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <div>No payment submissions found matching your filters.</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredSubmissions.map((sub) => {
                  const isPending = sub.status === "PENDING_APPROVAL";
                  const isApproved = sub.status === "APPROVED";
                  const isRejected = sub.status === "REJECTED";

                  return (
                    <div
                      key={sub.id}
                      className={`p-4 sm:p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        isPending
                          ? "bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/70 dark:border-amber-800/40 my-2"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        {/* Receipt Thumbnail */}
                        {sub.receipt_url ? (
                          <div
                            onClick={() => setPreviewImageUrl(sub.receipt_url)}
                            className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex-shrink-0 cursor-pointer relative group"
                          >
                            <img
                              src={sub.receipt_url}
                              alt="Receipt"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <CreditCard className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900 dark:text-white">
                              {sub.student?.full_name || "Student Commuter"}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold">
                              {sub.zone_code || "ZONE_B"}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Installment #{sub.installment_number || 1}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isPending
                                  ? "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
                                  : isApproved
                                  ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                                  : "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200"
                              }`}
                            >
                              {sub.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                            <span>Roll: <strong className="text-slate-700 dark:text-slate-300">{sub.student?.enrollment_no || "Pending"}</strong></span>
                            <span>•</span>
                            <span>Amount: <strong className="text-emerald-600 dark:text-emerald-400 font-black">₹{Number(sub.amount_paid).toLocaleString("en-IN")}</strong></span>
                            <span>•</span>
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
                              UTR: {sub.transaction_id || "NOT_DETECTED"}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Submitted: {new Date(sub.created_at).toLocaleString()}
                            {sub.reviewed_by && ` • Reviewed by ${sub.reviewed_by}`}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-end lg:self-center flex-shrink-0">
                        {sub.receipt_url && (
                          <button
                            onClick={() => setPreviewImageUrl(sub.receipt_url)}
                            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 text-slate-700 dark:text-slate-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>
                        )}

                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleApprovePayment(sub)}
                              disabled={actionLoadingId === sub.id}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{actionLoadingId === sub.id ? "Approving..." : "Approve & Unlock"}</span>
                            </button>

                            <button
                              onClick={() => setRejectModalId(sub.id)}
                              disabled={actionLoadingId === sub.id}
                              className="px-3 py-2 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        ) : isApproved ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> Pass Active
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <X className="w-4 h-4" /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Payment QR & UPI Settings Manager */}
        {activeTab === "QR_SETTINGS" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* Form */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>University Payment QR & UPI VPA Configuration</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update the official receiving account details and QR code displayed to all students during fee payments.
                </p>
              </div>

              <form onSubmit={handleSaveQrConfig} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Official Receiving UPI ID / VPA *
                  </label>
                  <input
                    type="text"
                    required
                    value={qrConfig.upi_id}
                    onChange={(e) => setQrConfig({ ...qrConfig, upi_id: e.target.value })}
                    placeholder="e.g. gehubhimtal.transit@upi"
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:border-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    All dynamic student payment links will point to this VPA.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Merchant / Beneficiary Name
                    </label>
                    <input
                      type="text"
                      value={qrConfig.merchant_name}
                      onChange={(e) => setQrConfig({ ...qrConfig, merchant_name: e.target.value })}
                      placeholder="e.g. GEHU Bhimtal Transport"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank Name & Branch
                    </label>
                    <input
                      type="text"
                      value={qrConfig.bank_name}
                      onChange={(e) => setQrConfig({ ...qrConfig, bank_name: e.target.value })}
                      placeholder="e.g. HDFC Bank, Haldwani"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Bank Account Number (Optional Fallback)
                    </label>
                    <input
                      type="text"
                      value={qrConfig.account_number}
                      onChange={(e) => setQrConfig({ ...qrConfig, account_number: e.target.value })}
                      placeholder="e.g. 50200012345678"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      IFSC Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={qrConfig.ifsc_code}
                      onChange={(e) => setQrConfig({ ...qrConfig, ifsc_code: e.target.value })}
                      placeholder="e.g. HDFC0001234"
                      className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono uppercase outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Student Payment Instructions Note
                  </label>
                  <textarea
                    rows={2}
                    value={qrConfig.instructions}
                    onChange={(e) => setQrConfig({ ...qrConfig, instructions: e.target.value })}
                    placeholder="Instructions displayed to students below the QR code..."
                    className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                {/* Upload Official Bank / Standee QR Image */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">Custom Physical Bank QR Image</div>
                      <div className="text-[11px] text-slate-400">
                        Upload your university bank counter standee QR code image (saved to Vercel Blob).
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={qrFileInputRef}
                      onChange={handleUploadQrImage}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrFileInputRef.current?.click()}
                      disabled={isUploadingQrImage}
                      className="px-3.5 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 rounded-xl font-bold text-xs flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingQrImage ? "Uploading..." : "Upload QR Image"}</span>
                    </button>
                  </div>
                  {qrConfig.qr_image_url && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate">
                      ✓ Active CDN QR: {qrConfig.qr_image_url}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingQr}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isSavingQr ? "Saving to Database..." : "Save & Publish Payment Settings"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Live Student Preview Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Student Screen Live Preview</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Exact preview of the payment QR presented to students.
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <div className="text-xs font-black text-slate-900 dark:text-white">{qrConfig.merchant_name}</div>
                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">{qrConfig.upi_id}</div>

                {qrConfig.qr_image_url ? (
                  <div className="w-44 h-44 mx-auto rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 p-2 bg-white shadow-inner flex items-center justify-center">
                    <img
                      src={qrConfig.qr_image_url}
                      alt="Uploaded QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-44 h-44 mx-auto rounded-2xl border-2 border-slate-200 dark:border-slate-800 p-3 bg-white shadow-inner flex items-center justify-center">
                    <QRCodeSVG
                      value={`upi://pay?pa=${qrConfig.upi_id}&pn=${encodeURIComponent(qrConfig.merchant_name)}&cu=INR`}
                      size={150}
                      level="H"
                    />
                  </div>
                )}

                <div className="text-[10px] text-slate-500 dark:text-slate-400 px-2 leading-relaxed">
                  {qrConfig.instructions}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Financial Audit Report & Excel Export */}
        {activeTab === "AUDIT_EXCEL" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Institutional Payment Audit & Excel Export</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full immutable ledger of student fees, bank UTRs, and reviewer approval records.
                </p>
              </div>

              {/* Big Export to Excel Button */}
              <button
                onClick={handleExportToExcel}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Audit to Excel (.xlsx)</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search audit records by name, roll no, transaction UTR..."
                className="w-full text-xs pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none font-mono"
              />
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Student</th>
                    <th className="p-3.5">Roll No</th>
                    <th className="p-3.5">Zone</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Inst.</th>
                    <th className="p-3.5">Transaction ID / UTR</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Reviewer</th>
                    <th className="p-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-mono">
                        No financial audit rows found.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {sub.student?.full_name || "Student"}
                        </td>
                        <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {sub.student?.enrollment_no || "Pending"}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                            {sub.zone_code || "ZONE_B"}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(sub.amount_paid).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3.5 font-mono">#{sub.installment_number || 1}</td>
                        <td className="p-3.5 font-mono text-slate-800 dark:text-slate-200">
                          {sub.transaction_id || "-"}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              sub.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                                : sub.status === "PENDING_APPROVAL"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                          {sub.reviewed_by || "-"}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-400">
                          {new Date(sub.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Route Commuter Demand & Bus Fleet Allocation */}
        {activeTab === "DEMAND_FLEET" && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>Route Commuter Demand & Algorithmic Bus Fleet Allocation</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculated fleet sizing using active commuter volume, corridor stops, and 10% peak surge buffer.
                  </p>
                </div>
                <button
                  onClick={fetchRouteAnalytics}
                  className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? "animate-spin" : ""}`} />
                  <span>Refresh Demand Data</span>
                </button>
              </div>
            </div>

            {isLoadingAnalytics ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                <span>Analyzing commuter load and route models...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {routeAnalytics.map((item) => {
                  const isUnderAllocated = item.fleetStatus === "UNDER_ALLOCATED";
                  const isOverAllocated = item.fleetStatus === "OVER_ALLOCATED";

                  return (
                    <div
                      key={item.routeId}
                      className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-md space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {item.routeCode} • {item.direction === "HOME_TO_CAMPUS" ? "Morning Inbound" : "Evening Return"}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isUnderAllocated
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300"
                              : isOverAllocated
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300"
                          }`}
                        >
                          {item.fleetStatus}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-black text-base text-slate-900 dark:text-white">{item.routeName}</h4>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          Distance: {item.totalDistanceKm} km • Corridor Capacity: {item.avgBusCapacity} seats/bus
                        </div>
                      </div>

                      {/* Demand vs Allocation Comparison Box */}
                      <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Total Demand</div>
                          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                            {item.totalCommuterDemand}
                          </div>
                          <div className="text-[9px] text-slate-400">{item.paidStudents} Paid</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">
                            Recommended
                          </div>
                          <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                            {item.recommendedBuses} Buses
                          </div>
                          <div className="text-[9px] text-slate-400">+10% buffer</div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400">Currently Active</div>
                          <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                            {item.assignedBusesCount} Buses
                          </div>
                          <div className="text-[9px] text-slate-400">{item.utilizationRate}% Utilized</div>
                        </div>
                      </div>

                      {/* Corridor Stops Breakdown */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Passenger Volume by Stop:</span>
                          <span className="font-mono text-[10px] text-slate-400">{item.stops.length} Stops</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs">
                          {item.stops.map((st: any) => (
                            <div
                              key={st.stopId}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-[11px]"
                            >
                              <span className="truncate max-w-[200px] text-slate-800 dark:text-slate-200">
                                {st.stopName}
                              </span>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-blue-600 dark:text-blue-400 font-bold">
                                  {st.registeredCount} Students
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4.5: Corridor Stop Flowchart & Dynamic Bus Dispatch */}
        {activeTab === "ROUTE_FLOWCHART" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header & Route Selector */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span>Corridor Flowchart & Stop-by-Stop Bus Dispatch</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Visual flow chart of transit stops. Click the <strong>+</strong> button at any stop to deploy an operational bus starting from that exact origin point.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Active Corridor:</span>
                  <select
                    value={flowchartRouteId || (routes[0]?.id ?? "")}
                    onChange={(e) => setFlowchartRouteId(e.target.value)}
                    className="text-xs font-black px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500 max-w-[280px]"
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} • {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Corridor Overview Banner */}
              {selectedFlowchartRoute && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200/60 dark:border-blue-900/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Corridor Route</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate">{selectedFlowchartRoute.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Code: {selectedFlowchartRoute.code}</div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sequential Stops</div>
                    <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{flowchartStops.length} Corridor Stations</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Direction: {selectedFlowchartRoute.direction || "CAMPUS"}</div>
                  </div>

                  <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Buses Deployed Here</div>
                    <div className="text-sm font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {trips.filter((t) => t.routeId === selectedFlowchartRoute.id).length} Active Buses
                    </div>
                    <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Assigned along this corridor</div>
                  </div>

                  <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-200/60 dark:border-purple-900/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Enrolled Commuters</div>
                    <div className="text-sm font-black text-purple-700 dark:text-purple-300 mt-0.5">
                      {students.filter((st) => st.primaryRouteId === selectedFlowchartRoute.id).length} Students
                    </div>
                    <div className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-0.5">Registered on this corridor</div>
                  </div>
                </div>
              )}

              {/* Search filter */}
              <div className="relative pt-1">
                <Search className="w-4 h-4 absolute left-3.5 top-[18px] text-slate-400" />
                <input
                  type="text"
                  value={flowchartSearchQuery}
                  onChange={(e) => setFlowchartSearchQuery(e.target.value)}
                  placeholder="Search stop name, station code, or landmark along this corridor..."
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 font-bold"
                />
              </div>
            </div>

            {/* Visual Flowchart Display */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-md">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <RouteIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-black text-slate-900 dark:text-white">Corridor Stop Flowchart</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                    {flowchartStops.length} Stops
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                  <span>Origin to Terminus Flow</span>
                </div>
              </div>

              {flowchartStops.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No stops found for this corridor or matching your search.
                </div>
              ) : (
                <div className="mt-6 space-y-0 relative">
                  {/* Flowchart items */}
                  {flowchartStops.map((st, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === flowchartStops.length - 1;
                    const stopBusCount = st.assignedTrips.length;

                    // Calculate time badge (based on 07:20 AM baseline + arrivalOffset)
                    const totalMins = 7 * 60 + 20 + st.arrivalOffset;
                    const hrs = Math.floor(totalMins / 60) % 24;
                    const mins = totalMins % 60;
                    const ampm = hrs >= 12 ? "PM" : "AM";
                    const displayHours = hrs % 12 || 12;
                    const formattedTime = `${String(displayHours).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${ampm}`;

                    return (
                      <div key={st.stopId} className="relative group">
                        {/* Connecting Line to next stop */}
                        {!isLast && (
                          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500 -mb-2 z-0">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-xs">
                              <ArrowDown className="w-2.5 h-2.5 text-indigo-500" />
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-4 pb-8 z-10 relative">
                          {/* Node Icon on the vertical flowline */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-md shrink-0 transition-transform group-hover:scale-105 ${
                                isFirst
                                  ? "bg-gradient-to-tr from-blue-600 to-cyan-500 text-white ring-4 ring-blue-100 dark:ring-blue-950"
                                  : isLast
                                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-950"
                                  : "bg-gradient-to-tr from-indigo-600 to-blue-600 text-white ring-4 ring-slate-100 dark:ring-slate-800"
                              }`}
                            >
                              {isFirst ? (
                                <Navigation className="w-5 h-5" />
                              ) : isLast ? (
                                <Building2 className="w-5 h-5" />
                              ) : (
                                <span>#{st.sequence}</span>
                              )}
                            </div>
                            <span
                              className={`text-[9px] font-black uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded ${
                                isFirst
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  : isLast
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "text-slate-400"
                              }`}
                            >
                              {isFirst ? "Origin" : isLast ? "Terminus" : `Stop ${st.sequence}`}
                            </span>
                          </div>

                          {/* Stop Card & Assign Button Container */}
                          <div className="flex-1 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm transition-all">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              {/* Stop Details */}
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                                    {st.name}
                                  </h4>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                    {st.code}
                                  </span>
                                  {isFirst && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                      Primary Route Origin
                                    </span>
                                  )}
                                  {isLast && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                      Campus Final Drop-off
                                    </span>
                                  )}
                                </div>

                                {st.landmark && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>{st.landmark}</span>
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-bold bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                                    <span>{formattedTime} (+{st.arrivalOffset}m)</span>
                                  </span>

                                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-bold bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <Users className="w-3.5 h-3.5 text-purple-500" />
                                    <span>{st.enrolledCount} Registered Commuters</span>
                                  </span>

                                  {stopBusCount > 0 && (
                                    <span className="inline-flex items-center gap-1 font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                      <BusFront className="w-3.5 h-3.5" />
                                      <span>{stopBusCount} {stopBusCount === 1 ? "Bus" : "Buses"} Assigned Here</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* The "+" Button to Add/Assign Bus from this starting point */}
                              <div className="shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenAssignModal({
                                      stopId: st.stopId,
                                      stopName: st.name,
                                      stopCode: st.code,
                                      stopSequence: st.sequence,
                                      arrivalOffset: st.arrivalOffset,
                                    })
                                  }
                                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all transform active:scale-95 group/btn"
                                >
                                  <div className="w-5 h-5 rounded-lg bg-white/20 flex items-center justify-center font-black">
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                  <span>Assign Bus Here</span>
                                </button>
                              </div>
                            </div>

                            {/* Assigned Buses Display along this stop */}
                            {stopBusCount > 0 ? (
                              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                  <BusFront className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Operational Buses Originating / At this Station:</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {st.assignedTrips.map((trip) => {
                                    const busObj = buses.find((b) => b.id === trip.busId);
                                    const driverName = trip.driverId
                                      ? staff.find((s) => s.id === trip.driverId)?.fullName ||
                                        users.find((u) => u.id === trip.driverId)?.fullName ||
                                        "Assigned Driver"
                                      : "No Driver Assigned";
                                    const conductorName = trip.conductorId
                                      ? staff.find((s) => s.id === trip.conductorId)?.fullName ||
                                        users.find((u) => u.id === trip.conductorId)?.fullName ||
                                        "Assigned Conductor"
                                      : "No Conductor Assigned";

                                    return (
                                      <div
                                        key={trip.id}
                                        className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between gap-3 group/chip"
                                      >
                                        <div className="space-y-0.5 truncate">
                                          <div className="flex items-center gap-1.5">
                                            <BusFront className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                              {busObj?.busNumber || "Bus Fleet"}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                            {busObj?.registrationNo || "Reg Plate"} • {busObj?.capacity || 40} Seats
                                          </div>
                                          <div className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                                            👤 {driverName} | 🎫 {conductorName}
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          title="Unassign bus from this stop"
                                          onClick={() =>
                                            handleUnassignTrip(trip.id, busObj?.busNumber || "Bus")
                                          }
                                          className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 transition-all shrink-0"
                                        >
                                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 italic">
                                No bus starting from this point yet. Click <strong>+ Assign Bus Here</strong> to deploy a vehicle from this station.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Bus Merge Suggestions & Optimizer */}
        {activeTab === "MERGE_OPTIMIZER" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Dynamic Bus Merge Optimizer & Consolidation</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Identifies under-capacity buses converging at Bus Merge Points to consolidate passengers, reducing fuel burn and carbon emissions.
                </p>
              </div>
              <button
                onClick={fetchMergeSuggestions}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMerges ? "animate-spin" : ""}`} />
                <span>Check Real-Time Merges</span>
              </button>
            </div>

            {isLoadingMerges ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                <span>Checking active trip telemetry at merge points...</span>
              </div>
            ) : mergeSuggestions.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 font-mono space-y-2">
                <Zap className="w-8 h-8 mx-auto text-emerald-500" />
                <div>All active routes are currently operating at optimal capacity. No merge actions required.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mergeSuggestions.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-purple-200 dark:border-purple-800/60 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-black">
                        Merge Point: {sug.mergePointName || "Tikonia Chauraha"}
                      </span>
                      <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">
                        {sug.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400">Source Vehicle</div>
                        <div className="font-black text-slate-900 dark:text-white mt-0.5">{sug.sourceBusName}</div>
                        <div className="text-slate-500 text-[11px] mt-1 font-mono">
                          Occupancy: <strong className="text-amber-600">{sug.sourceOccupancy} passengers</strong>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400">Receiving Vehicle</div>
                        <div className="font-black text-slate-900 dark:text-white mt-0.5">{sug.targetBusName}</div>
                        <div className="text-slate-500 text-[11px] mt-1 font-mono">
                          Seats Available: <strong className="text-emerald-600">{sug.remainingSeats} remaining</strong>
                        </div>
                      </div>
                    </div>

                    {/* Savings Callout */}
                    <div className="p-3 rounded-2xl bg-purple-100/70 dark:bg-purple-950/40 text-xs text-purple-900 dark:text-purple-200 flex items-center justify-between font-mono">
                      <span>Combined: {sug.combinedOccupancy} / {sug.targetCapacity} seats</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        ⚡ Save ~7.5L Diesel
                      </span>
                    </div>

                    {sug.status === "PENDING" && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/merges", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                suggestionId: sug.id,
                                action: "APPROVE",
                                reviewedBy: currentUser?.fullName || "Transport Staff",
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              showToast("✓ Bus merge approved! Passengers consolidated to single vehicle.");
                              fetchMergeSuggestions();
                            }
                          } catch (err: any) {
                            alert("Merge error: " + err.message);
                          }
                        }}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-colors"
                      >
                        Approve Bus Merge & Consolidate Fleet
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: Daily Fleet Operations & Day Rollover */}
        {activeTab === "DAILY_OPERATIONS" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Operational Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-80 h-full bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-mono font-bold text-blue-300 mb-2">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Operational Transit Date: {rolloverStatus?.targetDate || selectedHistoryDate}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black">
                    Daily Transit Lifecycle & Automated Day Rollover
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl mt-1">
                    Historical records (trips, bookings, QR verification scans, audit trails) are preserved permanently in PostgreSQL.
                    Each operational day starts fresh with 0 seat occupancy and clean conductor manifests.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleExecuteRollover(rolloverStatus?.targetDate || selectedHistoryDate, true)}
                    disabled={isRolloverLoading}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RotateCcw className={`w-4 h-4 ${isRolloverLoading ? "animate-spin" : ""}`} />
                    <span>{isRolloverLoading ? "Executing Rollover..." : "Execute Today Rollover"}</span>
                  </button>

                  <button
                    onClick={() => {
                      const now = new Date();
                      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000);
                      const tomorrowStr = tomorrow.toISOString().split("T")[0];
                      handleExecuteRollover(tomorrowStr, true);
                    }}
                    disabled={isRolloverLoading}
                    className="px-4 py-2.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-black text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Clock className="w-4 h-4" />
                    <span>Pre-Schedule Tomorrow</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Operational Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
                  Today's Active Trips
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {trips.filter((t) => t.tripDate === (rolloverStatus?.targetDate || selectedHistoryDate)).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Morning & Evening Shifts</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                  Today's Bookings
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {bookings.filter((b) => b.bookingDate === (rolloverStatus?.targetDate || selectedHistoryDate)).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Active Reservations</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-purple-600 dark:text-purple-400">
                  Total Historical Trips
                </div>
                <div className="text-2xl font-black font-mono mt-1">{trips.length}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Retained in PostgreSQL</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                  Fleet Readiness
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {buses.filter((b) => b.status === "ACTIVE").length} / {buses.length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Buses In Service</div>
              </div>
            </div>

            {/* Trips List Filtered by Date */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span>Operational Trips for Date:</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Filter by date to view historical runs, conductor assignments, and live statuses.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedHistoryDate}
                    onChange={(e) => setSelectedHistoryDate(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold outline-none"
                  />
                  <button
                    onClick={() => {
                      const now = new Date();
                      const istOffset = 5.5 * 60 * 60 * 1000;
                      setSelectedHistoryDate(new Date(now.getTime() + istOffset).toISOString().split("T")[0]);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Trips Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-black text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Trip Code</th>
                      <th className="p-3">Route</th>
                      <th className="p-3">Bus Number</th>
                      <th className="p-3">Shift</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Manifest</th>
                      <th className="p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {trips.filter((t) => !selectedHistoryDate || t.tripDate === selectedHistoryDate).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No trips scheduled for {selectedHistoryDate}. Click "Execute Today Rollover" to generate runs for this date.
                        </td>
                      </tr>
                    ) : (
                      trips
                        .filter((t) => !selectedHistoryDate || t.tripDate === selectedHistoryDate)
                        .map((t) => {
                          const r = routes.find((route) => route.id === t.routeId);
                          const b = buses.find((bus) => bus.id === t.busId);
                          const isCompleted = t.status === "COMPLETED";
                          const isInTransit = t.status === "IN_PROGRESS";

                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                {t.tripCode}
                              </td>
                              <td className="p-3 font-bold text-slate-900 dark:text-white">
                                {r?.name || t.routeId}
                              </td>
                              <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                                {b?.busNumber || t.busId}
                              </td>
                              <td className="p-3 font-mono">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold">
                                  {t.shiftId}
                                </span>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isCompleted
                                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                      : isInTransit
                                      ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 animate-pulse"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[11px]">
                                {t.manifestLocked ? "Locked 🔒" : "Open for Booking"}
                              </td>
                              <td className="p-3 font-mono text-slate-500">{t.tripDate}</td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Architecture Policy Card */}
            <div className="bg-blue-50/60 dark:bg-blue-950/30 rounded-3xl p-5 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 space-y-2">
              <div className="font-black text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span>Enterprise Transit Lifecycle Guarantee</span>
              </div>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                • <strong>Immutability:</strong> Old trips and passenger attendance records are never deleted from PostgreSQL, preserving full compliance and safety history.<br />
                • <strong>Fresh Morning Starts:</strong> Each day's trips are independent instances generated from route schedules. Student seat selection on <code className="px-1 rounded bg-blue-200/50 dark:bg-blue-900/50">/portal/booking</code> connects only to today's active trip, ensuring 100% seat availability.<br />
                • <strong>Self-Healing:</strong> If no external cron runner is active, the application automatically initiates today's operational runs on the first request of the day.
              </p>
            </div>
          </div>
        )}

        {/* TAB 7: Crew & Bus Allocation */}
        {activeTab === "CREW_ASSIGNMENT" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-xs font-mono font-bold text-blue-300 mb-2">
                    <Award className="w-3.5 h-3.5" />
                    <span>Crew Qualification Dispatch Matrix</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black">
                    Bus Crew Allocation & Role Qualifications
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl mt-1">
                    Staff dispatch authority: Assign certified drivers and conductors to campus transit buses.
                    <span className="block mt-1 font-bold text-amber-300">
                      • Driver Slot: Strictly qualified drivers only (conductors cannot drive).
                      • Conductor Slot: Both conductors and certified drivers can serve as conductors.
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-800/80 p-2 rounded-2xl border border-slate-700">
                    <CalendarDays className="w-4 h-4 text-blue-400" />
                    <input
                      type="date"
                      value={crewDate}
                      onChange={(e) => setCrewDate(e.target.value)}
                      className="text-xs px-2 py-1 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Crew Status Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-blue-600 dark:text-blue-400">
                  Scheduled Buses
                </div>
                <div className="text-2xl font-black font-mono mt-1">
                  {trips.filter((t) => !crewDate || t.tripDate === crewDate).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Active Fleet Runs</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400">
                  Fully Crewed
                </div>
                <div className="text-2xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                  {trips.filter((t) => (!crewDate || t.tripDate === crewDate) && t.driverId && t.conductorId).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Driver + Conductor Ready</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-rose-600 dark:text-rose-400">
                  Missing Driver
                </div>
                <div className="text-2xl font-black font-mono mt-1 text-rose-600 dark:text-rose-400">
                  {trips.filter((t) => (!crewDate || t.tripDate === crewDate) && !t.driverId).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Immediate Attention</div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
                  Missing Conductor
                </div>
                <div className="text-2xl font-black font-mono mt-1 text-amber-600 dark:text-amber-400">
                  {trips.filter((t) => (!crewDate || t.tripDate === crewDate) && !t.conductorId).length}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ticket Radar Officer</div>
              </div>
            </div>

            {/* Crew Allocation Roster Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <BusFront className="w-4 h-4 text-blue-600" />
                    <span>Fleet Crew Dispatch Table</span>
                  </h3>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={crewSearchQuery}
                    onChange={(e) => setCrewSearchQuery(e.target.value)}
                    placeholder="Search by bus, route, or trip code..."
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 font-bold"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-black text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Bus & Trip</th>
                      <th className="p-3.5">Corridor Route</th>
                      <th className="p-3.5">Assigned Driver</th>
                      <th className="p-3.5">Assigned Conductor</th>
                      <th className="p-3.5 text-center">Crew Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {trips
                      .filter((t) => !crewDate || t.tripDate === crewDate)
                      .filter((t) => {
                        if (!crewSearchQuery.trim()) return true;
                        const q = crewSearchQuery.toLowerCase();
                        const b = buses.find((bus) => bus.id === t.busId);
                        const r = routes.find((route) => route.id === t.routeId);
                        return (
                          t.tripCode.toLowerCase().includes(q) ||
                          (b?.busNumber && b.busNumber.toLowerCase().includes(q)) ||
                          (r?.name && r.name.toLowerCase().includes(q))
                        );
                      })
                      .map((t) => {
                        const b = buses.find((bus) => bus.id === t.busId);
                        const r = routes.find((route) => route.id === t.routeId);
                        const drv =
                          staff.find((s) => s.id === t.driverId || s.fullName === t.driverId) ||
                          users.find((u) => u.id === t.driverId || u.email === t.driverId);
                        const cnd =
                          staff.find((s) => s.id === t.conductorId || s.fullName === t.conductorId) ||
                          users.find((u) => u.id === t.conductorId || u.email === t.conductorId);

                        const isDrvConductor = drv && drv.role === "driver";
                        const isCndActing = cnd && cnd.role === "driver";
                        const isFullyCrewed = Boolean(t.driverId && t.conductorId);

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="p-3.5">
                              <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                <BusFront className="w-4 h-4 text-blue-600" />
                                <span>{b?.busNumber || t.busId}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>{t.tripCode}</span>
                                <span>•</span>
                                <span>{t.shiftId}</span>
                              </div>
                            </td>

                            <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                              <div>{r?.name || t.routeId}</div>
                              <div className="text-[10px] text-slate-400 font-mono font-normal">
                                {r?.totalDistanceKm || 28} km • {r?.estimatedDurationMins || 55} mins
                              </div>
                            </td>

                            <td className="p-3.5">
                              {t.driverId ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>{drv?.fullName || t.driverId}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {drv?.phone || "Phone on file"} • Commercial Lic
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-black border border-rose-200 dark:border-rose-900">
                                  <BadgeAlert className="w-3 h-3" /> Unassigned Driver
                                </span>
                              )}
                            </td>

                            <td className="p-3.5">
                              {t.conductorId ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                    <span>{cnd?.fullName || t.conductorId}</span>
                                    {isCndActing && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                        Driver Acting
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {cnd?.phone || "Phone on file"} • Scanner Authorized
                                  </div>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-200 dark:border-amber-900">
                                  <BadgeAlert className="w-3 h-3" /> Unassigned Conductor
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 text-center">
                              {isFullyCrewed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Complete
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                                  <Clock className="w-3 h-3 text-amber-600" /> Incomplete
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => openCrewModal(t)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Assign Crew</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Lightbox Modal for Receipt Image */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Student Payment Receipt Verification</span>
              </h4>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 flex items-center justify-center">
              <img src={previewImageUrl} alt="Full Receipt" className="max-h-full max-w-full object-contain rounded-xl" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open high-res image in new tab</span>
              </a>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white">
            <h4 className="font-bold text-base text-rose-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>Reject Payment Submission</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide a clear reason for rejecting this payment. The student will be notified and asked to re-upload.
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Transaction UTR does not match university bank statement, amount is incorrect..."
              className="w-full text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none focus:border-rose-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRejectModalId(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crew Assignment Modal with Strict Role Validation */}
      {crewModalOpen && selectedTripForCrew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-5 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <BusFront className="w-5 h-5 text-blue-600" />
                  <span>
                    Assign Crew for Bus {buses.find((b) => b.id === selectedTripForCrew.busId)?.busNumber || selectedTripForCrew.busId}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Trip: {selectedTripForCrew.tripCode} • {routes.find((r) => r.id === selectedTripForCrew.routeId)?.name || selectedTripForCrew.routeId}
                </p>
              </div>

              <button
                onClick={() => setCrewModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {crewAssignError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{crewAssignError}</span>
              </div>
            )}

            {/* Section 1: DRIVER ASSIGNMENT */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>Assign Certified Driver *</span>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  Commercial Heavy Vehicle License Required
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Rule: Conductors cannot drive the bus. Only certified drivers are shown.
              </p>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={driverSearchQuery}
                  onChange={(e) => setDriverSearchQuery(e.target.value)}
                  placeholder="Filter drivers by name or phone..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
              >
                <option value="">-- Choose Qualified Driver --</option>
                {eligibleDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone}) • {d.license || "Licensed Driver"}
                  </option>
                ))}
              </select>
            </div>

            {/* Section 2: CONDUCTOR ASSIGNMENT */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span>Assign Conductor / Manifest Officer *</span>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                  Conductors & Drivers Eligible
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Rule: A driver can serve as a conductor, and a conductor can serve as a conductor.
              </p>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={conductorSearchQuery}
                  onChange={(e) => setConductorSearchQuery(e.target.value)}
                  placeholder="Filter conductors or drivers by name or phone..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:border-purple-500 font-bold"
                />
              </div>

              <select
                value={selectedConductorId}
                onChange={(e) => setSelectedConductorId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:border-purple-500"
              >
                <option value="">-- Choose Conductor or Acting Driver --</option>
                {eligibleConductors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) {c.isActingDriver ? "• [Driver - Eligible as Conductor]" : "• [Conductor]"}
                  </option>
                ))}
              </select>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCrewModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCrewAssignment}
                disabled={isAssigningCrew}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isAssigningCrew ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Crew Assignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Origin Assign Bus Modal */}
      {isAssignBusModalOpen && assignTargetStop && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full space-y-4">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <BusFront className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Deploy Bus Starting at Stop #{assignTargetStop.stopSequence}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Origin Station: <strong>{assignTargetStop.stopName}</strong> ({assignTargetStop.stopCode}) • Route: <strong>{selectedFlowchartRoute?.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignBusModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignFlowchartError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{assignFlowchartError}</span>
              </div>
            )}

            {/* Modal Form */}
            <div className="space-y-4 pt-1">
              {/* Bus Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Select Vehicle from Fleet *
                </label>
                <select
                  value={assignBusFormData.busId}
                  onChange={(e) =>
                    setAssignBusFormData((prev) => ({ ...prev, busId: e.target.value }))
                  }
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Bus Fleet --</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.busNumber} • {b.capacity} Seats ({b.registrationNo}) [{b.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Service Departure Time */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Scheduled Service Departure Time from {assignTargetStop.stopName}
                </label>
                <input
                  type="time"
                  value={assignBusFormData.departureTime}
                  onChange={(e) =>
                    setAssignBusFormData((prev) => ({ ...prev, departureTime: e.target.value }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                />
              </div>

              {/* Driver Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Assign Driver (Optional)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                    HMV Licensed
                  </span>
                </div>
                <select
                  value={assignBusFormData.driverId}
                  onChange={(e) =>
                    setAssignBusFormData((prev) => ({ ...prev, driverId: e.target.value }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Driver (Can assign later) --</option>
                  {eligibleDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Conductor Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                    Assign Conductor (Optional)
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                    Conductors & Drivers Eligible
                  </span>
                </div>
                <select
                  value={assignBusFormData.conductorId}
                  onChange={(e) =>
                    setAssignBusFormData((prev) => ({ ...prev, conductorId: e.target.value }))
                  }
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Conductor (Can assign later) --</option>
                  {eligibleConductors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) {c.isActingDriver ? "• [Driver]" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsAssignBusModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBusAssignmentToStop}
                disabled={isAssigningFlowchartBus || !assignBusFormData.busId}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isAssigningFlowchartBus ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deploying Bus...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Bus Assignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
