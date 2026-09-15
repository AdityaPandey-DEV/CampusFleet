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

(async () => {
  await client.connect();
  const r = await client.query('SELECT id, course, year, section, name, semester FROM public.classes ORDER BY course, year, section');
  console.log('Total classes:', r.rows.length);
  r.rows.forEach(row => {
    console.log(`[${row.id.slice(0,8)}] course="${row.course}" year="${row.year}" section="${row.section}" semester="${row.semester}" name="${row.name}"`);
  });
  await client.end();
})().catch(e => { console.error(e); process.exit(1); });
