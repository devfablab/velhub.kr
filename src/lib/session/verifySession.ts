import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '../utils';

type VerifySessionStatus = 'SUCCESS' | 'FAIL';
type VerifySessionCase = 'admin' | 'guest-public' | 'guest-site' | 'member' | 'staff';

type VerifySessionParams = {
  siteId: string | null | undefined;
};

type VerifySessionResult = {
  status: VerifySessionStatus;
  case: VerifySessionCase;
  authUserId: string | null;
  particleId: string | null;
  stigmaId: string | null;
  rhizomeStigmaId: string | null;
};

export default async function verifySession({ siteId }: VerifySessionParams): Promise<VerifySessionResult> {
  const normalizedSiteId = normalizeText(siteId);
  const sessionClaims = await getSessionClaims();
  const authUserId = sessionClaims?.userId ?? null;

  if (!authUserId) {
    return {
      status: 'FAIL',
      case: 'guest-public',
      authUserId: null,
      particleId: null,
      stigmaId: null,
      rhizomeStigmaId: null,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const particleResult = await supabaseAdmin.from('particles').select('id').eq('id', authUserId).maybeSingle();

  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, role').eq('user_id', authUserId).maybeSingle();

  const particleId = particleResult.error || !particleResult.data ? null : (particleResult.data.id as string);

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      status: 'FAIL',
      case: 'guest-public',
      authUserId,
      particleId,
      stigmaId: null,
      rhizomeStigmaId: null,
    };
  }

  const stigmaId = stigmaResult.data.id as string;
  const stigmaRole = stigmaResult.data.role as string | null;

  if (stigmaRole === 'admin') {
    return {
      status: 'SUCCESS',
      case: 'admin',
      authUserId,
      particleId,
      stigmaId,
      rhizomeStigmaId: null,
    };
  }

  if (!normalizedSiteId) {
    return {
      status: 'FAIL',
      case: 'guest-site',
      authUserId,
      particleId,
      stigmaId,
      rhizomeStigmaId: null,
    };
  }

  const rhizomeStigmaResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role')
    .eq('site_id', normalizedSiteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (rhizomeStigmaResult.error || !rhizomeStigmaResult.data) {
    return {
      status: 'FAIL',
      case: 'guest-site',
      authUserId,
      particleId,
      stigmaId,
      rhizomeStigmaId: null,
    };
  }

  const rhizomeStigmaId = rhizomeStigmaResult.data.id as string;
  const rhizomeRole = rhizomeStigmaResult.data.role as string | null;

  if (rhizomeRole === 'owner' || rhizomeRole === 'manager') {
    return {
      status: 'SUCCESS',
      case: 'staff',
      authUserId,
      particleId,
      stigmaId,
      rhizomeStigmaId,
    };
  }

  if (rhizomeRole === 'member') {
    return {
      status: 'SUCCESS',
      case: 'member',
      authUserId,
      particleId,
      stigmaId,
      rhizomeStigmaId,
    };
  }

  return {
    status: 'FAIL',
    case: 'guest-site',
    authUserId,
    particleId,
    stigmaId,
    rhizomeStigmaId,
  };
}
