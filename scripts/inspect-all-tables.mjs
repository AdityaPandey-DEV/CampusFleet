import pkg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const envLocal = parseEnv(path.resolve(__dirname, "../.env.local"));

const client = new Client({
  connectionString: envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL,
});

await client.connect();

const candidateFKs = [
  // buses
  { table: "buses", col: "current_route_id", refTable: "routes", refCol: "id" },

  // bus_departure_alerts
  { table: "bus_departure_alerts", col: "trip_id", refTable: "trips", refCol: "id" },
  { table: "bus_departure_alerts", col: "bus_id", refTable: "buses", refCol: "id" },

  // bus_merge_points
  { table: "bus_merge_points", col: "route_id", refTable: "routes", refCol: "id" },
  { table: "bus_merge_points", col: "stop_id", refTable: "stops", refCol: "id" },

  // bus_merge_suggestions
  { table: "bus_merge_suggestions", col: "merge_point_id", refTable: "bus_merge_points", refCol: "id" },
  { table: "bus_merge_suggestions", col: "route_id", refTable: "routes", refCol: "id" },
  { table: "bus_merge_suggestions", col: "source_bus_id", refTable: "buses", refCol: "id" },
  { table: "bus_merge_suggestions", col: "target_bus_id", refTable: "buses", refCol: "id" },

  // bus_switch_requests
  { table: "bus_switch_requests", col: "student_id", refTable: "students", refCol: "id" },
  { table: "bus_switch_requests", col: "current_bus_id", refTable: "buses", refCol: "id" },
  { table: "bus_switch_requests", col: "requested_bus_id", refTable: "buses", refCol: "id" },
  { table: "bus_switch_requests", col: "current_stop_id", refTable: "stops", refCol: "id" },
  { table: "bus_switch_requests", col: "requested_stop_id", refTable: "stops", refCol: "id" },

  // bus_reservations
  { table: "bus_reservations", col: "student_id", refTable: "students", refCol: "id" },
  { table: "bus_reservations", col: "trip_id", refTable: "trips", refCol: "id" },
  { table: "bus_reservations", col: "boarding_stop_id", refTable: "stops", refCol: "id" },
  { table: "bus_reservations", col: "shift_id", refTable: "shifts", refCol: "id" },

  // subscriptions
  { table: "subscriptions", col: "student_id", refTable: "students", refCol: "id" },
  { table: "subscriptions", col: "plan_id", refTable: "subscription_plans", refCol: "id" },

  // maintenance_logs
  { table: "maintenance_logs", col: "bus_id", refTable: "buses", refCol: "id" },

  // maintenance_requests
  { table: "maintenance_requests", col: "bus_id", refTable: "buses", refCol: "id" },

  // notifications
  { table: "notifications", col: "user_id", refTable: "users", refCol: "id" },

  // staff
  { table: "staff", col: "user_id", refTable: "users", refCol: "id" },

  // routes
  { table: "routes", col: "campus_id", refTable: "campuses", refCol: "id" },
  { table: "routes", col: "origin_campus_id", refTable: "campuses", refCol: "id" },
  { table: "routes", col: "destination_campus_id", refTable: "campuses", refCol: "id" },

  // stops
  { table: "stops", col: "campus_id", refTable: "campuses", refCol: "id" },

  // stop_routes
  { table: "stop_routes", col: "stop_id", refTable: "stops", refCol: "id" },
  { table: "stop_routes", col: "route_id", refTable: "routes", refCol: "id" },
  { table: "stop_routes", col: "bus_id", refTable: "buses", refCol: "id" },

  // route_stops
  { table: "route_stops", col: "route_id", refTable: "routes", refCol: "id" },
  { table: "route_stops", col: "stop_id", refTable: "stops", refCol: "id" },

  // trips
  { table: "trips", col: "route_id", refTable: "routes", refCol: "id" },
  { table: "trips", col: "bus_id", refTable: "buses", refCol: "id" },
  { table: "trips", col: "shift_id", refTable: "shifts", refCol: "id" },
  { table: "trips", col: "driver_id", refTable: "staff", refCol: "id" },
  { table: "trips", col: "conductor_id", refTable: "staff", refCol: "id" },

  // special_shift_allocations
  { table: "special_shift_allocations", col: "shift_id", refTable: "shifts", refCol: "id" },
  { table: "special_shift_allocations", col: "student_id", refTable: "students", refCol: "id" },
  { table: "special_shift_allocations", col: "trip_id", refTable: "trips", refCol: "id" },
  { table: "special_shift_allocations", col: "allocated_by", refTable: "users", refCol: "id" },

  // dynamic_route_plans
  { table: "dynamic_route_plans", col: "shift_id", refTable: "shifts", refCol: "id" },
  { table: "dynamic_route_plans", col: "bus_id", refTable: "buses", refCol: "id" }
];

console.log("Checking candidate Foreign Keys on New DB...");

// Get existing FKs
const fkRes = await client.query(`
  SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
  FROM information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public';
`);

const existingSet = new Set(
  fkRes.rows.map(r => `${r.table_name}.${r.column_name}->${r.foreign_table_name}.${r.foreign_column_name}`)
);

console.log(`Found ${existingSet.size} existing FKs.`);

for (const fk of candidateFKs) {
  const key = `${fk.table}.${fk.col}->${fk.refTable}.${fk.refCol}`;
  const alreadyExists = existingSet.has(key);

  // Check if table and col exist
  const colCheck = await client.query(`
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = $1 AND column_name = $2;
  `, [fk.table, fk.col]);

  if (colCheck.rows.length === 0) {
    console.log(`[NOT FOUND] ${key} - column does not exist!`);
    continue;
  }

  const colType = colCheck.rows[0].data_type;

  // Check ref column type
  const refCheck = await client.query(`
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = $1 AND column_name = $2;
  `, [fk.refTable, fk.refCol]);

  if (refCheck.rows.length === 0) {
    console.log(`[REF NOT FOUND] ${key} - ref table/column does not exist!`);
    continue;
  }

  const refType = refCheck.rows[0].data_type;

  // Check orphan count
  let orphanCount = -1;
  try {
    const orphanRes = await client.query(`
      SELECT COUNT(*) as cnt 
      FROM "${fk.table}" t
      WHERE t."${fk.col}" IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM "${fk.refTable}" r WHERE r."${fk.refCol}" = t."${fk.col}"
        );
    `);
    orphanCount = parseInt(orphanRes.rows[0].cnt, 10);
  } catch (err) {
    orphanCount = `ERROR: ${err.message}`;
  }

  console.log(`[${alreadyExists ? 'EXISTS' : 'MISSING'}] ${key} (${colType} -> ${refType}) | Orphans: ${orphanCount}`);
}

await client.end();
