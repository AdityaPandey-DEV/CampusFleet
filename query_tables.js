const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envs = fs.readFileSync('.env.local', 'utf8').split('\n');
const url = envs.find(e => e.startsWith('NEXT_PUBLIC_SUPABASE_URL='))?.split('=')[1];
const key = envs.find(e => e.startsWith('SUPABASE_SERVICE_ROLE_KEY='))?.split('=')[1];

if(url && key) {
  const supabase = createClient(url, key);
  supabase.from('live_bus_locations').select('*').limit(1).then(console.log).catch(console.error);
}
