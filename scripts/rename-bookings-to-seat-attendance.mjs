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
console.log("Connected to database. Renaming bookings -> seat_attendance...\n");

try {
  await client.query("BEGIN;");

  // 1. Rename table bookings to seat_attendance
  console.log("1. Renaming bookings table to seat_attendance...");
  await client.query("ALTER TABLE public.bookings RENAME TO seat_attendance;");
  console.log("   ✓ Table renamed to seat_attendance.");

  // 2. Drop dependent view bookings_full first
  console.log("2. Dropping old bookings_full view definition...");
  await client.query("DROP VIEW IF EXISTS public.bookings_full CASCADE;");

  // 3. Drop redundant date column from seat_attendance (booking_date is canonical)
  console.log("3. Dropping redundant date column from seat_attendance...");
  await client.query("ALTER TABLE public.seat_attendance DROP COLUMN IF EXISTS date;");
  console.log("   ✓ Redundant date column dropped (booking_date retained).");

  // 4. Recreate bookings_full view pointing to seat_attendance
  console.log("4. Recreating bookings_full view...");
  await client.query(`
    CREATE OR REPLACE VIEW public.bookings_full AS
    SELECT b.id,
      b.booking_code,
      b.student_id,
      b.trip_id,
      COALESCE(b.bus_id, t.bus_id) AS bus_id,
      t.trip_code,
      COALESCE(b.booking_date, (t.trip_date)::text) AS booking_date,
      b.boarding_stop_id,
      bs.name AS boarding_stop_name,
      b.status,
      b.waitlist_position,
      b.seat_number,
      b.passenger_type,
      b.merge_stop_id,
      b.boarded_at,
      b.created_at
    FROM public.seat_attendance b
    LEFT JOIN public.trips t ON (t.id = b.trip_id)
    LEFT JOIN public.stops bs ON (bs.id = b.boarding_stop_id);
  `);
  console.log("   ✓ bookings_full view updated to point to seat_attendance.");

  // 5. Create backward-compatible updatable view for bookings
  console.log("5. Creating backward-compatible updatable bookings view...");
  await client.query(`
    CREATE OR REPLACE VIEW public.bookings AS
    SELECT * FROM public.seat_attendance;
  `);
  console.log("   ✓ bookings compatibility view created (allows read/write compatibility).");

  // 6. Drop csrf_tokens
  console.log("6. Dropping obsolete csrf_tokens table...");
  await client.query("DROP TABLE IF EXISTS public.csrf_tokens CASCADE;");
  console.log("   ✓ csrf_tokens table dropped.");

  await client.query("COMMIT;");
  console.log("\n✅ RENAME TO seat_attendance COMPLETED SUCCESSFULLY!");
} catch (err) {
  await client.query("ROLLBACK;");
  console.error("❌ Migration failed, rolled back:", err);
  process.exit(1);
} finally {
  await client.end();
}
