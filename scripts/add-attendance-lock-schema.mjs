import pkg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return env;
}

const envLocal = parseEnv(path.resolve(__dirname, "../.env.local"));
const envProd = parseEnv(path.resolve(__dirname, "../.env.production"));

const databases = [
  {
    name: "New Database (.env.local)",
    connectionString: envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL,
  },
  {
    name: "Old Database (.env.production)",
    connectionString: envProd.POSTGRES_URL_NON_POOLING || envProd.POSTGRES_PRISMA_URL || envProd.POSTGRES_URL,
  },
];

const migrationSql = `
BEGIN;

-- 1. Add attendance lock columns to attendance_records
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS lock_status VARCHAR(20) DEFAULT 'LOCKED',
  ADD COLUMN IF NOT EXISTS unlocked_by VARCHAR(40),
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS rfid_card_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS unlock_timestamp TIMESTAMPTZ;

-- Backfill existing boarded attendance records as UNLOCKED
UPDATE public.attendance_records
SET lock_status = 'UNLOCKED',
    unlocked_by = CASE 
      WHEN method ILIKE '%RFID%' THEN 'RFID'
      WHEN method ILIKE '%GPS%' OR method ILIKE '%GEOFENCE%' THEN 'LOCATION_DISTANCE'
      ELSE 'MANUAL_OVERRIDE'
    END,
    unlock_timestamp = COALESCE(timestamp, NOW())
WHERE status = 'BOARDED' AND (lock_status IS NULL OR lock_status = 'LOCKED');

-- 2. Add attendance lock columns to bus_reservations
ALTER TABLE public.bus_reservations
  ADD COLUMN IF NOT EXISTS lock_status VARCHAR(20) DEFAULT 'LOCKED',
  ADD COLUMN IF NOT EXISTS unlocked_by VARCHAR(40),
  ADD COLUMN IF NOT EXISTS distance_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS unlock_timestamp TIMESTAMPTZ;

-- Backfill existing boarded reservations as UNLOCKED
UPDATE public.bus_reservations
SET lock_status = 'UNLOCKED',
    unlocked_by = 'MANUAL_OVERRIDE',
    unlock_timestamp = COALESCE(boarded_at, NOW())
WHERE status = 'BOARDED' AND (lock_status IS NULL OR lock_status = 'LOCKED');

-- 3. Create indexes for high-speed attendance lock lookups
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date 
  ON public.attendance_records(student_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_records_lock 
  ON public.attendance_records(student_id, lock_status);

CREATE INDEX IF NOT EXISTS idx_bus_reservations_student_date_lock 
  ON public.bus_reservations(student_id, reservation_date, lock_status);

COMMIT;
`;

async function main() {
  for (const db of databases) {
    if (!db.connectionString) continue;
    console.log(`\n======================================================`);
    console.log(`🚀 Adding Attendance Lock columns to: ${db.name}`);
    console.log(`======================================================`);
    const client = new Client({ connectionString: db.connectionString });
    try {
      await client.connect();
      await client.query(migrationSql);
      console.log(`✅ Successfully applied attendance lock schema to ${db.name}!`);
    } catch (err) {
      console.error(`❌ Error on ${db.name}:`, err.message);
    } finally {
      await client.end();
    }
  }
}

main();
