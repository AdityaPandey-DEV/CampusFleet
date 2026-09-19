"use client";

import React, { useState } from "react";
import { store } from "@/lib/store";
import { AlertOctagon, PhoneCall, ShieldAlert, X, CheckCircle2 } from "lucide-react";

interface SOSModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

export function SOSModal({ isOpen, onClose, studentId }: SOSModalProps) {
  const [reason, setReason] = useState("EMERGENCY_PANIC");
  const [customNotes, setCustomNotes] = useState("");
  const [triggered, setTriggered] = useState(false);

  if (!isOpen) return null;

  const handleSendSOS = () => {
    // In browser, try getting real GPS or fallback
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const locStr = `Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}`;
          store.triggerSOS(studentId, locStr, `${reason}: ${customNotes}`);
          setTriggered(true);
        },
        () => {
          store.triggerSOS(studentId, "Near Sector 62 Bus Stop (GPS Denied)", `${reason}: ${customNotes}`);
          setTriggered(true);
        }
      );
    } else {
      store.triggerSOS(studentId, "Campus Corridor GPS Default", `${reason}: ${customNotes}`);
      setTriggered(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border-2 border-red-500 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-2xl animate-pulse">
              <AlertOctagon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg">EMERGENCY SOS ALERT</h3>
              <p className="text-xs text-red-100 font-medium">
                Direct Dispatch to Campus Transport Ops Desk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {triggered ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-green-400/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                SOS Dispatched Successfully!
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                Campus Security, Transport Control Desk, and the assigned Bus Driver have received your high-priority distress alert with your location coordinates.
              </p>

              <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900 text-left">
                <div className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider mb-2">
                  Immediate Emergency Hotlines:
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <span>Campus Security Quick-Response:</span>
                  <a href="tel:+911128002222" className="text-red-600 font-mono font-bold hover:underline">
                    +91-11-2800-2222
                  </a>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  <span>National Emergency Police Hotline:</span>
                  <a href="tel:112" className="text-red-600 font-mono font-bold hover:underline">
                    112
                  </a>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-2xl"
              >
                Close Window
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600" />
                <div>
                  <span className="font-bold">Use in genuine emergency only:</span> Pressing trigger will broadcast your current coordinates, phone number, and emergency contacts to transport controllers and security patrols immediately.
                </div>
              </div>

              {/* Emergency Category */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Emergency Nature
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "MEDICAL_ASSISTANCE", label: "Medical / Health" },
                    { id: "HARASSMENT_UNSAFE", label: "Safety / Harassment" },
                    { id: "ACCIDENT_COLLISION", label: "Bus Accident / Crash" },
                    { id: "LOST_STRANDED", label: "Stranded / Missing Bus" },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setReason(cat.id)}
                      className={`p-3 rounded-xl border text-left font-semibold transition-all ${
                        reason === cat.id
                          ? "bg-red-50 dark:bg-red-950/60 border-red-500 text-red-700 dark:text-red-300 ring-2 ring-red-400/30"
                          : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customNotes}
                  onChange={e => setCustomNotes(e.target.value)}
                  placeholder="Provide any quick detail (e.g., Near Gate 3, passenger feels dizzy)..."
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>

              {/* Big Red Trigger Button */}
              <button
                onClick={handleSendSOS}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-600 hover:from-red-700 hover:to-red-700 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <AlertOctagon className="w-5 h-5 animate-pulse" />
                BROADCAST EMERGENCY SOS NOW
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
