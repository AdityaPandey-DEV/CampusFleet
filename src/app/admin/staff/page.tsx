import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminStaffView from "@/components/admin/AdminStaffView";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Server Component: User Directory & RBAC Security Gateway
 * - Server-side authorization check (Admin / Transport Manager only)
 * - Pre-queries registered user accounts, role allocations, and auth providers
 * - Fast server render
 */
export default async function UserAndRBACManagementPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/staff");
  }

  if (session.role !== "admin" && session.role !== "transport_manager") {
    redirect("/portal");
  }

  const { data: dbUsers } = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, role, phone, is_active, created_at");

  const users: UserAccount[] = (dbUsers || []).map((u: any) => ({
    id: u.id,
    fullName: u.full_name || "User",
    email: u.email || "",
    role: (u.role || "student") as any,
    phone: u.phone,
    provider: "Institutional SSO",
    createdAt: u.created_at || new Date().toISOString(),
  }));

  return (
    <AdminStaffView
      initialUsers={users}
      initialUser={session}
    />
  );
}
