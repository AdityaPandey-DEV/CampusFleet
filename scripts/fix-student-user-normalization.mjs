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
const connectionString = envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL;

if (!connectionString) {
  console.error("No database connection string found in .env.local!");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();
console.log("Connected to database. Executing Item 2: Students & Staff Normalization...\n");

try {
  await client.query("BEGIN;");

  // 1. Unlink student records mistakenly connected to non-student accounts (drivers, conductors, admins, teachers)
  console.log("1. Unlinking student records from non-student user accounts...");
  const unlinkRes = await client.query(`
    UPDATE public.students 
    SET user_id = NULL 
    WHERE user_id IN (SELECT id FROM public.users WHERE role != 'student');
  `);
  console.log(`   ✓ Unlinked ${unlinkRes.rowCount} student records from non-student users.`);

  // 2. Fix usr-parent-1 user account to match student Neha Adhikari
  console.log("2. Normalizing student user accounts...");
  await client.query(`
    UPDATE public.users 
    SET full_name = 'Neha Adhikari' 
    WHERE id = 'usr-parent-1' AND role = 'student';
  `);

  // 3. Sync students.full_name from users.full_name for all student accounts
  const syncStudents = await client.query(`
    UPDATE public.students s
    SET full_name = u.full_name
    FROM public.users u
    WHERE s.user_id = u.id AND s.full_name IS DISTINCT FROM u.full_name;
  `);
  console.log(`   ✓ Synchronized ${syncStudents.rowCount} student names directly from users.`);

  // 4. Sync staff fields from users
  console.log("3. Synchronizing staff fields from users...");
  const syncStaff = await client.query(`
    UPDATE public.staff st
    SET full_name = u.full_name,
        email = u.email,
        phone = u.phone
    FROM public.users u
    WHERE st.user_id = u.id AND (
      st.full_name IS DISTINCT FROM u.full_name OR
      st.email IS DISTINCT FROM u.email OR
      st.phone IS DISTINCT FROM u.phone
    );
  `);
  console.log(`   ✓ Synchronized ${syncStaff.rowCount} staff rows from users.`);

  // 5. Backfill students campus & semester from campuses & classes
  console.log("4. Auto-deriving students.campus and students.semester from FKs...");
  const backfillCampus = await client.query(`
    UPDATE public.students s
    SET campus = c.name
    FROM public.campuses c
    WHERE s.campus_id = c.id AND (s.campus IS NULL OR s.campus != c.name);
  `);
  console.log(`   ✓ Backfilled ${backfillCampus.rowCount} student campus names from campuses table.`);

  const backfillSem = await client.query(`
    UPDATE public.students s
    SET semester = COALESCE(cl.semester_num::text, cl.semester)
    FROM public.classes cl
    WHERE s.class_id = cl.id AND (s.semester IS NULL OR s.semester != COALESCE(cl.semester_num::text, cl.semester));
  `);
  console.log(`   ✓ Backfilled ${backfillSem.rowCount} student semester values from classes table.`);

  // 6. Create permanent database synchronization triggers
  console.log("5. Installing database triggers for continuous normalization...");

  // Trigger 1: User -> Student and Staff
  await client.query(`
    CREATE OR REPLACE FUNCTION public.fn_sync_user_to_student_and_staff()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Sync full_name to student record if linked
      UPDATE public.students 
      SET full_name = NEW.full_name
      WHERE user_id = NEW.id;

      -- Sync full_name, email, phone to staff record if linked
      UPDATE public.staff 
      SET full_name = NEW.full_name,
          email = NEW.email,
          phone = NEW.phone
      WHERE user_id = NEW.id;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_user_to_student_and_staff ON public.users;
    CREATE TRIGGER trg_sync_user_to_student_and_staff
    AFTER UPDATE OF full_name, email, phone ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_user_to_student_and_staff();
  `);
  console.log("   ✓ User -> Student & Staff trigger active.");

  // Trigger 2: Student -> User
  await client.query(`
    CREATE OR REPLACE FUNCTION public.fn_sync_student_to_user()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.user_id IS NOT NULL AND (OLD.full_name IS NULL OR NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
        UPDATE public.users
        SET full_name = NEW.full_name
        WHERE id = NEW.user_id AND role = 'student';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_student_to_user ON public.students;
    CREATE TRIGGER trg_sync_student_to_user
    AFTER UPDATE OF full_name ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_student_to_user();
  `);
  console.log("   ✓ Student -> User trigger active.");

  // Trigger 3: Student Campus & Semester Auto-Derivation
  await client.query(`
    CREATE OR REPLACE FUNCTION public.fn_sync_student_class_campus()
    RETURNS TRIGGER AS $$
    DECLARE
      v_campus_name TEXT;
      v_semester TEXT;
    BEGIN
      IF NEW.campus_id IS NOT NULL THEN
        SELECT name INTO v_campus_name FROM public.campuses WHERE id = NEW.campus_id LIMIT 1;
        IF v_campus_name IS NOT NULL THEN
          NEW.campus = v_campus_name;
        END IF;
      END IF;

      IF NEW.class_id IS NOT NULL THEN
        SELECT COALESCE(semester_num::text, semester) INTO v_semester FROM public.classes WHERE id = NEW.class_id LIMIT 1;
        IF v_semester IS NOT NULL THEN
          NEW.semester = v_semester;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_student_class_campus ON public.students;
    CREATE TRIGGER trg_sync_student_class_campus
    BEFORE INSERT OR UPDATE OF campus_id, class_id ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_sync_student_class_campus();
  `);
  console.log("   ✓ Student Campus & Semester auto-derivation trigger active.");

  await client.query("COMMIT;");
  console.log("\n✅ ITEM 2: STUDENTS & STAFF NORMALIZATION COMPLETED SUCCESSFULLY!");
} catch (err) {
  await client.query("ROLLBACK;");
  console.error("❌ Migration failed, rolled back:", err);
  process.exit(1);
} finally {
  await client.end();
}
