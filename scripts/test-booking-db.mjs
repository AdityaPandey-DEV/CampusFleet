import { createClient } from "@supabase/supabase-js";
import fs from "fs";

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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

// Test with anon client (same client used by browser!)
const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

async function testBooking() {
  console.log("1. Fetching all bookings with adminClient...");
  const { data: adminBookings, error: bErr } = await adminClient.from("bookings").select("*");
  console.log("Admin bookings count:", adminBookings?.length, "Error:", bErr);
  console.table(adminBookings);

  console.log("\n2. Fetching all bookings with anonClient (browser client)...");
  const { data: anonBookings, error: aErr } = await anonClient.from("bookings").select("*");
  console.log("Anon bookings count:", anonBookings?.length, "Error:", aErr);

  console.log("\n3. Testing insert via anonClient (simulating browser bookShift)...");
  const testId = `bk-test-${Date.now()}`;
  const { data: insData, error: insErr } = await anonClient.from("bookings").insert({
    id: testId,
    booking_code: "TEST-01",
    student_id: "stud-usr-student-4",
    trip_id: "trip-morning-1",
    boarding_stop_id: "stop-kathgodam",
    status: "CONFIRMED",
    seat_number: "2B",
    booking_date: new Date().toISOString().split("T")[0],
    created_at: new Date().toISOString(),
  }).select();

  console.log("Insert result with anonClient:", insData, "Error:", insErr);

  if (insErr) {
    console.error("FATAL: anonClient cannot insert into bookings table due to:", insErr);
  } else {
    // Cleanup test record
    await adminClient.from("bookings").delete().eq("id", testId);
    console.log("✓ Test insert succeeded and cleaned up.");
  }
}

testBooking().catch(console.error);
