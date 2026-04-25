import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type VerifySessionCase = 'admin' | 'guest-public' | 'guest-site' | 'member' | 'staff';

type VerifySessionParams = {
  siteId: string | null | undefined;
};

type VerifySessionResult = {
  case: VerifySessionCase;
  authUserId: string | null;
  stigmaId: string | null;
  rhizomeStigmaId: string | null;
};

export default async function verifySession({ siteId }: VerifySessionParams): Promise<VerifySessionResult> {
  const normalizedSiteId = normalizeText(siteId);
  const sessionClaims = await getSessionClaims();
  const authUserId = sessionClaims?.userId ?? null;

  if (!authUserId) {
    return {
      case: 'guest-public',
      authUserId: null,
      stigmaId: null,
      rhizomeStigmaId: null,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, role').eq('user_id', authUserId).maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      case: 'guest-public',
      authUserId,
      stigmaId: null,
      rhizomeStigmaId: null,
    };
  }

  const stigmaId = stigmaResult.data.id as string;
  const stigmaRole = normalizeText(stigmaResult.data.role);

  if (stigmaRole === 'admin') {
    return {
      case: 'admin',
      authUserId,
      stigmaId,
      rhizomeStigmaId: null,
    };
  }

  if (!normalizedSiteId) {
    return {
      case: 'guest-site',
      authUserId,
      stigmaId,
      rhizomeStigmaId: null,
    };
  }

  const rhizomeStigmaResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role, is_approval')
    .eq('site_id', normalizedSiteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (rhizomeStigmaResult.error || !rhizomeStigmaResult.data) {
    return {
      case: 'guest-site',
      authUserId,
      stigmaId,
      rhizomeStigmaId: null,
    };
  }

  const rhizomeStigmaId = rhizomeStigmaResult.data.id as string;
  const rhizomeRole = normalizeText(rhizomeStigmaResult.data.role);
  const isApproval = rhizomeStigmaResult.data.is_approval === true;

  if (rhizomeRole === 'owner' || rhizomeRole === 'manager') {
    return {
      case: 'staff',
      authUserId,
      stigmaId,
      rhizomeStigmaId,
    };
  }

  if (isApproval) {
    return {
      case: 'member',
      authUserId,
      stigmaId,
      rhizomeStigmaId,
    };
  }

  return {
    case: 'guest-site',
    authUserId,
    stigmaId,
    rhizomeStigmaId,
  };
}
