// @ts-ignore
import pkg from 'pg';
const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
  connectionString: 'postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Create campuses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.campuses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        address TEXT,
        landmark TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        geofence_radius DOUBLE PRECISION DEFAULT 100,
        fleet_capacity INTEGER DEFAULT 50,
        parking_bays INTEGER DEFAULT 20,
        contact_phone TEXT,
        contact_email TEXT,
        is_primary BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('campuses table ensured');

    // Upsert the primary campus location
    const campusData = {
      id: "campus-gehu-bhimtal",
      name: "Graphic Era Hill University - Bhimtal Campus",
      code: "GEHU-BHT",
      address: "Sattal Road, Bhimtal, Nainital, Uttarakhand 263136",
      landmark: "GEHU Main Gate & Fleet Parking Depot, Sattal Road",
      latitude: 29.375015,
      longitude: 79.529479,
      geofence_radius: 90,
      fleet_capacity: 50,
      parking_bays: 16,
      contact_phone: "+91 8057999901",
      contact_email: "transport@gehu.ac.in",
      is_primary: true,
      is_active: true
    };

    await client.query(`
      INSERT INTO public.campuses (
        id, name, code, address, landmark, latitude, longitude,
        geofence_radius, fleet_capacity, parking_bays,
        contact_phone, contact_email, is_primary, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        address = EXCLUDED.address,
        landmark = EXCLUDED.landmark,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geofence_radius = EXCLUDED.geofence_radius,
        fleet_capacity = EXCLUDED.fleet_capacity,
        parking_bays = EXCLUDED.parking_bays,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        is_primary = EXCLUDED.is_primary,
        is_active = EXCLUDED.is_active,
        updated_at = NOW();
    `, [
      campusData.id,
      campusData.name,
      campusData.code,
      campusData.address,
      campusData.landmark,
      campusData.latitude,
      campusData.longitude,
      campusData.geofence_radius,
      campusData.fleet_capacity,
      campusData.parking_bays,
      campusData.contact_phone,
      campusData.contact_email,
      campusData.is_primary,
      campusData.is_active
    ]);

    console.log('Seeded primary campus:', campusData.name);

    // Also check if stop-bhimtal-campus is in stops table and ensure coordinates match
    const stopRes = await client.query(`SELECT id, name, latitude, longitude FROM public.stops WHERE id = 'stop-bhimtal-campus' OR code = 'GEHU-BHT'`);
    console.log('Matching stops in public.stops:', stopRes.rows);

    const allCampuses = await client.query(`SELECT * FROM public.campuses`);
    console.log('Current campuses in table:', allCampuses.rows);

  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
