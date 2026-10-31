import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fullInspection() {
  const tables = [
    "campuses", "classes", "buses", "shifts", "routes", "stops", "route_stops", 
    "trips", "staff", "students", "bookings", "users", "subscriptions", "audit_logs",
    "special_shift_allocations", "notifications"
  ];
  
  const report = {};
  for (const t of tables) {
    const { data, count, error } = await supabase.from(t).select("*", { count: "exact" }).limit(5);
    if (error) {
      report[t] = { error: error.message };
    } else {
      const sample = data?.[0] || {};
      const idFields = {};
      for (const [k, v] of Object.entries(sample)) {
        if (k === "id" || k.endsWith("_id") || k.endsWith("Id") || k.includes("code")) {
          const allVals = data.map(d => d[k]);
          const strVal = v != null ? String(v) : "";
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strVal);
          const isNum = typeof v === "number" || (!isNaN(Number(strVal)) && strVal !== "" && !strVal.includes("-"));
          
          let format = "NULL / UNKNOWN";
          if (v != null) {
            if (typeof v === "number") format = "INT / BIGINT";
            else if (isUuid) format = "UUIDv4";
            else if (strVal.startsWith("bk_")) format = "PREFIXED_TIMESTAMP_HASH (e.g. bk_1788...)";
            else if (strVal.startsWith("trip-")) format = "COMPOSITE_SLUG (e.g. trip-route-bus-37-m...)";
            else if (strVal.includes("-")) format = "SLUG / PREFIXED STRING (e.g. route-bus-44, stop-lamachaur)";
            else format = "RAW STRING";
          }

          idFields[k] = {
            sampleValue: v,
            format: format,
            allSamples: allVals.slice(0, 3)
          };
        }
      }
      report[t] = {
        rowCount: count,
        idFields
      };
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

fullInspection();
