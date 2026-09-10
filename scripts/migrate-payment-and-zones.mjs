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
  console.log("Connected successfully. Applying Zone & Payment DDL...");

  // 1. Add zone_code to stops
  await client.query(`
    ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS zone_code TEXT DEFAULT 'ZONE_B';
  `);
  console.log("✓ stops.zone_code ensured");

  // 2. Map existing Bhimtal / Haldwani stops to specific zones
  await client.query(`
    UPDATE public.stops SET zone_code = 'ZONE_A' WHERE id IN ('stop-lamachaur-terminal', 'stop-amrapali-institute', 'stop-kamluvaganja', 'stop-bhagwanpur', 'stop-fatehpur');
    UPDATE public.stops SET zone_code = 'ZONE_B' WHERE id IN ('stop-kusumkhera', 'stop-mukhani', 'stop-heera-nagar', 'stop-tikonia', 'stop-unchapul', 'stop-bhakda-laldant');
    UPDATE public.stops SET zone_code = 'ZONE_C' WHERE id IN ('stop-kathgodam', 'stop-hmt-ranibagh', 'stop-jeolikote', 'stop-bhowali', 'stop-panchakki');
    UPDATE public.stops SET zone_code = 'ZONE_D' WHERE id IN ('stop-bhimtal-campus', 'stop-bhimtal-lake', 'stop-it-park');
  `);
  console.log("✓ stop zone mappings assigned");

  // 3. Add zone_code, payment_status, total_fee_due, total_fee_paid to students
  await client.query(`
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS zone_code TEXT DEFAULT 'ZONE_B';
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID';
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_fee_due NUMERIC(10, 2) DEFAULT 12000.00;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_fee_paid NUMERIC(10, 2) DEFAULT 0.00;
  `);
  console.log("✓ students table updated with zone & payment fields");

  // 4. Create payment_submissions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.payment_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      enrollment_no TEXT,
      zone_code TEXT NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      installment_no INTEGER DEFAULT 1,
      total_installments INTEGER DEFAULT 1,
      receipt_url TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      auto_detected BOOLEAN DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ payment_submissions table created");

  await client.end();
  console.log("Migration completed successfully!");
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
