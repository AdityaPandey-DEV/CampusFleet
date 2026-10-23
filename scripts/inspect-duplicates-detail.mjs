import pkg from 'pg';
const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const connectionString = 'postgresql://postgres:CampusFleet2026!Secure@db.zdjooiztjzmbiwaknfir.supabase.co:5432/postgres';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const userIds = [
  '0199a9f8-478c-412f-a1e8-6f206988ae44'
];

for (const uid of userIds) {
  const u = await client.query('SELECT id, email, full_name, role FROM users WHERE id = $1', [uid]);
  console.log('========================================================');
  console.log('USER:', u.rows[0]);
  const rows = await client.query(`
    SELECT s.id, s.user_id, s.enrollment_no, s.semester, s.primary_stop_id, s.zone_id, s.class_id, s.created_at,
           (SELECT count(*) FROM subscriptions sub WHERE sub.student_id = s.id) as sub_count,
           (SELECT count(*) FROM payment_submissions ps WHERE ps.student_id = s.id) as pay_count,
           (SELECT count(*) FROM bus_reservations br WHERE br.student_id = s.id) as res_count,
           (SELECT count(*) FROM attendance_records ar WHERE ar.student_id = s.id) as att_count,
           (SELECT count(*) FROM seat_attendance sa WHERE sa.student_id = s.id) as seat_count
    FROM public.students s
    WHERE s.user_id = $1 OR s.id = ('stud-' || $1::text)
    ORDER BY s.created_at ASC NULLS LAST;
  `, [uid]);
  console.log(rows.rows);
}

await client.end();
