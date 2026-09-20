"use client";

import React from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { QrCode, Download } from "lucide-react";
import { Bus, Trip } from "@/lib/types";

interface BusQrTabProps {
  activeTrip: Trip;
  bus?: Bus;
}

export function BusQrTab({ activeTrip, bus }: BusQrTabProps) {
  if (!bus) return null;

  const handleDownload = () => {
    const canvas = document.getElementById("main-bus-qr") as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `Bus_${bus.busNumber}_QR.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 animate-in fade-in zoom-in duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl max-w-4xl w-full border border-gray-200 dark:border-gray-800 text-center relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

        <h3 className="font-black text-2xl text-gray-900 dark:text-white mb-3 flex items-center justify-center gap-3 relative z-10">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400">
            <QrCode className="w-6 h-6" />
          </div>
          Bus Self-Boarding QR
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10 leading-relaxed max-w-md mx-auto relative z-10">
          Display this to students if the physical QR sticker on the bus door is damaged. Students can scan it to securely check-in.
        </p>
        
        <div className="bg-white p-5 rounded-3xl inline-block shadow-xl border border-gray-100 mx-auto transition-transform hover:scale-105 cursor-pointer relative z-10 group">
          <QRCodeCanvas
            id="main-bus-qr"
            value={JSON.stringify({ type: "BUS_QR", busId: bus.id })}
            size={240}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
          />
          <button
            onClick={handleDownload}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-auto"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>

        <div className="mt-10 mb-12 relative z-10">
          <h4 className="font-black text-3xl text-gray-900 dark:text-white">
            {bus.busNumber}
          </h4>
          <p className="text-sm font-mono font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl inline-block px-4 py-1.5 mt-3 border border-gray-200 dark:border-gray-700">
            {bus.registrationNo}
          </p>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-12 relative z-10">
          <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2">
            Seat QRs
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed max-w-md mx-auto">
            Digital backups for individual seat QR codes.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: bus.capacity }, (_, i) => i + 1).map(seatNum => (
              <div key={seatNum} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-3xl border border-gray-200 dark:border-gray-700/80 flex flex-col items-center shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-black text-gray-500 dark:text-gray-400 mb-3 tracking-widest">SEAT {seatNum}</div>
                <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100">
                  <QRCodeSVG
                    value={JSON.stringify({ type: "SEAT_QR", busId: bus.id, seatId: seatNum, busNumber: bus.busNumber })}
                    size={80}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
