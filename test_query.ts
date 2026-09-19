import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const envMap: Record<string, string> = {};
env.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envMap[match[1]] = match[2].replace(/^"|"$/g, '');
});

const supabaseUrl = envMap['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envMap['SUPABASE_SERVICE_ROLE_KEY'];
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabaseAdmin
    .from("payment_submissions")
    .select("*")
    .limit(10);
    
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const studentIds = data.map(d => d.student_id);
  const { data: students, error: sErr } = await supabaseAdmin
    .from("students")
    .select("*")
    .in("id", studentIds);
    
  console.log("Students found:", students?.length);
}

test();
