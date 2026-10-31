import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log("=== INSPECTING DATABASE TABLES ===");
  
  const tables = [
    "campuses",
    "buses",
    "shifts",
    "routes",
    "stops",
    "route_stops",
    "trips",
    "staff",
    "students",
    "bookings",
    "special_shift_allocations",
    "bus_merges"
  ];

  for (const table of tables) {
    const { data, count, error } = await supabase
      .from(table)
      .select("*", { count: "exact" })
      .limit(3);

    if (error) {
      console.log(`Table [${table}]: ERROR - ${error.message}`);
    } else {
      console.log(`Table [${table}]: ${count} rows`);
      if (data && data.length > 0) {
        console.log(`  Sample 1:`, JSON.stringify(data[0]));
        if (data.length > 1) {
          console.log(`  Sample 2:`, JSON.stringify(data[1]));
        }
      }
    }
  }
}

inspectDatabase().catch(console.error);
