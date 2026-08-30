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

async function checkAttendanceTable() {
  await client.connect();
  console.log("Connected to PostgreSQL...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT,
      trip_id TEXT,
      method TEXT,
      status TEXT,
      verified_by TEXT,
      signature_token TEXT,
      notes TEXT,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow all for attendance_records" ON attendance_records;
    CREATE POLICY "Allow all for attendance_records" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
  `);

  console.log("✓ attendance_records table verified & RLS enabled.");
  await client.end();
}

checkAttendanceTable().catch(console.error);
