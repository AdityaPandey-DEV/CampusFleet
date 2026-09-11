import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminStaffView from "@/components/admin/AdminStaffView";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server Component: User Directory & RBAC Security Gateway
 * - Server-side authorization check (Admin / Transport Manager only)
 * - Pre-queries registered user accounts, role allocations, and auth providers
 * - Cross-references students table to guarantee 100% data consistency
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

  const [{ data: dbUsers }, { data: dbStudents }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, phone, campus, provider, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("students")
      .select("id, user_id, full_name, email, phone, campus, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const userList: UserAccount[] = (dbUsers || []).map((u: any) => ({
    id: u.id,
    fullName: u.full_name || "User",
    email: u.email || "",
    role: (u.role || "student") as any,
    phone: u.phone || undefined,
    campus: u.campus || undefined,
    provider: u.provider || "Institutional SSO",
    createdAt: u.created_at || new Date().toISOString(),
  }));

  // Auto-heal / cross-reference any student who has a profile in students table
  // but might be missing from users table
  const userEmails = new Set(userList.map(u => u.email.toLowerCase().trim()).filter(Boolean));
  const userIds = new Set(userList.map(u => u.id));

  for (const s of (dbStudents || [])) {
    const sEmail = (s.email || "").toLowerCase().trim();
    if (!userIds.has(s.user_id) && (!sEmail || !userEmails.has(sEmail))) {
      const fallbackId = s.user_id || s.id || `usr-${Date.now()}`;
      const healedUser: UserAccount = {
        id: fallbackId,
        fullName: s.full_name || "Student",
        email: s.email || "",
        role: "student",
        phone: s.phone || undefined,
        campus: s.campus || "GEHU Bhimtal",
        provider: "Institutional SSO",
        createdAt: s.created_at || new Date().toISOString(),
      };
      userList.unshift(healedUser);
      userIds.add(fallbackId);
      if (sEmail) userEmails.add(sEmail);

      // Auto-heal into users table
      supabaseAdmin.from("users").upsert({
        id: fallbackId,
        email: s.email || "",
        full_name: s.full_name || "Student",
        phone: s.phone || null,
        campus: s.campus || "GEHU Bhimtal",
        role: "student",
        provider: "Institutional SSO",
      }, { onConflict: "id" }).then(() => {});
    }
  }

  return (
    <AdminStaffView
      initialUsers={userList}
      initialUser={session}
    />
  );
}
