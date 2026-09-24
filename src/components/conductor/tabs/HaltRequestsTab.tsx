"use client";

import React, { useState, useEffect } from "react";
import { useConductorContext } from "../ConductorContext";
import { Hand, MapPin, Check, X, Loader2 } from "lucide-react";
import type { HaltRequest } from "@/lib/types";

export default function HaltRequestsTab() {
  const { activeTrip, showToast } = useConductorContext();
  const [requests, setRequests] = useState<HaltRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    try {
      const res = await fetch("/api/dispatch/halt-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId: activeTrip.id, studentId, status })
      });
      if (res.ok) {
        showToast(`Request ${status.toLowerCase()}`);
        setRequests(prev => prev.map(r => r.studentId === studentId ? { ...r, status } : r));
      }
    } catch(e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  if (!activeTrip) {
    return <div className="p-8 text-center text-gray-500">No active trip selected.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center">
          <Hand className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">SOS / Halt Requests</h2>
          <p className="text-sm text-gray-500 font-medium">Late students requesting the bus to stop.</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800 shadow-sm">
          <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No requests right now</h3>
          <p className="text-gray-500 text-sm mt-1">When students request a stop on the map, they will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map(req => (
            <div key={req.id} className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm uppercase">
                    {req.studentName.substring(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{req.studentName}</h4>
                    <p className="text-xs text-gray-500">
                      Requested {new Date(req.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
                
                <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full tracking-widest ${
                  req.status === "APPROVED" ? "bg-green-100 text-green-700" :
                  req.status === "REJECTED" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {req.status}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${req.latitude},${req.longitude}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors py-2 rounded-xl text-center text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-500" /> View Map
                </a>
              </div>

              {req.status === "PENDING" && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    disabled={isLoading}
                    onClick={() => handleAction(req.studentId, "APPROVED")}
                    className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button
                    disabled={isLoading}
                    onClick={() => handleAction(req.studentId, "REJECTED")}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
