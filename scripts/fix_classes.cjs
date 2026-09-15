const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
let connectionString = '';
try {
  const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf8');
  const match = envContent.match(/POSTGRES_URL=["']?([^"'\n\r]+)["']?/);
  if (match) connectionString = match[1];
} catch(e) {}
if (!connectionString) connectionString = 'postgres://postgres.hwawknnnolbxjvbylqkw:BiKq4k0BxCYR9nx8@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

const romanMap = { 'VIII': 8, 'VII': 7, 'VI': 6, 'IV': 4, 'V': 5, 'III': 3, 'II': 2, 'I': 1 };

function extractRomanPrefix(section) {
  // Match Roman numerals at start: VIII, VII, VI, IV, V, III, II, I
  const match = section.match(/^(VIII|VII|VI|IV|V|III|II|I)\b\s*(.*)/i);
  if (match) {
    return { semNum: romanMap[match[1].toUpperCase()], secPart: match[2].trim() };
  }
  return null;
}

function yearToSem(year) {
  if (year === '1st Year') return 1;
  if (year === '2nd Year') return 3;
  if (year === '3rd Year') return 5;
  if (year === '4th Year') return 7;
  return 1;
}

function computeSemNum(row) {
  // Roman prefix on section like "IV A" => 4th Sem
  const roman = extractRomanPrefix(row.section);
  if (roman && roman.semNum) return roman.semNum;
  
  // M.Tech special sections
  if (row.section.match(/M\.?Tech\s+II(?!I)/i)) return 2;
  if (row.section.match(/M\.?Tech\s+III/i)) return 3;
  if (row.section.match(/M\.?Tech\s+IV/i)) return 4;
  if (row.section.match(/M\.?Tech\s+V(?!I)/i)) return 5;
  if (row.section.match(/M\.?Tech\s+I(?!I|V)/i)) return 1;
  
  // From existing semester column
  if (row.semester) {
    const m = row.semester.match(/(\d+)/);
    if (m) return parseInt(m[1]);
  }
  
  return yearToSem(row.year);
}

