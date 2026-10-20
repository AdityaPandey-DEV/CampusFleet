import pkg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to dynamically parse environment variables from an env file
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
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261020_normalize_academic_tables_3nf.sql");
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
      console.log(`✓ Connected successfully!`);

      console.log(`Applying 3NF Academic Normalization migration...`);
      await client.query("BEGIN;");
      await client.query(migrationSql);
      await client.query("COMMIT;");
      console.log(`✅ 3NF Migration applied successfully!`);

      // Verify the classes
      const verifyRes = await client.query(`
        SELECT 
          c.id, 
          ac.short_name AS course, 
          ab.name AS branch, 
          asp.short_label AS specialization, 
          c.semester, 
          c.section
        FROM classes c
        LEFT JOIN academic_courses ac ON ac.id = c.course_id
        LEFT JOIN academic_branches ab ON ab.id = c.branch_id
        LEFT JOIN academic_specializations asp ON asp.id = c.specialization_id
        ORDER BY c.semester_num, c.section
        LIMIT 6;
      `);
      console.log("\nSample normalized records:");
      console.table(verifyRes.rows);

      // Verify specializations distribution
      const specRes = await client.query(`
        SELECT asp.short_label AS specialization, count(*) AS total_sections
        FROM classes c
        JOIN academic_specializations asp ON asp.id = c.specialization_id
        GROUP BY asp.short_label
        ORDER BY total_sections DESC;
      `);
      console.log("\nSpecializations distribution count:");
      console.table(specRes.rows);

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
