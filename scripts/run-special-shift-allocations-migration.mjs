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

    const sqlPath = path.resolve(process.cwd(), "supabase/migrations/20260915_special_shift_allocations.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    await client.query(sqlContent);
    console.log("✓ Successfully applied 20260915_special_shift_allocations.sql");

    // Verify shifts after update
    const res = await client.query("SELECT id, name, type, is_special FROM public.shifts ORDER BY start_time ASC");
    console.log("Shifts in DB with is_special flag:");
    console.table(res.rows);

    await client.end();
  } catch (err) {
    console.error("Migration error:", err);
    await client.end();
    process.exit(1);
  }
}

run().catch(console.error);
