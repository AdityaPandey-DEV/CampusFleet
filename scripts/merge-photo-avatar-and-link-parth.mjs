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
const envProd = parseEnv(path.resolve(__dirname, "../.env.production"));

const databases = [
  {
    name: "New Database (.env.local)",
    connectionString: envLocal.POSTGRES_PRISMA_URL || envLocal.POSTGRES_URL,
    host: envLocal.POSTGRES_HOST,
  },
  {
    name: "Old Database (.env.production)",
    connectionString: envProd.POSTGRES_URL_NON_POOLING || envProd.POSTGRES_PRISMA_URL || envProd.POSTGRES_URL,
    host: envProd.POSTGRES_HOST,
  },
];

const syncSql = `
BEGIN;

-- Drop stale trigger that referenced dropped students.photo_url
DROP TRIGGER IF EXISTS trg_users_sync_student_photo ON public.users CASCADE;
DROP FUNCTION IF EXISTS public.trg_fn_users_sync_student_photo() CASCADE;

-- 1. Unify and merge photo_url and avatar_url in users table (photo_url as single source of truth)
UPDATE public.users
SET photo_url = COALESCE(photo_url, avatar_url)
WHERE photo_url IS NULL AND avatar_url IS NOT NULL;

UPDATE public.users
SET avatar_url = photo_url
WHERE avatar_url IS NULL AND photo_url IS NOT NULL;

-- 2. Propagate Parth Dalakoti's uploaded photo to all his accounts
UPDATE public.users
SET 
  photo_url = 'https://hycfzwsdzghug7tt.public.blob.vercel-storage.com/receipts/038996c8/1792338858323-1000185575.jpeg',
  avatar_url = 'https://hycfzwsdzghug7tt.public.blob.vercel-storage.com/receipts/038996c8/1792338858323-1000185575.jpeg'
WHERE (email ILIKE '%parth%dalakoti%' OR email = 'robosoccer482@gmail.com' OR email = 'vinoddalakoti72@gmail.com' OR full_name ILIKE '%parth%dalakoti%')
  AND (photo_url IS NULL OR photo_url = '');

-- 3. Link unlinked Parth Dalakoti student records to their user accounts
-- Link stud-usr_1789105251441 to user usr_1789105251441
UPDATE public.students
SET user_id = 'usr_1789105251441'
WHERE id = 'stud-usr_1789105251441' AND user_id IS NULL;

-- Link a4417824-8d70-4c0e-9d49-033ac07182ea to user d4d4879c-e49a-42ac-a914-000fd831307e
UPDATE public.students
SET user_id = 'd4d4879c-e49a-42ac-a914-000fd831307e'
WHERE id = 'a4417824-8d70-4c0e-9d49-033ac07182ea' AND user_id IS NULL;

-- Link d5faa14a-c4f6-47f0-8bbc-25ce9c615369 to user 038996c8-d231-414d-b393-cf21ce5f436a
UPDATE public.students
SET user_id = '038996c8-d231-414d-b393-cf21ce5f436a'
WHERE id = 'd5faa14a-c4f6-47f0-8bbc-25ce9c615369' AND user_id IS NULL;

-- Also link Hem Pandey student to his user
UPDATE public.students
SET user_id = 'a1fb181e-702b-4405-8390-2a5bb5696887'
WHERE id = '1b442163-ac89-43ac-9ff1-f6e4d32ac762' AND user_id IS NULL;

-- 4. Create trigger to automatically keep photo_url and avatar_url in sync on users table
CREATE OR REPLACE FUNCTION public.fn_sync_user_photo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.photo_url IS NOT NULL AND NEW.photo_url <> '' THEN
        NEW.avatar_url := NEW.photo_url;
    ELSIF NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> '' THEN
        NEW.photo_url := NEW.avatar_url;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_photo ON public.users;
CREATE TRIGGER trg_sync_user_photo
BEFORE INSERT OR UPDATE OF photo_url, avatar_url ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_user_photo();

COMMIT;
`;

async function main() {
  for (const db of databases) {
    if (!db.connectionString) continue;
    console.log(`\n======================================================`);
    console.log(`🚀 Executing photo/avatar merge on: ${db.name}`);
    console.log(`======================================================`);
    const client = new Client({ connectionString: db.connectionString });
    try {
      await client.connect();
      await client.query(syncSql);
      console.log(`✅ Successfully merged photo/avatar and linked students on ${db.name}!`);
    } catch (err) {
      console.error(`❌ Error on ${db.name}:`, err.message);
    } finally {
      await client.end();
    }
  }
}

main();
