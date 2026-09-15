// @ts-ignore
import pkg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const { Client } = pkg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let connectionString: string = process.env.POSTGRES_URL || '';
if (!connectionString) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/POSTGRES_URL=["']?([^"'\n\r]+)["']?/);
      if (match) connectionString = match[1];
    }
  } catch (e) {}
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
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✓ Connected');

    // 1. Add secondary campus (Dehradun Campus) if not exists so multi-campus zone features can be demonstrated
    await client.query(`
      INSERT INTO public.campuses (
        id, name, code, address, landmark, city, latitude, longitude,
        geofence_radius, fleet_capacity, parking_bays,
        contact_phone, contact_email, is_primary, is_active, updated_at
      ) VALUES (
        'campus-geu-dehradun',
        'Graphic Era (Deemed to be University) - Dehradun Campus',
        'GEU-DDN',
        '566/6, Bell Road, Clement Town, Dehradun, Uttarakhand 248002',
        'GEU Main Gate & Central Transit Terminal, Clement Town',
        'Dehradun',
        30.2725,
        77.9943,
        100,
        65,
        24,
        '+91 135 2643421',
        'transport.ddn@geu.ac.in',
        false,
        true,
        NOW()
      ) ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✓ Ensured secondary campus (GEU Dehradun) in campuses table');

    // 2. Add id and campus_id to transit_zones
    await client.query(`
      ALTER TABLE public.transit_zones ADD COLUMN IF NOT EXISTS id TEXT;
      ALTER TABLE public.transit_zones ADD COLUMN IF NOT EXISTS campus_id TEXT;
    `);
    console.log('✓ Added id and campus_id columns to transit_zones');

    // 3. Backfill id and campus_id for existing rows
    await client.query(`
      UPDATE public.transit_zones 
      SET campus_id = 'campus-gehu-bhimtal' 
      WHERE campus_id IS NULL OR campus_id = '';
      
      UPDATE public.transit_zones 
      SET id = 'zone-' || LOWER(campus_id) || '-' || LOWER(code) 
      WHERE id IS NULL OR id = '';
    `);
    console.log('✓ Backfilled existing transit_zones with id and campus_id');

    // 4. Update constraints: change primary key to id, and add unique (campus_id, code)
    await client.query(`
      ALTER TABLE public.transit_zones ALTER COLUMN id SET NOT NULL;
      
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'transit_zones_pkey' 
          AND conrelid = 'public.transit_zones'::regclass
        ) THEN
          ALTER TABLE public.transit_zones DROP CONSTRAINT transit_zones_pkey;
        END IF;
      END $$;

      ALTER TABLE public.transit_zones ADD CONSTRAINT transit_zones_pkey PRIMARY KEY (id);

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'transit_zones_campus_code_key' 
          AND conrelid = 'public.transit_zones'::regclass
        ) THEN
          ALTER TABLE public.transit_zones ADD CONSTRAINT transit_zones_campus_code_key UNIQUE (campus_id, code);
        END IF;
      END $$;
    `);
    console.log('✓ Updated primary key to (id) and unique constraint to (campus_id, code)');

    // 5. Seed sample zones for GEU Dehradun campus
    const dehradunZones = [
      {
        id: 'zone-campus-geu-dehradun-zone_a',
        campus_id: 'campus-geu-dehradun',
        code: 'ZONE_A',
        name: 'Zone A: Clock Tower & Rajpur Road Corridor',
        corridor_description: 'Clock Tower, Dilaram Chowk, Jakhan, Rajpur Road, Pacific Mall Hub',
        semester_fee: 16000,
        installments_allowed: 3,
        is_active: true
      },
      {
        id: 'zone-campus-geu-dehradun-zone_b',
        campus_id: 'campus-geu-dehradun',
        code: 'ZONE_B',
        name: 'Zone B: ISBT & Saharanpur Road Corridor',
        corridor_description: 'ISBT Dehradun, Kargi Chowk, Vidhyanagar, Clement Town Entrance',
        semester_fee: 13500,
        installments_allowed: 3,
        is_active: true
      },
      {
        id: 'zone-campus-geu-dehradun-zone_c',
        campus_id: 'campus-geu-dehradun',
        code: 'ZONE_C',
        name: 'Zone C: Prem Nagar & Chakrata Road Corridor',
        corridor_description: 'Prem Nagar Terminal, Ballupur Chowk, Kishan Nagar, Cantt Area',
        semester_fee: 11000,
        installments_allowed: 2,
        is_active: true
      }
    ];

    for (const z of dehradunZones) {
      await client.query(`
        INSERT INTO public.transit_zones (
          id, campus_id, code, name, corridor_description,
          semester_fee, installments_allowed, is_active, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (id) DO UPDATE SET
          campus_id = EXCLUDED.campus_id,
          name = EXCLUDED.name,
          corridor_description = EXCLUDED.corridor_description,
          semester_fee = EXCLUDED.semester_fee,
          installments_allowed = EXCLUDED.installments_allowed,
          is_active = EXCLUDED.is_active,
          updated_at = NOW();
      `, [z.id, z.campus_id, z.code, z.name, z.corridor_description, z.semester_fee, z.installments_allowed, z.is_active]);
    }
    console.log('✓ Seeded transit zones for GEU Dehradun');

    // 6. Print all transit zones with their campus
    const allZones = await client.query(`
      SELECT tz.id, tz.campus_id, c.name as campus_name, tz.code, tz.name, tz.semester_fee, tz.installments_allowed 
      FROM public.transit_zones tz
      LEFT JOIN public.campuses c ON tz.campus_id = c.id
      ORDER BY tz.campus_id, tz.code;
    `);

    console.log('\nAll Transit Zones in Database:');
    console.table(allZones.rows);
    console.log('\n✅ Transit zones migration completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
