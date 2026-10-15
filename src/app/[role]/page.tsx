import { RoleDeskView } from "@/components/common/RoleDeskView";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

interface DynamicRolePageProps {
  params: {
    role: string;
  };
}

export async function generateMetadata({ params }: DynamicRolePageProps): Promise<Metadata> {
  const roleName = params.role.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${roleName} Desk | CampusFleet`,
  };
}

export default function DynamicRolePage({ params }: DynamicRolePageProps) {
  return <RoleDeskView roleKey={params.role} />;
}
