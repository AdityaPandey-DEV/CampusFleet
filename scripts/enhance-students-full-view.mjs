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
    name: "New Database (.env.local)",
    connectionString: envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL,
    host: envLocal.POSTGRES_HOST,
  },
  {
    name: "Old Database (.env.production)",
    connectionString: envProd.POSTGRES_URL_NON_POOLING || envProd.POSTGRES_PRISMA_URL || envProd.POSTGRES_URL,
    host: envProd.POSTGRES_HOST,
  },
];

const viewSql = `
DROP VIEW IF EXISTS public.students_full CASCADE;

CREATE VIEW public.students_full AS
SELECT DISTINCT ON (s.id)
    s.id,
    s.user_id,
    s.enrollment_no,
    COALESCE(u.full_name, s.full_name)::text AS full_name,
    u.email::text,
    u.phone::text,
    COALESCE(ab.name, ac.name, ''::text)::text AS department,
    COALESCE(c.semester, s.semester, ''::text)::text AS semester,
    COALESCE(camp.name, s.campus, ''::text)::text AS campus,
    s.campus_id,
    s.primary_stop_id,
    bs.name::text AS primary_stop_name,
    s.primary_route_id,
    r.name::text AS primary_route_name,
    s.emergency_contact,
    s.transport_access_suspended,
    (EXISTS (
        SELECT 1 FROM public.subscriptions sub
        WHERE sub.student_id = s.id 
          AND sub.status = 'ACTIVE' 
          AND sub.end_date >= CURRENT_DATE
    )) AS has_active_subscription,
    (
        SELECT MAX(sub.end_date) FROM public.subscriptions sub
        WHERE sub.student_id = s.id AND sub.status = 'ACTIVE'
    ) AS subscription_expiry_date,
    s.class_id,
    COALESCE(c.name, ''::text)::text AS class_name,
    s.zone_id,
    COALESCE(tz.code, ''::varchar) AS zone_code,
    COALESCE(tz.semester_fee, 0.00) AS total_fee_due,
    COALESCE((
        SELECT SUM(COALESCE(ps.verified_amount, ps.amount, 0))
        FROM public.payment_submissions ps
        WHERE ps.student_id = s.id AND ps.status = 'APPROVED'
    ), 0.00) AS total_fee_paid,
    CASE
        WHEN COALESCE((
            SELECT SUM(COALESCE(ps.verified_amount, ps.amount, 0))
            FROM public.payment_submissions ps
            WHERE ps.student_id = s.id AND ps.status = 'APPROVED'
        ), 0.00) >= COALESCE(tz.semester_fee, 0.00) AND COALESCE(tz.semester_fee, 0.00) > 0 THEN 'APPROVED'
        WHEN EXISTS (
            SELECT 1 FROM public.payment_submissions ps
            WHERE ps.student_id = s.id AND ps.status = 'PENDING_APPROVAL'
        ) THEN 'PENDING_APPROVAL'
        WHEN COALESCE((
            SELECT SUM(COALESCE(ps.verified_amount, ps.amount, 0))
            FROM public.payment_submissions ps
            WHERE ps.student_id = s.id AND ps.status = 'APPROVED'
        ), 0.00) > 0 THEN 'PARTIALLY_PAID'
        ELSE 'UNPAID'
    END AS payment_status,
    COALESCE(u.photo_url, u.avatar_url)::text AS photo_url,
    COALESCE(s.photo_locked, u.photo_locked, false) AS photo_locked,
    u.avatar_url::text,
    s.home_latitude,
    s.home_longitude,
    s.home_address::text,
    s.auto_assigned_stop_id,
    tz.semester_fee AS zone_semester_fee,
    tz.installments_allowed AS zone_installments,
    s.created_at,
    ac.id AS course_id,
    ac.code AS course_code,
    ac.short_name AS course_name,
    ab.id AS branch_id,
    ab.code AS branch_code,
    ab.name AS branch_name,
    asp.id AS specialization_id,
    asp.code AS specialization_code,
    asp.short_label AS specialization_label,
    s.rfid_card_id
FROM public.students s
LEFT JOIN public.users u ON u.id = s.user_id
LEFT JOIN public.classes c ON c.id = s.class_id
LEFT JOIN public.academic_specializations asp ON asp.id = c.specialization_id
LEFT JOIN public.academic_branches ab ON ab.id = asp.branch_id
LEFT JOIN public.academic_courses ac ON ac.id = ab.course_id
LEFT JOIN public.transit_zones tz ON tz.id = s.zone_id
LEFT JOIN public.campuses camp ON camp.id = s.campus_id
LEFT JOIN public.stops bs ON bs.id = s.primary_stop_id
LEFT JOIN public.routes r ON r.id = s.primary_route_id
ORDER BY s.id, s.created_at DESC;
`;

async function main() {
  for (const db of databases) {
    if (!db.connectionString) continue;
    console.log(`\nUpdating students_full on ${db.name}...`);
    const client = new Client({ connectionString: db.connectionString });
    try {
      await client.connect();
      await client.query(viewSql);
      console.log(`✅ Successfully updated students_full on ${db.name}!`);
    } catch (err) {
      console.error(`❌ Error on ${db.name}:`, err.message);
    } finally {
      await client.end();
    }
  }
}

main();
