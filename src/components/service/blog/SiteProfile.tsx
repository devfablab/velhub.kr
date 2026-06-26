'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import * as PortOne from '@portone/browser-sdk/v2';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import DonationButton from '@/components/service/common/DonationButton';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
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
  error?: string;
};

type MembershipStatus = 'none' | 'active' | 'scheduled_cancel' | 'canceled' | 'expired' | 'past_due';

type MembershipStatusResponse = {
  isEnabled?: boolean;
  price?: number | null;
  membershipStatus?: MembershipStatus;
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

type MembershipStartResponse = {
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
  error?: string;
};

type MembershipActionResponse = {
  ok?: boolean;
  membershipStatus?: MembershipStatus;
  subscriptionStatus?: MembershipStatus;
  error?: string;
};

function formatMembershipPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function getMembershipButtonLabel(status: MembershipStatus) {
  if (status === 'active' || status === 'past_due') {
    return '멤버십 취소';
  }

  if (status === 'scheduled_cancel') {
    return '멤버십 유지하기';
  }

  if (status === 'canceled' || status === 'expired') {
    return '멤버십 재가입하기';
  }

  return '멤버십 가입하기';
}

export default function SiteProfile() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profileLogoUrl, setProfileLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDonationProcessing, setIsDonationProcessing] = useState(false);
  const [isMembershipEnabled, setIsMembershipEnabled] = useState(false);
  const [membershipPrice, setMembershipPrice] = useState<number | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>('none');
  const [isMembershipDialogOpen, setIsMembershipDialogOpen] = useState(false);
  const [membershipErrorMessage, setMembershipErrorMessage] = useState('');
  const [isMembershipProcessing, setIsMembershipProcessing] = useState(false);
  const [isDonationEnabled, setIsDonationEnabled] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    async function loadMembershipStatus() {
      const response = await fetch(`/api/payments/portone/membership/status?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as MembershipStatusResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버십 상태를 확인하지 못했습니다.');
      }

      setIsMembershipEnabled(Boolean(result.isEnabled));
      setMembershipPrice(result.price ?? null);
      setMembershipStatus(result.membershipStatus ?? 'none');
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

    async function loadSiteProfile() {
      try {
        setErrorMessage('');
        setMembershipErrorMessage('');

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
        setProfilePictureUrl(normalizeText(result.profilePictureUrl));
        setProfileLogoUrl(normalizeText(result.profileLogoUrl));

        await Promise.all([loadMembershipStatus(), loadDonationStatus()]);
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

  function handleOpenMembershipDialog() {
    setMembershipErrorMessage('');
    setIsMembershipDialogOpen(true);
  }

  function handleCloseMembershipDialog() {
    if (isMembershipProcessing) {
      return;
    }

    setIsMembershipDialogOpen(false);
  }

  async function handleJoinMembership() {
    try {
      setMembershipErrorMessage('');
      setIsMembershipProcessing(true);

      const response = await fetch('/api/payments/portone/membership/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          successUrl: `/${siteName}/membership/success`,
          failUrl: `/${siteName}/membership/fail`,
        }),
      });

      const result = (await response.json()) as MembershipStartResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버십 가입을 시작하지 못했습니다.');
      }

      if (result.mode === 'direct_billing') {
        setMembershipStatus('active');
        setIsMembershipDialogOpen(false);
        setIsMembershipProcessing(false);
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
        throw new Error('멤버십 결제 정보가 올바르지 않습니다.');
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
        throw new Error('멤버십 결제수단 등록 응답이 없습니다.');
      }

      if (billingKeyResponse.code) {
        throw new Error(billingKeyResponse.message || '멤버십 결제수단 등록에 실패했습니다.');
      }

      if (!billingKeyResponse.billingKey) {
        throw new Error('billingKey가 발급되지 않았습니다.');
      }

      const successResponse = await fetch('/api/payments/portone/membership/success', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingKey: billingKeyResponse.billingKey,
          customerKey: result.customerKey,
          siteName,
          orderNo: result.orderNo,
        }),
      });

      const successResult = (await successResponse.json()) as MembershipActionResponse;

      if (!successResponse.ok) {
        throw new Error(successResult.error ?? '멤버십 가입을 완료하지 못했습니다.');
      }

      setMembershipStatus('active');
      setIsMembershipDialogOpen(false);
      setIsMembershipProcessing(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setMembershipErrorMessage(unknownError.message || '멤버십 가입을 시작하지 못했습니다.');
      } else {
        setMembershipErrorMessage('멤버십 가입을 시작하지 못했습니다.');
      }

      setIsMembershipProcessing(false);
    }
  }

  async function handleCancelMembership() {
    try {
      setMembershipErrorMessage('');
      setIsMembershipProcessing(true);

      const response = await fetch('/api/payments/portone/membership/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
        }),
      });

      const result = (await response.json()) as MembershipActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버십 취소를 처리하지 못했습니다.');
      }

      setMembershipStatus(result.membershipStatus ?? result.subscriptionStatus ?? 'canceled');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setMembershipErrorMessage(unknownError.message || '멤버십 취소를 처리하지 못했습니다.');
      } else {
        setMembershipErrorMessage('멤버십 취소를 처리하지 못했습니다.');
      }
    } finally {
      setIsMembershipProcessing(false);
    }
  }

  async function handleResumeMembership() {
    try {
      setMembershipErrorMessage('');
      setIsMembershipProcessing(true);

      const response = await fetch('/api/payments/portone/membership/resume', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
        }),
      });

      const result = (await response.json()) as MembershipActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버십 유지를 처리하지 못했습니다.');
      }

      setMembershipStatus(result.membershipStatus ?? result.subscriptionStatus ?? 'active');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setMembershipErrorMessage(unknownError.message || '멤버십 유지를 처리하지 못했습니다.');
      } else {
        setMembershipErrorMessage('멤버십 유지를 처리하지 못했습니다.');
      }
    } finally {
      setIsMembershipProcessing(false);
    }
  }

  function handleMembershipButtonClick() {
    if (membershipStatus === 'active' || membershipStatus === 'past_due') {
      void handleCancelMembership();
      return;
    }

    if (membershipStatus === 'scheduled_cancel') {
      void handleResumeMembership();
      return;
    }

    handleOpenMembershipDialog();
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

  if (errorMessage) {
    return <div className="paper paper-error">{errorMessage}</div>;
  }

  if (!siteInfo) {
    return null;
  }

  return (
    <div className={styles['site-profile']}>
      <div className={styles['site-profile-container']}>
        <div className={styles['site-profile-avatar']}>
          <AppIconAvatar src={profilePictureUrl || null} alt={siteInfo.site_label || ''} size={72} />
        </div>
        <div className={styles['site-profile-info']}>
          {profileLogoUrl ? <img src={profileLogoUrl} alt="" /> : null}
          <strong>{siteInfo.site_label}</strong>
          {siteInfo.summary ? <p>{siteInfo.summary}</p> : null}
        </div>
      </div>

      <div className={styles.action}>
        {isDonationEnabled ? (
          <DonationButton
            siteName={siteName}
            targetType="site"
            buttonText="블로그 후원"
            disabled={isMembershipProcessing}
            onProcessingChange={setIsDonationProcessing}
          />
        ) : null}

        {isMembershipEnabled ? (
          <button
            type="button"
            className="button small submit"
            onClick={handleMembershipButtonClick}
            disabled={isDonationProcessing || isMembershipProcessing}
          >
            {getMembershipButtonLabel(membershipStatus)}
          </button>
        ) : null}
      </div>

      {membershipErrorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{membershipErrorMessage}</span>
        </p>
      ) : null}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isMembershipDialogOpen}
          onClose={handleCloseMembershipDialog}
          className="VhiDrawer-bottom"
        >
          <h2>{membershipStatus === 'canceled' || membershipStatus === 'expired' ? '멤버십 재가입' : '멤버십 가입'}</h2>
          <button className="close-button" onClick={handleCloseMembershipDialog}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Typography variant="body2">
              월 {formatMembershipPrice(membershipPrice ?? 0)}원에 멤버십을 가입하시겠어요?
            </Typography>

            {membershipErrorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{membershipErrorMessage}</span>
              </p>
            ) : null}
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseMembershipDialog}
                disabled={isMembershipProcessing}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={handleJoinMembership}
                disabled={isMembershipProcessing}
              >
                가입하기
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isMembershipDialogOpen}
          onClose={handleCloseMembershipDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>
            {membershipStatus === 'canceled' || membershipStatus === 'expired' ? '멤버십 재가입' : '멤버십 가입'}
          </DialogTitle>
          <button className="close-button" onClick={handleCloseMembershipDialog}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="body2">
              월 {formatMembershipPrice(membershipPrice ?? 0)}원에 멤버십을 가입하시겠어요?
            </Typography>

            {membershipErrorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{membershipErrorMessage}</span>
              </p>
            ) : null}
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium close"
              onClick={handleCloseMembershipDialog}
              disabled={isMembershipProcessing}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={handleJoinMembership}
              disabled={isMembershipProcessing}
            >
              가입하기
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
