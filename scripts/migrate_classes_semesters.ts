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

function parseClass(c: any): { course: string; semester: string; section: string; name: string } {
  const course = (c.course || 'B.Tech CSE').trim();
  const rawName = (c.name || '').trim();
  let semester = '1st Sem';
  let section = 'Section A';

  // 1. Semester extraction
  const semMatch = rawName.match(/(\d+)(?:st|nd|rd|th)\s*Sem/i);
  if (semMatch) {
    const num = parseInt(semMatch[1]);
    const suf = num % 10 === 1 && num !== 11 ? 'st' : num % 10 === 2 && num !== 12 ? 'nd' : num % 10 === 3 && num !== 13 ? 'rd' : 'th';
    semester = `${num}${suf} Sem`;
  } else if (rawName.match(/Sem\s*([IVXLCDM]+)/i)) {
    const roman = rawName.match(/Sem\s*([IVXLCDM]+)/i)![1].toUpperCase();
    const map: Record<string, string> = { I: '1st Sem', II: '2nd Sem', III: '3rd Sem', IV: '4th Sem', V: '5th Sem', VI: '6th Sem', VII: '7th Sem', VIII: '8th Sem' };
    semester = map[roman] || `${roman} Sem`;
  } else if (rawName.includes('M.Tech I') && !rawName.includes('III') && !rawName.includes('IV') && !rawName.includes('V') && !rawName.includes('II')) {
    semester = '1st Sem';
  } else if (rawName.includes('M.Tech II')) {
    semester = '2nd Sem';
  } else if (rawName.includes('M.Tech III')) {
    semester = '3rd Sem';
  } else if (rawName.includes('M.Tech IV')) {
    semester = '4th Sem';
  } else if (rawName.includes('M.Tech V')) {
    semester = '5th Sem';
  } else if (rawName.includes('Diploma CSE - III')) {
    semester = '3rd Sem';
  } else if (rawName.includes('Diploma CSE - V')) {
    semester = '5th Sem';
  } else if (c.year === '1st Year') {
    semester = '1st Sem';
  } else if (c.year === '2nd Year') {
    semester = '3rd Sem';
  } else if (c.year === '3rd Year') {
    semester = '5th Sem';
  } else if (c.year === '4th Year') {
    semester = '7th Sem';
  }

  // 2. Section extraction
  if (rawName.includes('Cloud Computing')) {
    section = 'Cloud Computing (CC)';
  } else {
    const secInParen = rawName.match(/\(Sec\s*([^)]+)\)/i);
    if (secInParen) {
      let raw = secInParen[1].trim();
      raw = raw.replace(/^(?:VIII|VII|VI|IV|V|III|II|I)\s*/i, '').trim();
      section = raw.startsWith('Section') ? raw : `Section ${raw}`;
    } else if (c.section) {
      let raw = c.section.trim();
      raw = raw.replace(/^(?:VIII|VII|VI|IV|V|III|II|I)\s*/i, '').trim();
      section = raw.startsWith('Section') ? raw : `Section ${raw || 'A'}`;
    }
  }

  // Clean Section label: standardize e.g. "Section D(AIML)" to "Section D (AIML)"
  section = section.replace(/([A-Z])\((AIML|CS)\)/i, '$1 ($2)');

  // Standardized clean name
  const name = `${course} - ${semester} (${section})`;

  return { course, semester, section, name };
}

async function run() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✓ Connected');

    // 1. Add semester column if not exists
    await client.query(`
      ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS semester VARCHAR(50);
    `);
    console.log('✓ Added semester column to public.classes table');

    // 2. Fetch all classes
    const res = await client.query(`SELECT id, course, year, section, name FROM public.classes`);
    const classes = res.rows;
    console.log(`Found ${classes.length} classes to standardize`);

    for (const c of classes) {
      const { course, semester, section, name } = parseClass(c);
      await client.query(
        `UPDATE public.classes SET course = $1, semester = $2, section = $3, name = $4 WHERE id = $5`,
        [course, semester, section, name, c.id]
      );
      console.log(`[OK] ${c.id.slice(0, 8)}: "${name}" | course: "${course}" | sem: "${semester}" | sec: "${section}"`);
    }

    console.log('✓ All classes successfully updated in PostgreSQL database!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

run();
