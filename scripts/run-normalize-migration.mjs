#!/usr/bin/env node
/**
 * Run the normalization migration against Supabase PostgreSQL
 * Uses the POSTGRES_URL from .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runMigration() {
  console.log("🔄 Running normalization migration against Supabase...");
  console.log(`   Target: ${supabaseUrl}`);

  const sqlFile = resolve(
    process.cwd(),
    "supabase/migrations/20260911_normalize_schema.sql"
  );
  const sql = readFileSync(sqlFile, "utf-8");

  // Split into individual statements (respecting DO $$ blocks)
  // We'll use supabase.rpc to run raw SQL via the service role
  const { data, error } = await supabase.rpc("exec_sql", { sql_text: sql });

  if (error) {
    // Fallback: try running via pg directly if exec_sql RPC doesn't exist
    console.log("ℹ️  exec_sql RPC not available, running statements individually...");
    
    // Split SQL into executable chunks (handle DO $$ blocks properly)
    const statements = splitSqlStatements(sql);
    let successCount = 0;
    let errorCount = 0;

    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed || trimmed.startsWith("--")) continue;

      try {
        const { error: stmtError } = await supabase.from("_migration_runner").select("*").limit(0);
        // Use the REST API to execute each statement
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ sql_text: trimmed }),
        });

        if (response.ok) {
          successCount++;
        } else {
          const errBody = await response.text();
          if (errBody.includes("already exists") || errBody.includes("duplicate")) {
            console.log(`   ⚠️  Skipped (already exists): ${trimmed.substring(0, 60)}...`);
            successCount++;
          } else {
            console.error(`   ❌ Error: ${errBody.substring(0, 120)}`);
            errorCount++;
          }
        }
      } catch (e) {
        errorCount++;
      }
    }

    console.log(`\n✅ Migration complete: ${successCount} succeeded, ${errorCount} failed`);
    return;
  }

  console.log("✅ Migration executed successfully via exec_sql RPC");
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;

  const lines = sql.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Track $$ dollar-quoted blocks
    const dollarMatches = trimmedLine.match(/\$\$/g);
    if (dollarMatches) {
      for (const _m of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    current += line + "\n";

    // Statement boundary: semicolon at end of line, not inside $$ block
    if (trimmedLine.endsWith(";") && !inDollarQuote) {
      statements.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

runMigration().catch(e => {
  console.error("❌ Migration failed:", e.message);
  process.exit(1);
});
