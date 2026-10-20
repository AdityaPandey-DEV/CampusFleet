import pkg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databases = [
  {
    name: "New Database (db.zdjooiztjzmbiwaknfir.supabase.co)",
    connectionString: "postgresql://postgres:CampusFleet2026!Secure@db.zdjooiztjzmbiwaknfir.supabase.co:5432/postgres",
  },
  {
    name: "Old Database (hwawknnnolbxjvbylqkw.supabase.co / pooler)",
    connectionString: "postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
  },
];

async function run() {
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261020_normalize_academic_tables_3nf.sql");
  const migrationSql = fs.readFileSync(migrationFile, "utf8");

  for (const db of databases) {
    console.log(`\n======================================================================`);
    console.log(`🚀 Processing 3NF Migration on ${db.name}...`);
    console.log(`======================================================================`);

    const client = new Client({
      connectionString: db.connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      console.log(`✓ Connected to ${db.name}`);

      await client.query("BEGIN;");
      await client.query(migrationSql);
      await client.query("COMMIT;");
      console.log(`✅ 3NF Migration applied successfully to ${db.name}!`);

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
        LIMIT 5;
      `);
      console.log("Sample normalized rows:");
      console.table(verifyRes.rows);

      // Verify specializations distribution
      const specRes = await client.query(`
        SELECT asp.short_label, count(*)
        FROM classes c
        JOIN academic_specializations asp ON asp.id = c.specialization_id
        GROUP BY asp.short_label;
      `);
      console.log("Specializations count:");
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
