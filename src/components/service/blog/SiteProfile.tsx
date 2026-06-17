'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
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

type DonationStartResponse = {
  clientKey?: string;
  orderNo?: string;
  orderName?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
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

function formatDonationAmount(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatMembershipPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function getDonationAmountNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidDonationAmount(amount: number) {
  if (!Number.isInteger(amount)) {
    return false;
  }

  if (amount < 1000) {
    return false;
  }

  if (amount > 100000) {
    return false;
  }

  return amount % 1000 === 0;
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
  const [isDonationDialogOpen, setIsDonationDialogOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1,000');
  const [donationErrorMessage, setDonationErrorMessage] = useState('');
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

  function handleOpenDonationDialog() {
    setDonationAmount('1,000');
    setDonationErrorMessage('');
    setMembershipErrorMessage('');
    setIsDonationDialogOpen(true);
  }

  function handleCloseDonationDialog() {
    if (isDonationProcessing) {
      return;
    }

    setIsDonationDialogOpen(false);
  }

  function handleDonationAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const nextAmount = getDonationAmountNumber(event.target.value);

    if (!isValidDonationAmount(nextAmount)) {
      return;
    }

    setDonationAmount(formatDonationAmount(nextAmount));
    setDonationErrorMessage('');
  }

  async function handleDonate() {
    try {
      setDonationErrorMessage('');
      setMembershipErrorMessage('');
      setIsDonationProcessing(true);

      const amount = getDonationAmountNumber(donationAmount);

      const response = await fetch('/api/payments/toss/donation/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          amount,
          successUrl: `/${siteName}/donation/success`,
          failUrl: `/${siteName}/donation/fail`,
        }),
      });

      const result = (await response.json()) as DonationStartResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '후원을 시작하지 못했습니다.');
      }

      if (
        !result.clientKey ||
        !result.orderNo ||
        !result.orderName ||
        !result.amount ||
        !result.successUrl ||
        !result.failUrl
      ) {
        throw new Error('후원 결제 정보가 올바르지 않습니다.');
      }

      const tossPayments = await loadTossPayments(result.clientKey);

      await tossPayments.requestPayment('카드', {
        amount: result.amount,
        orderId: result.orderNo,
        orderName: result.orderName,
        successUrl: result.successUrl,
        failUrl: result.failUrl,
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDonationErrorMessage(unknownError.message || '후원을 시작하지 못했습니다.');
      } else {
        setDonationErrorMessage('후원을 시작하지 못했습니다.');
      }

      setIsDonationProcessing(false);
    }
  }

  function handleOpenMembershipDialog() {
    setDonationErrorMessage('');
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
      setDonationErrorMessage('');
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
      setDonationErrorMessage('');
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
      setDonationErrorMessage('');
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
        <button
          type="button"
          className="button small submit"
          onClick={handleOpenDonationDialog}
          disabled={isDonationProcessing || isMembershipProcessing}
        >
          후원하기
        </button>

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

      <Dialog open={isDonationDialogOpen} onClose={handleCloseDonationDialog} fullWidth maxWidth="xs">
        <DialogTitle>후원하기</DialogTitle>
        <DialogContent>
          <TextField
            value={donationAmount}
            onChange={handleDonationAmountChange}
            fullWidth
            margin="normal"
            placeholder="후원금액"
            inputProps={{
              inputMode: 'numeric',
            }}
            helperText="최소 1,000원, 최대 100,000원까지 1,000원 단위로 입력할 수 있습니다."
            disabled={isDonationProcessing}
          />

          {donationErrorMessage ? (
            <Typography role="status" color="error">
              {donationErrorMessage}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDonationDialog} disabled={isDonationProcessing}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleDonate} disabled={isDonationProcessing}>
            후원
          </Button>
        </DialogActions>
      </Dialog>

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
