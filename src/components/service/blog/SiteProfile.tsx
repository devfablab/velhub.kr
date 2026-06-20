'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import DonationButton from '@/components/service/common/DonationButton';
import { normalizeText } from '@/lib/utils';
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

type MembershipStartResponse = {
  mode?: 'billing_auth' | 'direct_billing';
  clientKey?: string;
  customerKey?: string;
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

  useEffect(() => {
    async function loadMembershipStatus() {
      const response = await fetch(`/api/payments/toss/membership/status?siteName=${siteName}`, {
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

        await loadMembershipStatus();
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

      const response = await fetch('/api/payments/toss/membership/start', {
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

      if (!result.clientKey || !result.customerKey || !result.orderNo || !result.successUrl || !result.failUrl) {
        throw new Error('멤버십 결제 정보가 올바르지 않습니다.');
      }

      const tossPayments = await loadTossPayments(result.clientKey);

      await tossPayments.requestBillingAuth('카드', {
        customerKey: result.customerKey,
        successUrl: result.successUrl,
        failUrl: result.failUrl,
      });
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

      const response = await fetch('/api/payments/toss/membership/cancel', {
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

      const response = await fetch('/api/payments/toss/membership/resume', {
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
        <DonationButton
          siteName={siteName}
          className="button small submit"
          disabled={isMembershipProcessing}
          onProcessingChange={setIsDonationProcessing}
        />

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
        <Typography role="status" color="error">
          {membershipErrorMessage}
        </Typography>
      ) : null}

      <Dialog open={isMembershipDialogOpen} onClose={handleCloseMembershipDialog} fullWidth maxWidth="xs">
        <DialogTitle>
          {membershipStatus === 'canceled' || membershipStatus === 'expired' ? '멤버십 재가입' : '멤버십 가입'}
        </DialogTitle>
        <DialogContent>
          <Typography>월 {formatMembershipPrice(membershipPrice ?? 0)}원 멤버십에 가입합니다.</Typography>

          {membershipErrorMessage ? (
            <Typography role="status" color="error">
              {membershipErrorMessage}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseMembershipDialog} disabled={isMembershipProcessing}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleJoinMembership} disabled={isMembershipProcessing}>
            가입하기
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
