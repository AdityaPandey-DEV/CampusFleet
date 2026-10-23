import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const connectionString = 'postgresql://postgres:CampusFleet2026!Secure@db.zdjooiztjzmbiwaknfir.supabase.co:5432/postgres';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  const migrationPath = path.resolve('supabase/migrations/20261023_deduplicate_and_enforce_single_student_per_user.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration 20261023_deduplicate_and_enforce_single_student_per_user.sql...');
  await client.query(sql);
  console.log('Migration applied successfully!');

  console.log('\n--- VERIFICATION ---');
  const dups = await client.query(`
    SELECT user_id, count(*), array_agg(id) as ids
    FROM public.students
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1;
  `);
  console.log('Duplicate user_ids in students table:', dups.rows.length === 0 ? 'NONE (PASSED)' : dups.rows);

  const constraintCheck = await client.query(`
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.students'::regclass AND conname = 'uq_students_user_id';
  `);
  console.log('Unique constraint:', constraintCheck.rows[0]);

  const harsh = await client.query(`
    SELECT id, user_id, full_name, email, primary_stop_name, zone_code, has_active_subscription, subscription_expiry_date, payment_status
    FROM public.students_full
    WHERE email = 'iamharshukumar@gmail.com';
  `);
  console.log('\nHarsh Kumar profile in students_full:');
  console.log(harsh.rows[0]);

  await client.end();
}

run().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
