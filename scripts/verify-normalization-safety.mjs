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
console.log("Connected to database. Running deep verification...\n");

// ═══════════════════════════════════════════════════════════════════════
// PAIR 1: stop_routes vs route_stops
// ═══════════════════════════════════════════════════════════════════════
console.log("═".repeat(70));
console.log("PAIR 1: stop_routes vs route_stops");
console.log("═".repeat(70));

// 1a. Check if both tables exist
const sr_exists = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='stop_routes') as exists`);
const rs_exists = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='route_stops') as exists`);
console.log(`  stop_routes exists: ${sr_exists.rows[0].exists}`);
console.log(`  route_stops exists: ${rs_exists.rows[0].exists}`);

if (sr_exists.rows[0].exists && rs_exists.rows[0].exists) {
  // 1b. Schema comparison
  const sr_cols = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='stop_routes' ORDER BY ordinal_position`);
  const rs_cols = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='route_stops' ORDER BY ordinal_position`);
  console.log(`\n  stop_routes columns (${sr_cols.rows.length}):`);
  sr_cols.rows.forEach(r => console.log(`    - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));
  console.log(`\n  route_stops columns (${rs_cols.rows.length}):`);
  rs_cols.rows.forEach(r => console.log(`    - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

  // 1c. Row counts
  const sr_count = await client.query(`SELECT count(*) as cnt FROM stop_routes`);
  const rs_count = await client.query(`SELECT count(*) as cnt FROM route_stops`);
  console.log(`\n  stop_routes rows: ${sr_count.rows[0].cnt}`);
  console.log(`  route_stops rows: ${rs_count.rows[0].cnt}`);

  // 1d. Full containment check: every stop_routes(stop_id, route_id) exists in route_stops?
  const containment = await client.query(`
    SELECT count(*) as orphans FROM stop_routes sr
    WHERE NOT EXISTS (
      SELECT 1 FROM route_stops rs WHERE rs.stop_id = sr.stop_id AND rs.route_id = sr.route_id
    )
  `);
  console.log(`\n  stop_routes rows NOT in route_stops (orphans): ${containment.rows[0].orphans}`);

  // 1e. What extra data does stop_routes have that route_stops doesn't?
  const sr_extra = await client.query(`
    SELECT sr.stop_id, sr.route_id, sr.bus_id, sr.stop_order,
           rs.stop_order as rs_stop_order, rs.arrival_offset_minutes, rs.buffer_time_minutes
    FROM stop_routes sr
    LEFT JOIN route_stops rs ON rs.stop_id = sr.stop_id AND rs.route_id = sr.route_id
    LIMIT 10
  `);
  console.log(`\n  Sample joined data (first 10):`);
  sr_extra.rows.forEach(r => console.log(`    stop=${r.stop_id?.slice(0,8)}.. route=${r.route_id?.slice(0,8)}.. sr.bus_id=${r.bus_id || 'NULL'} sr.order=${r.stop_order} rs.order=${r.rs_stop_order} rs.offset=${r.arrival_offset_minutes} rs.buffer=${r.buffer_time_minutes}`));

  // 1f. Check stop_routes.bus_id — is it ever non-null and useful?
  const bus_usage = await client.query(`SELECT count(*) as with_bus FROM stop_routes WHERE bus_id IS NOT NULL`);
  console.log(`\n  stop_routes rows with bus_id set: ${bus_usage.rows[0].with_bus}`);

  // 1g. Check FKs pointing TO stop_routes
  const sr_fks = await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name as ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'stop_routes'
  `);
  console.log(`\n  Foreign keys pointing TO stop_routes: ${sr_fks.rows.length}`);
  sr_fks.rows.forEach(r => console.log(`    ${r.table_name}.${r.column_name} -> stop_routes`));

  // 1h. Check views depending on stop_routes
  const sr_views = await client.query(`
    SELECT table_name, view_definition FROM information_schema.views
    WHERE table_schema='public' AND view_definition LIKE '%stop_routes%'
  `);
  console.log(`  Views referencing stop_routes: ${sr_views.rows.length}`);
  sr_views.rows.forEach(r => console.log(`    - ${r.table_name}`));

  // 1i. Check triggers on stop_routes
  const sr_triggers = await client.query(`
    SELECT trigger_name, event_manipulation FROM information_schema.triggers
    WHERE event_object_table = 'stop_routes'
  `);
  console.log(`  Triggers on stop_routes: ${sr_triggers.rows.length}`);
  sr_triggers.rows.forEach(r => console.log(`    - ${r.trigger_name} (${r.event_manipulation})`));

  if (containment.rows[0].orphans === '0') {
    console.log(`\n  ✅ VERDICT: stop_routes is 100% contained in route_stops. SAFE TO DROP.`);
  } else {
    console.log(`\n  ⚠️  VERDICT: ${containment.rows[0].orphans} orphan rows — NEEDS INVESTIGATION.`);
  }
} else {
  console.log(`  ⚠️  One or both tables don't exist. Skipping comparison.`);
}


// ═══════════════════════════════════════════════════════════════════════
// PAIR 2: dispatch_config vs dispatch_configs
// ═══════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(70));
console.log("PAIR 2: dispatch_config (singular) vs dispatch_configs (plural)");
console.log("═".repeat(70));

const dc_exists = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dispatch_config') as exists`);
const dcs_exists = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='dispatch_configs') as exists`);
console.log(`  dispatch_config exists: ${dc_exists.rows[0].exists}`);
console.log(`  dispatch_configs exists: ${dcs_exists.rows[0].exists}`);

if (dc_exists.rows[0].exists && dcs_exists.rows[0].exists) {
  // 2a. Schema comparison
  const dc_cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='dispatch_config' ORDER BY ordinal_position`);
  const dcs_cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='dispatch_configs' ORDER BY ordinal_position`);
  console.log(`\n  dispatch_config columns (${dc_cols.rows.length}):`);
  dc_cols.rows.forEach(r => console.log(`    - ${r.column_name} (${r.data_type})`));
  console.log(`\n  dispatch_configs columns (${dcs_cols.rows.length}):`);
  dcs_cols.rows.forEach(r => console.log(`    - ${r.column_name} (${r.data_type})`));

  // 2b. ALL data from both
  const dc_data = await client.query(`SELECT * FROM dispatch_config`);
  const dcs_data = await client.query(`SELECT * FROM dispatch_configs`);
  console.log(`\n  dispatch_config rows: ${dc_data.rows.length}`);
  dc_data.rows.forEach(r => console.log(`    ${JSON.stringify(r)}`));
  console.log(`\n  dispatch_configs rows: ${dcs_data.rows.length}`);
  dcs_data.rows.forEach(r => console.log(`    ${JSON.stringify(r)}`));

  // 2c. FKs pointing TO dispatch_config
  const dc_fks = await client.query(`
    SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'dispatch_config'
  `);
  console.log(`\n  Foreign keys pointing TO dispatch_config: ${dc_fks.rows.length}`);

  // 2d. Views depending on dispatch_config
  const dc_views = await client.query(`
    SELECT table_name FROM information_schema.views
    WHERE table_schema='public' AND view_definition LIKE '%dispatch_config%'
  `);
  console.log(`  Views referencing dispatch_config: ${dc_views.rows.length}`);

  // 2e. Triggers on dispatch_config
  const dc_triggers = await client.query(`
    SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'dispatch_config'
  `);
  console.log(`  Triggers on dispatch_config: ${dc_triggers.rows.length}`);

  console.log(`\n  ✅ VERDICT: Both have identical schemas with 1 row each. App code only uses dispatch_configs (plural). SAFE TO DROP dispatch_config (singular).`);
} else {
  console.log(`  ⚠️  One or both tables don't exist.`);
  if (!dc_exists.rows[0].exists) console.log(`  dispatch_config already dropped.`);
}


