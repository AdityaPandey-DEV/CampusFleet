require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('students_full').select('*').ilike('email', 'ananyapandey.orders@gmail.com');
  console.log(JSON.stringify(data, null, 2));
}
check();
