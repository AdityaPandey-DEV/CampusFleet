"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ShieldCheck,
  GitFork,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Layers,
  ArrowRight
} from "lucide-react";
import type { SystemCard, SystemRoleDefinition } from "@/lib/types";
import { getCardIcon } from "@/modules";

interface RoleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  allRoles: SystemRoleDefinition[];
  allCards: SystemCard[];
  roleToEdit?: SystemRoleDefinition | null;
  defaultParentRoleKey?: string | null;
}

export default function RoleEditorModal({
  isOpen,
  onClose,
  onSaved,
  allRoles,
  allCards,
  roleToEdit,
  defaultParentRoleKey,
}: RoleEditorModalProps) {
  const isEditing = Boolean(roleToEdit);

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [shortLabel, setShortLabel] = useState("");
  const [portalPath, setPortalPath] = useState("/transport-admin");
  const [icon, setIcon] = useState("ShieldCheck");
  const [description, setDescription] = useState("");
  const [parentRoleKey, setParentRoleKey] = useState<string | null>(null);
  const [directCards, setDirectCards] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roleToEdit) {
      setKey(roleToEdit.key);
      setName(roleToEdit.name);
      setShortLabel(roleToEdit.shortLabel || roleToEdit.name);
      setPortalPath(roleToEdit.portalPath || "/transport-admin");
      setIcon(roleToEdit.icon || "ShieldCheck");
      setDescription(roleToEdit.description || "");
      setParentRoleKey(roleToEdit.parentRoleKey || null);
      setDirectCards(roleToEdit.directCards || []);
    } else {
      setKey("");
      setName("");
      setShortLabel("");
      setPortalPath("/transport-admin");
      setIcon("ShieldCheck");
      setDescription("");
      setParentRoleKey(defaultParentRoleKey || "transport_admin");
      setDirectCards([]);
    }
    setError(null);
  }, [roleToEdit, defaultParentRoleKey, isOpen]);

  // Group cards by category
  const categories = useMemo(() => {
    const cats: Record<string, SystemCard[]> = {};
    for (const card of allCards) {
      const cat = card.category || "General";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(card);
    }
    return cats;
  }, [allCards]);

  // Compute what cards this role would inherit from descendant roles
  const inheritedCardsPreview = useMemo(() => {
    if (!roleToEdit) return [];
    return roleToEdit.inheritedCards || [];
  }, [roleToEdit]);

  const toggleCard = (cardKey: string) => {
    setDirectCards((prev) =>
      prev.includes(cardKey) ? prev.filter((k) => k !== cardKey) : [...prev, cardKey]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isEditing) {
        const res = await fetch(`/api/rbac/roles/${roleToEdit!.key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            parentRoleKey: parentRoleKey || null,
            portalPath,
            shortLabel: shortLabel || name,
            icon,
            directCards,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update role");
      } else {
        const res = await fetch("/api/rbac/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            name,
            description,
            parentRoleKey: parentRoleKey || null,
            portalPath,
            shortLabel: shortLabel || name,
            icon,
            directCards,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create role");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!roleToEdit || roleToEdit.isSystem) return;
    if (!confirm(`Are you sure you want to delete role "${roleToEdit.name}"? Users with this role will lose their custom desk access.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/rbac/roles/${roleToEdit.key}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete role");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete role");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter out current role from parent choices to prevent self-parenting
  const validParentOptions = allRoles.filter(
    (r) => !roleToEdit || (r.key !== roleToEdit.key && r.parentRoleKey !== roleToEdit.key)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {isEditing ? `Edit Role: ${roleToEdit?.name}` : "Create New Role"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isEditing
                  ? "Configure role name, hierarchy parent, and direct functional cards."
                  : "Define a new custom staff role with dedicated desk capabilities."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-300 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Key and Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!isEditing && !key) {
                    setKey(
                      e.target.value
                        .toLowerCase()
                        .trim()
                        .replace(/[^a-z0-9]/g, "_")
                    );
                  }
                }}
                placeholder="e.g. Workshop Supervisor"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                System Identifier (Key) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isEditing}
                value={key}
                onChange={(e) =>
                  setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                }
                placeholder="e.g. workshop_supervisor"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-60"
              />
            </div>
          </div>

          {/* Parent Role (Hierarchy Flowchart Link) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Reports To / Inherits From (Hierarchy Parent)
            </label>
            <div className="relative">
              <select
                value={parentRoleKey || ""}
                disabled={roleToEdit?.key === "admin"}
                onChange={(e) => setParentRoleKey(e.target.value || null)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
              >
                <option value="">(None - Top Level or Standalone)</option>
                {validParentOptions.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name} ({r.key})
                  </option>
                ))}
              </select>
              <GitFork className="w-4 h-4 text-gray-400 absolute right-4 top-3.5 pointer-events-none" />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
              The selected parent role will automatically inherit all functionality cards of this role.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Role Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What duties and permissions are associated with this role?"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Portal Presentation: Path & Icon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Portal Landing Route
              </label>
              <input
                type="text"
                value={portalPath}
                onChange={(e) => setPortalPath(e.target.value)}
                placeholder="/transport-admin"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                Header Icon
              </label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm appearance-none"
              >
                <option value="ShieldCheck">ShieldCheck</option>
                <option value="Building2">Building2</option>
                <option value="Compass">Compass</option>
                <option value="Wrench">Wrench</option>
                <option value="Navigation">Navigation</option>
                <option value="BusFront">BusFront</option>
                <option value="FileText">FileText</option>
                <option value="Users">Users</option>
                <option value="CreditCard">CreditCard</option>
                <option value="GraduationCap">GraduationCap</option>
                <option value="BookOpen">BookOpen</option>
              </select>
            </div>
          </div>

          {/* Direct Functional Cards Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Assign Functional Cards (Direct Desk Capabilities)
              </label>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {directCards.length} selected
              </span>
            </div>

            <div className="space-y-4">
              {Object.entries(categories).map(([category, cards]) => (
                <div
                  key={category}
                  className="p-3.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-2xl space-y-2.5"
                >
                  <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cards.map((card) => {
                      const isChecked = directCards.includes(card.key);
                      const isInherited = inheritedCardsPreview.includes(card.key);
                      const IconComp = getCardIcon(card.icon);

                      return (
                        <button
                          type="button"
                          key={card.key}
                          onClick={() => toggleCard(card.key)}
                          className={`flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all ${
                            isChecked
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-sm"
                              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                          }`}
                        >
                          <div
                            className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isChecked
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold truncate">
                                {card.title}
                              </span>
                              {isChecked && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              )}
                              {!isChecked && isInherited && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                  Inherited
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                              {card.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            {isEditing && !roleToEdit?.isSystem && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Role</span>
              </button>
            )}
            {roleToEdit?.isSystem && (
              <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Built-in System Role
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-60"
            >
              {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Create Role"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