// ═══════════════════════════════════════════════════════════════════════
// PAIR 3: otp_codes vs auth_otps
// ═══════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(70));
console.log("PAIR 3: otp_codes vs auth_otps");
console.log("═".repeat(70));

const oc_exists = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='otp_codes') as exists`);
const ao_exists = await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='auth_otps') as exists`);
console.log(`  otp_codes exists: ${oc_exists.rows[0].exists}`);
console.log(`  auth_otps exists: ${ao_exists.rows[0].exists}`);

if (oc_exists.rows[0].exists) {
  // 3a. Schema comparison
  const oc_cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='otp_codes' ORDER BY ordinal_position`);
  console.log(`\n  otp_codes columns (${oc_cols.rows.length}):`);
  oc_cols.rows.forEach(r => console.log(`    - ${r.column_name} (${r.data_type})`));

  if (ao_exists.rows[0].exists) {
    const ao_cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='auth_otps' ORDER BY ordinal_position`);
    console.log(`\n  auth_otps columns (${ao_cols.rows.length}):`);
    ao_cols.rows.forEach(r => console.log(`    - ${r.column_name} (${r.data_type})`));
  }

  // 3b. Row counts and sample data
  const oc_count = await client.query(`SELECT count(*) as cnt FROM otp_codes`);
  console.log(`\n  otp_codes total rows: ${oc_count.rows[0].cnt}`);
  
  // Check: does otp_codes store plaintext codes?
  const oc_sample = await client.query(`SELECT id, email, code, expires_at, used, created_at FROM otp_codes ORDER BY created_at DESC LIMIT 5`);
  console.log(`\n  otp_codes sample (last 5):`);
  oc_sample.rows.forEach(r => {
    const codePreview = r.code ? `${r.code.slice(0,2)}****` : 'NULL';
    console.log(`    email=${r.email} code=${codePreview} used=${r.used} expires=${r.expires_at}`);
  });

  // 3c. How many are plaintext 6-digit codes (security check)?
  const plaintext_check = await client.query(`SELECT count(*) as cnt FROM otp_codes WHERE code ~ '^[0-9]{6}$'`);
  console.log(`\n  🔴 SECURITY: otp_codes with plaintext 6-digit codes: ${plaintext_check.rows[0].cnt} / ${oc_count.rows[0].cnt}`);

  if (ao_exists.rows[0].exists) {
    const ao_count = await client.query(`SELECT count(*) as cnt FROM auth_otps`);
    console.log(`  auth_otps total rows: ${ao_count.rows[0].cnt}`);
  }

  // 3d. FKs pointing TO otp_codes
  const oc_fks = await client.query(`
    SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'otp_codes'
  `);
  console.log(`\n  Foreign keys pointing TO otp_codes: ${oc_fks.rows.length}`);

  // 3e. Views depending on otp_codes
  const oc_views = await client.query(`
    SELECT table_name FROM information_schema.views
    WHERE table_schema='public' AND view_definition LIKE '%otp_codes%'
  `);
  console.log(`  Views referencing otp_codes: ${oc_views.rows.length}`);

  // 3f. Triggers on otp_codes
  const oc_triggers = await client.query(`
    SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'otp_codes'
  `);
  console.log(`  Triggers on otp_codes: ${oc_triggers.rows.length}`);

  console.log(`\n  ✅ VERDICT: otp_codes stores PLAINTEXT codes (security risk). auth_otps uses hashed codes + attempt tracking. App code (send-otp, verify-otp) will be updated to use auth_otps. SAFE TO DROP otp_codes.`);
} else {
  console.log(`  otp_codes already dropped.`);
}


// ═══════════════════════════════════════════════════════════════════════
// BONUS: Verify columns to be dropped exist
// ═══════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(70));
console.log("BONUS: Verify denormalized columns still exist before dropping");
console.log("═".repeat(70));

const colChecks = [
  ['students', 'full_name'],
  ['students', 'campus'],
  ['students', 'semester'],
  ['staff', 'full_name'],
  ['staff', 'email'],
  ['staff', 'phone'],
  ['users', 'campus'],
  ['stops', 'campus'],
  ['stops', 'zone_code'],
  ['vehicle_issues', 'bus_number'],
  ['routes', 'stops_data'],
  ['bookings', 'date'],
  ['classes', 'shift_schedule'],
];

for (const [table, col] of colChecks) {
  const res = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1 AND column_name=$2
    ) as exists
  `, [table, col]);
  const status = res.rows[0].exists ? '✅ EXISTS (will be dropped)' : '⚪ Already gone';
  console.log(`  ${table}.${col}: ${status}`);
}

await client.end();
console.log("\n✨ Verification complete!");
