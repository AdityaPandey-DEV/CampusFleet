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
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[trimmed.slice(0, eqIdx).trim()] = val;
    }
  }
  return env;
}

const envLocal = parseEnv(path.resolve(__dirname, "../.env.local"));
const envProd = parseEnv(path.resolve(__dirname, "../.env.production"));

const databases = [
  {
    name: "New Database (.env.local -> POSTGRES_PRISMA_URL)",
    connectionString: envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL,
    host: envLocal.POSTGRES_HOST,
  },
  {
    name: "Old Database (.env.production -> POSTGRES_URL_NON_POOLING)",
    connectionString: envProd.POSTGRES_URL_NON_POOLING || envProd.POSTGRES_PRISMA_URL || envProd.POSTGRES_URL,
    host: envProd.POSTGRES_HOST,
  },
];

async function run() {
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261021_drop_classes_redundant_columns.sql");
  const migrationSql = fs.readFileSync(migrationFile, "utf8");

  for (const db of databases) {
    console.log(`\n======================================================================`);
    console.log(`🚀 Connecting to: ${db.name}`);
    console.log(`Target Host: ${db.host}`);
    console.log(`======================================================================`);

    if (!db.connectionString) {
      console.error(`❌ Missing connection string for ${db.name}! Skipping.`);
      continue;
    }

    const client = new Client({
      connectionString: db.connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      console.log(`Connected! Applying drop classes redundant columns migration...`);

      await client.query("BEGIN;");
      await client.query(migrationSql);
      await client.query("COMMIT;");
      console.log(`✅ Successfully applied migration on ${db.name}!`);

      // Verify columns on classes
      const cols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'classes' 
        ORDER BY ordinal_position;
      `);
      console.log(`Remaining columns on classes in ${db.name}:`, cols.rows.map(r => r.column_name));

    } catch (err) {
      console.error(`❌ Error on ${db.name}:`, err);
      try {
        await client.query("ROLLBACK;");
      } catch (rbErr) {}
    } finally {
      await client.end();
    }
  }
}

run();
