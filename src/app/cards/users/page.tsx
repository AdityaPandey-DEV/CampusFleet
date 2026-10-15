import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminStaffView from "@/components/admin/AdminStaffView";
import { canRoleAccessCard } from "@/modules/rbac/rbac-service";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoleManagerUsersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/role-manager/users");
  }

  const hasAccess = await canRoleAccessCard(session.role, "users");
  if (!hasAccess) {
    redirect(session.portalPath || "/portal");
  }

  const [{ data: dbUsers }, { data: dbStudents }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, phone, campus, campus_id, provider, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("students")
      .select("id, user_id, full_name, email, phone, campus, campus_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const userList: UserAccount[] = (dbUsers || []).map((u: any) => ({
    id: u.id,
    fullName: u.full_name || "User",
    email: u.email || "",
    role: (u.role || "student") as any,
    phone: u.phone || undefined,
    campusId: u.campus_id || u.campus || undefined,
    campus: u.campus || undefined,
    provider: u.provider || "NONE",
    createdAt: u.created_at || new Date().toISOString(),
  }));

  // Auto-heal / cross-reference students from students table
  const userEmails = new Set(userList.map((u) => u.email.toLowerCase().trim()).filter(Boolean));
  const userIds = new Set(userList.map((u) => u.id));

  for (const s of dbStudents || []) {
    const sEmail = (s.email || "").toLowerCase().trim();
    if (!userIds.has(s.user_id) && (!sEmail || !userEmails.has(sEmail))) {
      const fallbackId = s.user_id || s.id || `usr-${Date.now()}`;
      userList.push({
        id: fallbackId,
        fullName: s.full_name || "Student",
        email: s.email || `${fallbackId}@student.campus.edu`,
        role: "student",
        phone: s.phone || undefined,
        campusId: s.campus_id || s.campus || undefined,
        campus: s.campus || undefined,
        provider: "STUDENT_RECORD",
        createdAt: s.created_at || new Date().toISOString(),
      });
    }
  }

  return (
    <div className="space-y-6">
      <AdminStaffView initialUsers={userList} />
    </div>
  );
}