function cleanSection(rawSection, semNum) {
  // M.Tech sections
  if (rawSection.match(/M\.?Tech/i)) {
    const mmap = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' };
    return `Section ${mmap[semNum] || 'A'}`;
  }
  
  // Roman prefix: "IV A", "VI B(AIML)", "IV (CC)"
  const roman = extractRomanPrefix(rawSection);
  if (roman) {
    let s = roman.secPart || 'A';
    // Handle Cloud Computing special "(CC)" or "(Cloud Computing)"
    if (!s || s === '') s = 'CC';
    // Fix spacing around parens: "B(AIML)" -> "B (AIML)"
    s = s.replace(/([A-Za-z])\(([^)]*)\)?/g, (_, ch, inner) => `${ch} (${inner})`);
    // ensure closing paren
    const open = (s.match(/\(/g) || []).length;
    const close = (s.match(/\)/g) || []).length;
    if (open > close) s = s + ')';
    s = s.trim();
    if (!s) s = 'A';
    return `Section ${s}`;
  }
  
  // Pure roman alone like "II", "IV", "VI" (Diploma)
  if (romanMap[rawSection.toUpperCase()] !== undefined) {
    // Just number-based section from Diploma
    const semLabels = { 1:'A', 2:'B', 3:'C', 4:'D', 5:'E', 6:'F', 7:'G', 8:'H' };
    return `Section ${semLabels[semNum] || rawSection}`;
  }
  
  // "Section ..." already
  if (rawSection.match(/^[Ss]ection\s+/)) {
    let s = rawSection.replace(/^[Ss]ection\s+/, '').trim();
    // Fix truncated parens: "D(AIML" -> "D (AIML)"
    s = s.replace(/([A-Za-z])\(([^)]*)\)?/g, (_, ch, inner) => `${ch} (${inner})`);
    const open = (s.match(/\(/g) || []).length;
    const close = (s.match(/\)/g) || []).length;
    if (open > close) s = s + ')';
    s = s.trim();
    return `Section ${s}`;
  }
  
  return `Section ${rawSection}`;
}

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    
    // Ensure semester column exists
    await client.query('ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS semester VARCHAR(50)');
    
    const res = await client.query('SELECT id, course, year, section, name, semester FROM public.classes ORDER BY course, year, section');
    const rows = res.rows;
    
    // Build target canonical form for each row and detect duplicates
    const targetMap = new Map(); // key -> [rows] 
    const rowTargets = [];
    
    for (const row of rows) {
      const semNum = computeSemNum(row);
      const semLabel = `${ordinal(semNum)} Sem`;
      const cleanedSection = cleanSection(row.section, semNum);
      const newName = `${row.course} - ${semLabel} (${cleanedSection})`;
      const key = `${row.course}|${row.year}|${cleanedSection}`;
      
      const target = { id: row.id, course: row.course, year: row.year, semLabel, cleanedSection, newName, key, originalSection: row.section };
      rowTargets.push(target);
      
      if (!targetMap.has(key)) targetMap.set(key, []);
      targetMap.get(key).push(target);
    }
    
    // Find duplicates
    const duplicateKeys = [];
    for (const [key, list] of targetMap.entries()) {
      if (list.length > 1) {
        duplicateKeys.push({ key, list });
        console.log(`\nDUPLICATE: "${key}"`);
        list.forEach(t => console.log(`  - id=${t.id.slice(0,8)} originalSection="${t.originalSection}"`));
      }
    }
    
    if (duplicateKeys.length > 0) {
      console.log(`\nFound ${duplicateKeys.length} duplicate groups. Merging...`);
      
      for (const { key, list } of duplicateKeys) {
        // Keep first, delete rest (reassign students first)
        const [keep, ...remove] = list;
        
        for (const dup of remove) {
          // Reassign students from duplicate to kept class
          const updated = await client.query(
            'UPDATE public.students SET class_id = $1 WHERE class_id = $2',
            [keep.id, dup.id]
          );
          console.log(`  Reassigned ${updated.rowCount} students from ${dup.id.slice(0,8)} to ${keep.id.slice(0,8)}`);
          
          // Also reassign class_teachers
          await client.query(
            'UPDATE public.class_teachers SET class_id = $1 WHERE class_id = $2 AND NOT EXISTS (SELECT 1 FROM public.class_teachers WHERE class_id = $1 AND user_id = class_teachers.user_id)',
            [keep.id, dup.id]
          ).catch(() => {}); // ignore conflicts
          
          // Delete duplicate
          await client.query('DELETE FROM public.classes WHERE id = $1', [dup.id]);
          console.log(`  Deleted duplicate class ${dup.id.slice(0,8)}`);
        }
      }
    }
    
    // Now fetch remaining classes and update all
    const res2 = await client.query('SELECT id, course, year, section, name, semester FROM public.classes ORDER BY course, year, section');
    const remaining = res2.rows;
    
    console.log(`\nUpdating ${remaining.length} remaining classes...`);
    
    for (const row of remaining) {
      const semNum = computeSemNum(row);
      const semLabel = `${ordinal(semNum)} Sem`;
      const cleanedSection = cleanSection(row.section, semNum);
      const newName = `${row.course} - ${semLabel} (${cleanedSection})`;
      
      await client.query(
        'UPDATE public.classes SET semester = $1, section = $2, name = $3 WHERE id = $4',
        [semLabel, cleanedSection, newName, row.id]
      );
      console.log(`[OK] ${row.id.slice(0,8)}: "${newName}" | sem="${semLabel}" | sec="${cleanedSection}"`);
    }
    
    console.log('\n✓ All classes fixed!\n');
    console.log('=== Final State ===');
    const r3 = await client.query('SELECT course, year, semester, section, name FROM public.classes ORDER BY course, year, semester, section');
    r3.rows.forEach(r => {
      console.log(`  ${r.course} | ${r.year} | ${r.semester} | ${r.section}`);
    });
    
  } catch(e) {
    console.error('Fatal error:', e.message || e);
  } finally {
    await client.end();
  }
}

run();
