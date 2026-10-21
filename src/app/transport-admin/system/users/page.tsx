import { getStaffServerData } from "@/lib/transport-admin-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StaffUsersView from "@/components/transport-admin/StaffUsersView";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StaffSystemUsersPage() {
  const { session } = await getStaffServerData("/transport-admin/system/users");

  const [{ data: dbUsers }, { data: dbStudents, error: studentsErr }] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, full_name, email, role, phone, campus_id, provider, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("students_full")
      .select("id, user_id, full_name, email, phone, campus_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  let validStudents = dbStudents;
  if (!validStudents && studentsErr) {
    const { data: fallbackStudents } = await supabaseAdmin
      .from("students")
      .select("id, user_id, full_name, campus_id, created_at")
      .order("created_at", { ascending: false });
    validStudents = (fallbackStudents || []).map((s: any) => ({
      ...s,
      email: "",
      phone: "",
    }));
  }

  const userList: UserAccount[] = (dbUsers || []).map((u: any) => ({
    id: u.id,
    fullName: u.full_name || "User",
    email: u.email || "",
    role: (u.role || "student") as any,
    phone: u.phone || undefined,
    campusId: u.campus_id || undefined,
    provider: u.provider || "email",
    createdAt: u.created_at || new Date().toISOString(),
  }));

  // Sync any student records
  const existingUserIds = new Set(userList.map((u) => u.id));
  if (validStudents) {
    for (const st of validStudents) {
      const targetId = st.user_id || st.id;
      if (!existingUserIds.has(targetId) && !existingUserIds.has(st.id)) {
        userList.push({
          id: targetId,
          fullName: st.full_name || "Commuter",
          email: st.email || "",
          role: "student",
          phone: st.phone || undefined,
          campusId: st.campus_id || undefined,
          provider: "Institutional SSO",
          createdAt: st.created_at || new Date().toISOString(),
        });
        existingUserIds.add(targetId);
      }
    }
  }

  return (
    <StaffUsersView
      initialUsers={userList}
      initialUser={session}
    />
  );
}
