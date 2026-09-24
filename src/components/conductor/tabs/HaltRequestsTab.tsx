"use client";

import React, { useState, useEffect } from "react";
import { useConductorContext } from "../ConductorContext";
import { Hand, MapPin, Check, X, Navigation2, Clock } from "lucide-react";
import type { HaltRequest } from "@/lib/types";

export default function HaltRequestsTab() {
  const { activeTrip, showToast } = useConductorContext();
  const [requests, setRequests] = useState<HaltRequest[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTrip) return;
    
    let isMounted = true;
    const fetchRequests = async () => {
      try {
        const res = await fetch(`/api/dispatch/halt-requests?tripId=${activeTrip.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.requests) {
            setRequests(data.requests.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }
        }
      } catch(e) {}
    };

    fetchRequests();
    const interval = setInterval(fetchRequests, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTrip]);

  const handleAction = async (studentId: string, status: "APPROVED" | "REJECTED") => {
    if (!activeTrip) return;
    setIsLoading(studentId);
    try {
      const res = await fetch("/api/dispatch/halt-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: activeTrip.id, studentId, status })
      });
      if (res.ok) {
        showToast(status === "APPROVED" ? "Halt Request Approved" : "Halt Request Rejected");
        setRequests(prev => prev.map(r => r.studentId === studentId ? { ...r, status } : r));
      }
    } catch(e) {
      console.error(e);
      showToast("Failed to update request");
    }
    setIsLoading(null);
  };

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 animate-in fade-in">
        <Hand className="w-12 h-12 mb-4 opacity-50" />
        <p className="font-medium">No active trip selected.</p>
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
          <Hand className="w-48 h-48" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-black uppercase tracking-widest mb-3 backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${pendingCount > 0 ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
              Live Monitoring
            </div>
            <h2 className="text-3xl font-black tracking-tight">SOS Requests</h2>
            <p className="text-blue-100 mt-1 font-medium max-w-sm text-sm">
              Manage real-time halt requests from late students navigating to the bus route.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center min-w-[120px]">
            <div className="text-3xl font-black">{pendingCount}</div>
            <div className="text-xs font-bold text-blue-200 uppercase tracking-wider mt-1">Pending</div>
          </div>
        </div>
      </div>

      {/* Requests Grid */}
      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-900/50 rounded-3xl p-12 text-center border border-dashed border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Clear</h3>
          <p className="text-gray-500 text-sm mt-2 max-w-sm">No students have requested a halt for this trip yet. Active requests will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map(req => {
            const isPending = req.status === "PENDING";
            const isApproved = req.status === "APPROVED";
            const isRejected = req.status === "REJECTED";
            const loading = isLoading === req.studentId;

            return (
              <div 
                key={req.id} 
                className={`relative bg-white dark:bg-gray-900 rounded-3xl p-5 border shadow-sm flex flex-col transition-all duration-300 ${
                  isPending ? "border-blue-200 dark:border-blue-900/50 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800" : 
                  "border-gray-100 dark:border-gray-800 opacity-90"
                }`}
              >
                {/* Status Badge */}
                <div className="absolute top-5 right-5">
                  <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-full tracking-widest flex items-center gap-1 ${
                    isApproved ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200 dark:border-green-500/20" :
                    isRejected ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/20" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                  }`}>
                    {isPending && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                    {req.status}
                  </span>
                </div>

                {/* Student Info */}
                <div className="flex items-center gap-3 mb-4 pr-20">
                  <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-full flex items-center justify-center font-black text-gray-700 dark:text-gray-300 text-sm uppercase shadow-inner border border-white dark:border-gray-700">
                    {req.studentName.substring(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 dark:text-white text-base truncate">{req.studentName}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>

                {/* Map Button */}
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${req.latitude},${req.longitude}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800 transition-colors py-2.5 rounded-xl text-center text-xs font-bold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 mb-4"
                >
                  <Navigation2 className="w-4 h-4 text-blue-500" /> Locate on Google Maps
                </a>

                {/* Actions */}
                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800/60">
                  {isPending ? (
                    <div className="flex items-center gap-2">
                      <button
                        disabled={loading}
                        onClick={() => handleAction(req.studentId, "APPROVED")}
                        className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-70"
                      >
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleAction(req.studentId, "REJECTED")}
                        className="flex-1 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-600 dark:text-gray-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-70"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  ) : (
                    <div className={`text-center text-xs font-bold py-2 ${isApproved ? 'text-green-600' : 'text-red-500'}`}>
                      {isApproved ? '✓ Stop Approved' : '✕ Stop Rejected'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
