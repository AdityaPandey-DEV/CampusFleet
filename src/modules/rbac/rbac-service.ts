import { supabaseAdmin } from "@/lib/supabaseClient";
import type { SystemCard, SystemRoleDefinition, UserAccount } from "@/lib/types";

/**
 * Computes downward capability inheritance for all roles loaded from the database.
 * If Role A is the parent of Role B, Role A automatically inherits all cards assigned to Role B.
 */
export function resolveHierarchyInheritance(
  roles: SystemRoleDefinition[],
  allCards: SystemCard[]
): SystemRoleDefinition[] {
  const roleMap = new Map<string, SystemRoleDefinition>(
    roles.map((r) => [r.key, { ...r, inheritedCards: [], allEffectiveCards: [] }])
  );

  function getDescendantKeys(parentKey: string, visited = new Set<string>()): string[] {
    if (visited.has(parentKey)) return [];
    visited.add(parentKey);

    const children: string[] = [];
    for (const r of roles) {
      if (r.parentRoleKey === parentKey) {
        children.push(r.key);
        children.push(...getDescendantKeys(r.key, visited));
      }
    }
    return children;
  }

  const allCardKeys = allCards.map((c) => c.key);

  return roles.map((role) => {
    // Admin has master access to all cards across the system
    if (role.key === "admin") {
      return {
        ...role,
        inheritedCards: allCardKeys.filter((k) => !role.directCards.includes(k)),
        allEffectiveCards: allCardKeys,
      };
    }

    const descendants = getDescendantKeys(role.key);
    const inheritedSet = new Set<string>();

    for (const childKey of descendants) {
      const child = roleMap.get(childKey);
      if (child) {
        for (const card of child.directCards || []) {
          if (!role.directCards.includes(card)) {
            inheritedSet.add(card);
          }
        }
      }
    }

    const inheritedCards = Array.from(inheritedSet);
    const allEffectiveCards = Array.from(
      new Set([...(role.directCards || []), ...inheritedCards])
    );

    return {
      ...role,
      inheritedCards,
      allEffectiveCards,
    };
  });
}

/**
 * Auto-bootstrap: If a fresh database is connected and system_cards is empty,
 * seed default cards, hierarchical roles, and initial admin directly into the database.
 */
