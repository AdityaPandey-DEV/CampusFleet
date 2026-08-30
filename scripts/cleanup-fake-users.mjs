import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Read .env.local
const envFile = fs.readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function cleanup() {
  console.log("Fetching all users from Supabase...");
  const { data: users, error: uErr } = await supabase.from("users").select("*");
  if (uErr) {
    console.error("Error fetching users:", uErr);
    return;
  }
  console.log("Current users in database:", users.map(u => ({ id: u.id, email: u.email, fullName: u.full_name, role: u.role })));

  const fakeEmails = [
    "student@gehu.ac.in",
    "priya.bht@gehu.ac.in",
    "rahul.ddn@gehu.ac.in",
    "aayush.bht@gehu.ac.in",
    "vikram.singh@gehu.ac.in",
  ];

  console.log("\nDeleting fake dummy users from 'users' table...");
  const { data: deletedUsers, error: delUsersErr } = await supabase
    .from("users")
    .delete()
    .in("email", fakeEmails)
    .select();
  
  if (delUsersErr) {
    console.error("Error deleting from users:", delUsersErr);
  } else {
    console.log(`Deleted ${deletedUsers?.length || 0} fake users:`, deletedUsers?.map(u => u.email));
  }

  console.log("\nDeleting fake dummy students from 'students' table...");
  const { data: deletedStudents, error: delStudErr } = await supabase
    .from("students")
    .delete()
    .in("email", fakeEmails)
    .select();

  if (delStudErr) {
    console.error("Error deleting from students:", delStudErr);
  } else {
    console.log(`Deleted ${deletedStudents?.length || 0} fake students:`, deletedStudents?.map(s => s.email));
  }

  console.log("\nRemaining real users in database:");
  const { data: finalUsers } = await supabase.from("users").select("id, email, full_name, role, provider");
  console.table(finalUsers);

  console.log("\nSyncing real student records into 'students' table...");
  const { data: realUserStudents } = await supabase.from("users").select("*").eq("role", "student");
  for (const u of realUserStudents || []) {
    const { error: insErr } = await supabase.from("students").upsert({
      id: `stud-${u.id}`,
      user_id: u.id,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone || "+91 98765 43210",
      department: "B.Tech Computer Science & Engineering",
      semester: "5th Semester",
      enrollment_no: u.email.includes("student.commuter") ? "GEHU/2023/1045" : (u.email.includes("ananya") ? "GEHU/2023/1092" : "GEHU/2023/1108"),
      has_active_subscription: true,
    });
    if (insErr) console.error("Error upserting student for", u.email, insErr);
  }

  console.log("\nFinal real students in database:");
  const { data: finalStudents, error: selErr } = await supabase.from("students").select("*");
  if (selErr) console.error("Select students error:", selErr);
  console.table(finalStudents);
}

cleanup().catch(console.error);
