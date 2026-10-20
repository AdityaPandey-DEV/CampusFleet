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
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261020_cleanup_classes_and_link_timetables.sql");
  const migrationSql = fs.readFileSync(migrationFile, "utf8");

  for (const db of databases) {
    console.log(`\n======================================================================`);
    console.log(`🚀 Executing Cleanup & Foreign Key Link on: ${db.name}`);
    console.log(`Host: ${db.host}`);
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
      console.log(`✓ Connected successfully!`);

      await client.query("BEGIN;");
      await client.query(migrationSql);
      await client.query("COMMIT;");
      console.log(`✅ Cleanup & Timetables Foreign Key applied successfully!`);

      // 1. Check classes columns
      const colsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'classes'
        ORDER BY ordinal_position;
      `);
      console.log("\nCleaned normalized columns in 'classes' table:");
      console.table(colsRes.rows);

      // 2. Check class_timetables foreign key constraint
      const fkRes = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        WHERE conrelid = 'class_timetables'::regclass;
      `);
      console.log("\nConstraints on 'class_timetables' table:");
      console.table(fkRes.rows);

      await client.end();
    } catch (err) {
      console.error(`❌ Migration failed on ${db.name}:`, err);
      try {
        await client.query("ROLLBACK;");
        await client.end();
      } catch (e) {}
    }
  }
}

run();
