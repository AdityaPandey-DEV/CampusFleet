import { redirect } from "next/navigation";

export default function TeacherCommuteRedirectPage() {
  redirect("/teacher?tab=my_commute");
}
