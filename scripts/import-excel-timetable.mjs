import fs from "fs";
import xlsx from "xlsx";
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

if (!env.POSTGRES_URL) {
  console.error("Missing POSTGRES_URL in .env.local");
  process.exit(1);
}

const client = new Client({
  connectionString: env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const EXCEL_PATH = "docs/Time Table Btech CSE 2026_27 Odd Sem.xlsx";

// Standard university period definitions
const PERIOD_TIMES = [
  { col: 1, start: "09:00:00", end: "09:55:00", nextCol: 2 },
  { col: 2, start: "09:55:00", end: "10:50:00", nextCol: null },
  // col 3 is Break (10:50 - 11:00)
  { col: 4, start: "11:00:00", end: "11:55:00", nextCol: 5 },
  { col: 5, start: "11:55:00", end: "12:50:00", nextCol: null },
  // col 6 is Lunch (12:50 - 13:20)
  { col: 7, start: "13:20:00", end: "14:15:00", nextCol: 8 },
  { col: 8, start: "14:15:00", end: "15:10:00", nextCol: null },
  { col: 9, start: "15:10:00", end: "16:05:00", nextCol: 10 },
  { col: 10, start: "16:05:00", end: "17:00:00", nextCol: null },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

async function runImport() {
  console.log("=================================================");
  console.log("  CAMPUSFLEET REAL TIMETABLE DATA IMPORT SCRIPT  ");
  console.log("=================================================");

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`File not found: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(EXCEL_PATH);
  console.log(`Loaded workbook with ${wb.SheetNames.length} sheets.`);

  console.log("Connecting to PostgreSQL...");
  await client.connect();
  console.log("Connected successfully.");

  // 1. Extract all faculty from sheets
  const facultyByCode = new Map(); // code -> { name, code, email, id }
  const facultyByName = new Map(); // name -> { name, code, email, id }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    let subHeaderRow = -1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      if (row.some(c => typeof c === "string" && (c.includes("Faculty Name") || c.includes("Code")))) {
        subHeaderRow = r;
        break;
      }
    }
    if (subHeaderRow === -1) continue;

    for (let r = subHeaderRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      let facName = "";
      let facCode = "";

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").trim();
        if (val.match(/^(Dr\.|Mr\.|Ms\.|Prof\.)/i)) {
          facName = val;
        }
        if (val.length >= 2 && val.length <= 4 && val === val.toUpperCase() && 
            !val.includes("TCS") && !val.includes("PCS") && !val.includes("XCS") && !val.includes("LAB")) {
          facCode = val;
        }
      }

      if (facName && !facName.includes("+")) {
        const cleanName = facName.replace(/\(online\)/i, "").trim();
        const emailSlug = slugify(cleanName.replace(/^(Dr\.|Mr\.|Ms\.|Prof\.)\s*/i, ""));
        const teacherId = `teacher-${emailSlug}`;
        const teacherEmail = `${emailSlug}@gehu.ac.in`;

        const record = {
          id: teacherId,
          name: cleanName,
          code: facCode || "",
          email: teacherEmail,
        };

        if (facCode) facultyByCode.set(facCode, record);
        facultyByName.set(cleanName, record);
      }
    }
  }

  console.log(`\nIdentified ${facultyByName.size} unique faculty professors from timetable.`);

  // Upsert faculty into `public.users`
  for (const fac of facultyByName.values()) {
    await client.query(`
      INSERT INTO public.users (id, email, full_name, role, provider, campus)
      VALUES ($1, $2, $3, 'teacher', 'System', 'GEHU Bhimtal')
      ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          role = 'teacher',
          campus = 'GEHU Bhimtal';
    `, [fac.id, fac.email, fac.name]);
  }
  console.log("✓ Faculty members upserted into users table.");

  // 2. Process all 25 classes and timetables
  let totalClassesCreated = 0;
  let totalSlotsInserted = 0;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    // Derive class metadata from sheet name
    let course = "B.Tech CSE";
    let year = "3rd Year";
    let section = sheetName;
    let displayName = sheetName;

    if (sheetName.startsWith("CSE VII")) {
      course = "B.Tech CSE";
      year = "4th Year";
      section = sheetName.replace("CSE VII", "").trim() || "A";
      displayName = `B.Tech CSE - 7th Sem (Sec ${section})`;
    } else if (sheetName.startsWith("CSE V")) {
      course = "B.Tech CSE";
      year = "3rd Year";
      section = sheetName.replace("CSE V", "").trim() || "A";
      displayName = `B.Tech CSE - 5th Sem (Sec ${section})`;
    } else if (sheetName.startsWith("CSE III")) {
      course = "B.Tech CSE";
      year = "2nd Year";
      section = sheetName.replace("CSE III", "").trim() || "A";
      displayName = `B.Tech CSE - 3rd Sem (Sec ${section})`;
    } else if (sheetName.startsWith("M.Tech")) {
      course = "M.Tech CSE";
      year = sheetName.includes("I") && !sheetName.includes("III") && !sheetName.includes("V") ? "1st Year" : sheetName.includes("III") ? "2nd Year" : "3rd Year";
      section = sheetName;
      displayName = `M.Tech CSE - ${sheetName}`;
    } else if (sheetName.startsWith("Diploma")) {
      course = "Diploma CSE";
      year = sheetName.includes("III") ? "2nd Year" : "3rd Year";
      section = sheetName.replace("Diploma", "").trim();
      displayName = `Diploma CSE - ${section}`;
    }

    // Extract default Room Number
    let roomNumber = "";
    for (let r = 0; r < Math.min(6, rows.length); r++) {
      const row = rows[r] || [];
      for (const cell of row) {
        if (typeof cell === "string" && cell.toUpperCase().includes("ROOM NO")) {
          roomNumber = cell.replace(/ROOM\s*NO:?/i, "").trim();
        }
      }
    }
    if (!roomNumber) {
      roomNumber = sheetName.includes("VII") ? "OSH" : "Campus Block D";
    }

    // Upsert class into `public.classes`
    const classRes = await client.query(`
      INSERT INTO public.classes (course, year, section, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (course, year, section) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = true
      RETURNING id;
    `, [course, year, section, displayName]);

    const classId = classRes.rows[0].id;
    totalClassesCreated++;

    // Clear existing timetable slots for this class before importing fresh slots
    await client.query(`DELETE FROM public.class_timetables WHERE class_id = $1`, [classId]);

    // Find time header row
    let timeRow = -1;
    for (let r = 0; r < rows.length; r++) {
      const rowStr = JSON.stringify(rows[r] || []);
      if (rowStr.includes("09:00") || rowStr.includes("9:00")) {
        timeRow = r;
        break;
      }
    }
    if (timeRow === -1) {
      console.log(`  Skipping slots for ${sheetName} (no time header)`);
      continue;
    }

    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    let sheetSlots = 0;

    for (let r = timeRow + 1; r < rows.length; r++) {
      const firstCell = String(rows[r]?.[0] || "").trim().toUpperCase();
      if (days.includes(firstCell)) {
        const dayOfWeek = firstCell.charAt(0) + firstCell.slice(1).toLowerCase();
        const subjectRow = rows[r] || [];
        const facultyRow = rows[r + 1] || [];

        // Check each period
        for (let i = 0; i < PERIOD_TIMES.length; i++) {
          const p = PERIOD_TIMES[i];
          const rawSubj = subjectRow[p.col];
          if (!rawSubj || typeof rawSubj !== "string") continue;

          const subj = rawSubj.trim();
          if (!subj || subj.toUpperCase() === "BREAK" || subj.toUpperCase() === "LUNCH" || subj.toUpperCase() === "LIB") {
            continue;
          }

          let startTime = p.start;
          let endTime = p.end;

          // Check if this is a 2-period lecture / lab (next period column in same block is empty/merged)
          if (p.nextCol !== null) {
            const nextSubj = subjectRow[p.nextCol];
            if (!nextSubj || (typeof nextSubj === "string" && !nextSubj.trim())) {
              // Spans 2 consecutive periods!
              const nextPeriod = PERIOD_TIMES.find(pt => pt.col === p.nextCol);
              if (nextPeriod) {
                endTime = nextPeriod.end;
              }
            }
          }

          // Extract Faculty Code & match Teacher ID
          const rawFaculty = String(facultyRow[p.col] || "").trim();
          let teacherId = null;

          if (rawFaculty) {
            const cleanCode = rawFaculty.split("+")[0].trim();
            if (facultyByCode.has(cleanCode)) {
              teacherId = facultyByCode.get(cleanCode).id;
            }
          }

          // Insert into class_timetables
          await client.query(`
            INSERT INTO public.class_timetables (
              class_id, day_of_week, start_time, end_time, subject, teacher_id, room_number
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [classId, dayOfWeek, startTime, endTime, subj, teacherId, roomNumber]);

          sheetSlots++;
          totalSlotsInserted++;

          // Link teacher to class in class_teachers
          if (teacherId) {
            await client.query(`
              INSERT INTO public.class_teachers (class_id, teacher_id, is_primary)
              VALUES ($1, $2, true)
              ON CONFLICT (class_id, teacher_id) DO NOTHING;
            `, [classId, teacherId]);
          }
        }
      }
    }

    console.log(`✓ [${totalClassesCreated}/25] ${displayName} (Room: ${roomNumber}) -> ${sheetSlots} timetable slots`);
  }

  console.log("\n=================================================");
  console.log(`  IMPORT COMPLETE:`);
  console.log(`  • Classes Processed: ${totalClassesCreated}`);
  console.log(`  • Timetable Slots Inserted: ${totalSlotsInserted}`);
  console.log(`  • Faculty Teachers Registered: ${facultyByName.size}`);
  console.log("=================================================");

  await client.end();
}

runImport().catch(err => {
  console.error("Migration failed:", err);
  client.end();
  process.exit(1);
});
