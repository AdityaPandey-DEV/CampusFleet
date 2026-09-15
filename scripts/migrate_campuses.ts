// @ts-ignore
import pkg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Try reading POSTGRES_URL from .env.local if not already in env
let connectionString: string = process.env.POSTGRES_URL || '';
if (!connectionString) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/POSTGRES_URL=["']?([^"'\n\r]+)["']?/);
      if (match) {
        connectionString = match[1];
      }
    }
  } catch (e) {
    // ignore
  }
}

if (!connectionString) {
  connectionString = 'postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres';
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log('Connecting to PostgreSQL database via:', connectionString.replace(/:[^:@]+@/, ':****@'));
    await client.connect();
    console.log('✓ Connected to PostgreSQL database');

    // 1. Create campuses table & ensure columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.campuses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        address TEXT,
        landmark TEXT,
        city TEXT,
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
      ALTER TABLE public.campuses ADD COLUMN IF NOT EXISTS city TEXT;
    `);
    console.log('✓ public.campuses table verified/created with city column');

    // 2. Ensure campus_id columns across related tables
    await client.query(`
      ALTER TABLE public.stops ADD COLUMN IF NOT EXISTS campus_id TEXT;
      ALTER TABLE public.students ADD COLUMN IF NOT EXISTS campus_id TEXT;
      ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS campus_id TEXT;
      ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS origin_campus_id TEXT;
      ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS destination_campus_id TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS campus_id TEXT;
    `);
    console.log('✓ Added campus_id columns to stops, students, routes, users');

    // 3. Upsert the primary campus location
    const campusData = {
      id: "campus-gehu-bhimtal",
      name: "Graphic Era Hill University - Bhimtal Campus",
      code: "GEHU-BHT",
      address: "Sattal Road, Bhimtal, Nainital, Uttarakhand 263136",
      landmark: "GEHU Main Gate & Fleet Parking Depot, Sattal Road",
      city: "Bhimtal",
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
        id, name, code, address, landmark, city, latitude, longitude,
        geofence_radius, fleet_capacity, parking_bays,
        contact_phone, contact_email, is_primary, is_active, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        address = EXCLUDED.address,
        landmark = EXCLUDED.landmark,
        city = EXCLUDED.city,
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
      campusData.city,
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
    console.log('✓ Upserted primary campus entity:', campusData.name);

    // 4. Update stops: mark terminal stop with campus_id
    const updatedStops = await client.query(`
      UPDATE public.stops 
      SET campus_id = $1 
      WHERE id = 'stop-bhimtal-campus' OR code = 'GEHU-BHT' OR name ILIKE '%GEHU%Bhimtal%'
    `, [campusData.id]);
    console.log(`✓ Linked ${updatedStops.rowCount} campus stops in public.stops`);

    // 5. Backfill students campus_id
    const updatedStudents = await client.query(`
      UPDATE public.students
      SET campus_id = $1
      WHERE campus_id IS NULL OR campus_id = ''
    `, [campusData.id]);
    console.log(`✓ Backfilled ${updatedStudents.rowCount} students with primary campus_id`);

    // 6. Backfill users campus_id
    const updatedUsers = await client.query(`
      UPDATE public.users
      SET campus_id = $1
      WHERE campus_id IS NULL OR campus_id = ''
    `, [campusData.id]);
    console.log(`✓ Backfilled ${updatedUsers.rowCount} users with primary campus_id`);

    // 7. Backfill routes campus_id
    const updatedRoutes = await client.query(`
      UPDATE public.routes
      SET campus_id = $1
      WHERE campus_id IS NULL OR campus_id = ''
    `, [campusData.id]);
    console.log(`✓ Backfilled ${updatedRoutes.rowCount} routes with primary campus_id`);

    // 8. Verify final campus state
    const allCampuses = await client.query(`SELECT id, name, code, is_primary, is_active FROM public.campuses`);
    console.log('\nFinal registered campuses:');
    console.table(allCampuses.rows);

    console.log('\n✅ Database migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
