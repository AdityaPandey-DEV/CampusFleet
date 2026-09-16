const fs = require("fs");
const { Client } = require("pg");

const env = fs.readFileSync(".env.local", "utf8");
const envVars = {};
for (const line of env.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    envVars[key] = val;
  }
}

const connectionString =
  envVars.POSTGRES_URL_NON_POOLING ||
  envVars.POSTGRES_URL ||
  envVars.POSTGRES_PRISMA_URL;

async function run() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");

    const sql = fs.readFileSync("supabase/migrations/20260916_class_dismissal_time.sql", "utf8");
    await client.query(sql);
    console.log("Migration 20260916_class_dismissal_time applied successfully!");

    const res = await client.query("SELECT id, name, dismissal_time, is_half_day_eligible FROM public.classes LIMIT 3");
    console.log("Updated classes:", res.rows);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
