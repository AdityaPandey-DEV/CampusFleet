const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const envMap = {};
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envMap[match[1]] = match[2].replace(/^"|"$/g, '');
});

// Remove ?sslmode=require so pg doesn't override our ssl object
let connString = envMap['POSTGRES_URL_NON_POOLING'];
if (connString.includes('?')) {
  connString = connString.split('?')[0];
}

const client = new Client({
  connectionString: connString,
  ssl: {
    rejectUnauthorized: false,
  }
});

async function run() {
  await client.connect();
  try {
    console.log("Deleting orphaned payment submissions...");
    const delRes = await client.query(`
      DELETE FROM payment_submissions
      WHERE student_id NOT IN (SELECT id FROM students);
    `);
    console.log(`Deleted ${delRes.rowCount} orphaned rows.`);

    console.log("Adding foreign key constraint...");
    await client.query(`
      ALTER TABLE payment_submissions
      ADD CONSTRAINT fk_payment_submissions_student
      FOREIGN KEY (student_id)
      REFERENCES students(id)
      ON DELETE CASCADE;
    `);
    console.log("Successfully added foreign key constraint!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