export async function ensureDatabaseBootstrapped(): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from("system_cards")
      .select("key", { count: "exact", head: true });

    if (error || (count !== null && count > 0)) {
      return; // Already bootstrapped or table not available
    }

    // Seed cards in DB
    const seedCards = [
      { key: "role_manager", title: "Role & Access Manager", description: "Manage staff accounts, assign roles, and configure hierarchy flowchart.", icon: "ShieldCheck", route: "/role-manager", category: "Administration", sort_order: 1 },
      { key: "users", title: "User Accounts", description: "Search, add, and manage user accounts and login access.", icon: "Users", route: "/role-manager/users", category: "Administration", sort_order: 2 },
      { key: "hierarchy", title: "Role Hierarchy Tree", description: "Interactive visual flowchart of reporting and access hierarchy.", icon: "GitFork", route: "/role-manager/hierarchy", category: "Administration", sort_order: 3 },
      { key: "buses", title: "Bus Fleet", description: "Manage buses, registrations, seat layouts, and print seat QRs.", icon: "BusFront", route: "/transport-admin/buses", category: "Fleet Logistics", sort_order: 4 },
      { key: "routes", title: "Routes & Stops", description: "Manage corridors, bus stops, pickup timings, and route maps.", icon: "Route", route: "/transport-manager/routes", category: "Fleet Logistics", sort_order: 5 },
      { key: "trips", title: "Today's Trips", description: "Monitor live departures, dispatch trips, and combine buses.", icon: "Navigation", route: "/transport-manager/trips", category: "Fleet Logistics", sort_order: 6 },
      { key: "drivers", title: "Assign Drivers", description: "Assign drivers and conductors to specific buses and shifts.", icon: "UserCheck", route: "/transport-manager/drivers", category: "Fleet Logistics", sort_order: 7 },
      { key: "billing", title: "Bus Fees", description: "Approve student payment receipts, manage fee balances, and UPI QR.", icon: "CreditCard", route: "/transport-admin/billing/approvals", category: "Finance & Accounts", sort_order: 8 },
      { key: "students", title: "Students & Passes", description: "Search student directory, verify passes, and manage classes.", icon: "GraduationCap", route: "/transport-admin/academics/students", category: "Academics & Safety", sort_order: 9 },
      { key: "maintenance", title: "Bus Repairs", description: "Track workshop maintenance, engine servicing, and repair logs.", icon: "Wrench", route: "/transport-admin/maintenance", category: "Fleet Logistics", sort_order: 10 },
      { key: "reports", title: "Staff & Reports", description: "Attendance logs, driver manifests, and audit reports.", icon: "FileText", route: "/transport-admin/system/reports", category: "Administration", sort_order: 11 },
    ];
    await supabaseAdmin.from("system_cards").upsert(seedCards, { onConflict: "key" });

    // Seed roles in DB
    const seedRoles = [
      { key: "admin", name: "Super Administrator", description: "Full master control over institution, settings, and role management", parent_role_key: null, hierarchy_level: 1, is_system: true },
      { key: "role_manager", name: "Role & Access Manager", description: "Configures role hierarchy, assigns cards, and manages staff", parent_role_key: "admin", hierarchy_level: 2, is_system: true },
      { key: "transport_admin", name: "Transport Admin", description: "Oversees bus fleet, fee desks, student passes, and repairs", parent_role_key: "role_manager", hierarchy_level: 3, is_system: true },
      { key: "transport_manager", name: "Transport Manager", description: "Manages live operations, routes, drivers, and daily trips", parent_role_key: "transport_admin", hierarchy_level: 4, is_system: true },
      { key: "driver", name: "Driver", description: "Operational telematics and route progression HUD", parent_role_key: "transport_manager", hierarchy_level: 5, is_system: true },
      { key: "conductor", name: "Conductor", description: "Optical QR passenger manifest verification scanner", parent_role_key: "transport_manager", hierarchy_level: 5, is_system: true },
      { key: "teacher", name: "Teacher", description: "Classroom attendance and student transit status", parent_role_key: "transport_admin", hierarchy_level: 4, is_system: true },
      { key: "student", name: "Student", description: "Student mobility pass, reservations, and live tracking", parent_role_key: null, hierarchy_level: 6, is_system: true },
    ];
    await supabaseAdmin.from("system_roles").upsert(seedRoles, { onConflict: "key" });

    // Seed direct role_cards in DB
    const seedRoleCards = [
      { role_key: "role_manager", card_key: "role_manager" },
      { role_key: "role_manager", card_key: "users" },
      { role_key: "role_manager", card_key: "hierarchy" },
      { role_key: "transport_admin", card_key: "buses" },
      { role_key: "transport_admin", card_key: "billing" },
      { role_key: "transport_admin", card_key: "students" },
      { role_key: "transport_admin", card_key: "maintenance" },
      { role_key: "transport_admin", card_key: "reports" },
      { role_key: "transport_manager", card_key: "drivers" },
      { role_key: "transport_manager", card_key: "routes" },
      { role_key: "transport_manager", card_key: "trips" },
    ];
    await supabaseAdmin.from("role_cards").upsert(seedRoleCards, { onConflict: "role_key,card_key" });

    // Ensure default admin in DB
    await supabaseAdmin.from("users").upsert([
      { id: "admin-root-001", email: "admin@campusfleet.com", full_name: "System Administrator", role: "admin", provider: "EMAIL_PASSWORD" }
    ], { onConflict: "email" });
  } catch (err) {
    console.error("Database auto-bootstrap error:", err);
  }
}

/**
 * Fetch all system cards dynamically from the database.
 */
export async function getSystemCards(): Promise<SystemCard[]> {
  await ensureDatabaseBootstrapped();

  const { data, error } = await supabaseAdmin
    .from("system_cards")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error || !data) {
    console.error("Error fetching system_cards from DB:", error);
    return [];
  }

  return data.map((c: any) => ({
    key: c.key,
    title: c.title,
    description: c.description,
    icon: c.icon,
    route: c.route,
    category: c.category,
    sortOrder: c.sort_order,
  }));
}

/**
 * Fetch all roles and their card allocations dynamically from the database.
 */
export async function getRolesWithHierarchy(): Promise<SystemRoleDefinition[]> {
  await ensureDatabaseBootstrapped();
  const cards = await getSystemCards();

  const [{ data: dbRoles, error: rolesError }, { data: dbRoleCards, error: cardsError }, { data: dbUsers }] =
    await Promise.all([
      supabaseAdmin.from("system_roles").select("*").order("hierarchy_level", { ascending: true }),
      supabaseAdmin.from("role_cards").select("role_key, card_key"),
      supabaseAdmin.from("users").select("role"),
    ]);

  if (rolesError || !dbRoles) {
    console.error("Error fetching system_roles from DB:", rolesError);
    return [];
  }

  // Count active members per role
  const memberCounts: Record<string, number> = {};
  if (dbUsers) {
    for (const u of dbUsers) {
      const r = u.role || "student";
      memberCounts[r] = (memberCounts[r] || 0) + 1;
    }
  }

  // Group direct cards by role_key
  const cardsByRole: Record<string, string[]> = {};
  if (dbRoleCards && !cardsError) {
    for (const rc of dbRoleCards) {
      if (!cardsByRole[rc.role_key]) cardsByRole[rc.role_key] = [];
      cardsByRole[rc.role_key].push(rc.card_key);
    }
  }

  const rawRoles: SystemRoleDefinition[] = dbRoles.map((r: any) => ({
    key: r.key,
    name: r.name,
    description: r.description || undefined,
    parentRoleKey: r.parent_role_key || null,
    hierarchyLevel: r.hierarchy_level || 1,
    portalPath: r.portal_path || (r.key === "admin" ? "/admin" : r.key === "role_manager" ? "/role-manager" : "/portal"),
    shortLabel: r.short_label || r.name,
    icon: r.icon || "ShieldCheck",
    color: r.color || "text-blue-500",
    gradient: r.gradient || "bg-blue-600",
    isSystem: Boolean(r.is_system),
    directCards: cardsByRole[r.key] || [],
    memberCount: memberCounts[r.key] || 0,
  }));

  return resolveHierarchyInheritance(rawRoles, cards);
}

