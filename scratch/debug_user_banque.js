async function run() {
    const supabase = require('@supabase/supabase-js').createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: chorogon, error: cError } = await supabase
      .from('chorogons')
      .select('id')
      .eq('user_id', 'f67c0f28-0590-44bf-800f-8f95b9f114b2')
      .maybeSingle();
      
    if (chorogon) {
      const { data: banque, error: bError } = await supabase
        .from('chorogons_banque')
        .select('*')
        .eq('chorogon_id', chorogon.id)
        .maybeSingle();
      console.log("Banque:", banque, "Error:", bError);
    } else {
      console.log("Chorogon:", chorogon, "Error:", cError);
    }
}

run();
