import pkg from 'pg';
const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await client.connect();
  console.log('Connected to Supabase Postgres');

  // 1. Add missing columns to trips
  console.log('--- Adding missing columns to trips ---');
  const tripCols = [
    'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS driver_id TEXT',
    'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS conductor_id TEXT',
    'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS current_stop_index INTEGER DEFAULT 0',
    'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ',
    'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ',
    'ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS manifest_locked_at TIMESTAMPTZ',
  ];
  for (const q of tripCols) {
    await client.query(q);
  }
  console.log('  trips columns added');

  // 2. Create students table
  console.log('--- Creating students table ---');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.students (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      enrollment_no TEXT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      department TEXT DEFAULT 'B.Tech CSE',
      semester TEXT DEFAULT '5th',
      primary_stop_id TEXT,
      primary_route_id TEXT,
      emergency_contact JSONB DEFAULT '{"name":"Campus Desk","relationship":"Admin","phone":"+91 0000000000"}',
      transport_access_suspended BOOLEAN DEFAULT false,
      has_active_subscription BOOLEAN DEFAULT false,
      subscription_expiry_date DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('  students table created');

  // 3. Create staff table
  console.log('--- Creating staff table ---');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.staff (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      employee_code TEXT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      category TEXT DEFAULT 'DRIVERS',
      role TEXT DEFAULT 'driver',
      license_no TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('  staff table created');

  // 4. Clean old buses and insert official 14-bus GEHU Bhimtal fleet
  console.log('--- Seeding official 14-bus fleet ---');
  await client.query('DELETE FROM public.buses');
  
  const officialBuses = [
    { id: 'bus-02', num: 'Bus 2 (Ganna Center)', reg: 'UK04PA 2158', model: 'Tata Starbus 40-Seater', cap: 40, route: 'route-bus-2' },
    { id: 'bus-03', num: 'Bus 3 (Gaulapar)', reg: 'UK04PA 2165', model: 'Tata Starbus 40-Seater', cap: 40, route: 'route-bus-3' },
    { id: 'bus-08', num: 'Bus 8 (Nagla/Lalkuan)', reg: 'UK04PA 2172', model: 'Tata Starbus 38-Seater', cap: 38, route: 'route-bus-8' },
    { id: 'bus-09', num: 'Bus 9 (Jadge Farm)', reg: 'UK04PA 1613', model: 'Tata LP 36-Seater', cap: 36, route: 'route-bus-9' },
    { id: 'bus-11', num: 'Bus 11 (Nainital)', reg: 'UK04PA 0742', model: 'Tata Starbus 34-Seater', cap: 34, route: 'route-bus-11' },
    { id: 'bus-36', num: 'Bus 36 (Bhagwanpur)', reg: 'UK04PA 2012', model: 'Tata Starbus 40-Seater', cap: 40, route: 'route-bus-36' },
    { id: 'bus-37', num: 'Bus 37 (Lamachaur)', reg: 'UK04PA 2354', model: 'Tata LP 36-Seater', cap: 36, route: 'route-bus-37' },
    { id: 'bus-40', num: 'Bus 40 (Gusai Pur)', reg: 'UK04PA 2353', model: 'Tata Starbus 38-Seater', cap: 38, route: 'route-bus-40' },
    { id: 'bus-43', num: 'Bus 43 (Kamluvaganja)', reg: 'UK04PA 2019', model: 'Tata Starbus 40-Seater', cap: 40, route: 'route-bus-43' },
    { id: 'bus-44', num: 'Bus 44 (Bhakda/Laldant)', reg: 'UK04PA 2021', model: 'Tata Starbus 42-Seater', cap: 42, route: 'route-bus-44' },
    { id: 'bus-45', num: 'Bus 45 (Naukuchiatal)', reg: 'UK04PA 2022', model: 'Tata LP 34-Seater', cap: 34, route: 'route-bus-45' },
    { id: 'bus-49', num: 'Bus 49 (Panchayat Ghar)', reg: 'UK04PA 2149', model: 'Tata LP 36-Seater', cap: 36, route: 'route-bus-49' },
    { id: 'bus-50', num: 'Bus 50 (New ITI)', reg: 'UK04PA 2150', model: 'Tata LP 36-Seater', cap: 36, route: 'route-bus-50' },
    { id: 'bus-tempo', num: 'Tempo Shuttle (Tallital)', reg: 'UK04PA 1792', model: 'Force Traveller 12-Seater', cap: 12, route: null },
  ];

  for (const b of officialBuses) {
    await client.query(
      'INSERT INTO public.buses (id, bus_number, registration_no, model, capacity, seat_layout, status, gps_device_id, insurance_expiry, maintenance_due_date, current_route_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [b.id, b.num, b.reg, b.model, b.cap, '2x2', 'ACTIVE', `GPS-${b.id}`, '2027-03-31', '2027-01-15', b.route]
    );
  }
  console.log(`  ${officialBuses.length} buses inserted`);

  // 5. Seed staff (1 driver + 1 conductor per bus)
  console.log('--- Seeding staff ---');
  await client.query('DELETE FROM public.staff');

  const driverNames = ['Ramesh Chandra', 'Suresh Bisht', 'Prakash Rawat', 'Dinesh Joshi', 'Mohan Pandey', 'Rajesh Tiwari', 'Kailash Negi', 'Bharat Bhandari', 'Girish Upadhyay', 'Vinod Mehta', 'Anand Chamoli', 'Satish Gaur', 'Narendra Sah', 'Raju Thapa'];
  const conductorNames = ['Prakash Joshi', 'Manoj Verma', 'Deepak Arya', 'Vikas Bhatt', 'Sanjay Karki', 'Anil Rana', 'Pankaj Bisht', 'Harish Rawat', 'Sunil Pathak', 'Vivek Joshi', 'Lalit Bora', 'Mahesh Pandey', 'Ashok Gurung', 'Ravi Tamta'];

  for (let i = 0; i < officialBuses.length; i++) {
    const bus = officialBuses[i];
    const driverId = `staff-driver-${bus.id.replace('bus-', '')}`;
    const conductorId = `staff-conductor-${bus.id.replace('bus-', '')}`;

    await client.query(
      'INSERT INTO public.staff (id, user_id, employee_code, full_name, email, phone, category, role, license_no, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [driverId, driverId, `DRV-${bus.id.replace('bus-', '').toUpperCase()}`, driverNames[i], `driver.${bus.id.replace('bus-', '')}@gehu.ac.in`, `+91 98100${String(10 + i).padStart(2, '0')}219`, 'DRIVERS', 'driver', `UK-DL-${2024 + i}-${String(1000 + i)}`, true]
    );
    await client.query(
      'INSERT INTO public.staff (id, user_id, employee_code, full_name, email, phone, category, role, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [conductorId, conductorId, `CND-${bus.id.replace('bus-', '').toUpperCase()}`, conductorNames[i], `conductor.${bus.id.replace('bus-', '')}@gehu.ac.in`, `+91 98731${String(80 + i).padStart(2, '0')}402`, 'CONDUCTORS', 'conductor', true]
    );
  }
  console.log(`  ${officialBuses.length * 2} staff members inserted (14 drivers + 14 conductors)`);

  // 6. Seed sample students
  console.log('--- Seeding sample students ---');
  await client.query('DELETE FROM public.students');

  const sampleStudents = [
    { id: 'stud-1', name: 'Aayush Rawat', email: 'aayush.bht@gehu.ac.in', dept: 'B.Tech CSE', sem: '5th', stop: 'stop-bhakda-laldant', route: 'route-bus-44', enroll: 'GEU2024001' },
    { id: 'stud-2', name: 'Priya Sharma', email: 'priya.bht@gehu.ac.in', dept: 'B.Tech IT', sem: '3rd', stop: 'stop-mukhani', route: 'route-bus-44', enroll: 'GEU2024002' },
    { id: 'stud-3', name: 'Rohit Pandey', email: 'rohit.bht@gehu.ac.in', dept: 'BBA', sem: '5th', stop: 'stop-kathgodam', route: 'route-bus-44', enroll: 'GEU2024003' },
    { id: 'stud-4', name: 'Sneha Bisht', email: 'sneha.bht@gehu.ac.in', dept: 'B.Tech ECE', sem: '7th', stop: 'stop-nainital-tallital', route: 'route-bus-11', enroll: 'GEU2024004' },
    { id: 'stud-5', name: 'Vikas Joshi', email: 'vikas.bht@gehu.ac.in', dept: 'B.Tech CSE', sem: '3rd', stop: 'stop-lalkuan-nagla', route: 'route-bus-8', enroll: 'GEU2024005' },
    { id: 'stud-6', name: 'Ankita Negi', email: 'ankita.bht@gehu.ac.in', dept: 'B.Tech ME', sem: '5th', stop: 'stop-kusumkhera', route: 'route-bus-36', enroll: 'GEU2024006' },
    { id: 'stud-7', name: 'Deepak Arya', email: 'deepak.bht@gehu.ac.in', dept: 'MCA', sem: '1st', stop: 'stop-unchapul', route: 'route-bus-37', enroll: 'GEU2024007' },
    { id: 'stud-8', name: 'Kavita Bhandari', email: 'kavita.bht@gehu.ac.in', dept: 'B.Tech CSE', sem: '5th', stop: 'stop-ganna-center', route: 'route-bus-2', enroll: 'GEU2024008' },
    { id: 'stud-9', name: 'Manish Tiwari', email: 'manish.bht@gehu.ac.in', dept: 'B.Tech CE', sem: '7th', stop: 'stop-naukuchiatal', route: 'route-bus-45', enroll: 'GEU2024009' },
    { id: 'stud-10', name: 'Pooja Mehta', email: 'pooja.bht@gehu.ac.in', dept: 'BCA', sem: '3rd', stop: 'stop-jadge-farm', route: 'route-bus-9', enroll: 'GEU2024010' },
  ];

  for (const s of sampleStudents) {
    await client.query(
      'INSERT INTO public.students (id, user_id, enrollment_no, full_name, email, phone, department, semester, primary_stop_id, primary_route_id, has_active_subscription, subscription_expiry_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [s.id, s.id, s.enroll, s.name, s.email, `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`, s.dept, s.sem, s.stop, s.route, true, '2027-02-28']
    );
  }
  console.log(`  ${sampleStudents.length} students inserted`);

  // 7. Update trips with driver/conductor IDs
  console.log('--- Updating trips with driver/conductor refs ---');
  const { rows: allTrips } = await client.query('SELECT id, bus_id FROM public.trips');
  for (const trip of allTrips) {
    const busNum = trip.bus_id.replace('bus-', '');
    const driverId = `staff-driver-${busNum}`;
    const conductorId = `staff-conductor-${busNum}`;
    await client.query(
      'UPDATE public.trips SET driver_id = $1, conductor_id = $2 WHERE id = $3',
      [driverId, conductorId, trip.id]
    );
  }
  console.log(`  ${allTrips.length} trips updated`);

  // 8. Seed a few sample bookings
  console.log('--- Seeding sample bookings ---');
  await client.query('DELETE FROM public.bookings');
  
  const { rows: tripRows } = await client.query("SELECT id, route_id, bus_id FROM public.trips WHERE route_id = 'route-bus-44' LIMIT 1");
  if (tripRows.length > 0) {
    const trip44 = tripRows[0];
    const bookings = [
      { id: 'bk-1', code: 'GEHU-BK-001', studentId: 'stud-1', tripId: trip44.id, stop: 'stop-bhakda-laldant', seat: '1A', status: 'CONFIRMED' },
      { id: 'bk-2', code: 'GEHU-BK-002', studentId: 'stud-2', tripId: trip44.id, stop: 'stop-mukhani', seat: '2A', status: 'CONFIRMED' },
      { id: 'bk-3', code: 'GEHU-BK-003', studentId: 'stud-3', tripId: trip44.id, stop: 'stop-kathgodam', seat: '3B', status: 'WAITLISTED', wl: 1 },
    ];
    for (const b of bookings) {
      await client.query(
        'INSERT INTO public.bookings (id, booking_code, student_id, trip_id, boarding_stop_id, seat_number, status, waitlist_position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [b.id, b.code, b.studentId, b.tripId, b.stop, b.seat, b.status, b.wl || null]
      );
    }
    console.log(`  ${bookings.length} bookings inserted`);
  } else {
    console.log('  No Bus 44 trip found, skipping bookings');
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  
  // Final counts
  const tables = ['buses', 'stops', 'routes', 'trips', 'shifts', 'users', 'students', 'staff', 'bookings', 'subscription_plans'];
  for (const t of tables) {
    const { rows } = await client.query(`SELECT count(*) FROM public.${t}`);
    console.log(`  ${t}: ${rows[0].count} rows`);
  }

  await client.end();
}

migrate().catch(e => { console.error(e); process.exit(1); });
