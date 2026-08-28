'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import FacebookIcon from '@mui/icons-material/Facebook';
import GitHubIcon from '@mui/icons-material/GitHub';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PinterestIcon from '@mui/icons-material/Pinterest';
import XIcon from '@mui/icons-material/X';
import YouTubeIcon from '@mui/icons-material/YouTube';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import * as PortOne from '@portone/browser-sdk/v2';
import { normalizeText } from '@/lib/utils';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import DonationButton from '@/components/service/common/DonationButton';
import PaymentEmailDialog from '@/components/service/common/PaymentEmailDialog';
import PaymentTerms from '@/components/service/common/PaymentTerms';
import IdentityVerificationButton from '../common/IdentityVerificationButton';
import styles from '@/app/aside.module.sass';

type SiteInfo = {
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
};

type SiteProfileResponse = {
  siteInfo?: SiteInfo;
  profilePictureUrl?: string;
  profileLogoUrl?: string;
  blogType?: string | null;
  error?: string;
};

type ServiceValue = 'Facebook' | 'GitHub' | 'Instagram' | 'LinkedIn' | 'Pinterest' | 'X' | 'YouTube';

type SocialLink = {
  id: string;
  service: ServiceValue;
  account: string;
};

type SocialLinksResponse = {
  links?: SocialLink[];
};

const SOCIAL_LINK_OPTIONS: {
  value: ServiceValue;
  label: string;
  prefix: string;
  Icon: typeof FacebookIcon;
}[] = [
  { value: 'Facebook', label: '페이스북', prefix: 'https://facebook.com/', Icon: FacebookIcon },
  { value: 'GitHub', label: '깃헙', prefix: 'https://github.com/', Icon: GitHubIcon },
  { value: 'Instagram', label: '인스타그램', prefix: 'https://instagram.com/', Icon: InstagramIcon },
  { value: 'LinkedIn', label: '링크드인', prefix: 'https://linkedin.com/in/', Icon: LinkedInIcon },
  { value: 'Pinterest', label: '핀터레스트', prefix: 'https://pinterest.com/', Icon: PinterestIcon },
  { value: 'X', label: '엑스(트위터)', prefix: 'https://x.com/', Icon: XIcon },
  { value: 'YouTube', label: '유튜브', prefix: 'https://youtube.com/@', Icon: YouTubeIcon },
];

type BlogSubscriptionStatus = 'none' | 'active' | 'scheduled_cancel' | 'canceled' | 'expired' | 'past_due';

type BlogSubscriptionStatusResponse = {
  isEnabled?: boolean;
  price?: number | null;
  subscriptionStatus?: BlogSubscriptionStatus;
  paymentEmail?: string | null;
  error?: string;
};

type DonationStatusResponse = {
  isEnabled?: boolean;
  error?: string;
};

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BlogSubscriptionStartResponse = {
  mode?: 'billing_auth' | 'direct_billing';
  storeId?: string;
  channelKey?: string;
  customerKey?: string;
  customerName?: string;
  orderNo?: string;
  orderName?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
  subscriptionId?: string;
  paymentId?: string;
  paymentEmailRequired?: boolean;
  error?: string;
};

type BlogSubscriptionActionResponse = {
  ok?: boolean;
  mode?: string;
  error?: string;
};

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

function isUnder14(birthDate: string | null | undefined) {
  if (!birthDate) return false;
  const digits = onlyDigits(birthDate);
  if (digits.length !== 8) return false;

  const year = parseInt(digits.substring(0, 4), 10);
  const month = parseInt(digits.substring(4, 6), 10);
  const day = parseInt(digits.substring(6, 8), 10);

  const today = new Date();
  const birth = new Date(year, month - 1, day);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age < 14;
}

function formatBlogSubscriptionPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function getBlogSubscriptionButtonLabel(status: BlogSubscriptionStatus) {
  if (status === 'active' || status === 'past_due') {
    return '블로그 구독 취소';
  }

  if (status === 'scheduled_cancel') {
    return '블로그 구독 유지하기';
  }

  if (status === 'canceled' || status === 'expired') {
    return '블로그 재구독하기';
  }

  return '블로그 구독';
}

