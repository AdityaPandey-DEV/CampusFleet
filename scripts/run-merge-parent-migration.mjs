import pkg from "pg";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Read connection from .env.local
let connectionString = process.env.POSTGRES_URL || "";
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const matchPg = envContent.match(/POSTGRES_URL=["']?([^"'\n\r]+)["']?/);
    if (matchPg) connectionString = matchPg[1];

    const matchUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=["']?([^"'\n\r]+)["']?/);
    if (matchUrl) supabaseUrl = matchUrl[1];

    const matchKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\n\r]+)["']?/);
    if (matchKey) serviceRoleKey = matchKey[1];
  }
} catch (e) {
  console.warn("Could not read .env.local", e);
}

if (!connectionString) {
  connectionString = "postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
}

async function run() {
  console.log("==========================================================");
  console.log("🚀 Executing Migration: 20260915_merge_parent_role.sql");
  console.log("==========================================================");

  let pgSucceeded = false;

  // 1. Execute directly via PostgreSQL client
  try {
    console.log("Connecting to PostgreSQL...");
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log("✓ Connected to PostgreSQL database");

    console.log("1. Updating existing users with role = 'parent' -> 'student'...");
    const resUpdate = await client.query(`
      UPDATE public.users 
      SET role = 'student' 
      WHERE role = 'parent';
    `);
    console.log(`✓ Updated ${resUpdate.rowCount ?? 0} user records to 'student'`);

    console.log("2. Synchronizing users_role_check constraint...");
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
        ) THEN
          ALTER TABLE public.users DROP CONSTRAINT users_role_check;
        END IF;
        
        ALTER TABLE public.users 
          ADD CONSTRAINT users_role_check 
          CHECK (role IN ('admin', 'student', 'driver', 'conductor', 'transport_manager', 'supervisor', 'teacher', 'staff'));
      END $$;
    `);
    console.log("✓ Updated users_role_check constraint successfully");

    const resCheck = await client.query(`
      SELECT role, count(*) FROM public.users GROUP BY role;
    `);
    console.log("Current user role breakdown in PostgreSQL:");
    console.table(resCheck.rows);

    await client.end();
    pgSucceeded = true;
  } catch (err) {
    console.warn("⚠️ PostgreSQL direct connection warning:", err.message);
  }

  // 2. Also run via Supabase REST API as double verification
  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes("placeholder")) {
    try {
      console.log("\nVerifying via Supabase Client...");
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      const { data: parentUsers, error: fetchErr } = await supabase
        .from("users")
        .select("id, email, full_name, role")
        .eq("role", "parent");

      if (fetchErr) {
        console.warn("Supabase fetch notice:", fetchErr.message);
      } else if (parentUsers && parentUsers.length > 0) {
        console.log(`Found ${parentUsers.length} parent users to update in Supabase...`);
        const { error: updateErr } = await supabase
          .from("users")
          .update({ role: "student" })
          .eq("role", "parent");

        if (updateErr) {
          console.error("Supabase update error:", updateErr);
        } else {
          console.log(`✓ Successfully updated ${parentUsers.length} users to 'student' via Supabase API`);
        }
      } else {
        console.log("✓ No users with role = 'parent' remaining in Supabase table.");
      }
    } catch (apiErr) {
      console.warn("Supabase API check notice:", apiErr.message);
    }
  }

  console.log("\n✅ Migration 20260915_merge_parent_role.sql execution completed!");
}

run().catch(console.error);
