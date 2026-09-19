import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const envMap: Record<string, string> = {};
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envMap[match[1]] = match[2].replace(/^"|"$/g, '');
});

const supabaseAdmin = createClient(envMap['NEXT_PUBLIC_SUPABASE_URL'], envMap['SUPABASE_SERVICE_ROLE_KEY']);

async function test() {
  const { data: subs, error } = await supabaseAdmin
    .from("payment_submissions")
    .select("*, student:students(*)")
    .order("created_at", { ascending: false });
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Total submissions:", subs.length);
    if (subs.length > 0) {
      console.log("Latest submission student_id:", subs[0].student_id);
    }
  }
}
test();
