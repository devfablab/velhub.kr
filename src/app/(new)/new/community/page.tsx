import { Metadata } from 'next';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { originTitle, Seo } from '@/lib/seo';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import Opt from './opt';
import styles from '@/app/new.module.sass';

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

function isAtLeast14(birthDate: string | null | undefined) {
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

  return age >= 14;
}

export default async function Page() {
  const currentStigma = await getCurrentStigma();
  const supabaseAdmin = getSupabaseAdmin();
  let hasIdentity = false;
  let isUnder14 = false;

  if (currentStigma) {
    const identityResult = await supabaseAdmin
      .from('chorogons')
      .select('name, birth_date, birth_date_dummy, gender, identity_verified_at')
      .eq('user_id', currentStigma.stigmaId)
      .maybeSingle();
    const identity = identityResult.data;

    hasIdentity = Boolean(
      !identityResult.error &&
        identity?.identity_verified_at &&
        identity.name &&
        (identity.birth_date || identity.birth_date_dummy) &&
        identity.gender,
    );

    if (hasIdentity) {
      isUnder14 = !isAtLeast14(getChorogonBirthDate(identity));
    }
  }

  let canCreateSite = true;
  let blockMessage = '';

  if (currentStigma) {
    const hasUnlimitedSites = await hasMembershipFeature(currentStigma.stigmaId, 'owner_unlimited_sites');
    if (!hasUnlimitedSites) {
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

          {(!hasIdentity && !isUnder14) || isUnder14 ? (
            <div className="paper">
              {!hasIdentity && !isUnder14 ? (
                <>
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>본인인증 하시면 커뮤니티를 개설하실 수 있습니다.</span>
                  </p>
                  <IdentityVerificationButton />
                </>
              ) : null}
              {isUnder14 ? (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>커뮤니티는 데브허브 정책상 만 14세 이상부터 만들 수 있어요. 😭</span>
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

          {hasIdentity && !isUnder14 && canCreateSite ? <Opt /> : null}
        </div>
      </div>
    </main>
  );
}
