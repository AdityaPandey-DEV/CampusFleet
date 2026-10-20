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
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261020_restructure_academic_hierarchy.sql");
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
      console.log(`Connected successfully! Applying restructure migration...`);

      await client.query("BEGIN;");
      await client.query(migrationSql);
      await client.query("COMMIT;");
      console.log(`✅ Successfully applied migration on ${db.name}!`);

      // Verify hierarchy count and sample
      const classesCount = await client.query("SELECT count(*) FROM public.classes;");
      const unmapped = await client.query("SELECT count(*) FROM public.classes WHERE specialization_id IS NULL;");
      const sample = await client.query(`
        SELECT 
          c.name,
          ac.short_name AS course,
          ab.code AS branch,
          asp.short_label AS specialization
        FROM public.classes c
        JOIN public.academic_specializations asp ON asp.id = c.specialization_id
        JOIN public.academic_branches ab ON ab.id = asp.branch_id
        JOIN public.academic_courses ac ON ac.id = ab.course_id
        LIMIT 5;
      `);

      console.log(`Total classes: ${classesCount.rows[0].count}`);
      console.log(`Unmapped classes: ${unmapped.rows[0].count}`);
      console.log(`Hierarchy sample from ${db.name}:`);
      console.table(sample.rows);

      // Verify foreign keys on classes
      const fkeys = await client.query(`
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN ('classes', 'academic_specializations', 'academic_branches');
      `);
      console.log(`Active Foreign Keys in Academic Hierarchy:`);
      console.table(fkeys.rows);

    } catch (err) {
      console.error(`❌ Error on ${db.name}:`, err);
      try {
        await client.query("ROLLBACK;");
      } catch (rbErr) {}
    } finally {
      await client.end();
    }
  }

  // Remove test script
  const testScript = path.resolve(__dirname, "test-hierarchy-sim.mjs");
  if (fs.existsSync(testScript)) {
    fs.unlinkSync(testScript);
  }
}

run();
