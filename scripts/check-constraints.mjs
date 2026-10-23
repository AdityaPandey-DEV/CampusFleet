import pkg from 'pg';
const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const connectionString = 'postgresql://postgres:CampusFleet2026!Secure@db.zdjooiztjzmbiwaknfir.supabase.co:5432/postgres';
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const tables = [
  'payment_submissions',
  'bus_reservations',
  'seat_attendance',
  'attendance_records',
  'halt_requests',
  'bus_switch_requests',
  'special_shift_allocations',
  'early_departure_requests'
];

for (const tbl of tables) {
  const res = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = $1::regclass AND contype IN ('u', 'p');
  `, [`public.${tbl}`]);
  console.log(`=== Constraints for ${tbl} ===`);
  console.table(res.rows);
}

await client.end();
