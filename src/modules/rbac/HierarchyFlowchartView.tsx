"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  FileText,
  ShieldCheck,
  Plus,
  Users,
  Search,
  ArrowDown,
  ArrowRight,
  Layers,
  Settings2,
  Lock,
  Sparkles,
  Info,
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  GitFork,
  ExternalLink,
  SlidersHorizontal,
  Eye,
  CornerDownRight,
  BookOpen,
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
  const [viewMode, setViewMode] = useState<"tree" | "flowchart" | "grid">("tree");
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<SystemRoleDefinition | null>(null);
  const [inspectedRoleKey, setInspectedRoleKey] = useState<string | null>("admin");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [defaultParentForNew, setDefaultParentForNew] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set of expanded role keys in the folder tree (all open by default)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    return new Set(initialRoles.map((r) => r.key));
  });

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
    setDefaultParentForNew(parentKey || "admin");
    setIsEditorOpen(true);
  };

  const handleEditRole = (role: SystemRoleDefinition) => {
    setSelectedRoleForEdit(role);
    setIsEditorOpen(true);
  };

  // Build tree structure for both Tree & Flowchart views
  const { rootRoles, managementRoots, operationalRoles, childMap } = useMemo(() => {
    const cMap: Record<string, SystemRoleDefinition[]> = {};
    const roots: SystemRoleDefinition[] = [];
    const mgmtRoots: SystemRoleDefinition[] = [];
    const opRoles: SystemRoleDefinition[] = [];

    // Sort by hierarchyLevel ascending so Level 1 appears first
    const sorted = [...roles].sort((a, b) => (a.hierarchyLevel || 99) - (b.hierarchyLevel || 99));

    for (const r of sorted) {
      if (r.parentRoleKey) {
        if (!cMap[r.parentRoleKey]) cMap[r.parentRoleKey] = [];
        cMap[r.parentRoleKey].push(r);
      }
    }

    for (const r of sorted) {
      if (!r.parentRoleKey) {
        roots.push(r);
        // Management root: Super Admin or any role with subordinates/cards
        if (r.key === "admin" || (cMap[r.key] && cMap[r.key].length > 0)) {
          mgmtRoots.push(r);
        } else {
          opRoles.push(r);
        }
      }
    }

    return { rootRoles: roots, managementRoots: mgmtRoots, operationalRoles: opRoles, childMap: cMap };
  }, [roles]);

  // Filtered roles for search
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.directCards || []).some((c) => c.toLowerCase().includes(q))
    );
  }, [roles, searchQuery]);

  // Expand / Collapse Toggles
  const toggleExpand = (roleKey: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(roleKey)) {
        next.delete(roleKey);
      } else {
        next.add(roleKey);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(roles.map((r) => r.key)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  // Inspected role for the right-side detail drawer
  const inspectedRole = useMemo(() => {
    if (!inspectedRoleKey) return roles.find((r) => r.key === "admin") || roles[0] || null;
    return roles.find((r) => r.key === inspectedRoleKey) || roles[0] || null;
  }, [roles, inspectedRoleKey]);

  // Compute reporting chain breadcrumb for inspected role
  const reportingLineage = useMemo(() => {
    if (!inspectedRole) return [];
    const chain: SystemRoleDefinition[] = [];
    let currKey: string | null = inspectedRole.key;
    const visited = new Set<string>();

    while (currKey && !visited.has(currKey)) {
      visited.add(currKey);
      const r = roles.find((item) => item.key === currKey);
      if (!r) break;
      chain.unshift(r);
      currKey = r.parentRoleKey || null;
    }
    return chain;
  }, [roles, inspectedRole]);

  // Multi-branch stats
  const multiBranchCount = useMemo(() => {
    return Object.values(childMap).filter((children) => children.length > 1).length;
  }, [childMap]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full w-fit text-xs font-bold uppercase tracking-wider mb-3">
              <Folder className="w-3.5 h-3.5" />
              <span>Hierarchical Directory & RBAC Studio</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Role & Capability Hierarchy Studio
            </h1>
            <p className="text-blue-100 text-sm mt-1.5 max-w-2xl leading-relaxed">
              Organized in a multi-child folder directory. Higher-tier roles automatically inherit all functional cards from subordinate roles underneath them.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refreshRoles()}
              disabled={isRefreshing}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-white transition flex items-center justify-center disabled:opacity-50"
              title="Refresh hierarchy tree"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => handleCreateNewRole("admin")}
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
            <div className="text-xs text-blue-200 uppercase font-semibold">Multi-Child Branches</div>
            <div className="text-2xl font-black mt-0.5">{multiBranchCount} Active</div>
          </div>
          <div>
            <div className="text-xs text-blue-200 uppercase font-semibold">Custom Roles</div>
            <div className="text-2xl font-black mt-0.5">
              {roles.filter((r) => !r.isSystem).length}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Expand All, and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
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

          {viewMode === "tree" && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={expandAll}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
                title="Expand all branches"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </button>
              <button
                onClick={collapseAll}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
                title="Collapse all branches"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </button>
            </div>
          )}
        </div>

        {/* 3-Way View Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl self-end sm:self-auto">
          <button
            onClick={() => setViewMode("tree")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              viewMode === "tree"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Folder Tree</span>
          </button>
          <button
            onClick={() => setViewMode("flowchart")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              viewMode === "flowchart"
                ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>Flowchart</span>
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
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: FOLDER-BASED DIRECTORY TREE (Default & Recommended) */}
      {viewMode === "tree" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Folder Directory Tree (Left 7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-6">
            {/* Section 1: Management Hierarchy */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Institutional Management Hierarchy (RBAC)
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  Downward Card Inheritance
                </span>
              </div>

              <div className="space-y-2">
                {managementRoots.map((root) => (
                  <FolderTreeNode
                    key={root.key}
                    role={root}
                    childMap={childMap}
                    cardMap={cardMap}
                    depth={0}
                    expandedKeys={expandedKeys}
                    onToggleExpand={toggleExpand}
                    inspectedRoleKey={inspectedRole?.key || null}
                    onSelectInspect={(key) => setInspectedRoleKey(key)}
                    onEdit={handleEditRole}
                    onAddSubordinate={handleCreateNewRole}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            </div>

            {/* Section 2: Field Operations & Campus Portals */}
            {operationalRoles.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      Field Operations & Campus Portals
                    </h2>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Independent Specialized Workflows
                  </span>
                </div>

                <div className="space-y-2">
                  {operationalRoles.map((role) => (
                    <FolderTreeNode
                      key={role.key}
                      role={role}
                      childMap={childMap}
                      cardMap={cardMap}
                      depth={0}
                      expandedKeys={expandedKeys}
                      onToggleExpand={toggleExpand}
                      inspectedRoleKey={inspectedRole?.key || null}
                      onSelectInspect={(key) => setInspectedRoleKey(key)}
                      onEdit={handleEditRole}
                      onAddSubordinate={handleCreateNewRole}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Sticky Capability & Reporting Lineage Inspector */}
          <div className="lg:col-span-5 sticky top-20">
            {inspectedRole ? (
              <RoleInspectorCard
                role={inspectedRole}
                cardMap={cardMap}
                reportingLineage={reportingLineage}
                childRoles={childMap[inspectedRole.key] || []}
                onSelectRole={(key) => setInspectedRoleKey(key)}
                onEdit={handleEditRole}
                onAddSubordinate={handleCreateNewRole}
              />
            ) : (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 text-center text-gray-400 text-sm">
                Select a role from the tree to view reporting lineage and capabilities.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: FLOWCHART TREE (Canvas View) */}
      {viewMode === "flowchart" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-10 shadow-sm overflow-x-auto">
            <div className="text-xs font-black uppercase text-gray-400 mb-6 tracking-wider">
              Management Reporting Hierarchy Canvas
            </div>
            <div className="min-w-[760px] flex flex-col items-center space-y-8">
              {managementRoots.map((root) => (
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

          {/* Operational Roles Dock in Flowchart View */}
          {operationalRoles.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Field Operations & Campus Portals (Independent Endpoints)
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {operationalRoles.map((role) => (
                  <div
                    key={role.key}
                    onClick={() => {
                      setInspectedRoleKey(role.key);
                      setViewMode("tree");
                    }}
                    className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 bg-gray-50/50 dark:bg-gray-850 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {role.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        Portal
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {role.description || "Operational mobile endpoint."}
                    </p>
                    <div className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <span>Inspect Details →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: GRID VIEW */}
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
// Folder-Based Tree Node Component (Recursive with Multi-Child Indentation)
// ─────────────────────────────────────────────────────────────────────────────

interface FolderTreeNodeProps {
  role: SystemRoleDefinition;
  childMap: Record<string, SystemRoleDefinition[]>;
  cardMap: Map<string, SystemCard>;
  depth: number;
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
  inspectedRoleKey: string | null;
  onSelectInspect: (key: string) => void;
  onEdit: (r: SystemRoleDefinition) => void;
  onAddSubordinate: (parentKey: string) => void;
  searchQuery: string;
}

function FolderTreeNode({
  role,
  childMap,
  cardMap,
  depth,
  expandedKeys,
  onToggleExpand,
  inspectedRoleKey,
  onSelectInspect,
  onEdit,
  onAddSubordinate,
  searchQuery,
}: FolderTreeNodeProps) {
  const children = childMap[role.key] || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedKeys.has(role.key);
  const isInspected = inspectedRoleKey === role.key;

  const matchesSelf = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      role.name.toLowerCase().includes(q) ||
      role.key.toLowerCase().includes(q) ||
      (role.description || "").toLowerCase().includes(q)
    );
  }, [role, searchQuery]);

  return (
    <div className="flex flex-col w-full">
      {/* Node Row */}
      <div
        onClick={() => onSelectInspect(role.key)}
        className={`group relative flex items-center justify-between gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
          isInspected
            ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-sm"
            : "bg-white dark:bg-gray-850 border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50/60 dark:hover:bg-gray-800/50"
        }`}
        style={{ paddingLeft: `${Math.max(12, depth * 24 + 12)}px` }}
      >
        {/* Left Side: Chevron, Folder Icon, Name, and Level */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Chevron Toggle Button */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(role.key);
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition shrink-0"
              title={isExpanded ? "Collapse branch" : "Expand branch"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6 h-6 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </span>
          )}

          {/* Folder / Leaf Icon */}
          <div className="shrink-0">
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="w-5 h-5 text-blue-500" />
              ) : (
                <Folder className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )
            ) : (
              <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            )}
          </div>

          {/* Role Title & Hierarchy Badge */}
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {role.name}
            </span>

            {/* Level Badge */}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              L{role.hierarchyLevel ?? 1}
            </span>

            {role.isSystem ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-500">
                System
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                Custom
              </span>
            )}

            {/* Multiple Subordinates Badge */}
            {hasChildren && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {children.length} {children.length === 1 ? "sub-role" : "sub-roles"}
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Card Counts & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Card Summary Pills */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
              {role.directCards.length} direct
            </span>
            {(role.inheritedCards?.length || 0) > 0 && (
              <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 px-2 py-0.5 rounded-md">
                +{role.inheritedCards?.length} inherited
              </span>
            )}
            {role.memberCount !== undefined && (
              <span className="text-gray-400 font-medium">
                • {role.memberCount} {role.memberCount === 1 ? "user" : "users"}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubordinate(role.key);
              }}
              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
              title={`Add subordinate under ${role.name}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(role);
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Edit role cards & settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Nested Children (Rendered if expanded) */}
      {hasChildren && isExpanded && (
        <div className="relative pl-3 mt-1 space-y-1 border-l-2 border-gray-100 dark:border-gray-800/80 ml-6 sm:ml-8">
          {children.map((child) => (
            <FolderTreeNode
              key={child.key}
              role={child}
              childMap={childMap}
              cardMap={cardMap}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              onToggleExpand={onToggleExpand}
              inspectedRoleKey={inspectedRoleKey}
              onSelectInspect={onSelectInspect}
              onEdit={onEdit}
              onAddSubordinate={onAddSubordinate}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role Inspector Card (Sticky Right Panel)
// ─────────────────────────────────────────────────────────────────────────────

function RoleInspectorCard({
  role,
  cardMap,
  reportingLineage,
  childRoles,
  onSelectRole,
  onEdit,
  onAddSubordinate,
}: {
  role: SystemRoleDefinition;
  cardMap: Map<string, SystemCard>;
  reportingLineage: SystemRoleDefinition[];
  childRoles: SystemRoleDefinition[];
  onSelectRole: (key: string) => void;
  onEdit: (r: SystemRoleDefinition) => void;
  onAddSubordinate: (parentKey: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                {role.name}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Level {role.hierarchyLevel ?? 1}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Role Key: <code className="text-blue-600 dark:text-blue-400 font-bold">{role.key}</code>
            </p>
          </div>
        </div>

        <button
          onClick={() => onEdit(role)}
          className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          title="Configure Role"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-850 p-3 rounded-2xl">
        {role.description || "Core system organizational role."}
      </p>

      {/* Portal Path Link */}
      {role.portalPath && (
        <div className="flex items-center justify-between text-xs bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-2.5 rounded-2xl">
          <span className="text-blue-700 dark:text-blue-300 font-medium">Default Portal:</span>
          <Link
            href={role.portalPath}
            className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <span>{role.portalPath}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Reporting Lineage Breadcrumb */}
      <div>
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Reporting Chain (Lineage)
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {reportingLineage.map((item, idx) => {
            const isLast = idx === reportingLineage.length - 1;
            return (
              <React.Fragment key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelectRole(item.key)}
                  className={`px-2.5 py-1 rounded-xl font-bold transition ${
                    isLast
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {item.name}
                </button>
                {!isLast && <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Direct Subordinate Roles (Multiple Children) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Direct Subordinates ({childRoles.length})
          </div>
          <button
            type="button"
            onClick={() => onAddSubordinate(role.key)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Add Sub-Role</span>
          </button>
        </div>

        {childRoles.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No subordinate roles (Terminal role).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {childRoles.map((child) => (
              <button
                key={child.key}
                type="button"
                onClick={() => onSelectRole(child.key)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:scale-105 transition"
              >
                <CornerDownRight className="w-3 h-3 text-amber-600" />
                <span>{child.name}</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                  (L{child.hierarchyLevel ?? 4})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Direct Capability Cards */}
      <div>
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
          Direct Capability Cards ({role.directCards.length})
        </div>
        {role.directCards.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No cards assigned directly.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {role.directCards.map((cardKey) => {
              const card = cardMap.get(cardKey);
              const IconComp = card ? getCardIcon(card.icon) : ShieldCheck;
              return (
                <div
                  key={cardKey}
                  className="p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-200"
                >
                  <span className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                    <IconComp className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{card?.title || cardKey}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inherited Capability Cards */}
      {(role.inheritedCards?.length || 0) > 0 && (
        <div>
          <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
            Inherited from Subordinates ({role.inheritedCards?.length})
          </div>
          <div className="grid grid-cols-2 gap-2">
            {role.inheritedCards?.map((cardKey) => {
              const card = cardMap.get(cardKey);
              const IconComp = card ? getCardIcon(card.icon) : ShieldCheck;
              return (
                <div
                  key={cardKey}
                  className="p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 flex items-center gap-2 text-xs font-semibold text-purple-900 dark:text-purple-200"
                >
                  <span className="p-1.5 bg-purple-100 dark:bg-purple-900 rounded-lg text-purple-600 dark:text-purple-400">
                    <IconComp className="w-3.5 h-3.5" />
                  </span>
                  <span className="truncate">{card?.title || cardKey}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Directory Link */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <Link
          href={`/cards/users?roleFilter=${role.key}`}
          className="text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-blue-600 flex items-center gap-1.5"
        >
          <Users className="w-3.5 h-3.5" />
          <span>View {role.memberCount ?? 0} Assigned Users ↗</span>
        </Link>
        <button
          onClick={() => onEdit(role)}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
        >
          Configure Cards
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flowchart Node Component (Canvas View with Multi-Child Connector Splitting)
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
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  L{role.hierarchyLevel ?? 1}
                </span>
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
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  L{role.hierarchyLevel ?? 1}
                </span>
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
