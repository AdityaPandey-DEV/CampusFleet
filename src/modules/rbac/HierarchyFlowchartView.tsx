"use client";

import React, { useState, useMemo } from "react";
import {
  GitFork,
  ShieldCheck,
  Plus,
  Users,
  Search,
  ChevronRight,
  ArrowDown,
  Layers,
  Settings2,
  Lock,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
  LayoutGrid
} from "lucide-react";
import type { SystemCard, SystemRoleDefinition } from "@/lib/types";
import { getCardIcon } from "@/modules";
import RoleEditorModal from "./RoleEditorModal";

interface HierarchyFlowchartViewProps {
  initialRoles: SystemRoleDefinition[];
  initialCards: SystemCard[];
}

export default function HierarchyFlowchartView({
  initialRoles,
  initialCards,
}: HierarchyFlowchartViewProps) {
  const [roles, setRoles] = useState<SystemRoleDefinition[]>(initialRoles);
  const [cards] = useState<SystemCard[]>(initialCards);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"flowchart" | "grid">("flowchart");
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<SystemRoleDefinition | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [defaultParentForNew, setDefaultParentForNew] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Map card keys to full card objects for fast lookup
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);

  const refreshRoles = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/rbac/roles");
      if (res.ok) {
        const data = await res.json();
        if (data.roles) setRoles(data.roles);
      }
    } catch (err) {
      console.error("Failed to refresh roles:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateNewRole = (parentKey?: string) => {
    setSelectedRoleForEdit(null);
    setDefaultParentForNew(parentKey || "transport_admin");
    setIsEditorOpen(true);
  };

  const handleEditRole = (role: SystemRoleDefinition) => {
    setSelectedRoleForEdit(role);
    setIsEditorOpen(true);
  };

  // Build tree structure for flowchart
  const { rootRoles, childMap } = useMemo(() => {
    const cMap: Record<string, SystemRoleDefinition[]> = {};
    const roots: SystemRoleDefinition[] = [];

    for (const r of roles) {
      if (!r.parentRoleKey) {
        roots.push(r);
      } else {
        if (!cMap[r.parentRoleKey]) cMap[r.parentRoleKey] = [];
        cMap[r.parentRoleKey].push(r);
      }
    }
    return { rootRoles: roots, childMap: cMap };
  }, [roles]);

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full w-fit text-xs font-bold uppercase tracking-wider mb-3">
              <GitFork className="w-3.5 h-3.5" />
              <span>Hierarchical Access Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Role & Capability Hierarchy Studio
            </h1>
            <p className="text-blue-100 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Higher-tier roles automatically inherit all functional cards from subordinate roles below them. Configure roles, manage reporting paths, and grant desk capabilities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refreshRoles()}
              disabled={isRefreshing}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition flex items-center justify-center disabled:opacity-50"
              title="Refresh tree data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => handleCreateNewRole()}
              className="flex items-center gap-2 px-5 py-3 bg-white text-blue-600 hover:bg-blue-50 rounded-2xl font-bold text-sm transition shadow-lg shadow-black/10 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Role</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/20">
          <div>
            <div className="text-xs text-blue-200 uppercase font-semibold">Total Roles</div>
            <div className="text-2xl font-black mt-0.5">{roles.length}</div>
          </div>
          <div>
            <div className="text-xs text-blue-200 uppercase font-semibold">System Cards</div>
            <div className="text-2xl font-black mt-0.5">{cards.length}</div>
          </div>
          <div>
            <div className="text-xs text-blue-200 uppercase font-semibold">Inherited Links</div>
            <div className="text-2xl font-black mt-0.5">
              {roles.filter((r) => (r.inheritedCards?.length || 0) > 0).length}
            </div>
          </div>
          <div>
            <div className="text-xs text-blue-200 uppercase font-semibold">Custom Roles</div>
            <div className="text-2xl font-black mt-0.5">
              {roles.filter((r) => !r.isSystem).length}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search & View Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roles or capabilities..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center">
            <button
              onClick={() => setViewMode("flowchart")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === "flowchart"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Flowchart Tree</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === "grid"
                  ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid View</span>
            </button>
          </div>
        </div>
      </div>

      {/* View 1: Interactive Flowchart Tree */}
      {viewMode === "flowchart" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-10 shadow-sm overflow-x-auto">
          <div className="min-w-[700px] flex flex-col items-center space-y-8">
            {rootRoles.map((root) => (
              <FlowNode
                key={root.key}
                role={root}
                childMap={childMap}
                cardMap={cardMap}
                onEdit={handleEditRole}
                onAddSubordinate={handleCreateNewRole}
              />
            ))}
          </div>
        </div>
      )}

      {/* View 2: Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoles.map((role) => (
            <RoleCardItem
              key={role.key}
              role={role}
              cardMap={cardMap}
              onEdit={handleEditRole}
              onAddSubordinate={handleCreateNewRole}
            />
          ))}
        </div>
      )}

      {/* Role Editor Modal */}
      <RoleEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSaved={refreshRoles}
        allRoles={roles}
        allCards={cards}
        roleToEdit={selectedRoleForEdit}
        defaultParentRoleKey={defaultParentForNew}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flowchart Node Component (Recursive Tree Rendering)
// ─────────────────────────────────────────────────────────────────────────────

function FlowNode({
  role,
  childMap,
  cardMap,
  onEdit,
  onAddSubordinate,
}: {
  role: SystemRoleDefinition;
  childMap: Record<string, SystemRoleDefinition[]>;
  cardMap: Map<string, SystemCard>;
  onEdit: (r: SystemRoleDefinition) => void;
  onAddSubordinate: (parentKey: string) => void;
}) {
  const children = childMap[role.key] || [];

  return (
    <div className="flex flex-col items-center w-full">
      {/* Node Card */}
      <div className="relative group w-full max-w-md bg-white dark:bg-gray-850 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {role.name}
                </h3>
                {role.isSystem ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500">
                    System
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                    Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                key: <code className="text-blue-600 dark:text-blue-400">{role.key}</code>
                {role.memberCount !== undefined && ` • ${role.memberCount} users`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(role)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Edit Role & Cards"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cards Summary */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {role.directCards.length} Direct Cards
            </span>
            {(role.inheritedCards?.length || 0) > 0 && (
              <span className="text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full text-[10px]">
                +{role.inheritedCards?.length} Inherited
              </span>
            )}
          </div>

          <button
            onClick={() => onAddSubordinate(role.key)}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Add Subordinate</span>
          </button>
        </div>
      </div>

      {/* Downward Connector Arrow */}
      {children.length > 0 && (
        <div className="flex flex-col items-center my-3">
          <div className="w-0.5 h-6 bg-blue-300 dark:bg-blue-700" />
          <ArrowDown className="w-4 h-4 text-blue-500 -mt-1" />
        </div>
      )}

      {/* Children Nodes in Horizontal Split */}
      {children.length > 0 && (
        <div className="w-full flex items-start justify-center gap-6 pt-2">
          {children.map((child) => (
            <FlowNode
              key={child.key}
              role={child}
              childMap={childMap}
              cardMap={cardMap}
              onEdit={onEdit}
              onAddSubordinate={onAddSubordinate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid View Role Card Item
// ─────────────────────────────────────────────────────────────────────────────

function RoleCardItem({
  role,
  cardMap,
  onEdit,
  onAddSubordinate,
}: {
  role: SystemRoleDefinition;
  cardMap: Map<string, SystemCard>;
  onEdit: (r: SystemRoleDefinition) => void;
  onAddSubordinate: (parentKey: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {role.name}
                </h3>
                {role.isSystem && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500">
                    System
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                key: <code className="text-blue-600 dark:text-blue-400">{role.key}</code>
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">
          {role.description || "No description provided."}
        </p>

        {/* Parent Role */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-1.5 text-xs text-gray-500">
          <GitFork className="w-3.5 h-3.5 text-gray-400" />
          <span>Reports to:</span>
          <span className="font-bold text-gray-800 dark:text-gray-200">
            {role.parentRoleKey || "(Root / Independent)"}
          </span>
        </div>

        {/* Direct Cards Chips */}
        <div className="mt-3">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            Direct Cards ({role.directCards.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {role.directCards.length === 0 ? (
              <span className="text-xs text-gray-400 italic">None directly assigned</span>
            ) : (
              role.directCards.map((cardKey) => {
                const card = cardMap.get(cardKey);
                return (
                  <span
                    key={cardKey}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60"
                  >
                    {card?.title || cardKey}
                  </span>
                );
              })
            )}
          </div>
        </div>

        {/* Inherited Cards Chips */}
        {(role.inheritedCards?.length || 0) > 0 && (
          <div className="mt-3">
            <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
              Inherited from Subordinates ({role.inheritedCards?.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {role.inheritedCards?.map((cardKey) => {
                const card = cardMap.get(cardKey);
                return (
                  <span
                    key={cardKey}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60"
                  >
                    {card?.title || cardKey}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <button
          onClick={() => onAddSubordinate(role.key)}
          className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Subordinate</span>
        </button>

        <button
          onClick={() => onEdit(role)}
          className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Edit Cards</span>
        </button>
      </div>
    </div>
  );
}
