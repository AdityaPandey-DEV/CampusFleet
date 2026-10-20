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

const targetTables = [
  "auth_otps",
  "otp_codes",
  "dispatch_config",
  "dispatch_configs",
  "stop_routes",
  "route_stops",
  "shift_demands",
  "class_shift_schedules",
  "bookings",
  "bus_reservations",
  "students",
  "staff",
  "stops",
  "routes",
  "vehicle_issues"
];

const res = await client.query(`
  SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = ANY($1)
  ORDER BY table_name, ordinal_position;
`, [targetTables]);

const countsRes = await client.query(`
  SELECT 
    schemaname, 
    relname as table_name, 
    n_live_tup as row_count 
  FROM pg_stat_user_tables 
  WHERE relname = ANY($1);
`, [targetTables]);

// Also check views that might depend on these
const viewsRes = await client.query(`
  SELECT table_name, view_definition
  FROM information_schema.views
  WHERE table_schema = 'public';
`);

console.log("=== TABLE COUNTS ===");
for (const row of countsRes.rows) {
  console.log(`${row.table_name}: ~${row.row_count} rows`);
}

console.log("\n=== VIEWS DEFINITION SUMMARY ===");
for (const v of viewsRes.rows) {
  console.log(`View: ${v.table_name}`);
  for (const tbl of targetTables) {
    if (v.view_definition && v.view_definition.includes(tbl)) {
      console.log(`  -> references ${tbl}`);
    }
  }
}

console.log("\n=== COLUMNS PER TABLE ===");
const byTable = {};
for (const row of res.rows) {
  if (!byTable[row.table_name]) byTable[row.table_name] = [];
  byTable[row.table_name].push(`${row.column_name} (${row.data_type})`);
}
for (const [tbl, cols] of Object.entries(byTable)) {
  console.log(`\nTable: ${tbl}`);
  console.log(`  Columns: ${cols.join(", ")}`);
}

await client.end();
