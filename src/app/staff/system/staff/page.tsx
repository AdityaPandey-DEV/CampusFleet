import { getStaffServerData } from "@/lib/staff-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StaffUsersView from "@/components/staff/StaffUsersView";
import type { UserAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StaffSystemUsersPage() {
  const { session } = await getStaffServerData("/staff/system/staff");

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
    provider: u.provider || "email",
    createdAt: u.created_at || new Date().toISOString(),
  }));

  // Sync any student records
  const existingUserIds = new Set(userList.map((u) => u.id));
  if (dbStudents) {
    for (const st of dbStudents) {
      const targetId = st.user_id || st.id;
      if (!existingUserIds.has(targetId) && !existingUserIds.has(st.id)) {
        userList.push({
          id: targetId,
          fullName: st.full_name || "Commuter",
          email: st.email || "",
          role: "student",
          phone: st.phone || undefined,
          campusId: st.campus_id || st.campus || undefined,
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
