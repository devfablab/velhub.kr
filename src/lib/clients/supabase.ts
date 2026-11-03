import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseBrowserClient: SupabaseClient | null = null;
let supabaseAdminClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다.');
  }

  return supabaseUrl;
}

function getSupabaseBrowserKey() {
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabasePublishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
  }

  return supabasePublishableKey;
}

function getSupabaseServiceRoleKey() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  }

  return supabaseServiceRoleKey;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }

  const createdSupabaseBrowserClient = createBrowserClient(getSupabaseUrl(), getSupabaseBrowserKey());

  supabaseBrowserClient = createdSupabaseBrowserClient;

  return createdSupabaseBrowserClient;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const createdSupabaseAdminClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  supabaseAdminClient = createdSupabaseAdminClient;

  return createdSupabaseAdminClient;
}
