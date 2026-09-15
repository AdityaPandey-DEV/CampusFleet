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

    // Check existing duplicates in public.bookings
    const dupRes = await client.query(`
      SELECT trip_id, seat_number, count(*)
      FROM public.bookings
      WHERE status IN ('CONFIRMED', 'BOARDED') AND seat_number IS NOT NULL
      GROUP BY trip_id, seat_number
      HAVING count(*) > 1;
    `);

    console.log("Found existing duplicates:", dupRes.rows);

    if (dupRes.rows.length > 0) {
      console.log("Deduplicating existing duplicate bookings (keeping the earliest confirmed record)...");
      // Keep only the earliest booking, cancel duplicate extras
      await client.query(`
        UPDATE public.bookings
        SET status = 'CANCELLED'
        WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY trip_id, seat_number ORDER BY created_at ASC) as rnum
            FROM public.bookings
            WHERE status IN ('CONFIRMED', 'BOARDED') AND seat_number IS NOT NULL
          ) sub
          WHERE sub.rnum > 1
        );
      `);
      console.log("✓ Existing duplicates marked as CANCELLED.");
    }

    const sqlPath = path.resolve(process.cwd(), "supabase/migrations/20260915_booking_integrity_locks.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    await client.query(sqlContent);
    console.log("✓ Applied unique index uq_active_trip_seat & trigger trg_check_single_active_booking_per_shift successfully!");

    await client.end();
  } catch (err) {
    console.error("Migration execution detail:", err);
    await client.end();
  }
}

run().catch(console.error);
