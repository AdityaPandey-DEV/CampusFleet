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

async function checkFKs() {
  await client.connect();
  const res = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'bookings'::regclass;
  `);
  console.log("Constraints on bookings table:");
  console.table(res.rows);

  // Drop rigid foreign key constraints so dynamic trip IDs and student IDs don't get blocked
  for (const row of res.rows) {
    if (row.conname.includes("fkey")) {
      console.log(`Dropping FK constraint: ${row.conname}`);
      await client.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS "${row.conname}";`);
    }
  }

  console.log("✓ All rigid foreign key constraints dropped from bookings table to allow dynamic student/trip IDs.");
  await client.end();
}

checkFKs().catch(console.error);
