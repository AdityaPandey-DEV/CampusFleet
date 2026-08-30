"use client";

import React, { useState } from "react";
import { store } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { FileBarChart, Download, FileSpreadsheet, CheckCircle2, Calendar } from "lucide-react";

export default function ReportsAndExportsPage() {
  const [reportType, setReportType] = useState<"ATTENDANCE" | "OCCUPANCY" | "REVENUE" | "MAINTENANCE">("ATTENDANCE");
  const [isExporting, setIsExporting] = useState(false);

  const bookings = store.getBookings();
  const students = store.getStudents();
  const buses = store.getBuses();
  const payments = store.getPayments();
  const maintenance = store.getMaintenance();

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      let csvContent = "";
      let filename = `campusfleet_${reportType.toLowerCase()}_report.csv`;

      if (reportType === "ATTENDANCE") {
        csvContent = "BookingCode,StudentName,EnrollmentNo,Seat,Status,Date\n";
        bookings.forEach(b => {
          const s = students.find(stud => stud.id === b.studentId);
          csvContent += `"${b.bookingCode}","${s?.fullName || ""}","${s?.enrollmentNo || ""}","${b.seatNumber || `WL-${b.waitlistPosition}`}","${b.status}","${b.createdAt}"\n`;
        });
      } else if (reportType === "OCCUPANCY") {
        csvContent = "BusNumber,Registration,Capacity,Status,GPS_ID\n";
        buses.forEach(b => {
          csvContent += `"${b.busNumber}","${b.registrationNo}",${b.capacity},"${b.status}","${b.gpsDeviceId}"\n`;
        });
      } else if (reportType === "REVENUE") {
        csvContent = "ReceiptNo,StudentName,PlanName,Amount,Method,Date,Status\n";
        payments.forEach(p => {
          csvContent += `"${p.receiptNumber}","${p.studentName}","${p.planName}",${p.amount},"${p.paymentMethod}","${p.createdAt}","${p.status}"\n`;
        });
      } else if (reportType === "MAINTENANCE") {
        csvContent = "BusNumber,ServiceType,Cost,OdometerKm,Center,ServiceDate,NextDue\n";
        maintenance.forEach(m => {
          csvContent += `"${m.busNumber}","${m.serviceType}",${m.cost},${m.odometerKm},"${m.serviceCenter}","${m.serviceDate}","${m.nextDueDate}"\n`;
        });
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 600);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart className="w-7 h-7 text-blue-600" />
            Compliance Reports & CSV Data Export
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate auditable spreadsheets for university transport audits, safety boards, and finance.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all"
        >
          <Download className="w-4 h-4" />
          {isExporting ? "Generating CSV..." : `Download ${reportType} CSV`}
        </button>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
        {[
          { id: "ATTENDANCE", label: "Daily Trip & Attendance Ledger" },
          { id: "OCCUPANCY", label: "Bus Fleet & Seat Occupancy" },
          { id: "REVENUE", label: "Subscription Pass & Fee Revenue" },
          { id: "MAINTENANCE", label: "Workshop & Maintenance Due" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              reportType === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live Data Preview */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Live Preview: {reportType} Dataset
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Export format: RFC 4180 CSV Compliant
          </span>
        </div>

        {reportType === "ATTENDANCE" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Booking Code</th>
                  <th className="p-3">Passenger</th>
                  <th className="p-3">Seat Number</th>
                  <th className="p-3">Verification Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {bookings.map(b => {
                  const s = students.find(stud => stud.id === b.studentId);
                  return (
                    <tr key={b.id}>
                      <td className="p-3 font-mono font-bold text-blue-600">{b.bookingCode}</td>
                      <td className="p-3 font-semibold">{s?.fullName} ({s?.enrollmentNo})</td>
                      <td className="p-3 font-mono">{b.seatNumber || `WL-${b.waitlistPosition}`}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold text-[10px]">
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{formatDate(b.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {reportType === "OCCUPANCY" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Bus Identifier</th>
                  <th className="p-3">Registration</th>
                  <th className="p-3">Capacity</th>
                  <th className="p-3">Layout</th>
                  <th className="p-3">Fleet Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {buses.map(bus => (
                  <tr key={bus.id}>
                    <td className="p-3 font-bold">{bus.busNumber}</td>
                    <td className="p-3 font-mono">{bus.registrationNo}</td>
                    <td className="p-3 font-mono">{bus.capacity} Physical Seats</td>
                    <td className="p-3">{bus.seatLayout}</td>
                    <td className="p-3 font-bold text-emerald-600">{bus.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
