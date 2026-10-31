import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepInspect() {
  console.log("=== SHIFTS ===");
  const { data: shifts } = await supabase.from("shifts").select("*");
  console.log(JSON.stringify(shifts, null, 2));

  console.log("=== BUSES ===");
  const { data: buses } = await supabase.from("buses").select("id, bus_number, registration_no, capacity, status, current_route_id");
  console.log(JSON.stringify(buses, null, 2));

  console.log("=== ROUTES ===");
  const { data: routes } = await supabase.from("routes").select("id, code, name, direction, is_active");
  console.log(JSON.stringify(routes, null, 2));

  console.log("=== TRIPS DATES ===");
  const { data: tripDates } = await supabase.from("trips").select("trip_date");
  const counts = {};
  tripDates?.forEach(t => {
    counts[t.trip_date] = (counts[t.trip_date] || 0) + 1;
  });
  console.log("Trip date counts (top 15):", Object.entries(counts).sort((a,b) => b[0].localeCompare(a[0])).slice(0, 15));

  console.log("=== STUDENTS (Sample 10) ===");
  const { data: students } = await supabase.from("students").select("id, full_name, semester, student_id_code, primary_route_id, primary_stop_id").limit(10);
  console.log(JSON.stringify(students, null, 2));
}

deepInspect().catch(console.error);
