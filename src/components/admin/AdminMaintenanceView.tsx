"use client";

import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Wrench,
  Plus,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Camera,
  FileText,
  X,
  ExternalLink,
  Loader2,
  IndianRupee,
  Eye,
  Trash2,
  UploadCloud,
  Check,
  Filter,
  ArrowUpDown,
  Ban,
  Receipt,
  Sparkles,
} from "lucide-react";
import type { MaintenanceRequest, Bus, MaintenanceRequestStatus } from "@/lib/types";

export interface AdminMaintenanceProps {
  initialRequests?: MaintenanceRequest[];
  initialBuses?: Bus[];
}

export default function AdminMaintenanceView({
  initialRequests = [],
  initialBuses = [],
}: AdminMaintenanceProps) {
  // State
  const [requests, setRequests] = useState<MaintenanceRequest[]>(initialRequests);
  const [buses] = useState<Bus[]>(initialBuses);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedBusFilter, setSelectedBusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [completionRequest, setCompletionRequest] = useState<MaintenanceRequest | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // New Entry Form State
  const [newVehicleNo, setNewVehicleNo] = useState("");
  const [newBusId, setNewBusId] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newRate, setNewRate] = useState<number>(0);
  const [newDefectDesc, setNewDefectDesc] = useState("");
  const [newRemarks, setNewRemarks] = useState("");
  const [newDefectImages, setNewDefectImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completion Form State
  const [completeWorkDesc, setCompleteWorkDesc] = useState("");
  const [completeWorkImages, setCompleteWorkImages] = useState<string[]>([]);
  const [completeReceiptUrl, setCompleteReceiptUrl] = useState<string>("");
  const [completeTxnId, setCompleteTxnId] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Refresh requests from server API
  const refreshRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/maintenance/requests");
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error("Failed to refresh maintenance requests:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        searchTerm === "" ||
        req.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.defectDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.serialNo.toString().includes(searchTerm) ||
        req.requestedByName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;
      const matchesBus = selectedBusFilter === "ALL" || req.vehicleNo === selectedBusFilter;

      return matchesSearch && matchesStatus && matchesBus;
    });
  }, [requests, searchTerm, statusFilter, selectedBusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = requests.length;
    const open = requests.filter((r) => r.status === "OPEN").length;
    const inProgress = requests.filter((r) => r.status === "IN_PROGRESS").length;
    const completed = requests.filter((r) => r.status === "COMPLETED").length;
    const totalSpend = requests
      .filter((r) => r.status === "COMPLETED")
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return { total, open, inProgress, completed, totalSpend };
  }, [requests]);

  // Image Upload Handler
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (url: string) => void
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);

        const res = await fetch("/api/maintenance/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (data.success && data.url) {
          onSuccess(data.url);
        } else {
          showToast(data.message || "Failed to upload image.");
        }
      }
    } catch (err: any) {
      showToast("Network error uploading image: " + err.message);
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  // Submit New Entry
  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleNo || !newItem) {
      showToast("Please provide Vehicle No. and Item.");
      return;
    }

    setIsSubmitting(true);
    try {
      const amount = (newQuantity || 1) * (newRate || 0);
      const res = await fetch("/api/maintenance/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleNo: newVehicleNo,
          busId: newBusId || undefined,
          item: newItem,
          quantity: newQuantity,
          rate: newRate,
          amount,
          defectDescription: newDefectDesc,
          defectImageUrls: newDefectImages,
          remarks: newRemarks,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Maintenance register entry logged successfully.");
        setIsNewEntryOpen(false);
        // Reset form
        setNewVehicleNo("");
        setNewBusId("");
        setNewItem("");
        setNewQuantity(1);
        setNewRate(0);
        setNewDefectDesc("");
        setNewRemarks("");
        setNewDefectImages([]);
        await refreshRequests();
      } else {
        showToast(data.message || "Failed to create entry.");
      }
    } catch (err: any) {
      showToast("Error creating entry: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status
  const handleStatusChange = async (
    reqId: string,
    newStatus: MaintenanceRequestStatus,
    extraFields: Record<string, any> = {}
  ) => {
    try {
      const res = await fetch(`/api/maintenance/requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...extraFields,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Request updated to ${newStatus}`);
        await refreshRequests();
      } else {
        showToast(data.message || "Failed to update status.");
      }
    } catch (err: any) {
      showToast("Error updating request: " + err.message);
    }
  };

  // Submit Completion
  const handleCompleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionRequest) return;

    setIsCompleting(true);
    try {
      await handleStatusChange(completionRequest.id, "COMPLETED", {
        workDoneDescription: completeWorkDesc,
        workDoneImageUrls: completeWorkImages,
        paymentReceiptUrl: completeReceiptUrl || undefined,
        paymentTransactionId: completeTxnId || undefined,
      });
      setCompletionRequest(null);
      setCompleteWorkDesc("");
      setCompleteWorkImages([]);
      setCompleteReceiptUrl("");
      setCompleteTxnId("");
    } finally {
      setIsCompleting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      showToast("No records to export.");
      return;
    }

    const rows = filteredRequests.map((r) => ({
      "S.No": r.serialNo,
      Date: r.date,
      "Vehicle No.": r.vehicleNo,
      "Item / Spare Part": r.item,
      Qty: r.quantity,
      "Rate (₹)": r.rate,
      "Total Amount (₹)": r.amount,
      Status: r.status,
      "Defect Description": r.defectDescription,
      "Reported By": r.requestedByName,
      "Work Done": r.workDoneDescription,
      "Payment Txn": r.paymentTransactionId || "N/A",
      Remarks: r.remarks,
      "Logged At": new Date(r.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Maintenance Register");
    XLSX.writeFile(
      workbook,
      `CampusFleet_Maintenance_Register_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    showToast("Maintenance register exported to Excel.");
  };

  // Status badge styling helper
  const renderStatusBadge = (status: MaintenanceRequestStatus) => {
    switch (status) {
      case "OPEN":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 dark:bg-yellow-950/60 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="w-3.5 h-3.5" />
            OPEN
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            IN WORKSHOP
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            <Ban className="w-3.5 h-3.5" />
            CANCELLED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-gray-700 dark:border-gray-300 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-yellow-400 dark:text-yellow-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gray-900 rounded-3xl p-6 sm:p-8 text-white shadow-sm relative overflow-hidden border border-gray-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-mono font-black tracking-wider uppercase">
              <Wrench className="w-3.5 h-3.5" />
              PHYSICAL LEDGER DESK
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Fleet Maintenance & Repair Register
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl font-medium">
              Official institutional vehicle repair book. Records spare parts, labour, defect photo evidence, workshop authorization, and GST payment receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/10 transition-all hover:scale-102 active:scale-98 shadow-sm"
              title="Export filtered records to XLSX spreadsheet"
            >
              <Download className="w-4 h-4 text-green-400" />
              Export Excel (.xlsx)
            </button>
            <button
              onClick={() => setIsNewEntryOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500  text-white text-xs font-black shadow-lg shadow-blue-600/30 transition-all hover:scale-102 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              + New Register Entry
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-800/80">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Entries</div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">{stats.total}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-sm">
            <div className="text-[11px] font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Open Defects
            </div>
            <div className="text-xl sm:text-2xl font-black text-yellow-400 font-mono mt-0.5">{stats.open}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
            <div className="text-[11px] font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> In Workshop
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono mt-0.5">{stats.inProgress}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-green-500/10 border border-green-500/20 backdrop-blur-sm">
            <div className="text-[11px] font-bold text-green-300 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Total Cleared (₹)
            </div>
            <div className="text-xl sm:text-2xl font-black text-green-400 font-mono mt-0.5">
              ₹{stats.totalSpend.toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search register (Bus #, item, text)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-semibold rounded-2xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Bus Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedBusFilter}
              onChange={(e) => setSelectedBusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Vehicles</option>
              {buses.map((b) => (
                <option key={b.id} value={b.busNumber}>
                  {b.busNumber} {b.model ? `(${b.model})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tabs */}
          <div className="inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            {(["ALL", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all ${
                  statusFilter === status
                    ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {status === "ALL" ? "All" : status.replace("_", " ")}
              </button>
            ))}
          </div>

          <button
            onClick={refreshRequests}
            disabled={loading}
            className="p-2 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
            title="Refresh from server"
          >
            <Loader2 className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Physical Register Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            {/* Table Header Styled as Physical Ledger */}
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 font-black uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-700">
                <th className="p-3.5 text-center w-12 border-r border-gray-200 dark:border-gray-700/60">S.No</th>
                <th className="p-3.5 w-24 border-r border-gray-200 dark:border-gray-700/60">Date</th>
                <th className="p-3.5 w-32 border-r border-gray-200 dark:border-gray-700/60">Vehicle No.</th>
                <th className="p-3.5 min-w-[200px] border-r border-gray-200 dark:border-gray-700/60">Item / Defect Description</th>
                <th className="p-3.5 text-center w-16 border-r border-gray-200 dark:border-gray-700/60">Qty</th>
                <th className="p-3.5 text-right w-24 border-r border-gray-200 dark:border-gray-700/60">Rate (₹)</th>
                <th className="p-3.5 text-right w-28 border-r border-gray-200 dark:border-gray-700/60">Amount (₹)</th>
                <th className="p-3.5 text-center w-24 border-r border-gray-200 dark:border-gray-700/60">Defect Photos</th>
                <th className="p-3.5 text-center w-28 border-r border-gray-200 dark:border-gray-700/60">Status</th>
                <th className="p-3.5 min-w-[180px] border-r border-gray-200 dark:border-gray-700/60">Work Done & Proof</th>
                <th className="p-3.5 text-center w-24 border-r border-gray-200 dark:border-gray-700/60">Receipt</th>
                <th className="p-3.5 text-center w-36">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Wrench className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                      <div className="font-bold text-sm text-gray-600 dark:text-gray-400">No maintenance records found</div>
                      <div className="text-xs text-gray-400 max-w-sm">
                        Create a new entry using the button above or adjust your search and filters.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-gray-800/40 transition-colors group"
                  >
                    {/* S.No */}
                    <td className="p-3 text-center font-mono font-black text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                      #{req.serialNo}
                    </td>

                    {/* Date */}
                    <td className="p-3 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap border-r border-gray-200 dark:border-gray-800">
                      {req.date}
                    </td>

                    {/* Vehicle No */}
                    <td className="p-3 border-r border-gray-200 dark:border-gray-800">
                      <div className="font-black text-gray-900 dark:text-white font-mono">{req.vehicleNo}</div>
                      <div className="text-[10px] text-gray-400 truncate">By: {req.requestedByName}</div>
                    </td>

                    {/* Item & Description */}
                    <td className="p-3 border-r border-gray-200 dark:border-gray-800">
                      <div className="font-bold text-gray-900 dark:text-white">{req.item}</div>
                      {req.defectDescription && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {req.defectDescription}
                        </p>
                      )}
                      {req.remarks && (
                        <span className="inline-block text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded mt-1">
                          Remark: {req.remarks}
                        </span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="p-3 text-center font-mono font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-800">
                      {req.quantity}
                    </td>

                    {/* Rate */}
                    <td className="p-3 text-right font-mono font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                      ₹{Number(req.rate).toLocaleString("en-IN")}
                    </td>

                    {/* Amount */}
                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30">
                      ₹{Number(req.amount).toLocaleString("en-IN")}
                    </td>

                    {/* Defect Photos */}
                    <td className="p-3 text-center border-r border-gray-200 dark:border-gray-800">
                      {req.defectImageUrls && req.defectImageUrls.length > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          {req.defectImageUrls.slice(0, 2).map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setLightboxImage({ url, title: `Defect Photo ${i + 1} - ${req.vehicleNo}` })}
                              className="relative w-8 h-8 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 hover:scale-110 transition-transform shadow-sm flex-shrink-0"
                            >
                              <img src={url} alt="Defect" className="w-full h-full object-cover" />
                            </button>
                          ))}
                          {req.defectImageUrls.length > 2 && (
                            <span className="text-[10px] font-bold text-gray-500">
                              +{req.defectImageUrls.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">None</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3 text-center border-r border-gray-200 dark:border-gray-800 whitespace-nowrap">
                      {renderStatusBadge(req.status)}
                    </td>

                    {/* Work Done & Proof */}
                    <td className="p-3 border-r border-gray-200 dark:border-gray-800">
                      {req.workDoneDescription ? (
                        <div className="space-y-1">
                          <p className="text-[11px] text-gray-700 dark:text-gray-300 line-clamp-2">
                            {req.workDoneDescription}
                          </p>
                          {req.workDoneImageUrls && req.workDoneImageUrls.length > 0 && (
                            <div className="flex items-center gap-1 pt-1">
                              {req.workDoneImageUrls.map((url, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    setLightboxImage({
                                      url,
                                      title: `Work Completed Photo ${i + 1} - ${req.vehicleNo}`,
                                    })
                                  }
                                  className="w-7 h-7 rounded-md overflow-hidden border border-green-300 dark:border-green-700 hover:scale-110 transition-transform flex-shrink-0"
                                >
                                  <img src={url} alt="Work done" className="w-full h-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Pending overhaul</span>
                      )}
                    </td>

                    {/* Receipt */}
                    <td className="p-3 text-center border-r border-gray-200 dark:border-gray-800">
                      {req.paymentReceiptUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: req.paymentReceiptUrl!,
                              title: `GST Tax Receipt / Voucher - ${req.vehicleNo}`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-[10px] font-bold hover:scale-105 transition-transform"
                        >
                          <Receipt className="w-3 h-3" />
                          View
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No bill</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {req.status === "OPEN" && (
                          <button
                            onClick={() => handleStatusChange(req.id, "IN_PROGRESS")}
                            className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                            title="Approve defect and dispatch to workshop"
                          >
                            Approve
                          </button>
                        )}

                        {req.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => {
                              setCompletionRequest(req);
                              setCompleteWorkDesc(req.workDoneDescription || "");
                              setCompleteWorkImages(req.workDoneImageUrls || []);
                              setCompleteReceiptUrl(req.paymentReceiptUrl || "");
                              setCompleteTxnId(req.paymentTransactionId || "");
                            }}
                            className="px-2.5 py-1 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] transition-colors shadow-sm"
                            title="Mark complete and upload invoice / photos"
                          >
                            Complete
                          </button>
                        )}

                        {req.status !== "CANCELLED" && req.status !== "COMPLETED" && (
                          <button
                            onClick={() => handleStatusChange(req.id, "CANCELLED")}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                            title="Cancel / Reject request"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {req.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400">
                            <Check className="w-3.5 h-3.5" />
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="flex flex-col items-center justify-center gap-2">
                <Wrench className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                <div className="font-bold text-sm text-gray-600 dark:text-gray-400">No maintenance records found</div>
              </div>
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div key={req.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-gray-900 dark:text-white font-mono text-sm">{req.vehicleNo}</div>
                    <div className="text-[10px] text-gray-400">By: {req.requestedByName} • #{req.serialNo}</div>
                  </div>
                  {renderStatusBadge(req.status)}
                </div>
                
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-xs">{req.item}</div>
                  {req.defectDescription && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                      {req.defectDescription}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
                  <div className="font-mono font-black text-gray-900 dark:text-white">
                    ₹{Number(req.amount).toLocaleString("en-IN")} <span className="text-[10px] font-medium text-gray-400">(Qty: {req.quantity})</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {req.status === "OPEN" && (
                      <button
                        onClick={() => handleStatusChange(req.id, "IN_PROGRESS")}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                      >
                        Approve
                      </button>
                    )}
                    {req.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => {
                          setCompletionRequest(req);
                          setCompleteWorkDesc(req.workDoneDescription || "");
                          setCompleteWorkImages(req.workDoneImageUrls || []);
                          setCompleteReceiptUrl(req.paymentReceiptUrl || "");
                          setCompleteTxnId(req.paymentTransactionId || "");
                        }}
                        className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm"
                      >
                        Complete
                      </button>
                    )}
                    {req.status === "COMPLETED" && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                        <Check className="w-4 h-4" />
                        Archived
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* =========================================================
          MODAL 1: Create New Register Entry
      ========================================================= */}
      {isNewEntryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    Add Maintenance Register Entry
                  </h2>
                  <p className="text-xs text-gray-500">Record a new physical repair log, spare item, or defect</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewEntryOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateEntry} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Vehicle Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL-1P-9921 or Bus 12"
                    value={newVehicleNo}
                    onChange={(e) => {
                      setNewVehicleNo(e.target.value);
                      const match = buses.find(
                        (b) => b.busNumber.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (match) setNewBusId(match.id);
                    }}
                    list="bus-suggestions"
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                  <datalist id="bus-suggestions">
                    {buses.map((b) => (
                      <option key={b.id} value={b.busNumber}>
                        {b.model}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Item / Part */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Item / Spare Part / Task <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Front Brake Pad Set / Oil Filter"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Quantity, Rate, Amount */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={newRate}
                    onChange={(e) => setNewRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Calculated Amount
                  </label>
                  <div className="px-3 py-1.5 text-xs font-mono font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/40 rounded-lg border border-green-200 dark:border-green-800">
                    ₹{((newQuantity || 1) * (newRate || 0)).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* Defect Description */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Defect Details / Mechanic Findings
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the physical condition, noise, leakage, or breakdown reason..."
                  value={newDefectDesc}
                  onChange={(e) => setNewDefectDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Defect Images Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Defect Evidence Photos
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {newDefectImages.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 group">
                      <img src={url} alt="Defect" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewDefectImages(newDefectImages.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}

                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-gray-800/50 transition-colors">
                    {isUploadingImage ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-gray-400" />
                        <span className="text-[9px] font-bold text-gray-500 mt-0.5">+ Photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isUploadingImage}
                      onChange={(e) => handleFileUpload(e, (url) => setNewDefectImages((prev) => [...prev, url]))}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">JPEG, PNG or WebP up to 10MB per image.</p>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Internal Remarks / Workshop Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Authorized by Chief Engineer; warranty claim pending"
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewEntryOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploadingImage}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging Entry...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save to Register
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: Complete Work & Upload Proof / Receipt
      ========================================================= */}
      {completionRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-green-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-green-600 text-white flex items-center justify-center font-bold shadow-md shadow-green-600/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    Complete Maintenance Ticket
                  </h2>
                  <p className="text-xs text-gray-500">
                    Vehicle {completionRequest.vehicleNo} • #{completionRequest.serialNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletionRequest(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCompleteRequest} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Work Done Summary <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Detail parts replaced, tests conducted, and road test result..."
                  value={completeWorkDesc}
                  onChange={(e) => setCompleteWorkDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-white"
                />
              </div>

              {/* Work Done Photos */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Proof of Work / Replaced Parts Photos
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {completeWorkImages.map((url, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 group">
                      <img src={url} alt="Work Done" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCompleteWorkImages(completeWorkImages.filter((_, idx) => idx !== i))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}

                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-gray-800/50 transition-colors">
                    {isUploadingImage ? (
                      <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-gray-400" />
                        <span className="text-[9px] font-bold text-gray-500 mt-0.5">+ Photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isUploadingImage}
                      onChange={(e) => handleFileUpload(e, (url) => setCompleteWorkImages((prev) => [...prev, url]))}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Receipt / Invoice Upload */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-green-600" />
                  Workshop Tax Invoice / Payment Voucher
                </div>

                <div className="flex items-center gap-3">
                  {completeReceiptUrl ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-green-400 group">
                      <img src={completeReceiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCompleteReceiptUrl("")}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <label className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-green-500 flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                      {isUploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                      ) : (
                        <UploadCloud className="w-4 h-4 text-green-600" />
                      )}
                      <span>Upload Invoice Bill</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={isUploadingImage}
                        onChange={(e) => handleFileUpload(e, (url) => setCompleteReceiptUrl(url))}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Payment Transaction / Cheque ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-TXN-98412891 / CHQ-10492"
                    value={completeTxnId}
                    onChange={(e) => setCompleteTxnId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCompletionRequest(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompleting || isUploadingImage}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-xs shadow-lg shadow-green-600/30 transition-all disabled:opacity-50"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Work Completed
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: Image Lightbox
      ========================================================= */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-3xl max-h-[90vh] bg-gray-900 rounded-3xl overflow-hidden border border-gray-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gray-950 flex items-center justify-between text-white border-b border-gray-800">
              <span className="text-xs font-bold text-gray-200">{lightboxImage.title}</span>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[80vh]">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] max-w-full object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
