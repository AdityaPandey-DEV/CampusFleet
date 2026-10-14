"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  UserPlus,
  Tag,
  Building2,
  Filter,
  Award,
} from "lucide-react";
import SearchableDropdown, { DropdownOption } from "@/components/ui/SearchableDropdown";
import { store } from "@/lib/store";

export interface ClassItem {
  id: string;
  name: string;
  course: string;
  department?: string;
  semester?: string;
  year: string;
  section: string;
  specialization?: string;
  isActive: boolean;
  createdAt?: string;
  studentCount?: number;
  assignedTeachers?: { id: string; fullName: string; email: string; isPrimary: boolean }[];
  shiftSchedule?: Record<string, { enabled?: boolean; days?: Record<string, boolean> }>;
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
  email: string;
  phone?: string;
}

export interface StaffClassesProps {
  initialClasses?: ClassItem[];
  initialTeachers?: any[];
}

export default function StaffClassesView({
  initialClasses = [],
  initialTeachers = [],
}: StaffClassesProps = {}) {
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [teachersList, setTeachersList] = useState<any[]>(initialTeachers);
  const [isLoading, setIsLoading] = useState(initialClasses.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("ALL");
  const [semesterFilter, setSemesterFilter] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(initialClasses[0] || null);
  const [activeTab, setActiveTab] = useState<"overview" | "shifts" | "students">("overview");
  const [fleetShifts, setFleetShifts] = useState(store.getShifts());
  const [isSavingShiftSchedule, setIsSavingShiftSchedule] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setFleetShifts(store.getShifts());
    });
    return unsub;
  }, []);

  // Student roster state
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAllocateTeacherModalOpen, setIsAllocateTeacherModalOpen] = useState(false);

  // Form states with normalized structure
  const [formData, setFormData] = useState({
    course: "B.Tech CSE",
    semester: "3rd Sem",
    year: "2nd Year",
    section: "A",
    specialization: "Core",
    assignedTeacherId: "",
  });

  const [editFormData, setEditFormData] = useState({
    id: "",
    course: "B.Tech CSE",
    semester: "3rd Sem",
    year: "2nd Year",
    section: "A",
    specialization: "Core",
  });

  const [selectedTeacherToAllocate, setSelectedTeacherToAllocate] = useState("");
  const [isPrimaryTeacher, setIsPrimaryTeacher] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Fetch all classes
  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/classes");
      const data = await res.json();
      if (data.success) {
        setClasses(data.classes || []);
        if (data.classes?.length > 0) {
          setSelectedClass((prev) => {
            if (!prev) return data.classes[0];
            const updated = data.classes.find((c: ClassItem) => c.id === prev.id);
            return updated || data.classes[0];
          });
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
      const res = await fetch("/api/classes/teachers");
      const data = await res.json();
      if (data.success && data.teachers) {
        setTeachersList(data.teachers);
      }
    } catch (e) {
      console.error("Failed to load teachers list", e);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  // When selectedClass changes, load its details
  useEffect(() => {
    if (!selectedClass) return;

    if (activeTab === "students") {
      loadStudents(selectedClass.id);
    }
  }, [selectedClass?.id, activeTab]);

  const handleToggleShift = async (shiftId: string, dayKey?: string) => {
    if (!selectedClass) return;
    const currentSchedule = { ...(selectedClass.shiftSchedule || {}) };
    const currentRule = { ...(currentSchedule[shiftId] || { enabled: true, days: {} }) };

    let updatedRule: any;
    if (dayKey) {
      const currentDays = { ...(currentRule.days || {}) };
      const currentDayVal = currentDays[dayKey] !== false;
      currentDays[dayKey] = !currentDayVal;
      updatedRule = { ...currentRule, days: currentDays };
    } else {
      const currentEnabled = currentRule.enabled !== false;
      updatedRule = { ...currentRule, enabled: !currentEnabled };
    }

    const updatedSchedule = {
      ...currentSchedule,
      [shiftId]: updatedRule,
    };

    const updatedClass = { ...selectedClass, shiftSchedule: updatedSchedule };
    setSelectedClass(updatedClass);
    setClasses(prev => prev.map(c => c.id === selectedClass.id ? updatedClass : c));

    try {
      setIsSavingShiftSchedule(true);
      await fetch(`/api/classes/${selectedClass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftSchedule: updatedSchedule }),
      });
    } catch (e) {
      console.error("Failed to save shift schedule:", e);
    } finally {
      setIsSavingShiftSchedule(false);
    }
  };

  const handleResetAllShifts = async () => {
    if (!selectedClass) return;
    const updatedClass = { ...selectedClass, shiftSchedule: {} };
    setSelectedClass(updatedClass);
    setClasses(prev => prev.map(c => c.id === selectedClass.id ? updatedClass : c));

    try {
      setIsSavingShiftSchedule(true);
      await fetch(`/api/classes/${selectedClass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftSchedule: {} }),
      });
    } catch (e) {
      console.error("Failed to reset shift schedule:", e);
    } finally {
      setIsSavingShiftSchedule(false);
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

  // 1. CREATE CLASS
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: formData.course,
          semester: formData.semester,
          year: formData.year,
          section: formData.section,
          specialization: formData.specialization,
          assignedTeacherId: formData.assignedTeacherId || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to create class.");
        return;
      }

      setActionSuccess(`Class ${data.class.name} created successfully!`);
      setIsCreateModalOpen(false);
      setFormData({
        course: "B.Tech CSE",
        semester: "3rd Sem",
        year: "2nd Year",
        section: "A",
        specialization: "Core",
        assignedTeacherId: "",
      });
      await fetchClasses();
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. OPEN EDIT CLASS MODAL
  const handleOpenEditModal = (classItem: ClassItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditFormData({
      id: classItem.id,
      course: classItem.course,
      semester: classItem.semester || "3rd Sem",
      year: classItem.year,
      section: classItem.section,
      specialization: classItem.specialization || "Core",
    });
    setActionError("");
    setIsEditModalOpen(true);
  };

  // 3. UPDATE CLASS
  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/classes/${editFormData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: editFormData.course,
          semester: editFormData.semester,
          year: editFormData.year,
          section: editFormData.section,
          specialization: editFormData.specialization,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to update class.");
        return;
      }

      setActionSuccess(`Class updated successfully!`);
      setIsEditModalOpen(false);
      await fetchClasses();
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. DELETE CLASS
  const handleDeleteClass = async (classId: string, className: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Are you sure you want to delete class "${className}"?\n\nThis will unenroll all students in this class and delete its timetable schedules.`)) {
      return;
    }
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to delete class.");
        return;
      }

      setActionSuccess(`Class "${className}" deleted successfully.`);
      if (selectedClass?.id === classId) {
        setSelectedClass(null);
      }
      await fetchClasses();
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    }
  };

  // 5. TOGGLE CLASS STATUS
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

  // 6. ALLOCATE TEACHER TO CLASS
  const handleAllocateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedTeacherToAllocate) return;
    setActionError("");
    setActionSuccess("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: selectedTeacherToAllocate,
          isPrimary: isPrimaryTeacher,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to allocate teacher.");
        return;
      }

      setActionSuccess("Teacher allocated to class successfully!");
      setIsAllocateTeacherModalOpen(false);
      setSelectedTeacherToAllocate("");
      setIsPrimaryTeacher(false);
      await fetchClasses();
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. REMOVE TEACHER FROM CLASS
  const handleRemoveTeacher = async (teacherId: string, teacherName: string) => {
    if (!selectedClass) return;
    if (!confirm(`Remove ${teacherName} from ${selectedClass.name}?`)) return;
    setActionError("");
    setActionSuccess("");

    try {
      const res = await fetch(`/api/classes/${selectedClass.id}/teachers?teacherId=${teacherId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || "Failed to remove teacher.");
        return;
      }

      setActionSuccess(`Removed ${teacherName} from ${selectedClass.name}.`);
      await fetchClasses();
    } catch (err: any) {
      setActionError(err.message || "Network error.");
    }
  };


  // Convert teacher list to options for SearchableDropdown
  const teacherOptions: DropdownOption[] = teachersList.map((t) => ({
    value: t.id,
    label: t.full_name || t.fullName || "Faculty",
    sublabel: `${t.role ? `[${t.role.toUpperCase()}] ` : ""}${t.email || ""}`,
  }));

  // Filtering classes
  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.course.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q) ||
        (c.specialization && c.specialization.toLowerCase().includes(q)) ||
        (c.semester && c.semester.toLowerCase().includes(q));

      const matchesProgram =
        programFilter === "ALL" ||
        (programFilter === "B.Tech CSE" && c.course === "B.Tech CSE") ||
        (programFilter === "Diploma" && c.course.includes("Diploma")) ||
        (programFilter === "M.Tech" && c.course.includes("M.Tech")) ||
        (programFilter === "OTHER" && !c.course.includes("B.Tech CSE") && !c.course.includes("Diploma") && !c.course.includes("M.Tech"));

      const matchesSemester =
        semesterFilter === "ALL" ||
        (semesterFilter === "SEM_3_4" && (c.semester?.includes("3") || c.semester?.includes("4"))) ||
        (semesterFilter === "SEM_5_6" && (c.semester?.includes("5") || c.semester?.includes("6"))) ||
        (semesterFilter === "SEM_7_8" && (c.semester?.includes("7") || c.semester?.includes("8"))) ||
        (semesterFilter === "SEM_1_2" && (c.semester?.includes("1") || c.semester?.includes("2")));

      return matchesSearch && matchesProgram && matchesSemester;
    });
  }, [classes, searchQuery, programFilter, semesterFilter]);


  // Helper for specialization badge color
  const getSpecializationBadge = (spec?: string) => {
    switch (spec) {
      case "AIML":
        return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20";
      case "CS":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "Cloud Computing":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess("")} className="text-green-500 hover:text-green-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError("")} className="text-red-500 hover:text-red-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-blue-900/40 border border-blue-800/40 p-6 rounded-3xl backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-2.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Academic Fleet Integration</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
            Class & Timetable Management
          </h1>
          <p className="text-sm text-gray-300 mt-1 max-w-xl">
            Normalized university course structure with active timetable synchronization. The transit engine cross-references these lecture periods to validate real-time bus boarding eligibility.
          </p>
        </div>

        <button
          onClick={() => {
            setActionError("");
            setIsCreateModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500  text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Class</span>
        </button>
      </div>

      {/* Main Grid: Left Class List (5 cols), Right Class Details & Timetable (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Normalized Classes Roster (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>Active Classes ({filteredClasses.length} of {classes.length})</span>
              </h2>
              <button
                onClick={fetchClasses}
                className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                title="Refresh Classes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search course, semester, section, specialization..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Program Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
              {[
                { id: "ALL", label: "All" },
                { id: "B.Tech CSE", label: "B.Tech CSE" },
                { id: "Diploma", label: "Diploma" },
                { id: "M.Tech", label: "M.Tech" },
                { id: "OTHER", label: "BCA/MCA/ECE" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setProgramFilter(chip.id)}
                  className={`px-2.5 py-1 rounded-xl whitespace-nowrap transition-all cursor-pointer ${programFilter === chip.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Class Cards List */}
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {filteredClasses.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-xs">
                  {isLoading ? "Loading classes from database..." : "No classes found matching criteria."}
                </div>
              ) : (
                filteredClasses.map((item) => {
                  const isSelected = selectedClass?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedClass(item)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left group ${isSelected
                          ? "bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700/80 shadow-md ring-1 ring-blue-400/30"
                          : "bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{item.name}</span>
                            {item.isActive ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-bold">
                                Active
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500 text-[10px] font-bold">
                                Inactive
                              </span>
                            )}
                          </div>

                          {/* Normalized Badges Row */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                              {item.semester || item.year}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-[10px]">
                              Sec {item.section}
                            </span>
                            {item.specialization && item.specialization !== "Core" && (
                              <span className={`px-2 py-0.5 rounded-md border font-black text-[10px] ${getSpecializationBadge(item.specialization)}`}>
                                {item.specialization}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              • {item.course}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            <Users className="w-3 h-3 text-blue-500" />
                            {item.studentCount}
                          </span>

                          {/* Quick Edit and Delete buttons on card */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center ml-1">
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditModal(item, e)}
                              className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                              title="Edit Class"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClass(item.id, item.name, e)}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                              title="Delete Class"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Teachers list row */}
                      <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between text-[11px] text-gray-500">
                        <div className="flex items-center gap-1.5 truncate max-w-[85%]">
                          <UserCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          <span className="truncate">
                            {(item.assignedTeachers?.length || 0) > 0
                              ? item.assignedTeachers?.map((t) => t.fullName).join(", ")
                              : "No Faculty Assigned"}
                          </span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform flex-shrink-0 ${isSelected ? "text-blue-500 translate-x-0.5" : "text-gray-400"}`} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Class Operations, Normalized Details & Timetable (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedClass ? (
            <div className="bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-md space-y-6">
              {/* Header Info & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    <span>Academic Entity Structure</span>
                  </div>
                  <h2 className="text-xl font-black text-gray-900 dark:text-white">
                    {selectedClass.name}
                  </h2>

                  {/* STRUCTURED NORMALIZED PILLS */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>{selectedClass.course}</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>{selectedClass.semester || "Semester"}</span>
                      <span className="text-blue-400 font-normal">({selectedClass.year})</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/80">
                      <Tag className="w-3.5 h-3.5 text-green-500" />
                      <span>Section {selectedClass.section}</span>
                    </span>

                    {selectedClass.specialization && selectedClass.specialization !== "Core" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/80">
                        <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                        <span>{selectedClass.specialization} Track</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        Core Branch
                      </span>
                    )}

                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {selectedClass.course}
                    </span>
                  </div>
                </div>

                {/* Class Actions: Edit, Status, Delete */}
                <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                  <button
                    onClick={() => handleOpenEditModal(selectedClass)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(selectedClass)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${selectedClass.isActive
                        ? "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 border-yellow-200 dark:border-yellow-900/50 hover:bg-yellow-100"
                        : "bg-green-50 dark:bg-green-950/40 text-green-600 border-green-200 dark:border-green-900/50 hover:bg-green-100"
                      }`}
                  >
                    {selectedClass.isActive ? "Deactivate" : "Activate"}
                  </button>

                  <button
                    onClick={() => handleDeleteClass(selectedClass.id, selectedClass.name)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 transition-colors cursor-pointer"
                    title="Delete Class"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-800 gap-2">
                {[
                  { id: "overview", label: "Overview & Faculty", icon: Layers },
                  { id: "shifts", label: "Shift Schedule", icon: Clock },
                  { id: "students", label: `Enrolled Students (${selectedClass.studentCount})`, icon: GraduationCap },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${isActive
                          ? "border-blue-600 text-blue-600 dark:text-blue-400"
                          : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: OVERVIEW & NORMALIZED DETAILS */}
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Enrolled Students</div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                        {selectedClass.studentCount}
                      </div>
                      <div className="text-[11px] text-blue-500 mt-1 font-semibold">
                        Registered in Database
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Assigned Teachers</div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                        {selectedClass.assignedTeachers?.length || 0}
                      </div>
                      <div className="text-[11px] text-green-500 mt-1 font-semibold">
                        Faculty & Class Advisors
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">Gate Status</div>
                      <div className="text-2xl font-black text-gray-900 dark:text-white mt-1 flex items-center gap-1.5">
                        {selectedClass.isActive ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            <span className="text-green-600 dark:text-green-400 text-lg">Active</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="text-red-600 text-lg">Inactive</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        Lecture-gate scan protection
                      </div>
                    </div>
                  </div>

                  {/* Academic Blueprint Details */}
                  <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-800 space-y-2.5">
                    <div className="font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      <span>Curricular Normalization Profile</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase">Department</span>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200 truncate block mt-0.5">
                          {selectedClass.department || "Computer Science"}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase">Degree Program</span>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200 truncate block mt-0.5">
                          {selectedClass.course}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase">Academic Standing</span>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200 truncate block mt-0.5">
                          {selectedClass.year} • {selectedClass.semester}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase">Section & Track</span>
                        <span className="text-xs font-black text-gray-800 dark:text-gray-200 truncate block mt-0.5">
                          Sec {selectedClass.section} ({selectedClass.specialization || "Core"})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Teacher Allocation Section */}
                  <div className="p-5 rounded-3xl bg-gray-50 dark:bg-gray-800/40  border border-gray-200 dark:border-gray-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xs uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-green-500" />
                          <span>Allocated Faculty Advisors ({selectedClass.assignedTeachers?.length || 0})</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Teachers and faculty assigned to advise or lecture for this specific section.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeacherToAllocate("");
                          setIsPrimaryTeacher(false);
                          setActionError("");
                          setIsAllocateTeacherModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold shadow-md shadow-green-500/20 transition-all active:scale-95 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Allocate Teacher</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {selectedClass.assignedTeachers && selectedClass.assignedTeachers.length > 0 ? (
                        selectedClass.assignedTeachers.map((t) => (
                          <div
                            key={t.id}
                            className="p-3.5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span>{t.fullName}</span>
                                {t.isPrimary && (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase">
                                    Primary Advisor
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                                {t.email || "Faculty Account"}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveTeacher(t.id, t.fullName)}
                              className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex-shrink-0 cursor-pointer"
                              title="Remove teacher from class"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-400">
                          No teachers allocated to this class yet. Click "Allocate Teacher" above to assign faculty.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SHIFT SCHEDULE MATRIX */}
              {activeTab === "shifts" && (
                <div className="space-y-4">
                  {/* Header & Quick Action */}
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                          Section Shift Eligibility Matrix
                        </h4>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Shifts run on their own operating days. All shifts are <strong>ON (Allowed)</strong> by default. Toggle OFF any shift or specific day to restrict booking.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isSavingShiftSchedule && (
                        <span className="text-[10px] text-blue-500 flex items-center gap-1 font-bold animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                        </span>
                      )}
                      <button
                        onClick={handleResetAllShifts}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-bold text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                      >
                        Reset All (Default ON)
                      </button>
                    </div>
                  </div>

                  {/* Shift Cards */}
                  <div className="space-y-3">
                    {fleetShifts.map((shift) => {
                      const classSchedule = selectedClass.shiftSchedule || {};
                      const shiftRule = classSchedule[shift.id] || { enabled: true, days: {} };
                      const isMasterEnabled = shiftRule.enabled !== false;
                      const daysRule = shiftRule.days || {};

                      // Determine shift operational days (weekdays + sat for regular, or specific for custom)
                      const shiftDays = shift.isSpecial
                        ? ["Saturday", "Sunday"]
                        : shift.shiftType === "EVENING"
                          ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
                          : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

                      return (
                        <div
                          key={shift.id}
                          className={`p-4 rounded-2xl border transition-all ${isMasterEnabled
                              ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm"
                              : "bg-gray-50/60 dark:bg-gray-900/40 border-gray-200/50 dark:border-gray-800/50 opacity-80"
                            }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-gray-900 dark:text-white">
                                  {shift.name}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${shift.shiftType === "MORNING"
                                      ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                      : shift.shiftType === "AFTERNOON"
                                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                        : shift.shiftType === "EVENING"
                                          ? "bg-pink-500/10 text-pink-600 dark:text-pink-400"
                                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    }`}
                                >
                                  {shift.shiftType}
                                </span>
                                <span className="text-[11px] font-mono text-gray-400">
                                  {shift.startTime} - {shift.endTime}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400">
                                Cutoff: {shift.bookingCutoffMins}m before departure • Operating Days: {shiftDays.join(", ")}
                              </p>
                            </div>

                            {/* Master Toggle */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                {isMasterEnabled ? "Active" : "Disabled"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleShift(shift.id)}
                                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${isMasterEnabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"
                                  }`}
                              >
                                <span
                                  className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${isMasterEnabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Operating Day Toggles */}
                          {isMasterEnabled && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Shift Days for this Section (Click to Toggle):
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {shiftDays.map((d) => {
                                  const dayKey = d.toLowerCase();
                                  const isDayEnabled = daysRule[dayKey] !== false;
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => handleToggleShift(shift.id, dayKey)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${isDayEnabled
                                          ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 hover:bg-green-100"
                                          : "bg-gray-100 dark:bg-gray-800 text-gray-400 line-through border border-transparent hover:bg-gray-200"
                                        }`}
                                      title={isDayEnabled ? `${d}: Enabled for Section` : `${d}: Disabled (Emergency Pass Required)`}
                                    >
                                      <span>{isDayEnabled ? "✓" : "✕"}</span>
                                      <span>{d.substring(0, 3)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: STUDENTS ROSTER */}
              {activeTab === "students" && (
                <div className="space-y-3">
                  <div className="text-xs text-gray-500">
                    Students currently enrolled in <strong>{selectedClass.name}</strong> from database:
                  </div>

                  {isLoadingStudents ? (
                    <div className="text-center py-10 text-xs text-gray-400">Loading student roster...</div>
                  ) : classStudents.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-xs text-gray-400">
                      No students enrolled in this class yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                      {classStudents.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-xs text-gray-900 dark:text-white">
                              {s.full_name}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono">
                              {s.email}
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-600 text-[10px] font-bold">
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
            <div className="h-full min-h-[300px] flex items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center text-gray-400 text-xs">
              Select a class from the list to view its normalized academic profile and faculty advisors.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: CREATE CLASS */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">Create University Class</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Academic Course / Program
                </label>
                <select
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="B.Tech CSE">B.Tech Computer Science & Engineering (B.Tech CSE)</option>
                  <option value="Diploma CSE">Diploma in Computer Science & Engineering (Diploma CSE)</option>
                  <option value="M.Tech CSE">M.Tech Computer Science & Engineering (M.Tech CSE)</option>
                  <option value="B.Tech ECE">B.Tech Electronics & Communication (B.Tech ECE)</option>
                  <option value="BCA">Bachelor of Computer Applications (BCA)</option>
                  <option value="MCA">Master of Computer Applications (MCA)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Semester
                  </label>
                  <select
                    value={formData.semester}
                    onChange={(e) => {
                      const sem = e.target.value;
                      const semNum = parseInt(sem) || 1;
                      const yrNum = Math.ceil(semNum / 2);
                      const yrSuffix = yrNum === 1 ? '1st' : yrNum === 2 ? '2nd' : yrNum === 3 ? '3rd' : '4th';
                      setFormData({ ...formData, semester: sem, year: `${yrSuffix} Year` });
                    }}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1st Sem">1st Sem (Year 1)</option>
                    <option value="2nd Sem">2nd Sem (Year 1)</option>
                    <option value="3rd Sem">3rd Sem (Year 2)</option>
                    <option value="4th Sem">4th Sem (Year 2)</option>
                    <option value="5th Sem">5th Sem (Year 3)</option>
                    <option value="6th Sem">6th Sem (Year 3)</option>
                    <option value="7th Sem">7th Sem (Year 4)</option>
                    <option value="8th Sem">8th Sem (Year 4)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formData.year}
                    className="w-full px-3.5 py-2 text-xs bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Section Code
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                    placeholder="e.g. A, B, C, CC"
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Specialization / Track
                  </label>
                  <select
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Core">Core (Standard)</option>
                    <option value="AIML">AI & Machine Learning (AIML)</option>
                    <option value="CS">Computer Science (CS)</option>
                    <option value="Cloud Computing">Cloud Computing (CC)</option>
                  </select>
                </div>
              </div>

              {/* SEARCHABLE DROPDOWN FOR ASSIGNING TEACHER ON CREATION */}
              <div>
                <SearchableDropdown
                  label="Assign Faculty Advisor (Optional)"
                  placeholder="Search and select a teacher..."
                  searchPlaceholder="Type teacher name or email..."
                  options={teacherOptions}
                  value={formData.assignedTeacherId}
                  onChange={(val) => setFormData({ ...formData, assignedTeacherId: val })}
                  clearable
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  The chosen teacher will automatically be assigned as this class's primary advisor.
                </span>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-[11px] text-blue-700 dark:text-blue-300">
                Generated Normalized Identity: <strong>{formData.course} - {formData.semester} (Section {formData.section}{formData.specialization !== "Core" ? ` (${formData.specialization})` : ""})</strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Save Class to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT CLASS */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">Edit Academic Class</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Course
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.course}
                  onChange={(e) => setEditFormData({ ...editFormData, course: e.target.value })}
                  placeholder="e.g. B.Tech CSE"
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Semester
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.semester}
                    onChange={(e) => setEditFormData({ ...editFormData, semester: e.target.value })}
                    placeholder="e.g. 3rd Sem"
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.year}
                    onChange={(e) => setEditFormData({ ...editFormData, year: e.target.value })}
                    placeholder="e.g. 2nd Year"
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Section Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.section}
                    onChange={(e) => setEditFormData({ ...editFormData, section: e.target.value.toUpperCase() })}
                    placeholder="e.g. A, B, C"
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={editFormData.specialization}
                    onChange={(e) => setEditFormData({ ...editFormData, specialization: e.target.value })}
                    placeholder="e.g. Core, AIML, CS"
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ALLOCATE TEACHER TO CLASS */}
      {isAllocateTeacherModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-green-500" />
                <h3 className="font-black text-base text-gray-900 dark:text-white">
                  Allocate Faculty to {selectedClass.name}
                </h3>
              </div>
              <button
                onClick={() => setIsAllocateTeacherModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleAllocateTeacher} className="space-y-4">
              <div>
                <SearchableDropdown
                  label="Select Faculty / Teacher"
                  placeholder="Search and select faculty member..."
                  searchPlaceholder="Search by teacher name or email..."
                  required
                  options={teacherOptions}
                  value={selectedTeacherToAllocate}
                  onChange={(val) => setSelectedTeacherToAllocate(val)}
                />
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="primaryAdvisorCheck"
                  checked={isPrimaryTeacher}
                  onChange={(e) => setIsPrimaryTeacher(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="primaryAdvisorCheck" className="text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                  Designate as Primary Class Advisor
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAllocateTeacherModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedTeacherToAllocate || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-500 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Allocating..." : "Allocate Teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
