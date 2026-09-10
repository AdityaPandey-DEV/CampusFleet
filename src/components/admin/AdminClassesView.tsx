"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Plus,
  Users,
  Clock,
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Calendar,
  Layers,
  ChevronRight,
  GraduationCap,
  Sparkles,
  Shield,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
  course: string;
  year: string;
  section: string;
  isActive: boolean;
  studentCount: number;
  assignedTeachers: {
    id: string;
    fullName: string;
    email?: string;
    isPrimary?: boolean;
  }[];
  createdAt: string;
}

interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  roomNumber?: string;
}

interface StudentItem {
  id: string;
  full_name: string;
  enrollment_no: string;
  email: string;
  phone?: string;
}

export interface AdminClassesProps {
  initialClasses?: ClassItem[];
  initialTeachers?: any[];
}

export default function AdminClassesView({
  initialClasses = [],
  initialTeachers = [],
}: AdminClassesProps = {}) {
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [teachersList, setTeachersList] = useState<any[]>(initialTeachers);
  const [isLoading, setIsLoading] = useState(initialClasses.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(initialClasses[0] || null);
  const [activeTab, setActiveTab] = useState<"overview" | "timetable" | "students" | "teachers">("overview");

  // Timetable state
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Student roster state
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddSlotModalOpen, setIsAddSlotModalOpen] = useState(false);
  const [isAllocateTeacherModalOpen, setIsAllocateTeacherModalOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    course: "B.Tech CSE",
    year: "3rd Year",
    section: "A",
  });

  const [slotFormData, setSlotFormData] = useState({
    dayOfWeek: "Monday",
    startTime: "10:00",
    endTime: "11:00",
    subject: "",
    teacherId: "",
    roomNumber: "LH-301",
  });

  const [selectedTeacherToAllocate, setSelectedTeacherToAllocate] = useState("");
  const [isPrimaryTeacher, setIsPrimaryTeacher] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Fetch all classes
  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/classes");
      const data = await res.json();
      if (data.success) {
        setClasses(data.classes || []);
        if (data.classes?.length > 0 && !selectedClass) {
          setSelectedClass(data.classes[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load classes", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch teacher list for dropdowns
  const fetchTeachers = async () => {
    try {
      const res = await fetch("/api/classes"); // Or we can fetch teachers from users table
      // Let's call /api/classes/teachers or fetch from supabase/API
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  // When selectedClass changes, load its details
  useEffect(() => {
    if (!selectedClass) return;

    if (activeTab === "timetable") {
      loadTimetable(selectedClass.id);
    } else if (activeTab === "students") {
      loadStudents(selectedClass.id);
    }
  }, [selectedClass, activeTab]);

  const loadTimetable = async (classId: string) => {
    try {
      setIsLoadingSlots(true);
      const res = await fetch(`/api/classes/${classId}/timetable`);
      const data = await res.json();
      if (data.success) {
        setTimetableSlots(data.timetable || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const loadStudents = async (classId: string) => {
    try {
      setIsLoadingStudents(true);
      const res = await fetch(`/api/classes/${classId}`);
      const data = await res.json();
      if (data.success) {
        setClassStudents(data.students || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to create class.");
        return;
      }

      setActionSuccess(`Class ${data.class.name} created successfully!`);
      setIsCreateModalOpen(false);
      fetchClasses();
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    }
  };

  const handleToggleStatus = async (classItem: ClassItem) => {
    try {
      const res = await fetch(`/api/classes/${classItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !classItem.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        fetchClasses();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    setActionError("");

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/timetable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...slotFormData,
          dayOfWeek: selectedDay,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to schedule slot.");
        return;
      }

      setIsAddSlotModalOpen(false);
      setSlotFormData({ ...slotFormData, subject: "" });
      loadTimetable(selectedClass.id);
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!selectedClass || !confirm("Delete this timetable lecture slot?")) return;

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/timetable?slotId=${slotId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        loadTimetable(selectedClass.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredClasses = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.section.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const daySlots = timetableSlots.filter((s) => s.dayOfWeek.toLowerCase() === selectedDay.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/20 border border-blue-800/40 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Academic Fleet Integration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Class & Timetable Management
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Configure courses, sections, and class timetables. The bus-entry validation engine actively cross-references these schedules to deny boarding during student lecture hours.
          </p>
        </div>

        <button
          onClick={() => {
            setActionError("");
            setIsCreateModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Class</span>
        </button>
      </div>

      {/* Main Grid: Left Class List, Right Class Details & Timetable */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Classes Roster (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>Active Classes ({classes.length})</span>
              </h2>
              <button
                onClick={fetchClasses}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search course, year, section..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Class Cards */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredClasses.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  {isLoading ? "Loading classes from database..." : "No classes found matching search."}
                </div>
              ) : (
                filteredClasses.map((item) => {
                  const isSelected = selectedClass?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedClass(item)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700/80 shadow-md ring-1 ring-blue-400/30"
                          : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.isActive ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                Active
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-bold">
                                Inactive
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.course} • {item.year}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            <Users className="w-3 h-3 text-blue-500" />
                            {item.studentCount}
                          </span>
                        </div>
                      </div>

                      {/* Teachers */}
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1 truncate">
                          <UserCheck className="w-3.5 h-3.5 text-teal-500" />
                          <span>
                            {item.assignedTeachers?.length > 0
                              ? item.assignedTeachers.map((t) => t.fullName).join(", ")
                              : "No Faculty Assigned"}
                          </span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? "text-blue-500 translate-x-0.5" : "text-slate-400"}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Class Operations, Timetable & Roster (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedClass ? (
            <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                    Selected Class Details
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedClass.name}
                  </h2>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                    <span>Course: <strong>{selectedClass.course}</strong></span>
                    <span>•</span>
                    <span>Year: <strong>{selectedClass.year}</strong></span>
                    <span>•</span>
                    <span>Section: <strong>{selectedClass.section}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleStatus(selectedClass)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      selectedClass.isActive
                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100"
                        : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100"
                    }`}
                  >
                    {selectedClass.isActive ? "Deactivate Class" : "Activate Class"}
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
                {[
                  { id: "overview", label: "Overview", icon: Layers },
                  { id: "timetable", label: "Class Timetable", icon: Clock },
                  { id: "students", label: `Enrolled Students (${selectedClass.studentCount})`, icon: GraduationCap },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                        isActive
                          ? "border-blue-600 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Enrolled Students</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {selectedClass.studentCount}
                      </div>
                      <div className="text-[11px] text-blue-500 mt-1 font-semibold">
                        Registered in Database
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Assigned Teachers</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {selectedClass.assignedTeachers?.length || 0}
                      </div>
                      <div className="text-[11px] text-teal-500 mt-1 font-semibold">
                        Class Advisors & Faculty
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                        {selectedClass.isActive ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400 text-lg">Active</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span className="text-rose-600 text-lg">Inactive</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Available in registration
                      </div>
                    </div>
                  </div>

                  {/* Faculty Allocation Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-tr from-slate-50 to-blue-50/30 dark:from-slate-800/40 dark:to-blue-950/20 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-teal-500" />
                        <span>Allocated Faculty Advisors</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selectedClass.assignedTeachers && selectedClass.assignedTeachers.length > 0 ? (
                        selectedClass.assignedTeachers.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{t.fullName}</span>
                                {t.isPrimary && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                                    Primary Advisor
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{t.email || "Faculty Account"}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 p-2">
                          No teachers assigned yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TIMETABLE */}
              {activeTab === "timetable" && (
                <div className="space-y-4">
                  {/* Day Picker */}
                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                    <div className="flex items-center gap-1.5">
                      {daysOfWeek.map((d) => (
                        <button
                          key={d}
                          onClick={() => setSelectedDay(d)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            selectedDay === d
                              ? "bg-blue-600 text-white shadow-sm"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                          }`}
                        >
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setActionError("");
                        setIsAddSlotModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Slot</span>
                    </button>
                  </div>

                  {/* Scheduled Slots for this day */}
                  <div className="space-y-2">
                    {isLoadingSlots ? (
                      <div className="text-center py-10 text-xs text-slate-400">Loading timetable...</div>
                    ) : daySlots.length === 0 ? (
                      <div className="text-center py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-1">
                        <Clock className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="font-bold">No lectures scheduled on {selectedDay}</p>
                        <p className="text-[11px] text-slate-500">
                          Students of this class have no boarding restrictions during these hours.
                        </p>
                      </div>
                    ) : (
                      daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-mono text-xs font-black flex items-center justify-center">
                              {slot.startTime.slice(0, 5)}
                            </div>

                            <div>
                              <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{slot.subject}</span>
                                {slot.roomNumber && (
                                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                                    {slot.roomNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>
                                  {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                </span>
                                <span>•</span>
                                <span>{slot.teacherName || "Assigned Faculty"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                              title="Delete Slot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: STUDENTS ROSTER */}
              {activeTab === "students" && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Students currently enrolled in <strong>{selectedClass.name}</strong> from database:
                  </div>

                  {isLoadingStudents ? (
                    <div className="text-center py-10 text-xs text-slate-400">Loading student roster...</div>
                  ) : classStudents.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                      No students enrolled in this class yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                      {classStudents.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white">
                              {s.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Roll: {s.enrollment_no} • {s.email}
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                            Enrolled
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs">
              Select a class from the list to manage its timetable and student roster.
            </div>
          )}
        </div>
      </div>

      {/* CREATE CLASS MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">Create New University Class</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Course
                </label>
                <input
                  type="text"
                  required
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  placeholder="e.g. B.Tech CSE, BBA, MBA"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Year / Semester
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="e.g. 3rd Year"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g. A, B, C"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-[11px] text-blue-700 dark:text-blue-300">
                Generated Identity: <strong>{formData.course} - {formData.year} (Sec {formData.section.toUpperCase()})</strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md"
                >
                  Save Class to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD TIMETABLE SLOT MODAL */}
      {isAddSlotModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Add Lecture Slot: {selectedDay}
                </h3>
              </div>
              <button
                onClick={() => setIsAddSlotModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleAddSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Subject / Course Module
                </label>
                <input
                  type="text"
                  required
                  value={slotFormData.subject}
                  onChange={(e) => setSlotFormData({ ...slotFormData, subject: e.target.value })}
                  placeholder="e.g. Database Management Systems (DBMS)"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={slotFormData.startTime}
                    onChange={(e) => setSlotFormData({ ...slotFormData, startTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={slotFormData.endTime}
                    onChange={(e) => setSlotFormData({ ...slotFormData, endTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Lecture Hall / Room Number
                </label>
                <input
                  type="text"
                  value={slotFormData.roomNumber}
                  onChange={(e) => setSlotFormData({ ...slotFormData, roomNumber: e.target.value })}
                  placeholder="e.g. Lab 4 or Room 302"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
                <strong>Enforced Rule:</strong> During {slotFormData.startTime} - {slotFormData.endTime} on {selectedDay}, any student of {selectedClass.name} attempting to scan into a bus will be denied entry automatically.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddSlotModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md"
                >
                  Add to Class Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
