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

async function run() {
  console.log("Connecting to PostgreSQL...");
  await client.connect();
  console.log("Connected successfully. Adding bus_id to public.bookings...");

  // 1. Add bus_id column to public.bookings
  await client.query(`
    ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS bus_id TEXT REFERENCES public.buses(id) ON DELETE SET NULL;
  `);
  console.log("✓ Added bus_id column to public.bookings");

  // 2. Backfill existing bookings bus_id from trips table
  const updateRes = await client.query(`
    UPDATE public.bookings b
    SET bus_id = t.bus_id
    FROM public.trips t
    WHERE b.trip_id = t.id AND (b.bus_id IS NULL OR b.bus_id = '');
  `);
  console.log(`✓ Backfilled bus_id on ${updateRes.rowCount} existing bookings`);

  // 3. Check for any orphan bookings and associate to default bus if needed
  await client.query(`
    UPDATE public.bookings
    SET bus_id = (SELECT id FROM public.buses LIMIT 1)
    WHERE bus_id IS NULL;
  `);
  console.log("✓ Ensured all bookings have valid bus_id");

  // 4. Force PostgREST to reload schema cache
  try {
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("✓ Sent NOTIFY pgrst, 'reload schema' to refresh PostgREST schema cache");
  } catch (err) {
    console.warn("Notice: could not notify pgrst:", err);
  }

  // 5. Verify columns of bookings table
  const colRes = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'bookings'
    ORDER BY ordinal_position;
  `);
  console.log("\nUpdated bookings table columns:", colRes.rows.map(r => `${r.column_name} (${r.data_type})`).join(", "));

  await client.end();
  console.log("\nMigration completed successfully!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
