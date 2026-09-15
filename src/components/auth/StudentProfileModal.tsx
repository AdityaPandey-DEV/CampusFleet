"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Student, TransitZone, TRANSIT_ZONES, Campus } from "@/lib/types";
import {
  GraduationCap,
  Building2,
  Phone,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  X,
  User,
  HeartHandshake,
  Compass,
  Camera,
  Upload,
  Lock,
  ShieldAlert,
} from "lucide-react";

export function StudentProfileModal() {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [campuses, setCampuses] = useState<Campus[]>(() => store.getCampuses());
  const [stops, setStops] = useState(store.getStops());
  const [transitZones, setTransitZones] = useState<TransitZone[]>(() => store.getTransitZones(store.getPrimaryCampus()?.id));
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeStudent: Student | undefined = students.find(
    s => s.email?.toLowerCase() === currentUser?.email?.toLowerCase() || s.userId === currentUser?.id
  );

  // Form State
  const [fullName, setFullName] = useState("");
  const [campusId, setCampusId] = useState(() => store.getPrimaryCampus()?.id || "");
  const [campus, setCampus] = useState(() => store.getPrimaryCampus()?.name || "Main Campus");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [department, setDepartment] = useState("B.Tech Computer Science & Engineering");
  const [semester, setSemester] = useState("5th Semester");
  const [classesList, setClassesList] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedZoneCode, setSelectedZoneCode] = useState("ZONE_B");
  const [phone, setPhone] = useState("");
  const [primaryStopId, setPrimaryStopId] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRel, setEmergencyRel] = useState("Parent / Guardian");
  const [photoUrl, setPhotoUrl] = useState("");

  const isPhotoLocked = Boolean(activeStudent?.photoUrl || activeStudent?.photoLocked);

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPhotoLocked) {
      alert("Official photo is locked. Only Campus Staff/Admin can update your photo.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Photo file size must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setCampuses(store.getCampuses());
      setStops(store.getStops());
      setTransitZones(store.getTransitZones(campusId));
    });
    return unsub;
  }, [campusId]);

  useEffect(() => {
    setTransitZones(store.getTransitZones(campusId));
  }, [campusId]);

  useEffect(() => {
    fetch("/api/classes")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.classes) setClassesList(data.classes);
      })
      .catch(console.error);
  }, []);

  // Check if profile is incomplete
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") {
      setIsOpen(false);
      return;
    }

    const isIncomplete =
      !activeStudent ||
      !activeStudent.phone ||
      activeStudent.phone === "+91 0000000000" ||
      !activeStudent.campus;

    if (isIncomplete) {
      setIsOpen(true);
      setFullName(activeStudent?.fullName || currentUser.fullName || "");
      setEnrollmentNo(activeStudent?.enrollmentNo && activeStudent?.enrollmentNo !== "PENDING" ? activeStudent.enrollmentNo : "");
      setPhone(activeStudent?.phone !== "+91 0000000000" ? (activeStudent?.phone || "") : "");
      setCampusId(activeStudent?.campusId || store.getPrimaryCampus()?.id || "");
      setCampus(activeStudent?.campus || store.getPrimaryCampus()?.name || "Main Campus");
      setDepartment(activeStudent?.department || "B.Tech Computer Science & Engineering");
      setSemester(activeStudent?.semester || "5th Semester");
      setSelectedClassId(activeStudent?.classId || "");
      setPrimaryStopId(activeStudent?.primaryStopId || stops[0]?.id || "");
      setEmergencyName(activeStudent?.emergencyContact?.name !== "Campus Desk" ? (activeStudent?.emergencyContact?.name || "") : "");
      setEmergencyPhone(activeStudent?.emergencyContact?.phone !== "+91 0000000000" ? (activeStudent?.emergencyContact?.phone || "") : "");
      setPhotoUrl(activeStudent?.photoUrl || "");
    }
  }, [currentUser, activeStudent, stops]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert("Please fill in your Contact Phone Number.");
      return;
    }

    setIsSubmitting(true);
    const targetStudentId = activeStudent?.id || `stud-${currentUser?.id || Date.now()}`;
    const chosenClass = classesList.find(c => c.id === selectedClassId);
    const chosenCampus = campuses.find(c => c.id === campusId);

    const res = await store.updateStudentProfile(targetStudentId, {
      fullName: fullName.trim() || currentUser?.fullName || "Student",
      enrollmentNo: enrollmentNo.trim() ? enrollmentNo.trim().toUpperCase() : "NOT_SPECIFIED",
      campusId,
      campus: chosenCampus?.name || campus,
      department,
      semester,
      classId: chosenClass?.id,
      className: chosenClass?.name,
      zoneCode: selectedZoneCode,
      phone: phone.trim(),
      primaryStopId: primaryStopId || stops[0]?.id || "",
      photoUrl: photoUrl.trim() || undefined,
      emergencyContact: {
        name: emergencyName.trim() || "Parent / Guardian",
        relationship: emergencyRel,
        phone: emergencyPhone.trim() || phone.trim(),
      },
    });

    if (chosenClass?.id) {
      try {
        await fetch(`/api/students/${targetStudentId}/class`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: chosenClass.id }),
        });
      } catch (err) {
        console.warn("Failed to sync student class with backend", err);
      }
    }

    setIsSubmitting(false);
    if (res.success) {
      setToast("✓ Student Profile Saved & Verified in Institutional Database!");
      setTimeout(() => {
        setIsOpen(false);
        setToast(null);
      }, 1200);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header Strip */}
        <div className="p-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur rounded-2xl">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-blue-100 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Institutional Onboarding
              </div>
              <h3 className="text-lg font-black">Complete Your Student Profile</h3>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {toast && (
          <div className="p-3 bg-emerald-500 text-white text-xs font-bold text-center animate-in fade-in">
            {toast}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <p className="text-xs text-slate-500">
            Welcome, <strong>{currentUser?.fullName || currentUser?.email}</strong>! Please link your university enrollment and campus transit stop to enable automated pass generation and bus tracking.
          </p>

          {/* Official Passport Photo Verification Upload */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                  Official Passport-Size Photo
                </span>
              </div>
              {isPhotoLocked ? (
                <span className="flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  <Lock className="w-3 h-3" /> Photo Locked
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                  Required for Boarding ID
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Photo Preview Thumbnail */}
              <div className="relative flex-shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Passport Photo Preview"
                    className="w-20 h-24 sm:w-22 sm:h-28 object-cover rounded-xl border-2 border-teal-500 shadow-md bg-white dark:bg-slate-900"
                  />
                ) : (
                  <div className="w-20 h-24 sm:w-22 sm:h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <User className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1" />
                    <span className="text-[9px] font-bold leading-tight">No Photo</span>
                  </div>
                )}
              </div>

              {/* Upload Controls or Locked Notice */}
              <div className="flex-1 space-y-2">
                {isPhotoLocked ? (
                  <div className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 text-[11px] text-teal-900 dark:text-teal-200">
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      Verified Institutional Identity
                    </div>
                    <p className="text-[10px] opacity-80">
                      Your official photo is locked to prevent pass impersonation. Only campus transport staff can update or verify this photo.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Upload your official passport photo. The conductor will visually confirm this against your face during QR boarding check-in.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFileChange}
                          className="hidden"
                        />
                      </label>
                      {photoUrl && (
                        <button
                          type="button"
                          onClick={() => setPhotoUrl("")}
                          className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold underline px-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Student Name"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* University Campus */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                University Campus
              </label>
              <select
                value={campusId}
                onChange={e => {
                  setCampusId(e.target.value);
                  const c = campuses.find(camp => camp.id === e.target.value);
                  if (c) setCampus(c.name);
                }}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                {campuses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isPrimary ? "(Primary)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Enrollment / Roll No (Optional) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Roll / Enrollment No</span>
                <span className="text-[10px] lowercase text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={enrollmentNo}
                onChange={e => setEnrollmentNo(e.target.value)}
                placeholder="e.g. GEHU/2023/1045 (optional)"
                className="w-full text-xs font-mono font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500"
              />
            </div>

            {/* Contact Mobile Phone */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Student Mobile Phone *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* University Class (Created by Admin) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Assigned University Class *</span>
                <span className="text-blue-500 font-normal lowercase">(admin authorized)</span>
              </label>
              <select
                required
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-bold"
              >
                <option value="">-- Select Your Class & Section --</option>
                {classesList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.course} • {c.year} • Sec {c.section})
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Department / Program
              </label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="B.Tech Computer Science & Engineering">B.Tech CSE</option>
                <option value="B.Tech Artificial Intelligence & Data Science">B.Tech AI & Data Science</option>
                <option value="BCA - Bachelor of Computer Applications">BCA</option>
                <option value="MCA - Master of Computer Applications">MCA</option>
                <option value="MBA - Master of Business Administration">MBA</option>
                <option value="BBA - Bachelor of Business Administration">BBA</option>
                <option value="B.Pharma - Bachelor of Pharmacy">B.Pharma</option>
                <option value="B.Sc Biotechnology / Physics">B.Sc Science</option>
              </select>
            </div>

            {/* Semester */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Academic Semester
              </label>
              <select
                value={semester}
                onChange={e => setSemester(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="1st Semester">1st Semester (Freshman)</option>
                <option value="2nd Semester">2nd Semester</option>
                <option value="3rd Semester">3rd Semester (Sophomore)</option>
                <option value="4th Semester">4th Semester</option>
                <option value="5th Semester">5th Semester (Junior)</option>
                <option value="6th Semester">6th Semester</option>
                <option value="7th Semester">7th Semester (Senior)</option>
                <option value="8th Semester">8th Semester</option>
              </select>
            </div>
          </div>

          {/* Residential Transit Zone */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-teal-600" />
                Residential Transit Zone *
              </span>
              <span className="text-teal-600 dark:text-teal-400 font-bold lowercase text-[10px]">
                (determines semester fee & pickup corridor)
              </span>
            </label>
            <select
              required
              value={selectedZoneCode}
              onChange={e => {
                const newZone = e.target.value;
                setSelectedZoneCode(newZone);
                const filteredStops = stops.filter(st => (st.zoneCode || "ZONE_B") === newZone);
                if (filteredStops.length > 0) {
                  setPrimaryStopId(filteredStops[0].id);
                }
              }}
              className="w-full text-xs p-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 text-slate-900 dark:text-white outline-none focus:border-teal-500 font-bold"
            >
              {transitZones.map(z => (
                <option key={z.code} value={z.code}>
                  {z.name} — ₹{z.semesterFee.toLocaleString()} / Semester
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Covers: {transitZones.find(z => z.code === selectedZoneCode)?.corridorDescription}
            </p>
          </div>

          {/* Primary Boarding Stop (Filtered strictly to selected zone) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Primary Boarding Stop ({selectedZoneCode}) *
              </span>
              <span className="text-[10px] text-slate-400">Zone-restricted</span>
            </label>
            <select
              value={primaryStopId}
              onChange={e => setPrimaryStopId(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500 font-medium"
            >
              {stops
                .filter(st => (st.zoneCode || "ZONE_B") === selectedZoneCode)
                .map(st => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code}) • {st.landmark}
                  </option>
                ))}
            </select>
          </div>

          {/* Emergency Guardian Section */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <HeartHandshake className="w-4 h-4 text-rose-500" />
              Emergency & Guardian Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={emergencyName}
                onChange={e => setEmergencyName(e.target.value)}
                placeholder="Parent / Guardian Name"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
              <input
                type="tel"
                value={emergencyPhone}
                onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="Guardian Phone (+91 ...)"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? "Saving to Database..." : "Save Profile & Verify Transit Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
