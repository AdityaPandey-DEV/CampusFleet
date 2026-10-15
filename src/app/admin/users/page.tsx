import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RedirectAdminUsersPage() {
  redirect("/role-manager/users");
}
