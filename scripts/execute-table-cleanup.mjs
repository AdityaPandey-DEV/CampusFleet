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
const connectionString = envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL;

if (!connectionString) {
  console.error("No database connection string found in .env.local!");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();
console.log("Connected to database. Executing table cleanup migration...\n");

try {
  await client.query("BEGIN;");

  // 1. Ensure auth_otps schema
  console.log("1. Ensuring auth_otps schema...");
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_otps' AND column_name='max_attempts') THEN
        ALTER TABLE public.auth_otps ADD COLUMN max_attempts INTEGER DEFAULT 5;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_otps' AND column_name='used') THEN
        ALTER TABLE public.auth_otps ADD COLUMN used BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS idx_auth_otps_email_used ON public.auth_otps (email, used);
    CREATE INDEX IF NOT EXISTS idx_auth_otps_expires_at ON public.auth_otps (expires_at);
  `);
  console.log("   ✓ auth_otps prepared with secure columns & indexes.");

  // 2. Drop dispatch_config (singular)
  console.log("2. Dropping redundant dispatch_config (singular)...");
  await client.query("DROP TABLE IF EXISTS public.dispatch_config CASCADE;");
  console.log("   ✓ dispatch_config dropped (dispatch_configs plural is the active table).");

  // 3. Drop stop_routes and replace with view pointing to route_stops
  console.log("3. Replacing stop_routes with compatibility view over route_stops...");
  await client.query("DROP TABLE IF EXISTS public.stop_routes CASCADE;");
  await client.query(`
    CREATE OR REPLACE VIEW public.stop_routes AS
    SELECT 
      route_id,
      stop_id,
      stop_order,
      NULL::uuid as bus_id,
      NOW() as created_at
    FROM public.route_stops;
  `);
  console.log("   ✓ stop_routes table replaced with backward-compatible view.");

  // 4. Drop otp_codes (plaintext OTP table)
  console.log("4. Dropping plaintext otp_codes table...");
  await client.query("DROP TABLE IF EXISTS public.otp_codes CASCADE;");
  console.log("   ✓ otp_codes dropped (app now uses auth_otps with sha256).");

  // 5. Auto-sync trigger: class_shift_schedules -> shift_demands
  console.log("5. Creating auto-sync trigger: class_shift_schedules -> shift_demands...");
  await client.query(`
    CREATE OR REPLACE FUNCTION public.fn_sync_schedule_to_demands()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.shift_demands (class_id, day_of_week, incoming_shift_id, outgoing_shift_id, is_today_off, notes, updated_at)
      VALUES (NEW.class_id, NEW.day_of_week, NEW.incoming_shift_id, NEW.outgoing_shift_id, NEW.is_today_off, NEW.notes, NOW())
      ON CONFLICT (class_id, day_of_week) DO UPDATE SET
        incoming_shift_id = EXCLUDED.incoming_shift_id,
        outgoing_shift_id = EXCLUDED.outgoing_shift_id,
        is_today_off = EXCLUDED.is_today_off,
        notes = EXCLUDED.notes,
        updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_schedule_to_demands ON public.class_shift_schedules;
    CREATE TRIGGER trg_sync_schedule_to_demands
    AFTER INSERT OR UPDATE ON public.class_shift_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_schedule_to_demands();
  `);
  console.log("   ✓ Auto-sync trigger active: class timetable changes auto-propagate to fleet demands.");

  await client.query("COMMIT;");
  console.log("\n✅ ALL TABLE NORMALIZATION CLEANUP COMPLETED SUCCESSFULLY!");
} catch (err) {
  await client.query("ROLLBACK;");
  console.error("❌ Migration failed, rolled back:", err);
  process.exit(1);
} finally {
  await client.end();
}
