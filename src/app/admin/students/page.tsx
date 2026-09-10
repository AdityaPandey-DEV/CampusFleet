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
} from "lucide-react";

export default function StudentManagementPage() {
  const [students, setStudents] = useState(store.getStudents());
  const [stops, setStops] = useState(store.getStops());
  const [routes, setRoutes] = useState(store.getRoutes());
  const [guardians, setGuardians] = useState(store.getGuardians());
  const [classesList, setClassesList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Class reassignment modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedStudentForClass, setSelectedStudentForClass] = useState<Student | null>(null);
  const [selectedNewClassId, setSelectedNewClassId] = useState("");
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.enrollmentNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.className?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
          <GraduationCap className="w-7 h-7 text-blue-600" />
          Student & Guardian Transit Directory
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage enrolled students, academic class assignment, linked guardian accounts, emergency contacts, and transport access privileges.
        </p>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student name, roll, class..."
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
          />
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3.5">Roll / ID</th>
                <th className="p-3.5">Student Commuter</th>
                <th className="p-3.5">Assigned University Class</th>
                <th className="p-3.5">Primary Pickup Stop</th>
                <th className="p-3.5">Emergency Contact</th>
                <th className="p-3.5">Transit Status</th>
                <th className="p-3.5 text-right">Access Privileges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((s) => {
                const stop = stops.find((st) => st.id === s.primaryStopId);
                const isSuspended = s.transportAccessSuspended;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {s.enrollmentNo || "PENDING"}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{s.fullName}</div>
                      <div className="text-[10px] text-slate-500">{s.email}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.phone}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                            <span>{s.className || "B.Tech CSE - 3rd Year (Sec A)"}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {s.department || "Engineering"} • {s.semester || "Semester 6"}
                          </div>
                        </div>

                        <button
                          onClick={() => handleOpenReassignModal(s)}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition-colors"
                          title="Change Class"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold">{stop?.name || "Campus Main Corridor"}</div>
                      <div className="text-[10px] text-slate-400">{stop?.landmark}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.emergencyContact?.name || "Guardian"} ({s.emergencyContact?.relationship || "Family"})
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {s.emergencyContact?.phone || s.phone}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                        ACTIVE PASS
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleToggleSuspension(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          isSuspended
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                        }`}
                      >
                        {isSuspended ? "Restore Access" : "Suspend Access"}
                      </button>
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
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Assign Class to Student
                </h3>
              </div>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {selectedStudentForClass.fullName}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Roll: {selectedStudentForClass.enrollmentNo} • {selectedStudentForClass.email}
              </div>
            </div>

            <form onSubmit={handleSaveStudentClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Select University Class (from Database)
                </label>
                <select
                  required
                  value={selectedNewClassId}
                  onChange={(e) => setSelectedNewClassId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
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
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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
    </div>
  );
}
