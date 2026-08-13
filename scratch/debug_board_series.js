async function run() {
    const supabase = require('@supabase/supabase-js').createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: series, error } = await supabase
      .from('board_series')
      .select('id, is_subscription')
      .limit(1);
      
    console.log("Series:", series, "Error:", error);
}

run();
