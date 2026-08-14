import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import { originTitle, Seo } from '@/lib/seo';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMembershipFeature } from '@/lib/memberships/features';
import Anchor from '@/components/Anchor';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import Opt from './opt';
import styles from '@/app/new.module.sass';

type Identity = {
  name: string;
  birth_date: string;
  gender: string;
  identity_verified_at: string;
};

type IdentityStatusResponse = {
  exists: boolean;
  identity: Identity | null;
};

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `커뮤니티 개설 - ${originTitle}`,
    pageTitle: `커뮤니티 개설`,
    pageDescription: `커뮤니티를 개설할 수 있어요`,
    pageImg: `https://velhub.xyz/og-community.webp?ts=${timestamp}`,
    pagePath: '/new/community',
  });
}

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function isAdult(birthDate: string | null | undefined) {
  const digits = onlyDigits(birthDate);

  if (digits.length !== 8) {
    return false;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 19;
}

async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = headersList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return null;
  }

  return `${protocol}://${host}`;
}

async function getIdentityStatus(baseUrl: string, cookieHeader: string) {
  const response = await fetch(`${baseUrl}/api/identity/portone/status`, {
    method: 'GET',
    headers: {
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json().catch(() => null)) as IdentityStatusResponse | null;
}

export default async function Page() {
  const cookieStore = await cookies();
  const baseUrl = await getBaseUrl();
  const cookieHeader = cookieStore.toString();

  let hasIdentity = false;
  let isMinor = false;

  if (baseUrl) {
    const identityStatus = await getIdentityStatus(baseUrl, cookieHeader);
    const identity = identityStatus?.exists ? identityStatus.identity : null;

    hasIdentity = Boolean(identity);

    if (identity) {
      isMinor = !isAdult(identity.birth_date);
    }
  }

  let canCreateSite = true;
  let blockMessage = '';

  const currentStigma = await getCurrentStigma();
  if (currentStigma) {
    const hasUnlimitedSites = await hasMembershipFeature(currentStigma.stigmaId, 'owner_unlimited_sites');
    if (!hasUnlimitedSites) {
      const supabaseAdmin = getSupabaseAdmin();
      const siteCountResult = await supabaseAdmin
        .from('rhizomes')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', currentStigma.stigmaId)
        .eq('site_type', 'community');

      if ((siteCountResult.count ?? 0) >= 1) {
        canCreateSite = false;
        blockMessage = '기본 오너 멤버십에서는 커뮤니티를 1개만 개설할 수 있습니다.';
      }
    }
  }

  return (
    <main className={styles['new-generation']}>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <h1>커뮤니티 개설</h1>

          {(!hasIdentity && !isMinor) || isMinor ? (
            <div className="paper">
              {!hasIdentity && !isMinor ? (
                <>
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>본인인증 하시면 커뮤니티를 개설하실 수 있습니다.</span>
                  </p>
                  <IdentityVerificationButton />
                </>
              ) : null}
              {isMinor ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>만 19세 미만은 본 사이트에서 수익창출을 하실 수 없습니다.</span>
                </p>
              ) : null}
            </div>
          ) : !canCreateSite ? (
            <div className="paper page-error">
              <NearbyErrorRoundedIcon />
              <p className="alert error">
                <span>{blockMessage}</span>
              </p>
              <Anchor href={`/memberships/creator`} className="button medium submit">
                멤버십 가입하기
              </Anchor>
            </div>
          ) : null}

          {(hasIdentity || isMinor) && canCreateSite ? <Opt /> : null}
        </div>
      </div>
    </main>
  );
}
