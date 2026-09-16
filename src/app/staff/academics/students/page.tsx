import { getStaffServerData } from "@/lib/staff-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StaffStudentsView from "@/components/staff/StaffStudentsView";

export const dynamic = "force-dynamic";

export default async function StaffAcademicsStudentsPage() {
  const data = await getStaffServerData("/staff/academics/students");

  const [
    { data: dbGuardians },
    { data: dbClasses },
  ] = await Promise.all([
    supabaseAdmin.from("guardians").select("*"),
    supabaseAdmin.from("classes").select("*").order("name"),
  ]);

  return (
    <StaffStudentsView
      initialStudents={data.students}
      initialStops={data.stops}
      initialRoutes={data.routes}
      initialGuardians={dbGuardians || []}
      initialClasses={dbClasses || []}
    />
  );
}
