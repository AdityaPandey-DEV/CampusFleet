import fs from "fs";
import pg from "pg";
const { Client } = pg;

// Read .env.local
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const client = new Client({
  connectionString: env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log("Connecting to PostgreSQL...");
  await client.connect();
  console.log("Connected successfully. Applying DDL migrations...");

  // 1. Classes Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.classes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      course TEXT NOT NULL,
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(course, year, section)
    );
  `);
  console.log("✓ classes table ensured");

  // 2. Class Teachers Allocation Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.class_teachers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      teacher_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      is_primary BOOLEAN DEFAULT TRUE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(class_id, teacher_id)
    );
  `);
  console.log("✓ class_teachers table ensured");

  // 3. Class Timetables Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.class_timetables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      subject TEXT NOT NULL,
      teacher_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
      room_number TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ class_timetables table ensured");

  // 4. Update Students Table with class foreign key
  await client.query(`
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_name TEXT;
  `);
  console.log("✓ students table updated with class_id");

  // 5. Bus Merge Points Table (belonging strictly to a specific route)
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.bus_merge_points (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ bus_merge_points table ensured");

  // 6. Bus Merge Suggestions & Approval History Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.bus_merge_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      merge_point_id UUID NOT NULL REFERENCES public.bus_merge_points(id) ON DELETE CASCADE,
      route_id TEXT NOT NULL,
      source_bus_id TEXT NOT NULL,
      target_bus_id TEXT NOT NULL,
      source_occupancy INTEGER NOT NULL,
      target_occupancy INTEGER NOT NULL,
      target_capacity INTEGER NOT NULL,
      combined_occupancy INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      rejection_reason TEXT,
      suggested_by TEXT DEFAULT 'SYSTEM_OPTIMIZER',
      reviewed_by TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ bus_merge_suggestions table ensured");

  // 7. Progressive Dispatch Configuration Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.dispatch_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      min_occupancy_percent INTEGER NOT NULL DEFAULT 80,
      max_wait_minutes INTEGER NOT NULL DEFAULT 15,
      progressive_dispatch_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ dispatch_configs table ensured");

  // 8. Audit Logs Table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT,
      user_email TEXT,
      user_role TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      previous_value JSONB,
      new_value JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("✓ audit_logs table ensured");

  // 9. Initial Seeding of Classes
  console.log("\nSeeding university classes...");
  const initialClasses = [
    { course: "B.Tech CSE", year: "3rd Year", section: "A", name: "B.Tech CSE - 3rd Year (Sec A)" },
    { course: "B.Tech CSE", year: "3rd Year", section: "B", name: "B.Tech CSE - 3rd Year (Sec B)" },
    { course: "B.Tech CSE", year: "2nd Year", section: "A", name: "B.Tech CSE - 2nd Year (Sec A)" },
    { course: "B.Tech ECE", year: "3rd Year", section: "A", name: "B.Tech ECE - 3rd Year (Sec A)" },
    { course: "BCA", year: "2nd Year", section: "A", name: "BCA - 2nd Year (Sec A)" },
    { course: "MCA", year: "1st Year", section: "A", name: "MCA - 1st Year (Sec A)" },
  ];

  const classMap = new Map();
  for (const c of initialClasses) {
    const res = await client.query(
      `INSERT INTO public.classes (course, year, section, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (course, year, section) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE
       RETURNING id, name`,
      [c.course, c.year, c.section, c.name]
    );
    classMap.set(c.name, res.rows[0].id);
  }
  console.log(`✓ Seeded ${classMap.size} academic classes`);

  // 10. Seed Teacher Users
  console.log("\nSeeding faculty / teachers...");
  const sampleTeachers = [
    { id: "user-teacher-rajesh", email: "rajesh.sharma@gehu.ac.in", full_name: "Dr. Rajesh Sharma", phone: "+91 9876543210" },
    { id: "user-teacher-meenakshi", email: "meenakshi.verma@gehu.ac.in", full_name: "Prof. Meenakshi Verma", phone: "+91 9876543211" },
    { id: "user-teacher-arvind", email: "arvind.joshi@gehu.ac.in", full_name: "Dr. Arvind Joshi", phone: "+91 9876543212" },
  ];

  const teacherMap = new Map();
  for (const t of sampleTeachers) {
    const res = await client.query(
      `INSERT INTO public.users (id, email, full_name, role, provider, phone, campus)
       VALUES ($1, $2, $3, 'teacher', 'email', $4, 'GEHU Bhimtal')
       ON CONFLICT (email) DO UPDATE SET role = 'teacher', full_name = EXCLUDED.full_name
       RETURNING id, full_name`,
      [t.id, t.email, t.full_name, t.phone]
    );
    teacherMap.set(t.email, res.rows[0].id);
  }
  console.log(`✓ Seeded ${teacherMap.size} faculty teachers`);

  // 11. Allocate Teachers to Classes
  const cse3AId = classMap.get("B.Tech CSE - 3rd Year (Sec A)");
  const cse3BId = classMap.get("B.Tech CSE - 3rd Year (Sec B)");
  const rajeshId = teacherMap.get("rajesh.sharma@gehu.ac.in");
  const meenakshiId = teacherMap.get("meenakshi.verma@gehu.ac.in");

  if (cse3AId && rajeshId) {
    await client.query(
      `INSERT INTO public.class_teachers (class_id, teacher_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (class_id, teacher_id) DO NOTHING`,
      [cse3AId, rajeshId]
    );
  }
  if (cse3BId && meenakshiId) {
    await client.query(
      `INSERT INTO public.class_teachers (class_id, teacher_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (class_id, teacher_id) DO NOTHING`,
      [cse3BId, meenakshiId]
    );
  }
  console.log("✓ Allocated teachers to classes");

  // 12. Seed Class Timetables
  console.log("\nSeeding class timetables for CSE 3A...");
  if (cse3AId) {
    await client.query("DELETE FROM public.class_timetables WHERE class_id = $1", [cse3AId]);
    const timetableSlots = [
      // Monday
      { day: "Monday", start: "09:00:00", end: "10:00:00", subject: "Discrete Mathematics", room: "LT-201" },
      { day: "Monday", start: "10:00:00", end: "11:00:00", subject: "Database Management Systems (DBMS)", room: "Lab 3" },
      { day: "Monday", start: "11:15:00", end: "12:15:00", subject: "Operating Systems", room: "LT-201" },
      { day: "Monday", start: "14:00:00", end: "16:00:00", subject: "Computer Networks Lab", room: "Networking Lab" },
      // Tuesday
      { day: "Tuesday", start: "09:00:00", end: "10:00:00", subject: "Computer Organization & Architecture", room: "LT-202" },
      { day: "Tuesday", start: "10:00:00", end: "11:00:00", subject: "Theory of Computation", room: "LT-202" },
      { day: "Tuesday", start: "11:30:00", end: "12:30:00", subject: "Software Engineering", room: "LT-202" },
      // Wednesday
      { day: "Wednesday", start: "10:00:00", end: "11:00:00", subject: "Database Management Systems (DBMS)", room: "LT-201" },
      { day: "Wednesday", start: "11:00:00", end: "12:00:00", subject: "Operating Systems", room: "LT-201" },
      // Thursday
      { day: "Thursday", start: "09:00:00", end: "10:00:00", subject: "Artificial Intelligence", room: "LT-203" },
      { day: "Thursday", start: "10:00:00", end: "11:00:00", subject: "Computer Networks", room: "LT-203" },
      // Friday
      { day: "Friday", start: "09:30:00", end: "10:30:00", subject: "Web Technologies", room: "Lab 2" },
      { day: "Friday", start: "10:30:00", end: "11:30:00", subject: "Cloud Computing & DevOps", room: "LT-201" },
      // Saturday
      { day: "Saturday", start: "10:00:00", end: "11:00:00", subject: "Technical Seminar & Project Work", room: "Seminar Hall" },
    ];

    for (const slot of timetableSlots) {
      await client.query(
        `INSERT INTO public.class_timetables (class_id, day_of_week, start_time, end_time, subject, teacher_id, room_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [cse3AId, slot.day, slot.start, slot.end, slot.subject, rajeshId, slot.room]
      );
    }
    console.log(`✓ Seeded ${timetableSlots.length} lecture slots in CSE 3A timetable`);
  }

  // 13. Assign Students to Classes
  console.log("\nAssigning students to classes in database...");
  if (cse3AId) {
    await client.query(
      `UPDATE public.students
       SET class_id = $1, class_name = 'B.Tech CSE - 3rd Year (Sec A)'
       WHERE id IN (SELECT id FROM public.students LIMIT 15)`,
      [cse3AId]
    );
  }
  if (cse3BId) {
    await client.query(
      `UPDATE public.students
       SET class_id = $1, class_name = 'B.Tech CSE - 3rd Year (Sec B)'
       WHERE class_id IS NULL`,
      [cse3BId]
    );
  }
  console.log("✓ Students linked with persistent class_id");

  // 14. Seed Configured Bus Merge Points
  console.log("\nConfiguring Bus Merge Points on active routes...");
  const mergePoints = [
    {
      code: "MP-KGM-01",
      name: "Kathgodam Junction Highway Merge Point",
      route_id: "route-bus-44",
      stop_id: "stop-kathgodam",
      description: "Designated merge station for Haldwani corridor buses before mountain climb",
    },
    {
      code: "MP-BHW-01",
      name: "Bhowali Sanatorium Transit Merge Point",
      route_id: "route-bus-44",
      stop_id: "stop-bhowali",
      description: "Mid-corridor merge point for inbound Bhimtal shuttles",
    },
    {
      code: "MP-KGM-02",
      name: "Kathgodam Junction Highway Merge Point (Bus 2)",
      route_id: "route-bus-2",
      stop_id: "stop-kathgodam",
      description: "Rampur Road & Ganna Center corridor merge station",
    },
    {
      code: "MP-KGM-03",
      name: "Kathgodam Junction Highway Merge Point (Bus 3)",
      route_id: "route-bus-3",
      stop_id: "stop-kathgodam",
      description: "Gaulapar corridor merge station",
    },
  ];

  for (const mp of mergePoints) {
    await client.query(
      `INSERT INTO public.bus_merge_points (code, name, route_id, stop_id, description, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      [mp.code, mp.name, mp.route_id, mp.stop_id, mp.description]
    );
  }
  console.log(`✓ Seeded ${mergePoints.length} configured bus merge points`);

  // 15. Ensure Dispatch Config
  await client.query(`
    INSERT INTO public.dispatch_configs (min_occupancy_percent, max_wait_minutes, progressive_dispatch_enabled)
    VALUES (80, 15, TRUE)
    ON CONFLICT DO NOTHING;
  `);
  console.log("✓ Default progressive dispatch config active");

  console.log("\n=======================================================");
  console.log("ALL ENHANCEMENT PHASE 3 DATABASE MIGRATIONS COMPLETED!");
  console.log("=======================================================");

  await client.end();
}

runMigration().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
