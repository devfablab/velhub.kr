async function run() {
    const supabase = require('@supabase/supabase-js').createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: board, error } = await supabase
      .from('boards')
      .select('id, board_key, board_label, site_id, is_subscription')
      .eq('board_key', 'camp-events')
      .maybeSingle();
      
    console.log("Board:", board, "Error:", error);
}

run();
