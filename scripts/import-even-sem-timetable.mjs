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

const EXCEL_PATH = "docs/Time Table Btech CSE 2024-25_Even Sem_ver3-2.xlsx";

// Period definitions
const BASE_PERIODS = [
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

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, ".");
}

async function runImport() {
  console.log("===============================================================");
  console.log("  CAMPUSFLEET: EVEN SEMESTER REAL TIMETABLE DATA IMPORT SCRIPT ");
  console.log("===============================================================");

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`File not found: ${EXCEL_PATH}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(EXCEL_PATH);
  console.log(`Loaded workbook with ${wb.SheetNames.length} total sheets.`);

  const CLASS_SHEETS = wb.SheetNames.filter(
    s => !["uP Lab Slot", "Lab TT_Even sem", "Sheet1"].includes(s)
  );

  console.log(`Found ${CLASS_SHEETS.length} academic class sheets to process.\n`);

  console.log("Connecting to PostgreSQL database...");
  await client.connect();
  console.log("✓ Connected successfully.");

  // 1. First pass: Collect all faculty across sheets and build sheet-level code dictionaries
  const allFacultyByName = new Map();
  const sheetFacultyMaps = new Map(); // sheetName -> Map(code -> facultyRecord)

  for (const sheetName of CLASS_SHEETS) {
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

    const localCodeMap = new Map();

    if (subHeaderRow !== -1) {
      for (let r = subHeaderRow + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        let facName = "";
        let facCode = "";

        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || "").trim();
          if (val.match(/^(Dr\.|Mr\.|Ms\.|Prof\.)/i)) {
            facName = val;
          }
          if (
            val.length >= 2 &&
            val.length <= 8 &&
            !val.includes("TCS") &&
            !val.includes("PCS") &&
            !val.includes("XCS") &&
            !val.includes("LAB") &&
            !val.includes("MCS") &&
            !val.includes("DT") &&
            !val.includes("DP")
          ) {
            // Check if uppercase code
            if (val === val.toUpperCase() || val.startsWith("Dr.")) {
              facCode = val;
            }
          }
        }

        if (facName && !facName.includes("+")) {
          const cleanName = facName.replace(/\(online\)/i, "").trim();
          const emailSlug = slugify(cleanName.replace(/^(Dr\.|Mr\.|Ms\.|Prof\.)\s*/i, ""));
          const teacherId = `teacher-${emailSlug}`;
          const teacherEmail = `${emailSlug}@gehu.ac.in`;

          const facRecord = {
            id: teacherId,
            name: cleanName,
            code: facCode,
            email: teacherEmail,
          };

          allFacultyByName.set(cleanName, facRecord);
          if (facCode) {
            localCodeMap.set(facCode, facRecord);
          }
        }
      }
    }

    sheetFacultyMaps.set(sheetName, localCodeMap);
  }

  console.log(`\nExtracted ${allFacultyByName.size} unique faculty members from Even Semester timetable.`);

  // Upsert all teachers into `public.users`
  for (const fac of allFacultyByName.values()) {
    await client.query(
      `
      INSERT INTO public.users (id, email, full_name, role, provider, campus)
      VALUES ($1, $2, $3, 'teacher', 'System', 'GEHU Bhimtal')
      ON CONFLICT (id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          role = 'teacher',
          campus = 'GEHU Bhimtal';
    `,
      [fac.id, fac.email, fac.name]
    );
  }
  console.log("✓ All faculty members upserted into users table as teachers.");

  // 2. Process all 23 classes and their timetables
  let totalClassesCreated = 0;
  let totalSlotsInserted = 0;

  for (const sheetName of CLASS_SHEETS) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

    // Derive class metadata
    let course = "B.Tech CSE";
    let year = "3rd Year";
    let section = sheetName.trim();
    let displayName = sheetName.trim();

    if (sheetName.startsWith("CSE VIII")) {
      course = "B.Tech CSE";
      year = "4th Year";
      const secLetter = sheetName.replace("CSE VIII", "").trim();
      section = `VIII ${secLetter}`;
      displayName = `B.Tech CSE - 8th Sem (Sec ${secLetter})`;
    } else if (sheetName.startsWith("CSE VI")) {
      course = "B.Tech CSE";
      year = "3rd Year";
      const secLetter = sheetName.replace("CSE VI", "").trim();
      section = `VI ${secLetter}`;
      displayName = `B.Tech CSE - 6th Sem (Sec ${secLetter})`;
    } else if (sheetName.startsWith("CSE IV")) {
      course = "B.Tech CSE";
      year = "2nd Year";
      const secLetter = sheetName.replace("CSE IV", "").trim();
      section = `IV ${secLetter}`;
      displayName = `B.Tech CSE - 4th Sem (Sec ${secLetter})`;
    } else if (sheetName.includes("(CC)")) {
      course = "B.Tech CSE";
      year = "2nd Year";
      section = "IV (CC)";
      displayName = "B.Tech CSE - 4th Sem (Cloud Computing)";
    } else if (sheetName.startsWith("M.Tech")) {
      course = "M.Tech CSE";
      year = sheetName.includes("II") ? "1st Year" : "2nd Year";
      section = sheetName.trim();
      displayName = `M.Tech CSE - ${sheetName.trim()}`;
    } else if (sheetName.startsWith("Diploma")) {
      course = "Diploma CSE";
      const semRoman = sheetName.replace("Diploma", "").trim();
      year = semRoman === "II" ? "1st Year" : semRoman === "IV" ? "2nd Year" : "3rd Year";
      section = semRoman;
      displayName = `Diploma CSE - Sem ${semRoman}`;
    }

    // Extract default Room Number
    let roomNumber = "";
    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const row = rows[r] || [];
      for (const cell of row) {
        if (typeof cell === "string" && cell.toUpperCase().includes("ROOM NO")) {
          roomNumber = cell.replace(/ROOM\s*NO:?/i, "").trim();
        }
      }
    }
    if (!roomNumber) {
      roomNumber = sheetName.includes("VIII") ? "OSH" : "Campus Block D";
    }

    // Upsert class into `public.classes`
    const classRes = await client.query(
      `
      INSERT INTO public.classes (course, year, section, name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (course, year, section) DO UPDATE
      SET name = EXCLUDED.name,
          is_active = true
      RETURNING id;
    `,
      [course, year, section, displayName]
    );

    const classId = classRes.rows[0].id;
    totalClassesCreated++;

    // Clear existing timetable slots for this class before importing fresh slots
    await client.query(`DELETE FROM public.class_timetables WHERE class_id = $1`, [classId]);

    // Find time row
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

    // Find day column (usually 0, but 1 in CSE IV C)
    let dayCol = 0;
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        if (DAYS.includes(String(row[c]).trim().toUpperCase())) {
          dayCol = c;
          break;
        }
      }
    }

    // Find subHeaderRow (legend start)
    let subHeaderRow = -1;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r] || [];
      if (row.some(c => typeof c === "string" && (c.includes("Faculty Name") || c.includes("Code")))) {
        subHeaderRow = r;
        break;
      }
    }

    // Collect all day rows
    const dayRows = [];
    const limitRow = subHeaderRow > 0 ? subHeaderRow : rows.length;
    for (let r = 0; r < limitRow; r++) {
      const cellVal = String(rows[r]?.[dayCol] || "").trim().toUpperCase();
      if (DAYS.includes(cellVal)) {
        dayRows.push({
          day: cellVal.charAt(0) + cellVal.slice(1).toLowerCase(),
          row: r,
        });
      }
    }

    const localFacultyMap = sheetFacultyMaps.get(sheetName) || new Map();
    let sheetSlots = 0;

    for (let d = 0; d < dayRows.length; d++) {
      const curDay = dayRows[d];
      const nextRow =
        d + 1 < dayRows.length ? dayRows[d + 1].row : subHeaderRow > 0 ? subHeaderRow : curDay.row + 3;
      const subjectRow = rows[curDay.row] || [];

      for (const bp of BASE_PERIODS) {
        const col = bp.col + dayCol;
        const nextCol = bp.nextCol !== null ? bp.nextCol + dayCol : null;

        const rawSubj = subjectRow[col];
        if (!rawSubj || typeof rawSubj !== "string") continue;
        const subj = rawSubj.trim();
        if (!subj || ["BREAK", "LUNCH", "LIB"].includes(subj.toUpperCase())) {
          continue;
        }

        let startTime = bp.start;
        let endTime = bp.end;

        // Check if 2-period lab/lecture
        if (nextCol !== null) {
          const nextSubj = subjectRow[nextCol];
          if (!nextSubj || (typeof nextSubj === "string" && !nextSubj.trim())) {
            const nextPeriod = BASE_PERIODS.find(pt => pt.col === bp.nextCol);
            if (nextPeriod) {
              endTime = nextPeriod.end;
            }
          }
        }

        // Find teacher for this slot
        let teacherId = null;

        // Search rows between curDay.row + 1 and nextRow for faculty code
        for (let fr = curDay.row + 1; fr < nextRow; fr++) {
          const val = String(rows[fr]?.[col] || "").trim();
          if (val && val.length <= 10) {
            const firstCode = val.split("+")[0].trim();
            if (localFacultyMap.has(firstCode)) {
              teacherId = localFacultyMap.get(firstCode).id;
              break;
            }
          }
        }

        // Insert timetable slot
        await client.query(
          `
          INSERT INTO public.class_timetables (
            class_id, day_of_week, start_time, end_time, subject, teacher_id, room_number
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
          [classId, curDay.day, startTime, endTime, subj, teacherId, roomNumber]
        );

        sheetSlots++;
        totalSlotsInserted++;

        // Link teacher to class in class_teachers
        if (teacherId) {
          await client.query(
            `
            INSERT INTO public.class_teachers (class_id, teacher_id, is_primary)
            VALUES ($1, $2, true)
            ON CONFLICT (class_id, teacher_id) DO NOTHING;
          `,
            [classId, teacherId]
          );
        }
      }
    }

    console.log(`✓ [${totalClassesCreated}/${CLASS_SHEETS.length}] ${displayName} (Room: ${roomNumber}) -> ${sheetSlots} slots`);
  }

  console.log("\n===============================================================");
  console.log("  EVEN SEMESTER IMPORT COMPLETED SUCCESSFULLY!");
  console.log(`  • Academic Classes Added/Updated: ${totalClassesCreated}`);
  console.log(`  • Timetable Slots Inserted: ${totalSlotsInserted}`);
  console.log(`  • Unique Faculty Members Registered: ${allFacultyByName.size}`);
  console.log("===============================================================");

  await client.end();
}

runImport().catch(err => {
  console.error("Import failed with error:", err);
  client.end();
  process.exit(1);
});
