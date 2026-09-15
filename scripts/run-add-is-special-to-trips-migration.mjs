import pkg from "pg";
import * as fs from "fs";
import * as path from "path";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let connectionString = process.env.POSTGRES_URL || "";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const matchPg = envContent.match(/POSTGRES_URL=["']?([^"'\n\r]+)["']?/);
    if (matchPg) connectionString = matchPg[1];
  }
} catch (e) {
  console.warn("Could not read .env.local", e);
}

if (!connectionString) {
  connectionString = "postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
}

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL database");

    const sqlPath = path.resolve(process.cwd(), "supabase/migrations/20260915_add_is_special_to_trips.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    await client.query(sqlContent);
    console.log("✓ Applied migration: 20260915_add_is_special_to_trips.sql");

    // Also, let's create a dedicated Placement Drive Trip if none exists so Admin can allocate students immediately!
    const checkTrip = await client.query("SELECT id FROM public.trips WHERE shift_id = 'shift-placement' OR route_id = 'route-bht-ddn-placement'");
    if (checkTrip.rows.length === 0) {
      console.log("Creating default placement drive trip in DB...");
      await client.query(`
        INSERT INTO public.trips (
          id, trip_code, route_id, bus_id, shift_id, trip_date, status, delay_minutes, manifest_locked, is_special, facility_type
        ) VALUES (
          'trip-bht-ddn-placement-2026-09-15',
          'TRIP-GEHU-C2C-DDN',
          'route-bht-ddn-placement',
          'bus-44',
          'shift-placement',
          CURRENT_DATE,
          'SCHEDULED',
          0,
          false,
          true,
          'PLACEMENT_DRIVE'
        )
        ON CONFLICT (id) DO UPDATE SET is_special = TRUE, facility_type = 'PLACEMENT_DRIVE';
      `);
      console.log("✓ Created placement trip 'trip-bht-ddn-placement-2026-09-15'");
    }

    const checkRes = await client.query("SELECT id, trip_code, shift_id, is_special, facility_type FROM public.trips WHERE is_special = TRUE");
    console.log("Special trips in DB:");
    console.table(checkRes.rows);

    await client.end();
  } catch (err) {
    console.error("Migration error:", err);
    await client.end();
    process.exit(1);
  }
}

run().catch(console.error);
