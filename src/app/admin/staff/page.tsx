"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { Staff, Student, UserRole } from "@/lib/types";
import { Users, ShieldCheck, Plus, CheckCircle2, AlertTriangle, Key, UserCheck, ArrowRightLeft, Shield, Mail } from "lucide-react";

export default function StaffAndRBACManagementPage() {
  const [staff, setStaff] = useState(store.getStaff());
  const [students, setStudents] = useState(store.getStudents());
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"STAFF" | "CONVERT_ROLES">("STAFF");

  const [newStaff, setNewStaff] = useState({
    fullName: "",
    email: "",
    phone: "+91 98765 43210",
    employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
    role: "driver" as "driver" | "conductor" | "supervisor" | "admin",
    category: "CAMPUS_OPERATIONS",
    rank: "SENIOR_OPERATOR",
    permissions: ["VIEW_ASSIGNED_TRIP", "START_TRIP", "BROADCAST_GPS_LOCATION"],
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setStaff(store.getStaff());
      setStudents(store.getStudents());
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.fullName || !newStaff.email) {
      alert("Please fill full name and email");
      return;
    }

    const category = newStaff.role === "driver" ? "DRIVERS" : newStaff.role === "conductor" ? "CONDUCTORS" : "TRANSPORT_OPS";

    const createdStaff: Staff = {
      id: `st-${Date.now()}`,
      userId: `u-${Date.now()}`,
      employeeCode: newStaff.employeeCode,
      fullName: newStaff.fullName,
      email: newStaff.email,
      phone: newStaff.phone,
      role: newStaff.role,
      category,
      rank: "SENIOR",
      isActive: true,
      permissions:
        newStaff.role === "driver"
          ? ["VIEW_ASSIGNED_TRIP", "START_TRIP", "BROADCAST_GPS_LOCATION", "REPORT_INCIDENT"]
          : ["VIEW_ASSIGNED_TRIP", "SCAN_QR_BOARDING_PASS", "VERIFY_BIOMETRIC_TOKEN", "MANUAL_ATTENDANCE_OVERRIDE"],
    };

    // Update staff in store
    const updated = [...staff, createdStaff];
    (store as any).staff = updated;
    (store as any).notify();

    setIsAddStaffOpen(false);
    setNewStaff({
      fullName: "",
      email: "",
      phone: "+91 98765 43210",
      employeeCode: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      role: "driver",
      category: "DRIVERS",
      rank: "REGULAR",
      permissions: ["VIEW_ASSIGNED_TRIP", "START_TRIP", "BROADCAST_GPS_LOCATION"],
    });
    alert(`Successfully registered ${createdStaff.fullName} as ${createdStaff.role.toUpperCase()}!`);
  };

  const handleConvertStudentToStaff = (student: Student, targetRole: "driver" | "conductor") => {
    if (confirm(`Convert ${student.fullName} (${student.email}) from Student to Staff (${targetRole.toUpperCase()})?`)) {
      const newStaffMember: Staff = {
        id: `st-${Date.now()}`,
        userId: student.userId,
        employeeCode: `EMP-${student.enrollmentNo.slice(-3)}`,
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
        role: targetRole,
        category: targetRole === "driver" ? "DRIVERS" : "CONDUCTORS",
        rank: "REGULAR",
        isActive: true,
        permissions:
          targetRole === "driver"
            ? ["VIEW_ASSIGNED_TRIP", "START_TRIP", "BROADCAST_GPS_LOCATION"]
            : ["VIEW_ASSIGNED_TRIP", "SCAN_QR_BOARDING_PASS", "VERIFY_BIOMETRIC_TOKEN"],
      };

      (store as any).staff = [...staff, newStaffMember];
      (store as any).notify();
      alert(`${student.fullName} has been granted Staff (${targetRole.toUpperCase()}) permissions!`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-600" />
            Staff Registry & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage drivers, conductors, admin roles, and convert users between Student and Staff accounts.
          </p>
        </div>

        <button
          onClick={() => setIsAddStaffOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          + Add Staff Member
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("STAFF")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "STAFF"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Active Staff Roster ({staff.length})
        </button>

        <button
          onClick={() => setActiveTab("CONVERT_ROLES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "CONVERT_ROLES"
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Convert User Roles ({students.length} Students)
        </button>
      </div>

      {/* TAB 1: Staff Grid Cards */}
      {activeTab === "STAFF" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map(member => (
            <div
              key={member.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-blue-500/60 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      {member.employeeCode}
                    </span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white mt-0.5">
                      {member.fullName}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      <span>{member.email}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-black uppercase tracking-wide">
                    {member.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Category</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{member.category}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Rank</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{member.rank}</div>
                  </div>
                </div>

                {/* Explicit Permissions Matrix */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Key className="w-3 h-3 text-amber-500" />
                    Granted RBAC Permissions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {member.permissions.map(perm => (
                      <span
                        key={perm}
                        className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-700 dark:text-slate-300 font-medium"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Convert Roles */}
      {activeTab === "CONVERT_ROLES" && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300">
            <strong>Institutional Administrator Action:</strong> You can convert registered students or users into Driver or Conductor staff roles so they can access the In-Cabin Driver Console or Conductor Manifest Desk.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(st => (
              <div
                key={st.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div>
                  <span className="text-[10px] font-mono text-slate-400">Roll: {st.enrollmentNo}</span>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{st.fullName}</h4>
                  <div className="text-xs text-slate-500">{st.email}</div>
                  <div className="text-[11px] text-slate-400 mt-1">{st.department} • Sem {st.semester}</div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <button
                    onClick={() => handleConvertStudentToStaff(st, "driver")}
                    className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-xl"
                  >
                    Make Driver
                  </button>
                  <button
                    onClick={() => handleConvertStudentToStaff(st, "conductor")}
                    className="flex-1 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 font-bold text-xs rounded-xl"
                  >
                    Make Conductor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateStaff}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 text-slate-900 dark:text-white shadow-2xl"
          >
            <h3 className="font-black text-lg">Register New Campus Staff</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Chand"
                  value={newStaff.fullName}
                  onChange={e => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Employee Code</label>
                  <input
                    type="text"
                    required
                    value={newStaff.employeeCode}
                    onChange={e => setNewStaff({ ...newStaff, employeeCode: e.target.value })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold uppercase tracking-wider text-slate-400">Assigned Role</label>
                  <select
                    value={newStaff.role}
                    onChange={e => setNewStaff({ ...newStaff, role: e.target.value as any })}
                    className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-bold"
                  >
                    <option value="driver">Driver</option>
                    <option value="conductor">Conductor</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="staff@campus.edu or gmail"
                  value={newStaff.email}
                  onChange={e => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-400">Phone Number</label>
                <input
                  type="tel"
                  value={newStaff.phone}
                  onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full p-2.5 mt-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                Save Staff Member
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
