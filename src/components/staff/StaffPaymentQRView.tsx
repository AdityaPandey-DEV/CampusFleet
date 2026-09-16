"use client";

import React, { useState, useEffect } from "react";
import { store } from "@/lib/store";
import {
  QrCode,
  Building,
  CreditCard,
  Upload,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Save,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";

interface StaffPaymentQRViewProps {
  initialUser?: any;
}

export default function StaffPaymentQRView({ initialUser }: StaffPaymentQRViewProps) {
  const [currentUser] = useState(initialUser || store.getCurrentUser());
  const [isSavingQr, setIsSavingQr] = useState(false);
  const [isUploadingQrImage, setIsUploadingQrImage] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [qrConfig, setQrConfig] = useState({
    upi_id: "gehu.transport@sbi",
    account_name: "Graphic Era Hill University Transport Cell",
    bank_name: "State Bank of India",
    account_number: "389201948201",
    ifsc_code: "SBIN0006240",
    qr_image_url: "",
    instructions: "Please make payment and enter the 12-digit Bank UTR / Transaction Reference number accurately.",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch("/api/staff/qr-config");
        const data = await res.json();
        if (data.success && data.config) {
          setQrConfig({
            upi_id: data.config.upi_id || "gehu.transport@sbi",
            account_name: data.config.account_name || "Graphic Era Hill University Transport Cell",
            bank_name: data.config.bank_name || "State Bank of India",
            account_number: data.config.account_number || "389201948201",
            ifsc_code: data.config.ifsc_code || "SBIN0006240",
            qr_image_url: data.config.qr_image_url || "",
            instructions: data.config.instructions || "Please make payment and enter the 12-digit Bank UTR / Transaction Reference number accurately.",
          });
        }
      } catch (err) {
        console.error("Failed to load QR config:", err);
      }
    };
    fetchConfig();
  }, []);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  // Generate dynamic Google Charts / QuickChart QR URL as fallback
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    `upi://pay?pa=${qrConfig.upi_id}&pn=${encodeURIComponent(qrConfig.account_name)}&cu=INR`
  )}`;

  const activeQrSrc = qrConfig.qr_image_url || dynamicQrUrl;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Campus Fee Collection QR & UPI VPA Management</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure the institutional bank account details, UPI ID, and QR code displayed to commuters in the Student Portal.
            </p>
          </div>

          <form onSubmit={handleSaveQrConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Official UPI ID / VPA
                </label>
                <input
                  type="text"
                  value={qrConfig.upi_id}
                  onChange={(e) => setQrConfig({ ...qrConfig, upi_id: e.target.value })}
                  placeholder="e.g. gehu.transport@sbi"
                  required
                  className="w-full text-xs font-mono font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Merchant / Beneficiary Name
                </label>
                <input
                  type="text"
                  value={qrConfig.account_name}
                  onChange={(e) => setQrConfig({ ...qrConfig, account_name: e.target.value })}
                  placeholder="e.g. Graphic Era Hill University"
                  required
                  className="w-full text-xs font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={qrConfig.bank_name}
                  onChange={(e) => setQrConfig({ ...qrConfig, bank_name: e.target.value })}
                  placeholder="State Bank of India"
                  className="w-full text-xs font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={qrConfig.account_number}
                  onChange={(e) => setQrConfig({ ...qrConfig, account_number: e.target.value })}
                  placeholder="389201948201"
                  className="w-full text-xs font-mono font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={qrConfig.ifsc_code}
                  onChange={(e) => setQrConfig({ ...qrConfig, ifsc_code: e.target.value })}
                  placeholder="SBIN0006240"
                  className="w-full text-xs font-mono font-bold p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Custom QR Image Upload */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Custom Standee QR Image (Optional)
              </label>
              <div className="flex items-center gap-3">
                <label className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700">
                  <Upload className="w-4 h-4" />
                  <span>{isUploadingQrImage ? "Uploading to Vercel Blob..." : "Upload High-Res Standee QR"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrImage}
                    disabled={isUploadingQrImage}
                    className="hidden"
                  />
                </label>
                {qrConfig.qr_image_url && (
                  <button
                    type="button"
                    onClick={() => setQrConfig({ ...qrConfig, qr_image_url: "" })}
                    className="text-xs text-rose-500 hover:text-rose-600 font-bold"
                  >
                    Reset to Dynamic QR
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                If omitted, CampusFleet automatically generates an SVG UPI payment QR from the VPA above.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Instructions for Commuters
              </label>
              <textarea
                value={qrConfig.instructions}
                onChange={(e) => setQrConfig({ ...qrConfig, instructions: e.target.value })}
                rows={2}
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSavingQr}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingQr ? "Updating Configuration..." : "Save & Publish QR Configuration"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Student Preview Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">Live Student Portal Preview</span>
              </div>
              <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                ACTIVE
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center text-slate-900 shadow-inner">
              <img
                src={activeQrSrc}
                alt="Payment QR"
                className="w-48 h-48 object-contain rounded-lg"
              />
              <div className="mt-3 text-center space-y-0.5">
                <div className="text-xs font-black text-slate-900">{qrConfig.account_name}</div>
                <div className="text-[11px] font-mono text-slate-500 flex items-center justify-center gap-1">
                  <span>{qrConfig.upi_id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(qrConfig.upi_id)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                  >
                    {copiedVpa ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Bank</span>
                <strong className="text-white font-mono">{qrConfig.bank_name}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>A/C No</span>
                <strong className="text-white font-mono">{qrConfig.account_number}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>IFSC</span>
                <strong className="text-white font-mono">{qrConfig.ifsc_code}</strong>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-[11px] text-blue-300">
            Commuters scan this QR with GPay, PhonePe, Paytm, or BHIM to pay semester transit fees.
          </div>
        </div>
      </div>
    </div>
  );
}
