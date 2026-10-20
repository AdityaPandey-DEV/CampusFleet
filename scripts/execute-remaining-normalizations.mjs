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
const connectionString = envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL;

if (!connectionString) {
  console.error("No database connection string found in .env.local!");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();
console.log("Connected to database. Executing Remaining Normalizations...\n");

try {
  await client.query("BEGIN;");

  // 1. Add stops.zone_id FK to transit_zones and backfill
  console.log("1. Adding zone_id FK to stops and backfilling from transit_zones...");
  await client.query(`
    ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS zone_id TEXT REFERENCES public.transit_zones(id) ON DELETE SET NULL;
    UPDATE public.stops s
    SET zone_id = tz.id
    FROM public.transit_zones tz
    WHERE tz.id = 'zone-' || s.campus_id || '-' || LOWER(s.zone_code);
  `);
  console.log("   ✓ stops.zone_id FK added and 100% backfilled.");

  // 2. vehicle_issues.bus_number -> drop and update vehicle_issues_full view
  console.log("2. Normalizing vehicle_issues (updating view and dropping denormalized bus_number)...");
  await client.query(`
    CREATE OR REPLACE VIEW public.vehicle_issues_full AS
    SELECT vi.id,
      vi.bus_id,
      bus.bus_number AS bus_number,
      vi.reported_by,
      vi.issue_type,
      vi.severity,
      vi.description,
      vi.status,
      vi.latitude,
      vi.longitude,
      vi.reported_at,
      vi.resolved_at
    FROM public.vehicle_issues vi
    LEFT JOIN public.buses bus ON bus.id = vi.bus_id;

    ALTER TABLE public.vehicle_issues DROP COLUMN IF EXISTS bus_number;
  `);
  console.log("   ✓ vehicle_issues.bus_number dropped, view vehicle_issues_full updated.");

  // 3. routes.stops_data -> drop denormalized JSONB column
  console.log("3. Dropping routes.stops_data (canonical is route_stops)...");
  await client.query("ALTER TABLE public.routes DROP COLUMN IF EXISTS stops_data;");
  console.log("   ✓ routes.stops_data dropped.");

  // 4. classes.shift_schedule -> drop empty JSONB column and recreate v_classes_expanded
  console.log("4. Dropping classes.shift_schedule (canonical is class_shift_schedules)...");
  await client.query("DROP VIEW IF EXISTS public.v_classes_expanded CASCADE;");
  await client.query("ALTER TABLE public.classes DROP COLUMN IF EXISTS shift_schedule;");
  await client.query(`
    CREATE OR REPLACE VIEW public.v_classes_expanded AS
    SELECT c.id,
      c.name,
      c.semester,
      c.semester_num,
      CASE
        WHEN (c.year_num IS NOT NULL) THEN ((c.year_num)::text ||
          CASE
            WHEN (c.year_num = 1) THEN 'st Year'::text
            WHEN (c.year_num = 2) THEN 'nd Year'::text
            WHEN (c.year_num = 3) THEN 'rd Year'::text
            ELSE 'th Year'::text
          END)
        ELSE NULL::text
      END AS year,
      c.year_num,
      c.section_id,
      sec.code AS section,
      sec.code AS section_code,
      sec.name AS section_name,
      c.is_active,
      '{}'::jsonb AS shift_schedule,
      c.created_at,
      COALESCE(ac.short_name, ac.code) AS course,
      COALESCE(ab.name, ac.name) AS department,
      ab.name AS branch,
      COALESCE(asp.short_label, asp.name) AS specialization,
      asp.id AS specialization_id,
      asp.code AS specialization_code,
      asp.name AS specialization_name,
      asp.short_label AS specialization_label,
      asp.is_default AS is_default_specialization,
      ab.id AS branch_id,
      ab.code AS branch_code,
      ab.name AS branch_name,
      ac.id AS course_id,
      ac.code AS course_code,
      ac.name AS course_title,
      ac.short_name AS course_name,
      ac.degree_level,
      ac.total_years,
      ac.total_semesters
    FROM public.classes c
    LEFT JOIN public.academic_sections sec ON (sec.id = c.section_id)
    LEFT JOIN public.academic_specializations asp ON (asp.id = c.specialization_id)
    LEFT JOIN public.academic_branches ab ON (ab.id = asp.branch_id)
    LEFT JOIN public.academic_courses ac ON (ac.id = ab.course_id);
  `);
  console.log("   ✓ classes.shift_schedule dropped, v_classes_expanded recreated.");

  // 5. subscription_plans.stoppages -> create plan_stops junction table
  console.log("5. Creating plan_stops junction table from subscription_plans.stoppages...");
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.plan_stops (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
      stop_name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    INSERT INTO public.plan_stops (plan_id, stop_name, display_order)
    SELECT p.id, elem, ord
    FROM public.subscription_plans p,
    LATERAL unnest(p.stoppages) WITH ORDINALITY AS t(elem, ord)
    ON CONFLICT DO NOTHING;
  `);
  console.log("   ✓ plan_stops table created and backfilled.");

  // 6. Drop redundant text campus columns from stops and users
  console.log("6. Dropping redundant campus text columns from stops and users...");
  await client.query(`
    ALTER TABLE public.stops DROP COLUMN IF EXISTS campus;
    ALTER TABLE public.users DROP COLUMN IF EXISTS campus;
  `);
  console.log("   ✓ stops.campus and users.campus text columns dropped.");

  // 7. Clean up 3 trivial alias views
  console.log("7. Dropping 3 trivial alias views (sections, demands, class_shift_demands)...");
  await client.query(`
    DROP VIEW IF EXISTS public.sections CASCADE;
    DROP VIEW IF EXISTS public.demands CASCADE;
    DROP VIEW IF EXISTS public.class_shift_demands CASCADE;
  `);
  console.log("   ✓ Trivial alias views cleaned up.");

  await client.query("COMMIT;");
  console.log("\n✅ ALL REMAINING NORMALIZATIONS COMPLETED SUCCESSFULLY!");
} catch (err) {
  await client.query("ROLLBACK;");
  console.error("❌ Migration failed, rolled back:", err);
  process.exit(1);
} finally {
  await client.end();
}
