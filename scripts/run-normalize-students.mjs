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
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261020_normalize_students_table.sql");
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
    });

    try {
      await client.connect();
      console.log(`Connected successfully! Applying migration...`);
      await client.query(migrationSql);
      console.log(`✅ Successfully applied students normalization to ${db.name}!`);

      // Verify students columns
      const sCols = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'students'
        ORDER BY ordinal_position;
      `);
      console.log(`📋 students columns:`, sCols.rows.map(r => r.column_name).join(", "));

      // Verify foreign key on students.zone_id
      const fkRes = await client.query(`
        SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.table_name = 'students' AND tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
      `);
      console.log(`🔗 students foreign keys:`);
      console.table(fkRes.rows);

    } catch (err) {
      console.error(`❌ Error migrating ${db.name}:`, err);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }

  console.log(`\n✨ Students normalization completed across all databases!`);
}

run();
