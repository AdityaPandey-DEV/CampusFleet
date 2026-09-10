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
  console.log("Connected successfully. Creating system_configs table...");

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.system_configs (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    );
  `);
  console.log("✓ system_configs table created/verified");

  // Initial seed for payment_qr_config
  const initialQrConfig = {
    upi_id: "gehubhimtal.transit@upi",
    merchant_name: "GEHU Bhimtal Transport Department",
    qr_image_url: "",
    instructions: "Scan via Google Pay, PhonePe, Paytm, or any BHIM UPI app. Ensure the 12-digit transaction ID / UTR is clear on the receipt.",
    account_number: "50200012345678",
    ifsc_code: "HDFC0001234",
    bank_name: "HDFC Bank, Haldwani Branch",
  };

  await client.query(`
    INSERT INTO public.system_configs (key, value, updated_at, updated_by)
    VALUES ('payment_qr_config', $1, NOW(), 'SYSTEM_INIT')
    ON CONFLICT (key) DO NOTHING;
  `, [JSON.stringify(initialQrConfig)]);
  console.log("✓ Seeded default payment_qr_config");

  await client.end();
  console.log("Migration complete!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
