"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Student } from "@/lib/types";
import {
  GraduationCap,
  Search,
  ShieldCheck,
  ShieldAlert,
  Phone,
  User,
  CheckCircle2,
  BookOpen,
  Edit2,
  X,
  AlertCircle,
  Camera,
  Upload,
  Lock,
} from "lucide-react";
import type { Stop, Route, Guardian } from "@/lib/types";

export interface StaffStudentsProps {
  initialStudents?: Student[];
  initialStops?: Stop[];
  initialRoutes?: Route[];
  initialGuardians?: Guardian[];
  initialClasses?: any[];
}

export default function StaffStudentsView({
  initialStudents = [],
  initialStops = [],
  initialRoutes = [],
  initialGuardians = [],
  initialClasses = [],
}: StaffStudentsProps = {}) {
  const [students, setStudents] = useState<Student[]>(() => initialStudents.length > 0 ? initialStudents : store.getStudents());
  const [stops, setStops] = useState<Stop[]>(() => initialStops.length > 0 ? initialStops : store.getStops());
  const [routes, setRoutes] = useState<Route[]>(() => initialRoutes.length > 0 ? initialRoutes : store.getRoutes());
  const [guardians, setGuardians] = useState<Guardian[]>(() => initialGuardians.length > 0 ? initialGuardians : store.getGuardians());
  const [classesList, setClassesList] = useState<any[]>(() => initialClasses.length > 0 ? initialClasses : []);
  const [searchQuery, setSearchQuery] = useState("");

  // Class reassignment modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedStudentForClass, setSelectedStudentForClass] = useState<Student | null>(null);
  const [selectedNewClassId, setSelectedNewClassId] = useState("");
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Staff passport photo update modal
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedStudentForPhoto, setSelectedStudentForPhoto] = useState<Student | null>(null);
  const [newStaffPhotoUrl, setNewStaffPhotoUrl] = useState("");
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setStudents(store.getStudents());
      setStops(store.getStops());
      setRoutes(store.getRoutes());
      setGuardians(store.getGuardians());
    });
    return unsub;
  }, []);

  // Fetch admin created classes from database
  useEffect(() => {
    const loadDbClasses = async () => {
      try {
        const res = await fetch("/api/classes");
        const data = await res.json();
        if (data.success) {
          setClassesList(data.classes || []);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadDbClasses();
  }, []);

  const handleToggleSuspension = (student: Student) => {
    student.transportAccessSuspended = !student.transportAccessSuspended;
    store.setCurrentUser(store.getCurrentUser()); // trigger notify
    setToastMessage(`Transport access for ${student.fullName} has been ${student.transportAccessSuspended ? "SUSPENDED" : "RESTORED"}.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenReassignModal = (student: Student) => {
    setSelectedStudentForClass(student);
    setSelectedNewClassId(student.classId || "");
    setReassignModalOpen(true);
  };

  const handleSaveStudentClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForClass) return;

    try {
      setIsUpdatingClass(true);
      const res = await fetch(`/api/students/${selectedStudentForClass.id}/class`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: selectedNewClassId }),
      });
      const data = await res.json();

      if (data.success) {
        // Update student in local store
        const chosenClass = classesList.find((c) => c.id === selectedNewClassId);
        selectedStudentForClass.classId = chosenClass?.id;
        selectedStudentForClass.className = chosenClass?.name;

        setToastMessage(`✓ ${selectedStudentForClass.fullName} reassigned to ${chosenClass?.name || "Unassigned"}.`);
        setReassignModalOpen(false);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert(data.message || "Failed to update student class.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setIsUpdatingClass(false);
    }
  };

  const handleOpenPhotoModal = (student: Student) => {
    setSelectedStudentForPhoto(student);
    setNewStaffPhotoUrl(student.photoUrl || "");
    setPhotoModalOpen(true);
  };

  const handleStaffPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Photo file size must be under 2MB.");
      return;
    }

    setIsUpdatingPhoto(true);
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await fetch("/api/payments/upload-receipt", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewStaffPhotoUrl(data.url);
      } else {
        alert(data.error || "Failed to upload photo. Please try again.");
      }
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const handleSaveStaffPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForPhoto || !newStaffPhotoUrl) {
      alert("Please upload or provide a photo URL.");
      return;
    }

    try {
      setIsUpdatingPhoto(true);
      const res = await store.updateStudentProfile(selectedStudentForPhoto.id, {
        photoUrl: newStaffPhotoUrl,
        performedByStaff: true,
      });

      if (res.success) {
        selectedStudentForPhoto.photoUrl = newStaffPhotoUrl;
        selectedStudentForPhoto.photoLocked = true;
        setToastMessage(`✓ Official identity photo for ${selectedStudentForPhoto.fullName} updated and locked by staff.`);
        setPhotoModalOpen(false);
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert(res.message || "Failed to update official photo.");
      }
    } catch (err: any) {
      alert(err.message || "Network error.");
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.className?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
          <GraduationCap className="w-7 h-7 text-blue-600" />
          Student & Guardian Transit Directory
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Manage enrolled students, academic class assignment, linked guardian accounts, emergency contacts, and transport access privileges.
        </p>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student name, roll, class..."
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none"
          />
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-3.5">Photo</th>
                <th className="p-3.5">Student Commuter</th>
                <th className="p-3.5">Assigned University Class</th>
                <th className="p-3.5">Primary Pickup Stop</th>
                <th className="p-3.5">Emergency Contact</th>
                <th className="p-3.5">Transit Status</th>
                <th className="p-3.5 text-right">Access & Photo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredStudents.map((s) => {
                const stop = stops.find((st) => st.id === s.primaryStopId);
                const isSuspended = s.transportAccessSuspended;

                return (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="p-3.5">
                      <div className="relative w-9 h-11 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                        {s.photoUrl ? (
                          <img
                            src={s.photoUrl}
                            alt={s.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                        {s.photoUrl && (
                          <div className="absolute bottom-0 right-0 bg-green-500 text-white p-0.5 rounded-tl">
                            <Lock className="w-2 h-2" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-gray-900 dark:text-white">{s.fullName}</div>
                      <div className="text-[10px] text-gray-500">{s.email}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{s.phone}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                            <span>{s.className || "B.Tech CSE - 3rd Year (Sec A)"}</span>
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {s.department || "Engineering"} • {s.semester || "Semester 6"}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenReassignModal(s)}
                          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Change Class"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-gray-700 dark:text-gray-300">
                      <div className="font-semibold">{stop?.name || "Campus Main Corridor"}</div>
                      <div className="text-[10px] text-gray-400">{stop?.landmark}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {s.emergencyContact?.name || "Guardian"} ({s.emergencyContact?.relationship || "Family"})
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {s.emergencyContact?.phone || s.phone}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 text-[10px] font-bold border border-green-300 dark:border-green-800">
                        ACTIVE PASS
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenPhotoModal(s)}
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 flex items-center gap-1 transition-colors"
                          title="Staff Photo Update (Anti-Fraud Override)"
                        >
                          <Camera className="w-3.5 h-3.5 text-green-500" />
                          <span>Photo</span>
                        </button>
                        <button
                          onClick={() => handleToggleSuspension(s)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${isSuspended
                              ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                              : "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900"
                            }`}
                        >
                          {isSuspended ? "Restore" : "Suspend"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassign Class Modal */}
      {reassignModalOpen && selectedStudentForClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Assign Class to Student
                </h3>
              </div>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs">
              <div className="font-bold text-gray-900 dark:text-white">
                {selectedStudentForClass.fullName}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {selectedStudentForClass.email}
              </div>
            </div>

            <form onSubmit={handleSaveStudentClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Select University Class (from Database)
                </label>
                <select
                  required
                  value={selectedNewClassId}
                  onChange={(e) => setSelectedNewClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="">-- Choose Class --</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.course} • {c.year} • Sec {c.section})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-[11px] text-blue-800 dark:text-blue-300">
                <strong>Enforced Rule:</strong> When the conductor scans this student&apos;s QR code, the system will cross-reference the selected class&apos;s timetable to prevent boarding during active lecture slots.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingClass || !selectedNewClassId}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {isUpdatingClass ? "Updating Database..." : "Save Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Identity Photo Update Modal */}
      {photoModalOpen && selectedStudentForPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-green-500" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Staff Photo Override & Verification
                </h3>
              </div>
              <button
                onClick={() => setPhotoModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs">
              <div className="font-bold text-gray-900 dark:text-white">
                {selectedStudentForPhoto.fullName}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {selectedStudentForPhoto.email}
              </div>
            </div>

            <form onSubmit={handleSaveStaffPhoto} className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-3 p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/40">
                {newStaffPhotoUrl ? (
                  <img
                    src={newStaffPhotoUrl}
                    alt="New Photo Preview"
                    className="w-24 h-32 object-cover rounded-xl border-2 border-green-500 shadow-md bg-white dark:bg-gray-900"
                  />
                ) : (
                  <div className="w-24 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                    <User className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-1" />
                    <span className="text-[10px] font-bold">No Photo Selected</span>
                  </div>
                )}

                <label className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleStaffPhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="p-3 rounded-2xl bg-green-50/70 dark:bg-green-950/40 border border-green-200 dark:border-green-800/80 text-[11px] text-green-800 dark:text-green-300 flex items-start gap-2">
                <Lock className="w-4 h-4 flex-shrink-0 text-green-500 mt-0.5" />
                <span>
                  <strong>Anti-Fraud Security Policy:</strong> This official passport photo is locked to prevent students from sharing tickets or swapping ID cards. Only authorized transport desk staff can edit this image.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPhoto || !newStaffPhotoUrl}
                  className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingPhoto ? "Saving..." : "Lock & Save Official Photo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