export default function SiteProfile() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [blogType, setBlogType] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profileLogoUrl, setProfileLogoUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDonationProcessing, setIsDonationProcessing] = useState(false);
  const [isBlogSubscriptionEnabled, setIsBlogSubscriptionEnabled] = useState(false);
  const [blogSubscriptionPrice, setBlogSubscriptionPrice] = useState<number | null>(null);
  const [blogSubscriptionStatus, setBlogSubscriptionStatus] = useState<BlogSubscriptionStatus>('none');
  const [isBlogSubscriptionDialogOpen, setIsBlogSubscriptionDialogOpen] = useState(false);
  const [isBlogSubscriptionCancelDialogOpen, setIsBlogSubscriptionCancelDialogOpen] = useState(false);
  const [blogSubscriptionErrorMessage, setBlogSubscriptionErrorMessage] = useState('');
  const [isBlogSubscriptionProcessing, setIsBlogSubscriptionProcessing] = useState(false);
  const [isDonationEnabled, setIsDonationEnabled] = useState(false);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [isUnder14Age, setIsUnder14Age] = useState(false);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [isPaymentEmailDialogOpen, setIsPaymentEmailDialogOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  useEffect(() => {
    async function loadIdentity() {
      const identityResponse = await fetch('/api/identity/portone/status', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const identityData = identityResponse.ok
        ? ((await identityResponse.json().catch(() => null)) as IdentityStatusResponse | null)
        : null;

      const identity = identityData?.exists ? identityData.identity : null;

      setHasIdentity(Boolean(identity));
      setIsMinor(identity ? !isAdult(identity.birth_date) : false);
      setIsUnder14Age(identity ? isUnder14(identity.birth_date) : false);
      setIsLoading(false);
    }

    void loadIdentity();
  }, [siteName]);

  useEffect(() => {
    async function loadBlogSubscriptionStatus() {
      const response = await fetch(`/api/payments/portone/subscriptions/status?targetType=site&siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as BlogSubscriptionStatusResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 구독 상태를 확인하지 못했습니다.');
      }

      setIsBlogSubscriptionEnabled(Boolean(result.isEnabled));
      setBlogSubscriptionPrice(result.price ?? null);
      setBlogSubscriptionStatus(result.subscriptionStatus ?? 'none');
      setPaymentEmail(normalizeText(result.paymentEmail));
    }

    async function loadDonationStatus() {
      const response = await fetch(`/api/payments/portone/donation/status?siteName=${siteName}&targetType=site`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as DonationStatusResponse;

      if (!response.ok) {
        setIsDonationEnabled(false);
        return;
      }

      setIsDonationEnabled(Boolean(result.isEnabled));
    }

    async function loadSocialLinks() {
      try {
        const response = await fetch(`/api/manage/design/blog/links?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          setSocialLinks([]);
          return;
        }

        const result = (await response.json()) as SocialLinksResponse;
        setSocialLinks(Array.isArray(result.links) ? result.links : []);
      } catch {
        setSocialLinks([]);
      }
    }

    async function loadSiteProfile() {
      try {
        setErrorMessage('');
        setBlogSubscriptionErrorMessage('');

        const response = await fetch(`/api/info/general/site/${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SiteProfileResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '사이트 정보를 불러오지 못했습니다.');
        }

        if (!result.siteInfo) {
          throw new Error('사이트 정보를 불러오지 못했습니다.');
        }

        setSiteInfo(result.siteInfo);
        setBlogType(result.blogType ?? null);
        setProfilePictureUrl(normalizeText(result.profilePictureUrl));
        setProfileLogoUrl(normalizeText(result.profileLogoUrl));

        await Promise.all([loadBlogSubscriptionStatus(), loadDonationStatus(), loadSocialLinks()]);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '사이트 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('사이트 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadSiteProfile();
  }, [siteName]);

  function handleOpenIdentityDialog() {
    setIsIdentityDialogOpen(true);
  }

  function handleCloseIdentityDialog() {
    setIsIdentityDialogOpen(false);
  }

  function handleIdentityVerified() {
    handleCloseIdentityDialog();
    window.requestAnimationFrame(() => window.location.reload());
  }

  function handleOpenBlogSubscriptionDialog() {
    setBlogSubscriptionErrorMessage('');
    setIsBlogSubscriptionDialogOpen(true);
  }

  function handleCloseBlogSubscriptionDialog() {
    if (isBlogSubscriptionProcessing) {
      return;
    }

    setIsBlogSubscriptionDialogOpen(false);
  }

  function handleOpenBlogSubscriptionCancelDialog() {
    setBlogSubscriptionErrorMessage('');
    setIsBlogSubscriptionCancelDialogOpen(true);
  }

  function handleCloseBlogSubscriptionCancelDialog() {
    if (isBlogSubscriptionProcessing) {
      return;
    }

    setIsBlogSubscriptionCancelDialogOpen(false);
  }

  async function handleJoinBlogSubscription() {
    try {
      setBlogSubscriptionErrorMessage('');
      setIsBlogSubscriptionProcessing(true);

      const response = await fetch('/api/payments/portone/subscriptions/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          targetType: 'site',
          successUrl: `/${siteName}/subscription/success`,
          failUrl: `/${siteName}/subscription/fail`,
        }),
      });

      const result = (await response.json()) as BlogSubscriptionStartResponse;

      if (result.paymentEmailRequired) {
        setIsBlogSubscriptionDialogOpen(false);
        setIsPaymentEmailDialogOpen(true);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 구독 가입을 시작하지 못했습니다.');
      }

      if (result.mode === 'direct_billing') {
        setBlogSubscriptionStatus('active');
        setIsBlogSubscriptionDialogOpen(false);
        setIsBlogSubscriptionProcessing(false);
        return;
      }

      if (
        !result.storeId ||
        !result.channelKey ||
        !result.customerKey ||
        !result.customerName ||
        !result.orderNo ||
        !result.orderName ||
        !result.successUrl
      ) {
        throw new Error('블로그 구독 결제 정보가 올바르지 않습니다.');
      }

      const billingKeyResponse = (await PortOne.requestIssueBillingKey({
        storeId: result.storeId,
        channelKey: result.channelKey,
        billingKeyMethod: 'CARD',
        issueId: result.orderNo,
        issueName: result.orderName,
        displayAmount: result.amount,
        currency: 'KRW',
        customer: {
          customerId: result.customerKey,
          fullName: result.customerName,
          email: result.customerName,
        },
        redirectUrl: result.successUrl,
      })) as PortOneBillingKeyResponse | undefined;

      if (!billingKeyResponse) {
        throw new Error('블로그 구독 결제수단 등록 응답이 없습니다.');
      }

      if (billingKeyResponse.code) {
        throw new Error(billingKeyResponse.message || '블로그 구독 결제수단 등록에 실패했습니다.');
      }

      if (!billingKeyResponse.billingKey) {
        throw new Error('billingKey가 발급되지 않았습니다.');
      }

      const successResponse = await fetch('/api/payments/portone/subscriptions/success', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingKey: billingKeyResponse.billingKey,
          customerKey: result.customerKey,
          siteName,
          targetType: 'site',
          orderNo: result.orderNo,
        }),
      });

      const successResult = (await successResponse.json()) as BlogSubscriptionActionResponse;

      if (!successResponse.ok) {
        throw new Error(successResult.error ?? '블로그 구독 가입을 완료하지 못했습니다.');
      }

      setBlogSubscriptionStatus('active');
      setIsBlogSubscriptionDialogOpen(false);
      setIsBlogSubscriptionProcessing(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setBlogSubscriptionErrorMessage(unknownError.message || '블로그 구독 가입을 시작하지 못했습니다.');
      } else {
        setBlogSubscriptionErrorMessage('블로그 구독 가입을 시작하지 못했습니다.');
      }

      setIsBlogSubscriptionProcessing(false);
    }
  }

  async function handleCancelBlogSubscription() {
    try {
      setBlogSubscriptionErrorMessage('');
      setIsBlogSubscriptionProcessing(true);

      const response = await fetch('/api/payments/portone/subscriptions/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          targetType: 'site',
        }),
      });

      const result = (await response.json()) as BlogSubscriptionActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 구독 취소를 처리하지 못했습니다.');
      }

      setBlogSubscriptionStatus(result.mode === 'cancel_scheduled' ? 'scheduled_cancel' : 'canceled');
      setIsBlogSubscriptionCancelDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setBlogSubscriptionErrorMessage(unknownError.message || '블로그 구독 취소를 처리하지 못했습니다.');
      } else {
        setBlogSubscriptionErrorMessage('블로그 구독 취소를 처리하지 못했습니다.');
      }
    } finally {
      setIsBlogSubscriptionProcessing(false);
    }
  }

  async function handleResumeBlogSubscription() {
    try {
      setBlogSubscriptionErrorMessage('');
      setIsBlogSubscriptionProcessing(true);

      const response = await fetch('/api/payments/portone/subscriptions/resume', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          targetType: 'site',
        }),
      });

      const result = (await response.json()) as BlogSubscriptionActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 구독 유지를 처리하지 못했습니다.');
      }

      setBlogSubscriptionStatus('active');
      setIsBlogSubscriptionDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setBlogSubscriptionErrorMessage(unknownError.message || '블로그 구독 유지를 처리하지 못했습니다.');
      } else {
        setBlogSubscriptionErrorMessage('블로그 구독 유지를 처리하지 못했습니다.');
      }
    } finally {
      setIsBlogSubscriptionProcessing(false);
    }
  }

  function handleBlogSubscriptionButtonClick() {
    if (blogSubscriptionStatus === 'active' || blogSubscriptionStatus === 'past_due') {
      handleOpenBlogSubscriptionCancelDialog();
      return;
    }

    if (blogSubscriptionStatus === 'scheduled_cancel') {
      handleOpenBlogSubscriptionDialog();
      return;
    }

    if (!paymentEmail) {
      setIsPaymentEmailDialogOpen(true);
      return;
    }

    handleOpenBlogSubscriptionDialog();
  }

  function handlePaymentEmailSaved(savedPaymentEmail: string) {
    setPaymentEmail(savedPaymentEmail);
    handleOpenBlogSubscriptionDialog();
  }

  if (isLoading) {
    return (
      <div className="paper">
        <div className="loading-container">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  if (!siteInfo) {
    return null;
  }

  const isResumingScheduledBlogSubscription = blogSubscriptionStatus === 'scheduled_cancel';

  return (
    <div className={styles['site-profile']}>
      <div className={styles['site-profile-container']}>
        <div className={styles['site-profile-info']}>
          {profileLogoUrl ? (
            <img src={profileLogoUrl} alt="" />
          ) : (
            <div className={styles['site-profile-avatar']}>
              <AppIconAvatar src={profilePictureUrl || null} alt={siteInfo.site_label || ''} size={20} />
              <strong>{siteInfo.site_label}</strong>
            </div>
          )}
          {siteInfo.summary ? <p>{siteInfo.summary}</p> : null}
          {socialLinks.length > 0 ? (
            <Stack direction="row" gap={0.25} flexWrap="wrap" useFlexGap>
              {socialLinks.map((link) => {
                const option = SOCIAL_LINK_OPTIONS.find((item) => item.value === link.service);
                const account = normalizeText(link.account);

                if (!option || !account) {
                  return null;
                }

                const ServiceIcon = option.Icon;

                return (
                  <IconButton
                    key={link.id}
                    component="a"
                    href={`${option.prefix}${account}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-label={`${option.label} 링크`}
                    size="small"
                  >
                    <ServiceIcon sx={{ width: 16, height: 16 }} />
                  </IconButton>
                );
              })}
            </Stack>
          ) : null}
        </div>
      </div>

      {blogType !== 'team' && !isUnder14Age ? (
        <div className={styles.action}>
          {isDonationEnabled ? (
            <DonationButton
              siteName={siteName}
              targetType="site"
              buttonText="블로그 후원"
              disabled={isBlogSubscriptionProcessing}
              onProcessingChange={setIsDonationProcessing}
            />
          ) : null}
          {isBlogSubscriptionEnabled ? (
            <button
              type="button"
              className="button small action"
              onClick={hasIdentity ? handleBlogSubscriptionButtonClick : handleOpenIdentityDialog}
              disabled={isDonationProcessing || isBlogSubscriptionProcessing}
            >
              {getBlogSubscriptionButtonLabel(blogSubscriptionStatus)}
            </button>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {blogSubscriptionErrorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{blogSubscriptionErrorMessage}</span>
        </p>
      ) : null}

      <PaymentEmailDialog
        open={isPaymentEmailDialogOpen}
        onClose={() => setIsPaymentEmailDialogOpen(false)}
        onSaved={handlePaymentEmailSaved}
      />

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isBlogSubscriptionCancelDialogOpen}
          onClose={handleCloseBlogSubscriptionCancelDialog}
          className="VhiDrawer-bottom"
        >
          <h2>블로그 구독 취소</h2>
          <button
            type="button"
            className="close-button"
            onClick={handleCloseBlogSubscriptionCancelDialog}
            aria-label="닫기"
            disabled={isBlogSubscriptionProcessing}
          >
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Stack gap={1}>
              <Typography variant="subtitle2">블로그 구독을 취소하시겠어요?</Typography>
              <Typography variant="body2">
                지금 취소해도 현재 이용 기간은 그대로 사용할 수 있어요. 다음 결제일부터 자동 결제가 진행되지 않습니다.
              </Typography>
              {blogSubscriptionErrorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{blogSubscriptionErrorMessage}</span>
                </p>
              ) : null}
            </Stack>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium close"
                onClick={handleCloseBlogSubscriptionCancelDialog}
                disabled={isBlogSubscriptionProcessing}
              >
                계속 이용하기
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handleCancelBlogSubscription()}
                disabled={isBlogSubscriptionProcessing}
              >
                구독 취소하기
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isBlogSubscriptionCancelDialogOpen}
          onClose={handleCloseBlogSubscriptionCancelDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>블로그 구독 취소</DialogTitle>
          <button
            type="button"
            className="close-button"
            onClick={handleCloseBlogSubscriptionCancelDialog}
            aria-label="닫기"
            disabled={isBlogSubscriptionProcessing}
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Stack gap={1}>
              <Typography variant="subtitle2">블로그 구독을 취소하시겠어요?</Typography>
              <Typography variant="body2">
                지금 취소해도 현재 이용 기간은 그대로 사용할 수 있어요. 다음 결제일부터 자동 결제가 진행되지 않습니다.
              </Typography>
              {blogSubscriptionErrorMessage ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{blogSubscriptionErrorMessage}</span>
                </p>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseBlogSubscriptionCancelDialog}
              disabled={isBlogSubscriptionProcessing}
            >
              계속 이용하기
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleCancelBlogSubscription()}
              disabled={isBlogSubscriptionProcessing}
            >
              구독 취소하기
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isIdentityDialogOpen}
          onClose={handleCloseIdentityDialog}
          className="VhiDrawer-bottom"
        >
          <h2>본인인증 필요</h2>
          <button type="button" className="close-button" onClick={handleCloseIdentityDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>

          <Stack gap={3}>
            <Stack gap={1}>
              <Typography variant="subtitle2">결제를 하기 위해서는 본인인증을 하셔야 합니다.</Typography>
              <IdentityVerificationButton onVerified={handleIdentityVerified} />
            </Stack>

            <button type="button" className="button medium close" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isIdentityDialogOpen}
          onClose={handleCloseIdentityDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>본인인증 필요</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseIdentityDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>

          <DialogContent>
            <Stack gap={1}>
              <Typography variant="subtitle2">결제를 하기 위해서는 본인인증을 하셔야 합니다.</Typography>
              <IdentityVerificationButton onVerified={handleIdentityVerified} />
            </Stack>
          </DialogContent>

          <DialogActions>
            <button type="button" className="button medium close" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isBlogSubscriptionDialogOpen}
          onClose={handleCloseBlogSubscriptionDialog}
          className="VhiDrawer-bottom"
        >
          <h2>
            {isMinor
              ? '1개월 구독권'
              : isResumingScheduledBlogSubscription
                ? '블로그 구독 유지하기'
                : blogSubscriptionStatus === 'canceled' || blogSubscriptionStatus === 'expired'
                  ? '블로그 구독 재가입'
                  : '블로그 구독 가입'}
          </h2>
          <button className="close-button" onClick={handleCloseBlogSubscriptionDialog}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {isResumingScheduledBlogSubscription ? (
              <Stack gap={1}>
                <Typography variant="subtitle2">구독 취소를 철회할까요?</Typography>
                <Typography variant="body2">현재 이용 기간은 그대로 이용할 수 있습니다.</Typography>
                <Typography variant="body2">
                  다음 결제일에 월 {formatBlogSubscriptionPrice(blogSubscriptionPrice ?? 0)}원이 자동 결제되며, 이후에도
                  매월 자동 결제됩니다.
                </Typography>
              </Stack>
            ) : (
              <>
                <Typography variant="body2">
                  {isMinor
                    ? `1개월 ${formatBlogSubscriptionPrice(blogSubscriptionPrice ?? 0)} 단건 결제로 블로그 구독을 이용하시겠어요? 기간이 끝나면 다시 결제해야 합니다.`
                    : `월 ${formatBlogSubscriptionPrice(blogSubscriptionPrice ?? 0)}원에 블로그 구독을 가입하시겠어요?`}
                </Typography>
                <PaymentTerms type="subscription" disabled={isBlogSubscriptionProcessing} />
              </>
            )}

            {blogSubscriptionErrorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{blogSubscriptionErrorMessage}</span>
              </p>
            ) : null}
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseBlogSubscriptionDialog}
                disabled={isBlogSubscriptionProcessing}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={
                  isResumingScheduledBlogSubscription ? handleResumeBlogSubscription : handleJoinBlogSubscription
                }
                disabled={isBlogSubscriptionProcessing}
              >
                {isResumingScheduledBlogSubscription ? '구독 유지하기' : '가입하기'}
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isBlogSubscriptionDialogOpen}
          onClose={handleCloseBlogSubscriptionDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>
            {isMinor
              ? '1개월 구독권'
              : isResumingScheduledBlogSubscription
                ? '블로그 구독 유지하기'
                : blogSubscriptionStatus === 'canceled' || blogSubscriptionStatus === 'expired'
                  ? '블로그 구독 재가입'
                  : '블로그 구독 가입'}
          </DialogTitle>
          <button className="close-button" onClick={handleCloseBlogSubscriptionDialog}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            {isResumingScheduledBlogSubscription ? (
              <Stack gap={1}>
                <Typography variant="subtitle2">구독 취소를 철회할까요?</Typography>
                <Typography variant="body2">현재 이용 기간은 그대로 이용할 수 있습니다.</Typography>
                <Typography variant="body2">
                  다음 결제일에 월 {formatBlogSubscriptionPrice(blogSubscriptionPrice ?? 0)}원이 자동 결제되며, 이후에도
                  매월 자동 결제됩니다.
                </Typography>
              </Stack>
            ) : (
              <>
                <Typography variant="body2">
                  {isMinor
                    ? `1개월 ${formatBlogSubscriptionPrice(blogSubscriptionPrice ?? 0)} 단건 결제로 블로그 구독을 이용하시겠어요? 기간이 끝나면 다시 결제해야 합니다.`
                    : `월 ${formatBlogSubscriptionPrice(blogSubscriptionPrice ?? 0)}원에 블로그 구독을 가입하시겠어요?`}
                </Typography>
                <PaymentTerms type="subscription" disabled={isBlogSubscriptionProcessing} />
              </>
            )}

            {blogSubscriptionErrorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{blogSubscriptionErrorMessage}</span>
              </p>
            ) : null}
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseBlogSubscriptionDialog}
              disabled={isBlogSubscriptionProcessing}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={isResumingScheduledBlogSubscription ? handleResumeBlogSubscription : handleJoinBlogSubscription}
              disabled={isBlogSubscriptionProcessing}
            >
              {isResumingScheduledBlogSubscription ? '구독 유지하기' : '가입하기'}
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
