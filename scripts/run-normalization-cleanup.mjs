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
const envProd = parseEnv(path.resolve(__dirname, "../.env.production"));

const databases = [
  {
    name: "New Database (.env.local → POSTGRES_PRISMA_URL)",
    connectionString: envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL,
    host: envLocal.POSTGRES_HOST,
  },
  {
    name: "Old Database (.env.production → POSTGRES_URL_NON_POOLING)",
    connectionString: envProd.POSTGRES_URL_NON_POOLING || envProd.POSTGRES_PRISMA_URL || envProd.POSTGRES_URL,
    host: envProd.POSTGRES_HOST,
  },
];

async function run() {
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261021_database_normalization_cleanup.sql");
  const migrationSql = fs.readFileSync(migrationFile, "utf8");

  for (const db of databases) {
    console.log(`\n======================================================================`);
    console.log(`🚀 Connecting to: ${db.name}`);
    console.log(`Target Host: ${db.host}`);
    console.log(`======================================================================`);

    if (!db.connectionString) {
      console.error(`❌ Missing connection string for ${db.name}! Skipping.`);
      continue;
    }

    const client = new Client({
      connectionString: db.connectionString,
    });

    try {
      await client.connect();
      console.log(`Connected successfully! Applying normalization migration...`);
      await client.query(migrationSql);
      console.log(`✅ Successfully applied normalization migration to ${db.name}!`);

      // Verify: count tables and FKs
      const tableRes = await client.query(`
        SELECT count(*) as total_tables
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
      `);
      console.log(`📊 Total Base Tables: ${tableRes.rows[0].total_tables}`);

      const fkRes = await client.query(`
        SELECT count(*) as total_fks
        FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';
      `);
      console.log(`🔗 Total Foreign Keys: ${fkRes.rows[0].total_fks}`);

      // Verify dropped tables are gone
      const droppedCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('stop_routes', 'dispatch_config', 'otp_codes')
        ORDER BY table_name;
      `);
      if (droppedCheck.rows.length === 0) {
        console.log(`✅ Confirmed: stop_routes, dispatch_config, otp_codes are DROPPED`);
      } else {
        console.warn(`⚠️  Still found:`, droppedCheck.rows.map(r => r.table_name));
      }

      // Verify class_shift_schedules is KEPT
      const keptCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'class_shift_schedules';
      `);
      console.log(`✅ Confirmed: class_shift_schedules is KEPT (${keptCheck.rows.length} table)`);

      // Verify sync trigger exists
      const triggerCheck = await client.query(`
        SELECT trigger_name FROM information_schema.triggers
        WHERE trigger_name = 'trg_sync_schedule_to_demands';
      `);
      console.log(`✅ Sync trigger trg_sync_schedule_to_demands: ${triggerCheck.rows.length > 0 ? 'EXISTS' : 'MISSING!'}`);

      // Verify auth_otps table exists
      const otpCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'auth_otps';
      `);
      console.log(`✅ auth_otps table: ${otpCheck.rows.length > 0 ? 'EXISTS' : 'MISSING!'}`);

      // Verify plan_stops junction table exists
      const planStopsCheck = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'plan_stops';
      `);
      console.log(`✅ plan_stops junction table: ${planStopsCheck.rows.length > 0 ? 'EXISTS' : 'MISSING!'}`);

      // List all views
      const viewsRes = await client.query(`
        SELECT table_name FROM information_schema.views
        WHERE table_schema = 'public' ORDER BY table_name;
      `);
      console.log(`📋 Views: ${viewsRes.rows.map(r => r.table_name).join(', ')}`);

    } catch (err) {
      console.error(`❌ Error migrating ${db.name}:`, err.message || err);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }

  console.log(`\n✨ Normalization migration run completed!`);
}

run();
