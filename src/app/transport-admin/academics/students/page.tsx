import { getStaffServerData } from "@/lib/transport-admin-data";
import { supabaseAdmin } from "@/lib/supabaseClient";
import StaffStudentsView from "@/components/transport-admin/StaffStudentsView";

export const dynamic = "force-dynamic";

export default async function StaffAcademicsStudentsPage() {
  const data = await getStaffServerData("/transport-admin/academics/students");

  const [
    { data: dbGuardians },
    { data: dbClasses },
  ] = await Promise.all([
    supabaseAdmin.from("guardians").select("*"),
    supabaseAdmin.from("v_classes_expanded").select("*").order("name"),
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
