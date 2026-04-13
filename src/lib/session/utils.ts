import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

export type SessionRouteResult =
  | {
      ok: true;
      allow: boolean;
      redirectTo: string | null;
      siteId?: string;
      stigmaId?: string;
      role?: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type SitePathKind =
  | 'outside'
  | 'home'
  | 'board'
  | 'content'
  | 'board_new'
  | 'content_edit'
  | 'join'
  | 'forbidden'
  | 'other';

export function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function getSitePathKind(pathname: string, siteName: string): SitePathKind {
  const normalizedPathname = normalizeText(pathname);
  const normalizedSiteName = normalizeText(siteName);
  const segments = normalizedPathname.split('/').filter(Boolean);

  if (!normalizedSiteName || segments[0] !== normalizedSiteName) {
    return 'outside';
  }

  if (segments.length === 1) {
    return 'home';
  }

  if (segments.length === 2) {
    if (segments[1] === 'join') {
      return 'join';
    }

    if (segments[1] === 'forbidden') {
      return 'forbidden';
    }

    return 'board';
  }

  if (segments.length === 3) {
    if (segments[2] === 'new') {
      return 'board_new';
    }

    return 'content';
  }

  if (segments.length === 4 && segments[3] === 'edit') {
    return 'content_edit';
  }

  return 'other';
}

export async function getCurrentStigma() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, role')
    .eq('user_id', sessionClaims.userId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return null;
  }

  return {
    userId: sessionClaims.userId,
    stigmaId: stigmaResult.data.id as string,
    role: stigmaResult.data.role as string | null,
  };
}

export async function getSiteByName(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, is_shutdown, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return null;
  }

  return {
    id: rhizomeResult.data.id as string,
    isShutdown: Boolean(rhizomeResult.data.is_shutdown),
    siteType: rhizomeResult.data.site_type as string,
  };
}

export async function getRhizomeStigma(siteId: string, stigmaId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeStigmaResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role, is_approval, is_block')
    .eq('site_id', siteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (rhizomeStigmaResult.error || !rhizomeStigmaResult.data) {
    return null;
  }

  return {
    id: rhizomeStigmaResult.data.id as string,
    role: rhizomeStigmaResult.data.role as string,
    isApproval: Boolean(rhizomeStigmaResult.data.is_approval),
    isBlock: Boolean(rhizomeStigmaResult.data.is_block),
  };
}
