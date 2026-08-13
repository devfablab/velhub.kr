async function run() {
    const supabase = require('@supabase/supabase-js').createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: members, error } = await supabase
      .from('rhizome_stigmas')
      .select('user_id, nickname')
      .ilike('nickname', '%아리%');
      
    console.log("Members:", members, "Error:", error);
}

run();
