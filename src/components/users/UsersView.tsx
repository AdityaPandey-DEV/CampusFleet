"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { store } from "@/lib/store";
import { authService } from "@/lib/auth-service";
import { UserAccount, UserRole, Campus } from "@/lib/types";
import { getCardIcon } from "@/modules";
import {
  Users,
  Search,
  Plus,
  CheckCircle2,
  Shield,
  ShieldCheck,
} from "lucide-react";

export interface UsersViewProps {
  initialUsers?: UserAccount[];
  initialUser?: any;
}

interface DynamicRoleItem {
  key: string;
  name: string;
  shortLabel?: string;
  icon?: string;
  color?: string;
  gradient?: string;
  parentRoleKey?: string | null;
  hierarchyLevel?: number;
}

export default function UsersView({
  initialUsers = [],
  initialUser,
}: UsersViewProps = {}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserAccount[]>(initialUsers || []);
  const [currentUser, setCurrentUser] = useState(initialUser || store.getCurrentUser());
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>(() => store.getCampuses());
  const [availableRoles, setAvailableRoles] = useState<DynamicRoleItem[]>([]);

  const [newUser, setNewUser] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "student" as UserRole,
    campus: store.getPrimaryCampus()?.name || "Main Campus",
    campusId: store.getPrimaryCampus()?.id || "",
    provider: "Institutional SSO",
  });

  // Fetch all roles dynamically from database
  useEffect(() => {
    fetch("/api/rbac/roles")
      .then((r) => r.json())
      .then((data) => {
        if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
          setAvailableRoles(
            data.roles.map((r: any) => ({
              key: r.key,
              name: r.name,
              shortLabel: r.shortLabel || r.name,
              icon: r.icon || "ShieldCheck",
              color: r.color || "text-blue-500",
              gradient: r.gradient || "bg-blue-600",
              parentRoleKey: r.parentRoleKey || null,
              hierarchyLevel: r.hierarchyLevel || 1,
            }))
          );
        }
      })
      .catch((err) => console.error("Failed to load roles from DB:", err));
  }, []);

  useEffect(() => {
    if (initialUsers && initialUsers.length > 0) {
      setUsers(initialUsers);
    }
  }, [initialUsers]);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      if (!initialUsers || initialUsers.length === 0) {
        setUsers(store.getUsers());
      }
      setCurrentUser(store.getCurrentUser());
    });
    return unsub;
  }, [initialUsers]);

  // Compute live member counts dynamically for each role
  const roleCounts: Record<string, number> = {};
  for (const u of users) {
    const rKey = (u.role || "student") as string;
    roleCounts[rKey] = (roleCounts[rKey] || 0) + 1;
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = async (userId: string, newRole: UserRole, userName: string) => {
    setUpdatingUserId(userId);
    const previousUsers = [...users];

    // Optimistic UI update
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

    try {
      const res = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update role in database");
      }

      // Update store local state
      store.updateUserRoleLocal(userId, newRole);

      // If the admin is modifying their own role, update authService immediately
      const currentAuthUser = authService.getCurrentUser();
      const targetUser = users.find((u) => u.id === userId);
      if (
        currentAuthUser &&
        (currentAuthUser.id === userId ||
          (targetUser?.email && currentAuthUser.email.toLowerCase() === targetUser.email.toLowerCase()))
      ) {
        authService.updateUserRoleLocal(newRole);
      }

      const roleName = availableRoles.find((r) => r.key === newRole)?.name || String(newRole).toUpperCase();
      setToastMessage(`✓ ${userName}'s access updated to ${roleName}`);
      setTimeout(() => setToastMessage(null), 3500);

      // Re-fetch fresh user list
      router.refresh();

      try {
        const usersRes = await fetch("/api/admin/users", { credentials: "include" });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          if (usersData.users && Array.isArray(usersData.users)) {
            setUsers(usersData.users);
          }
        }
      } catch {
        // Non-fatal
      }
    } catch (e: any) {
      console.error("Failed to update role via API:", e);
      setUsers(previousUsers);
      alert(`Could not update access level: ${e.message || "Network error"}`);
    } finally {
      setUpdatingUserId(null);
    }
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

    // Update in store
    const updated = [createdUser, ...users];
    (store as any).users = updated;
    (store as any).notify();

    setIsAddUserOpen(false);
    setNewUser({
      fullName: "",
      email: "",
      phone: "+91 98765 43210",
      role: "student",
      campus: store.getPrimaryCampus()?.name || "Main Campus",
      campusId: store.getPrimaryCampus()?.id || "",
      provider: "Institutional SSO",
    });

    const roleName = availableRoles.find((r) => r.key === createdUser.role)?.name || String(createdUser.role);
    setToastMessage(`Added new user ${createdUser.fullName} (${roleName})`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getRoleBadge = (roleKey: UserRole) => {
    const roleDef = availableRoles.find((r) => r.key === roleKey);
    if (roleDef) {
      const Icon = getCardIcon(roleDef.icon || "ShieldCheck");
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
          <Icon className="w-3.5 h-3.5 text-blue-500" />
          {roleDef.name}
        </span>
      );
    }

    // Fallback if roles are still loading
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
        <ShieldCheck className="w-3.5 h-3.5" />
        {String(roleKey).replace(/_/g, " ")}
      </span>
    );
  };

  const getAvatarBg = (name: string, roleKey: UserRole) => {
    const roleDef = availableRoles.find((r) => r.key === roleKey);
    if (roleDef && roleDef.gradient) {
      return `${roleDef.gradient} text-white`;
    }
    const colors = ["bg-blue-600", "bg-emerald-600", "bg-purple-600", "bg-amber-600", "bg-pink-600"];
    const charCode = name.charCodeAt(0) || 0;
    return `${colors[charCode % colors.length]} text-white`;
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-gray-900 dark:bg-gray-800 text-white border border-gray-700 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Dynamic Summary Cards for all Database Roles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {availableRoles.map((role) => (
          <div
            key={role.key}
            onClick={() => setRoleFilter(roleFilter === role.key ? "ALL" : role.key)}
            className={`rounded-3xl p-3 border shadow-sm flex flex-col items-center justify-center text-center space-y-1 cursor-pointer transition-all ${
              roleFilter === role.key
                ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 scale-102"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
          >
            <div className={`text-2xl font-black ${role.color || "text-blue-600 dark:text-blue-400"}`}>
              {roleCounts[role.key] || 0}
            </div>
            <div className="text-[11px] font-bold text-gray-500 dark:text-gray-400 truncate max-w-full" title={role.name}>
              {role.shortLabel || role.name}
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none focus:border-blue-500 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Dynamic Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
          >
            <option value="ALL">All Roles ({users.length})</option>
            {availableRoles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name} ({roleCounts[r.key] || 0})
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsAddUserOpen(true)}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-green-600/20 whitespace-nowrap transition-transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + Add User
          </button>
        </div>
      </div>

      {/* Main User Management Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 text-[11px] font-black uppercase tracking-wider text-gray-400">
                <th className="py-4 px-6">User Profile</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">Login Provider</th>
                <th className="py-4 px-6">Current Role</th>
                <th className="py-4 px-6 text-right">Modify Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    No matching users found in the institutional registry.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = user.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  const isCurrentUser = currentUser?.id === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
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
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isCurrentUser && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {user.campus || store.getPrimaryCampus()?.name || "Campus Terminal"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* EMAIL ADDRESS */}
                      <td className="py-4 px-6 font-mono text-gray-600 dark:text-gray-300">
                        {user.email}
                      </td>

                      {/* LOGIN PROVIDER */}
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-[11px]">
                          {user.provider || "Google"}
                        </span>
                      </td>

                      {/* CURRENT ROLE */}
                      <td className="py-4 px-6">{getRoleBadge(user.role)}</td>

                      {/* MODIFY ACCESS DROPDOWN (100% Dynamic Database Roles) */}
                      <td className="py-4 px-6 text-right">
                        <select
                          disabled={updatingUserId === user.id}
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value as UserRole, user.fullName)
                          }
                          className="px-3 py-1.5 text-xs font-bold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-gray-200 outline-none cursor-pointer hover:border-blue-500 transition-colors disabled:opacity-50"
                        >
                          {availableRoles.length > 0 ? (
                            availableRoles.map((r) => (
                              <option key={r.key} value={r.key}>
                                {r.name}
                              </option>
                            ))
                          ) : (
                            <option value={user.role}>{String(user.role)}</option>
                          )}
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
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                Add Institutional User
              </h3>
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. name@gehu.ac.in"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Role
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none mt-1 cursor-pointer"
                  >
                    {availableRoles.length > 0 ? (
                      availableRoles.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))
                    ) : (
                      <option value="student">Student</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Campus
                  </label>
                  <select
                    value={newUser.campus}
                    onChange={(e) => {
                      const c = campuses.find((camp) => camp.name === e.target.value || camp.id === e.target.value);
                      setNewUser({ ...newUser, campus: c?.name || e.target.value, campusId: c?.id || "" });
                    }}
                    className="w-full text-xs p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl outline-none mt-1 cursor-pointer"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.isPrimary ? "(Primary)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-2xl shadow-md shadow-green-600/20"
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
