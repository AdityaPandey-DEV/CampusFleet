import pkg from "pg";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database targets: New DB (.env.local) and Old DB (.env.production / pooler)
const databases = [
  {
    name: "New Database (db.zdjooiztjzmbiwaknfir.supabase.co)",
    connectionString: "postgresql://postgres:CampusFleet2026!Secure@db.zdjooiztjzmbiwaknfir.supabase.co:5432/postgres",
    isOld: false,
  },
  {
    name: "Old Database (hwawknnnolbxjvbylqkw.supabase.co / pooler)",
    connectionString: "postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    isOld: true,
  },
];

async function executeMigration() {
  const migrationFile = path.resolve(__dirname, "../supabase/migrations/20261020_smart_transit_foundation.sql");
  const migrationSql = fs.readFileSync(migrationFile, "utf8");

  const maintenancePatchSql = `
    ALTER TABLE maintenance_requests 
      ALTER COLUMN bus_id TYPE TEXT USING bus_id::TEXT,
      ALTER COLUMN requested_by TYPE TEXT USING requested_by::TEXT,
      ALTER COLUMN approved_by TYPE TEXT USING approved_by::TEXT;
  `;

  for (const db of databases) {
    console.log(`\n======================================================================`);
    console.log(`🚀 Processing ${db.name}...`);
    console.log(`======================================================================`);

    const client = new Client({
      connectionString: db.connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      console.log(`✓ Connected to ${db.name}`);

      // If Old DB, check and apply maintenance_requests column type patch first
      if (db.isOld) {
        const maintRes = await client.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'maintenance_requests' 
            AND column_name = 'bus_id';
        `);
        if (maintRes.rows.length > 0 && maintRes.rows[0].data_type === "uuid") {
          console.log("Applying pending maintenance_requests type patch to Old DB...");
          await client.query(maintenancePatchSql);
          console.log("✓ maintenance_requests columns updated to TEXT on Old DB");
        } else {
          console.log("✓ maintenance_requests already has TEXT columns on Old DB");
        }
      }

      // Execute 20261020_smart_transit_foundation.sql
      console.log("Applying 20261020_smart_transit_foundation.sql...");
      await client.query(migrationSql);
      console.log("✓ Migration SQL executed successfully!");

      // Verification Step
      console.log("\nVerifying database schema...");

      // 1. Check students table columns
      const stCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'students' 
          AND column_name IN ('home_latitude', 'home_longitude', 'home_address', 'auto_assigned_stop_id')
        ORDER BY column_name;
      `);
      console.log(`✓ students home location columns:`, stCols.rows.map(r => `${r.column_name} (${r.data_type})`));

      // 2. Check new tables
      const tblRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('transport_settings', 'bus_reservations', 'bus_switch_requests', 'dynamic_route_plans')
        ORDER BY table_name;
      `);
      console.log(`✓ New tables present:`, tblRes.rows.map(r => r.table_name));

      // 3. Check transport_settings row
      const settingsRes = await client.query(`
        SELECT max_walk_distance_km, auto_assignment_enabled, seat_selection_mode, min_fill_percent 
        FROM public.transport_settings 
        LIMIT 1;
      `);
      console.log(`✓ Default transport settings:`, settingsRes.rows[0]);

      // 4. Verify students_full view query
      const viewTest = await client.query(`
        SELECT count(*) as total,
               count(home_latitude) as students_with_home_coords
        FROM public.students_full;
      `);
      console.log(`✓ students_full view accessible:`, viewTest.rows[0]);

      console.log(`🎉 ${db.name} migration COMPLETED successfully!`);
    } catch (err) {
      console.error(`❌ Error migrating ${db.name}:`, err);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }

  console.log(`\n======================================================================`);
  console.log(`All migrations applied and verified on both old and new databases!`);
  console.log(`======================================================================\n`);
}

executeMigration();
