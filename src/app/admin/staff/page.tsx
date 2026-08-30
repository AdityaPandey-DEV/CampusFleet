"use client";

import React, { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { UserAccount, UserRole } from "@/lib/types";
import {
  Users,
  ShieldCheck,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Mail,
  UserCheck,
  Shield,
  BusFront,
  GraduationCap,
  Sparkles,
  Phone,
  Building2,
  Key,
} from "lucide-react";

export default function UserAndRBACManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>(store.getUsers());
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    phone: "+91 98765 43210",
    role: "student" as UserRole,
    campus: "GEHU Bhimtal",
    provider: "Institutional SSO",
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setUsers(store.getUsers());
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, []);

  const adminCount = users.filter(u => u.role === "admin" || u.role === "transport_manager").length;
  const staffCount = users.filter(u => u.role === "conductor" || u.role === "supervisor").length;
  const driverCount = users.filter(u => u.role === "driver").length;
  const studentCount = users.filter(u => u.role === "student" || u.role === "parent").length;

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = async (userId: string, newRole: UserRole, userName: string) => {
    await store.updateUserRole(userId, newRole);
    setToastMessage(`Updated access level for ${userName} to ${newRole.toUpperCase()}`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.fullName || !newUser.email) {
      alert("Please enter full name and email");
      return;
    }

    const createdUser: UserAccount = {
      id: `usr-${Date.now()}`,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      campus: newUser.campus,
      provider: newUser.provider,
      createdAt: new Date().toISOString(),
    };

    // Update in store and supabase
    const updated = [createdUser, ...users];
    (store as any).users = updated;
    (store as any).notify();

    setIsAddUserOpen(false);
    setNewUser({
      fullName: "",
      email: "",
      phone: "+91 98765 43210",
      role: "student",
      campus: "GEHU Bhimtal",
      provider: "Institutional SSO",
    });
    setToastMessage(`Added new user ${createdUser.fullName} (${createdUser.role.toUpperCase()})`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
      case "transport_manager":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <Shield className="w-3.5 h-3.5" />
            Administrator
          </span>
        );
      case "driver":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
            <BusFront className="w-3.5 h-3.5" />
            Fleet Driver
          </span>
        );
      case "conductor":
      case "supervisor":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            Conductor / Staff
          </span>
        );
      case "parent":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <UserCheck className="w-3.5 h-3.5" />
            Guardian / Parent
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <GraduationCap className="w-3.5 h-3.5" />
            Student Commuter
          </span>
        );
    }
  };

  const getAvatarBg = (name: string, role: UserRole) => {
    if (role === "admin") return "bg-rose-500 text-white";
    if (role === "driver") return "bg-blue-600 text-white";
    if (role === "conductor") return "bg-purple-600 text-white";
    if (role === "parent") return "bg-amber-600 text-white";
    const colors = ["bg-emerald-500", "bg-teal-500", "bg-indigo-500", "bg-sky-500"];
    const charCode = name.charCodeAt(0) || 0;
    return `${colors[charCode % colors.length]} text-white`;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top 4 Summary Cards matching Image 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Administrator */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-1">
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
            {adminCount}
          </div>
          <div className="text-xs font-bold text-slate-500">Administrator</div>
        </div>

        {/* Transport Staff */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-1">
          <div className="text-3xl font-black text-purple-600 dark:text-purple-400">
            {staffCount}
          </div>
          <div className="text-xs font-bold text-slate-500">Conductor & Staff</div>
        </div>

        {/* Fleet Driver */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-1">
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
            {driverCount}
          </div>
          <div className="text-xs font-bold text-slate-500">Fleet Driver</div>
        </div>

        {/* Student Commuters */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-center space-y-1">
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {studentCount}
          </div>
          <div className="text-xs font-bold text-slate-500">Student Commuter</div>
        </div>
      </div>

      {/* Search & Filter Bar matching Image 2 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="admin">Administrator ({adminCount})</option>
            <option value="driver">Fleet Driver ({driverCount})</option>
            <option value="conductor">Conductor / Staff ({staffCount})</option>
            <option value="student">Student Commuter ({studentCount})</option>
            <option value="parent">Guardian / Parent</option>
          </select>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-emerald-600/20 whitespace-nowrap transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + Add User
          </button>
        </div>
      </div>

      {/* Main User Management Table matching Image 2 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[11px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">User Profile</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">Login Provider</th>
                <th className="py-4 px-6">Current Role</th>
                <th className="py-4 px-6 text-right">Modify Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No matching users found in the institutional registry.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const initials = user.fullName
                    .split(" ")
                    .map(n => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  const isCurrentUser = currentUser?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* USER PROFILE */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shadow-xs ${getAvatarBg(
                              user.fullName,
                              user.role
                            )}`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isCurrentUser && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{user.campus || "GEHU Bhimtal"}</div>
                          </div>
                        </div>
                      </td>

                      {/* EMAIL ADDRESS */}
                      <td className="py-4 px-6 font-mono text-slate-600 dark:text-slate-300">
                        {user.email}
                      </td>

                      {/* LOGIN PROVIDER */}
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[11px]">
                          {user.provider || "Google"}
                        </span>
                      </td>

                      {/* CURRENT ROLE */}
                      <td className="py-4 px-6">{getRoleBadge(user.role)}</td>

                      {/* MODIFY ACCESS DROPDOWN */}
                      <td className="py-4 px-6 text-right">
                        <select
                          value={user.role}
                          onChange={e =>
                            handleRoleChange(user.id, e.target.value as UserRole, user.fullName)
                          }
                          className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 outline-none cursor-pointer hover:border-blue-500 transition-colors"
                        >
                          <option value="student">Student</option>
                          <option value="driver">Fleet Driver</option>
                          <option value="conductor">Conductor</option>
                          <option value="parent">Guardian / Parent</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Add Institutional User
              </h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={newUser.fullName}
                  onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@gehu.ac.in"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none mt-1 cursor-pointer"
                  >
                    <option value="student">Student</option>
                    <option value="driver">Fleet Driver</option>
                    <option value="conductor">Conductor</option>
                    <option value="parent">Parent</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Campus
                  </label>
                  <select
                    value={newUser.campus}
                    onChange={e => setNewUser({ ...newUser, campus: e.target.value })}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none mt-1 cursor-pointer"
                  >
                    <option value="GEHU Bhimtal">GEHU Bhimtal</option>
                    <option value="GEHU Haldwani">GEHU Haldwani</option>
                    <option value="GEHU Dehradun">GEHU Dehradun</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-emerald-600/20"
                >
                  Register User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
