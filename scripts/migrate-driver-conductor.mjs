import fs from "fs";
import pg from "pg";
const { Client } = pg;

// Read .env.local
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const client = new Client({
  connectionString: env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log("Connecting to PostgreSQL...");
  await client.connect();
  console.log("Connected successfully. Running driver/conductor schema updates...");

  // 1. Add boarded_at to bookings table
  await client.query(`
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS boarded_at TIMESTAMPTZ;
  `);
  console.log("✓ Added boarded_at column to public.bookings");

  // 2. Create vehicle_issues table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.vehicle_issues (
      id TEXT PRIMARY KEY,
      bus_id TEXT NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
      bus_number TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
  `);
  console.log("✓ Created public.vehicle_issues table");

  // 3. Create notifications table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'SYSTEM',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ Created public.notifications table");

  await client.end();
  console.log("Migration complete!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
