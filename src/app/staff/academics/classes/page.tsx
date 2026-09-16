import { getStaffServerData } from "@/lib/staff-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StaffClassesView from "@/components/staff/StaffClassesView";

export const dynamic = "force-dynamic";

export default async function StaffAcademicsClassesPage() {
  await getStaffServerData("/staff/academics/classes");

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

  const studentCountMap = new Map<string, number>();
  if (dbStudents) {
    for (const s of dbStudents) {
      if (s.class_id) {
        studentCountMap.set(s.class_id, (studentCountMap.get(s.class_id) || 0) + 1);
      }
    }
  }

  const classes = (dbClasses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    code: c.code,
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
    campusId: c.campus_id || "",
    defaultDismissalTime: c.default_dismissal_time || "16:30",
    isActive: c.is_active ?? true,
    studentCount: studentCountMap.get(c.id) || 0,
    assignedTeachers: teachersMap.get(c.id) || [],
    teachers: teachersMap.get(c.id) || [],
    createdAt: c.created_at || new Date().toISOString(),
  }));

  const teachers = (dbTeachers || []).map((t: any) => ({
    id: t.id,
    fullName: t.full_name,
    email: t.email,
    role: t.role,
  }));

  return (
    <StaffClassesView
      initialClasses={classes}
      initialTeachers={teachers}
    />
  );
}
