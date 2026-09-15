import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseClient";
import AdminClassesView from "@/components/admin/AdminClassesView";

export const dynamic = "force-dynamic";

/**
 * Server Component: Academic Class & Section Management Gateway
 * - Server-side authorization check (Admin / Academic Desk)
 * - Queries course classes, student roll counts, and assigned faculty
 * - Pre-rendered HTML delivery with 0ms load flicker
 */
export default async function AdminClassesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/admin/classes");
  }

  if (session.role !== "admin" && session.role !== "transport_manager" && session.role !== "staff") {
    redirect("/portal");
  }

  const [
    { data: dbClasses },
    { data: dbStudents },
    { data: dbTeachers },
    { data: dbClassTeachers },
  ] = await Promise.all([
    supabaseAdmin.from("classes").select("*").order("name"),
    supabaseAdmin.from("students").select("id, class_id"),
    supabaseAdmin.from("users").select("id, full_name, email, role").in("role", ["teacher", "staff", "admin"]),
    supabaseAdmin.from("class_teachers").select("class_id, is_primary, users(id, full_name, email)"),
  ]);

  const teachersMap = new Map<string, any[]>();
  if (dbClassTeachers) {
    for (const ct of dbClassTeachers) {
      const list = teachersMap.get(ct.class_id) || [];
      if (ct.users) {
        list.push({
          id: (ct.users as any).id,
          fullName: (ct.users as any).full_name,
          email: (ct.users as any).email,
          isPrimary: ct.is_primary,
        });
      }
      teachersMap.set(ct.class_id, list);
    }
  }

  const classes = (dbClasses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    course: c.course || "B.Tech CSE",
    department: c.department || "Computer Science & Engineering",
    degreeLevel: c.degree_level || "Undergraduate",
    year: c.year || "3rd Year",
    yearNum: c.year_num || 1,
    semester: c.semester || "1st Sem",
    semesterNum: c.semester_num || 1,
    section: c.section || "A",
    sectionCode: c.section_code || c.section || "A",
    specialization: c.specialization || "Core",
    isActive: c.is_active ?? true,
    studentCount: (dbStudents || []).filter((s: any) => s.class_id === c.id).length,
    assignedTeachers: teachersMap.get(c.id) || [],
    createdAt: c.created_at || new Date().toISOString(),
  }));

  return (
    <AdminClassesView
      initialClasses={classes}
      initialTeachers={dbTeachers || []}
    />
  );
}
