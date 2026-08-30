import pg from "pg";
import fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
}

const { Client } = pg;
const client = new Client({
  connectionString: env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  await client.connect();
  console.log("Connected to PostgreSQL...");

  // 1. Add booking_date column if not exists
  await client.query(`
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date TEXT DEFAULT CURRENT_DATE::TEXT;
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date TEXT DEFAULT CURRENT_DATE::TEXT;
  `);
  console.log("✓ Added booking_date column to bookings table.");

  // 2. Check RLS policies on bookings table to ensure anon/authenticated can insert, select, update
  await client.query(`
    ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for bookings" ON bookings;
    CREATE POLICY "Allow all for bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
  `);
  console.log("✓ Ensured open RLS policy on bookings table.");

  await client.end();
  console.log("Migration finished.");
}

migrate().catch(console.error);
