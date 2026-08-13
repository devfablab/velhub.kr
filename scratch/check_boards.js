const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: site } = await supabase.from('rhizomes').select('id, site_key').eq('site_key', 'stay-camp').single();
  if (!site) {
    console.log('Site not found');
    return;
  }
  const { data: boards } = await supabase.from('boards').select('id, board_key, board_label').eq('site_id', site.id);
  console.log(boards);
}

run();
