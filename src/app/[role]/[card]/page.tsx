import { getStaffServerData } from "@/lib/transport-admin-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getRolesWithHierarchy, getSystemCards } from "@/modules/rbac/rbac-service";
import { CardRenderer } from "@/components/operations/CardRenderer";
import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

interface RoleCardPageProps {
  params: {
    role: string;
    card: string;
  };
}

export async function generateMetadata({ params }: RoleCardPageProps): Promise<Metadata> {
  const cardName = params.card.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const roleName = params.role.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${cardName} | ${roleName} | CampusFleet`,
  };
}

export default async function DynamicRoleCardPage({ params }: RoleCardPageProps) {
  const { role: rawRole, card: rawCard } = params;
  const normalizedRole = rawRole.toLowerCase().replace(/-/g, "_");
  const normalizedCard = rawCard.toLowerCase().replace(/-/g, "_");

  // Load server data and verify authentication
  const data = await getStaffServerData(`/${rawRole}/${rawCard}`);

  // Fetch roles and cards from database
  const [allRoles, allCards] = await Promise.all([
    getRolesWithHierarchy(),
    getSystemCards(),
  ]);

  const roleDef = allRoles.find(
    (r) =>
      r.key === normalizedRole ||
      (r.portalPath && r.portalPath.replace(/^\//, "").replace(/-/g, "_") === normalizedRole)
  );

  const cardDef = allCards.find(
    (c) => c.key === normalizedCard || c.key.replace(/_/g, "-") === rawCard
  );

  // If role or card doesn't exist in database definitions
  if (!cardDef) {
    // If it's a known functional card like 'demand' or 'combine_buses', proceed, else notFound
    const knownAuxiliaryCards = ["demand", "combine_buses", "merges", "crew"];
    if (!knownAuxiliaryCards.includes(normalizedCard)) {
      notFound();
    }
  }

  // Fetch auxiliary data tailored to specific card operations
  const extra: any = {};

  if (normalizedCard === "students") {
    const [{ data: dbGuardians }, { data: dbClasses }] = await Promise.all([
      supabaseAdmin.from("guardians").select("*"),
      supabaseAdmin.from("classes").select("*").order("name"),
    ]);
    extra.guardians = dbGuardians || [];
    extra.classes = dbClasses || [];
  } else if (normalizedCard === "reports") {
    const [{ data: dbPayments }] = await Promise.all([
      supabaseAdmin.from("payments").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    extra.payments = dbPayments || [];
  } else if (normalizedCard === "users") {
    const [{ data: dbUsers }, { data: dbStudents }] = await Promise.all([
      supabaseAdmin.from("users").select("id, full_name, email, role, phone, campus, campus_id, provider, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("students").select("id, user_id, full_name, email, phone, campus, campus_id, created_at").order("created_at", { ascending: false }),
    ]);

    const userList = (dbUsers || []).map((u: any) => ({
      id: u.id,
      fullName: u.full_name || "User",
      email: u.email || "",
      role: u.role || "student",
      phone: u.phone || undefined,
      campusId: u.campus_id || u.campus || undefined,
      campus: u.campus || undefined,
      provider: u.provider || "NONE",
      createdAt: u.created_at || new Date().toISOString(),
    }));

    extra.users = userList;
  } else if (normalizedCard === "hierarchy") {
    extra.roles = allRoles;
    extra.cards = allCards;
  } else if (normalizedCard === "combine_buses" || normalizedCard === "merges") {
    const [{ data: dbSuggestions }, { data: dbMergePoints }] = await Promise.all([
      supabaseAdmin.from("bus_merge_suggestions").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("bus_merge_points").select("*").order("code"),
    ]);
    extra.suggestions = dbSuggestions || [];
    extra.mergePoints = dbMergePoints || [];
  }

  return (
    <div className="py-2">
      <CardRenderer cardKey={normalizedCard} data={data} extra={extra} />
    </div>
  );
}