/**
 * Get all cards accessible by a specific user from database.
 */
export async function getUserAllowedCards(user: UserAccount | null | undefined): Promise<SystemCard[]> {
  if (!user) return [];
  const allCards = await getSystemCards();

  if (user.role === "admin") {
    return allCards;
  }

  const roles = await getRolesWithHierarchy();
  const userRole = roles.find((r) => r.key === user.role);

  const allowedKeys = new Set<string>([
    ...(userRole?.allEffectiveCards || []),
    ...((user as any).custom_cards || []),
  ]);

  return allCards.filter((c) => allowedKeys.has(c.key));
}

/**
 * Create a new custom role directly in the database.
 */
export async function createSystemRole(params: {
  key: string;
  name: string;
  description?: string;
  parentRoleKey?: string | null;
  hierarchyLevel?: number;
  portalPath?: string;
  shortLabel?: string;
  icon?: string;
  color?: string;
  gradient?: string;
  directCards: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanKey = params.key.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
    if (!cleanKey || !params.name.trim()) {
      return { success: false, error: "Role key and name are required." };
    }

    const { error: roleError } = await supabaseAdmin.from("system_roles").insert({
      key: cleanKey,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      parent_role_key: params.parentRoleKey || null,
      hierarchy_level: params.hierarchyLevel || 4,
      portal_path: params.portalPath || "/transport-admin",
      short_label: params.shortLabel || params.name.trim(),
      icon: params.icon || "ShieldCheck",
      color: params.color || "text-blue-500",
      gradient: params.gradient || "bg-blue-600",
      is_system: false,
    });

    if (roleError) {
      return { success: false, error: roleError.message };
    }

    if (params.directCards && params.directCards.length > 0) {
      const inserts = params.directCards.map((cardKey) => ({
        role_key: cleanKey,
        card_key: cardKey,
      }));
      await supabaseAdmin.from("role_cards").insert(inserts);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create role in database" };
  }
}

/**
 * Update a role's hierarchy parent and card allocations in the database.
 */
export async function updateSystemRole(
  roleKey: string,
  params: {
    name: string;
    description?: string;
    parentRoleKey?: string | null;
    hierarchyLevel?: number;
    portalPath?: string;
    shortLabel?: string;
    icon?: string;
    color?: string;
    gradient?: string;
    directCards: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: Record<string, any> = {
      name: params.name.trim(),
      description: params.description?.trim() || null,
      parent_role_key: params.parentRoleKey || null,
      hierarchy_level: params.hierarchyLevel || 4,
      updated_at: new Date().toISOString(),
    };
    if (params.portalPath) updatePayload.portal_path = params.portalPath;
    if (params.shortLabel) updatePayload.short_label = params.shortLabel;
    if (params.icon) updatePayload.icon = params.icon;
    if (params.color) updatePayload.color = params.color;
    if (params.gradient) updatePayload.gradient = params.gradient;

    const { error: roleError } = await supabaseAdmin
      .from("system_roles")
      .update(updatePayload)
      .eq("key", roleKey);

    if (roleError) {
      return { success: false, error: roleError.message };
    }

    // Replace role_cards bindings in database
    await supabaseAdmin.from("role_cards").delete().eq("role_key", roleKey);

    if (params.directCards && params.directCards.length > 0) {
      const inserts = params.directCards.map((cardKey) => ({
        role_key: roleKey,
        card_key: cardKey,
      }));
      await supabaseAdmin.from("role_cards").insert(inserts);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update role in database" };
  }
}

/**
 * Delete a custom role from the database.
 */
export async function deleteSystemRole(roleKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: role, error } = await supabaseAdmin
      .from("system_roles")
      .select("is_system")
      .eq("key", roleKey)
      .single();

    if (error || !role) {
      return { success: false, error: "Role not found in database." };
    }

    if (role.is_system) {
      return { success: false, error: "System-defined roles cannot be deleted." };
    }

    // Re-parent any dependent child roles
    await supabaseAdmin
      .from("system_roles")
      .update({ parent_role_key: null })
      .eq("parent_role_key", roleKey);

    // Delete role (cascade removes role_cards)
    const { error: delError } = await supabaseAdmin
      .from("system_roles")
      .delete()
      .eq("key", roleKey);

    if (delError) {
      return { success: false, error: delError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete role from database" };
  }
}
