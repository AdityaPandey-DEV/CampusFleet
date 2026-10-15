import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import { getRolesWithHierarchy, getSystemCards } from "@/modules/rbac/rbac-service";
import HierarchyFlowchartView from "@/modules/rbac/HierarchyFlowchartView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RoleHierarchyFlowchartPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login?redirect=/role-manager/hierarchy");
  }

  if (session.role !== "admin" && session.role !== "role_manager") {
    redirect("/portal");
  }

  const [roles, cards] = await Promise.all([
    getRolesWithHierarchy(),
    getSystemCards(),
  ]);

  return (
    <div className="space-y-6">
      <HierarchyFlowchartView initialRoles={roles} initialCards={cards} />
    </div>
  );
}
