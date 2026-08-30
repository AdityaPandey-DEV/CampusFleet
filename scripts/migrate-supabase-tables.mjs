import pkg from "pg";
const { Client } = pkg;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const connectionString = "postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres";

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS public.stops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  landmark TEXT,
  geofence_radius INTEGER DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  direction TEXT DEFAULT 'HOME_TO_CAMPUS',
  color TEXT DEFAULT '#2563EB',
  total_distance_km DOUBLE PRECISION DEFAULT 15.0,
  estimated_duration_mins INTEGER DEFAULT 45,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.buses (
  id TEXT PRIMARY KEY,
  bus_number TEXT NOT NULL,
  registration_no TEXT NOT NULL,
  model TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 40,
  seat_layout TEXT DEFAULT '2x2',
  status TEXT DEFAULT 'ACTIVE',
  gps_device_id TEXT,
  insurance_expiry TEXT,
  maintenance_due_date TEXT,
  current_route_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'MORNING',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  booking_cutoff_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trips (
  id TEXT PRIMARY KEY,
  trip_code TEXT NOT NULL,
  route_id TEXT REFERENCES public.routes(id) ON DELETE SET NULL,
  bus_id TEXT REFERENCES public.buses(id) ON DELETE SET NULL,
  shift_id TEXT REFERENCES public.shifts(id) ON DELETE SET NULL,
  trip_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'SCHEDULED',
  delay_minutes INTEGER DEFAULT 0,
  manifest_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  booking_code TEXT NOT NULL,
  student_id TEXT NOT NULL,
  trip_id TEXT REFERENCES public.trips(id) ON DELETE CASCADE,
  boarding_stop_id TEXT REFERENCES public.stops(id) ON DELETE SET NULL,
  seat_number TEXT,
  status TEXT DEFAULT 'CONFIRMED',
  waitlist_position INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

const SEED_SQL = `
-- Insert GEHU Stops
INSERT INTO public.stops (id, name, code, latitude, longitude, landmark, geofence_radius)
VALUES
  ('stop-hld-isbt', 'Haldwani ISBT Terminal', 'HLD-ISBT', 29.2183, 79.5130, 'Main Highway Bus Bay 1', 100),
  ('stop-hld-tikonia', 'Haldwani Tikonia Chauraha', 'HLD-TIK', 29.2245, 79.5240, 'Near Nainital Bank Head Office', 80),
  ('stop-kgm-rly', 'Kathgodam Railway Station Point', 'KGM-RLY', 29.2713, 79.5441, 'Opposite Station Main Gate', 90),
  ('stop-bhowali', 'Bhowali Sanatorium Junction', 'BHW-JNC', 29.3820, 79.5186, 'Almora-Nainital Bypass Point', 100),
  ('stop-gehu-bhimtal', 'GEHU Bhimtal Campus Terminal', 'GEHU-BHT', 29.3516, 79.5583, 'Graphic Era Hill University Campus Gate 1', 150),
  ('stop-gehu-hld', 'GEHU Haldwani Campus Station', 'GEHU-HLD', 29.2310, 79.5320, 'University Transport Block', 120),
  ('stop-ddn-isbt', 'Dehradun ISBT Terminal', 'DDN-ISBT', 30.2858, 78.0098, 'Haridwar Bypass Exit', 120),
  ('stop-ddn-clock', 'Dehradun Clock Tower', 'DDN-CLK', 30.3256, 78.0437, 'Rajpur Road Circle', 80),
  ('stop-gehu-ddn', 'GEHU Dehradun Main Campus (Clement Town)', 'GEHU-DDN', 30.2687, 77.9947, 'Graphic Era University Main Gate, Clement Town', 150)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

-- Insert GEHU Routes
INSERT INTO public.routes (id, code, name, description, direction, color, total_distance_km, estimated_duration_mins, is_active)
VALUES
  ('route-hld-bht', 'GEHU-RT-101', 'Haldwani to GEHU Bhimtal Express', 'Daily academic shuttle connecting Haldwani ISBT, Kathgodam, and Bhowali to GEHU Bhimtal Campus', 'HOME_TO_CAMPUS', '#2563EB', 28.4, 55, TRUE),
  ('route-ddn-cle', 'GEHU-RT-202', 'Dehradun City to GEHU Clement Town', 'Express corridor from Dehradun Clock Tower and ISBT to GEHU Dehradun Main Campus', 'HOME_TO_CAMPUS', '#0D9488', 12.8, 30, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, total_distance_km = EXCLUDED.total_distance_km;

-- Insert GEHU Buses
INSERT INTO public.buses (id, bus_number, registration_no, model, capacity, seat_layout, status, gps_device_id, insurance_expiry, maintenance_due_date, current_route_id)
VALUES
  ('bus-1', 'BUS-01 (GEHU Bhimtal Express)', 'UK-04-TA-1001', 'Tata Starbus Ultra 42-Seater', 42, '2x2', 'ACTIVE', 'GPS-GEHU-901', '2027-04-15', '2026-11-20', 'route-hld-bht'),
  ('bus-2', 'BUS-02 (Haldwani City Shuttle)', 'UK-04-TA-2002', 'BharatBenz Tourer 36-Seater', 36, '2x2', 'ACTIVE', 'GPS-GEHU-902', '2027-06-30', '2026-12-05', 'route-hld-bht'),
  ('bus-3', 'BUS-03 (Dehradun Valley Flyer)', 'UK-07-PA-5544', 'Ashok Leyland Lynx Smart 45-Seater', 45, '2x2', 'ACTIVE', 'GPS-GEHU-903', '2027-01-10', '2026-10-15', 'route-ddn-cle'),
  ('bus-4', 'BUS-04 (Bhimtal Hill Loop Mini)', 'UK-04-CA-8899', 'Force Traveller Executive 26', 26, '2x2', 'ACTIVE', 'GPS-GEHU-904', '2027-08-25', '2026-12-30', NULL)
ON CONFLICT (id) DO UPDATE SET bus_number = EXCLUDED.bus_number, registration_no = EXCLUDED.registration_no;

-- Insert GEHU Shifts
INSERT INTO public.shifts (id, name, type, start_time, end_time, booking_cutoff_minutes, is_active)
VALUES
  ('shift-1', 'Morning Academic Shift', 'MORNING', '07:30:00', '08:45:00', 30, TRUE),
  ('shift-2', 'Evening Return Corridor', 'EVENING', '16:30:00', '17:45:00', 45, TRUE)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
`;

async function runMigration() {
  try {
    console.log("🔌 Connecting to Supabase Postgres...");
    await client.connect();
    console.log("✓ Connected to Supabase!");

    console.log("📦 Creating Database Tables (stops, routes, buses, shifts, trips, bookings)...");
    await client.query(SCHEMA_SQL);
    console.log("✓ Database Tables created successfully!");

    console.log("🌱 Seeding GEHU Institutional Data into Supabase Tables...");
    await client.query(SEED_SQL);
    console.log("✓ GEHU stops, routes, buses, and shifts successfully stored in Supabase Database!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await client.end();
  }
}

runMigration();
