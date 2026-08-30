"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Student } from "@/lib/types";
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
} from "lucide-react";

export function StudentProfileModal() {
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [students, setStudents] = useState(store.getStudents());
  const [stops, setStops] = useState(store.getStops());
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [campus, setCampus] = useState("Graphic Era Hill University (GEHU), Bhimtal Campus");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [department, setDepartment] = useState("B.Tech Computer Science & Engineering");
  const [semester, setSemester] = useState("5th Semester");
  const [phone, setPhone] = useState("");
  const [primaryStopId, setPrimaryStopId] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRel, setEmergencyRel] = useState("Parent / Guardian");

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setCurrentUser(store.getCurrentUser());
      setStudents(store.getStudents());
      setStops(store.getStops());
    });
    return unsub;
  }, []);

  const activeStudent: Student | undefined = students.find(
    s => s.email?.toLowerCase() === currentUser?.email?.toLowerCase() || s.userId === currentUser?.id
  );

  // Check if profile is incomplete
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") {
      setIsOpen(false);
      return;
    }

    const isIncomplete =
      !activeStudent ||
      !activeStudent.enrollmentNo ||
      activeStudent.enrollmentNo === "PENDING" ||
      !activeStudent.phone ||
      activeStudent.phone === "+91 0000000000" ||
      !activeStudent.campus;

    if (isIncomplete) {
      setIsOpen(true);
      setFullName(activeStudent?.fullName || currentUser.fullName || "");
      setEnrollmentNo(activeStudent?.enrollmentNo !== "PENDING" ? (activeStudent?.enrollmentNo || "") : "");
      setPhone(activeStudent?.phone !== "+91 0000000000" ? (activeStudent?.phone || "") : "");
      setCampus(activeStudent?.campus || "Graphic Era Hill University (GEHU), Bhimtal Campus");
      setDepartment(activeStudent?.department || "B.Tech Computer Science & Engineering");
      setSemester(activeStudent?.semester || "5th Semester");
      setPrimaryStopId(activeStudent?.primaryStopId || stops[0]?.id || "");
      setEmergencyName(activeStudent?.emergencyContact?.name !== "Campus Desk" ? (activeStudent?.emergencyContact?.name || "") : "");
      setEmergencyPhone(activeStudent?.emergencyContact?.phone !== "+91 0000000000" ? (activeStudent?.emergencyContact?.phone || "") : "");
    }
  }, [currentUser, activeStudent, stops]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollmentNo.trim() || !phone.trim()) {
      alert("Please fill in your Enrollment Number and Contact Phone.");
      return;
    }

    setIsSubmitting(true);
    const targetStudentId = activeStudent?.id || `stud-${currentUser?.id || Date.now()}`;

    const res = await store.updateStudentProfile(targetStudentId, {
      fullName: fullName.trim() || currentUser?.fullName || "Student",
      enrollmentNo: enrollmentNo.trim().toUpperCase(),
      campus,
      department,
      semester,
      phone: phone.trim(),
      primaryStopId: primaryStopId || stops[0]?.id || "",
      emergencyContact: {
        name: emergencyName.trim() || "Parent / Guardian",
        relationship: emergencyRel,
        phone: emergencyPhone.trim() || phone.trim(),
      },
    });

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
                value={campus}
                onChange={e => setCampus(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                <option value="Graphic Era Hill University (GEHU), Bhimtal Campus">
                  GEHU Bhimtal Campus
                </option>
                <option value="Graphic Era Hill University (GEHU), Dehradun Campus">
                  GEHU Dehradun Campus
                </option>
                <option value="Graphic Era Hill University (GEHU), Haldwani Campus">
                  GEHU Haldwani Campus
                </option>
                <option value="Graphic Era Deemed to be University (GEU), Dehradun">
                  GEU Dehradun Campus
                </option>
              </select>
            </div>

            {/* Enrollment / Roll No */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Roll / Enrollment Number *
              </label>
              <input
                type="text"
                required
                value={enrollmentNo}
                onChange={e => setEnrollmentNo(e.target.value)}
                placeholder="e.g. GEHU/2023/1045"
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

          {/* Primary Boarding Stop */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              Primary Boarding / Pickup Location
            </label>
            <select
              value={primaryStopId}
              onChange={e => setPrimaryStopId(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-blue-500"
            >
              {stops.map(st => (
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
