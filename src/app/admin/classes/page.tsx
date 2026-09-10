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
  ] = await Promise.all([
    supabaseAdmin.from("classes").select("*").order("name"),
    supabaseAdmin.from("students").select("id, class_id"),
    supabaseAdmin.from("users").select("id, full_name, email, role").in("role", ["teacher", "staff", "admin"]),
  ]);

  const classes = (dbClasses || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    course: c.course || "B.Tech CSE",
    year: c.year || "3rd Year",
    section: c.section || "A",
    isActive: c.is_active ?? true,
    studentCount: (dbStudents || []).filter((s: any) => s.class_id === c.id).length,
    assignedTeachers: [],
    createdAt: c.created_at || new Date().toISOString(),
  }));

  return (
    <AdminClassesView
      initialClasses={classes}
      initialTeachers={dbTeachers || []}
    />
  );
}
