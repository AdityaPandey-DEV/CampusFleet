const { Client } = require('pg');
const client = new Client({ connectionString: process.env.POSTGRES_URL });

function parseClass(c) {
  const name = c.name || '';
  
  let department = 'Computer Science & Engineering';
  let degree_level = 'Undergraduate';
  if (c.course.includes('ECE')) {
    department = 'Electronics & Communication Engineering';
    degree_level = 'Undergraduate';
  } else if (c.course.includes('BCA')) {
    department = 'Computer Applications';
    degree_level = 'Undergraduate';
  } else if (c.course.includes('MCA')) {
    department = 'Computer Applications';
    degree_level = 'Postgraduate';
  } else if (c.course.includes('Diploma')) {
    department = 'Computer Science & Engineering';
    degree_level = 'Diploma';
  } else if (c.course.includes('M.Tech')) {
    department = 'Computer Science & Engineering';
    degree_level = 'Postgraduate';
  }

  let semester_num = 1;
  let semester = '1st Sem';
  const semMatch = name.match(/(\d+)(st|nd|rd|th)\s*Sem/i);
  if (semMatch) {
    semester_num = parseInt(semMatch[1], 10);
    semester = `${semester_num}${semMatch[2].toLowerCase()} Sem`;
  }

  const year_num = Math.ceil(semester_num / 2);
  const yearSuffix = year_num === 1 ? '1st' : year_num === 2 ? '2nd' : year_num === 3 ? '3rd' : '4th';
  const year = `${yearSuffix} Year`;

  let section = 'A';
  let specialization = 'Core';

  if (name.includes('Cloud Computing')) {
    section = 'CC';
    specialization = 'Cloud Computing';
  } else {
    const secMatch = name.match(/Section\s+([A-Z])/i);
    if (secMatch) {
      section = secMatch[1].toUpperCase();
    }
    if (name.includes('AIML')) {
      specialization = 'AIML';
    } else if (name.includes('(CS)')) {
      specialization = 'CS';
    }
  }

  return {
    id: c.id,
    department,
    degree_level,
    semester,
    semester_num,
    year,
    year_num,
    section,
    section_code: section,
    specialization,
  };
}

async function run() {
  await client.connect();
  console.log('Connected to PostgreSQL');

  // 1. Drop the legacy non-normalized constraint if exists
  await client.query(`
    ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_course_year_section_key;
  `);
  console.log('Dropped legacy unique constraint');

  // 2. Normalize every class
  const res = await client.query('SELECT * FROM classes');
  let updatedCount = 0;

  for (const row of res.rows) {
    const p = parseClass(row);
    await client.query(
      `UPDATE classes 
       SET "department" = $1, "degree_level" = $2, "semester" = $3, "semester_num" = $4,
           "year" = $5, "year_num" = $6, "section" = $7, "section_code" = $8, "specialization" = $9
       WHERE "id" = $10`,
      [p.department, p.degree_level, p.semester, p.semester_num, p.year, p.year_num, p.section, p.section_code, p.specialization, p.id]
    );
    updatedCount++;
  }

  console.log(`Updated and normalized ${updatedCount} classes in PostgreSQL!`);

  // 3. Add modern normalized unique constraint
  await client.query(`
    ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_course_sem_sec_spec_key;
    ALTER TABLE classes ADD CONSTRAINT classes_course_sem_sec_spec_key 
      UNIQUE (course, semester, section, specialization);
  `);
  console.log('Added normalized unique constraint (course, semester, section, specialization)');

  // 4. Verify
  const sample = await client.query(`
    SELECT name, course, department, degree_level, semester, year, section, specialization 
    FROM classes 
    ORDER BY course, semester_num, section, specialization 
    LIMIT 10
  `);
  console.log('Sample normalized rows:\n', JSON.stringify(sample.rows, null, 2));

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
