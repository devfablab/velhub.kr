async function run() {
    const supabase = require('@supabase/supabase-js').createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: banque, error } = await supabase
      .from('chorogons_banque')
      .select('*')
      .limit(5);
      
    console.log("Banque:", banque, "Error:", error);
}

run();
