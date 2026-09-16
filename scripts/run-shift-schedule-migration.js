const fs = require("fs");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
    console.log("Connected to PostgreSQL successfully!");

    const sql = fs.readFileSync("supabase/migrations/20260916_class_shift_schedule.sql", "utf8");
    await client.query(sql);
    console.log("Migration 20260916_class_shift_schedule applied successfully!");

    const res = await client.query("SELECT id, name, shift_schedule FROM public.classes LIMIT 3");
    console.log("Updated classes with shift_schedule:", res.rows);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

run();
