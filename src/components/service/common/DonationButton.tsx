'use client';

import { type ChangeEvent, useEffect, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PortOne from '@portone/browser-sdk/v2';
import IdentityVerificationButton from './IdentityVerificationButton';
import PaymentTerms from './PaymentTerms';

type DonationTargetType = 'site' | 'series';

type DonationStartResponse = {
  storeId?: string;
  channelKey?: string;
  orderNo?: string;
  paymentId?: string;
  orderName?: string;
  amount?: number;
  redirectUrl?: string;
  error?: string;
};

type CommonProps = {
  siteName: string;
  buttonText?: string;
  disabled?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
};

type SiteDonationProps = CommonProps & {
  targetType?: 'site';
  successUrl?: string;
  failUrl?: string;
};

type SeriesDonationProps = CommonProps & {
  targetType: 'series';
  boardName: string;
  seriesName: string;
  successUrl?: string;
  failUrl?: string;
};

type Props = SiteDonationProps | SeriesDonationProps;

type IdentityStatusResponse = {
  exists: boolean;
  identity: {
    purchase_available?: boolean;
    birth_date: string;
  } | null;
  error?: string;
};

type DonationStatusResponse = {
  isEnabled?: boolean;
};

type SitePublicResponse = {
  siteInfo?: {
    purchase_available?: boolean;
  };
  error?: string;
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

function formatDonationAmount(value: number) {
  if (!value) {
    return '';
  }

  return value.toLocaleString('ko-KR');
}

function getDonationAmountNumber(value: string) {
  const numberText = value.replace(/[^0-9]/g, '');

  if (!numberText) {
    return 0;
  }

  return Number(numberText);
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

function getTargetType(props: Props): DonationTargetType {
  return props.targetType === 'series' ? 'series' : 'site';
}

function getDonationTitle(props: Props) {
  return getTargetType(props) === 'series' ? '연재 후원' : '블로그 후원';
}

function getSuccessUrl(props: Props) {
  if (props.successUrl) {
    return props.successUrl;
  }

  return `/${props.siteName}/donation/success`;
}

function getFailUrl(props: Props) {
  if (props.failUrl) {
    return props.failUrl;
  }

  return `/${props.siteName}/donation/fail`;
}

function createRequestBody(props: Props, amount: number) {
  if (props.targetType === 'series') {
    return {
      targetType: 'series',
      siteName: props.siteName,
      boardName: props.boardName,
      seriesName: props.seriesName,
      amount,
      successUrl: getSuccessUrl(props),
      failUrl: getFailUrl(props),
    };
  }

  return {
    targetType: 'site',
    siteName: props.siteName,
    amount,
    successUrl: getSuccessUrl(props),
    failUrl: getFailUrl(props),
  };
}

export default function DonationButton(props: Props) {
  const { buttonText = '후원하기', disabled = false, onProcessingChange } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1,000');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [canShowDonationButton, setCanShowDonationButton] = useState(false);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [purchaseAvailable, setPurchaseAvailable] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const donationTitle = getDonationTitle(props);

  useEffect(() => {
    async function checkDonationStatus() {
      try {
        const statusParams = new URLSearchParams({
          siteName: props.siteName,
          targetType: getTargetType(props),
        });

        const [identityResponse, donationStatusResponse] = await Promise.all([
          fetch('/api/identity/portone/status', {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/payments/portone/donation/status?${statusParams.toString()}`, {
            method: 'GET',
            credentials: 'include',
          }),
        ]);

        const identityResult = (await identityResponse.json()) as IdentityStatusResponse;
        const donationStatusResult = (await donationStatusResponse.json()) as DonationStatusResponse;

        setHasIdentity(identityResponse.ok && Boolean(identityResult.exists));
        setIsMinor(
          identityResponse.ok && identityResult.exists && identityResult.identity
            ? !isAdult(identityResult.identity.birth_date)
            : false,
        );

        setCanShowDonationButton(Boolean(donationStatusResponse.ok && donationStatusResult.isEnabled));
      } catch {
        setCanShowDonationButton(false);
      }
    }

    void checkDonationStatus();

    return () => {
      setCanShowDonationButton(true);
    };
  }, [props.siteName, props.targetType]);

  if (!canShowDonationButton) {
    return null;
  }

  function updateProcessing(nextIsProcessing: boolean) {
    setIsProcessing(nextIsProcessing);
    onProcessingChange?.(nextIsProcessing);
  }

  function handleOpenDialog() {
    if (!hasIdentity) {
      setIsIdentityDialogOpen(true);
      return;
    }
    setDonationAmount('1,000');
    setErrorMessage('');
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (isProcessing) {
      return;
    }

    setIsDialogOpen(false);
  }

  function handleCloseIdentityDialog() {
    setIsIdentityDialogOpen(false);
  }

  function handleDonationAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const nextAmount = getDonationAmountNumber(event.target.value);

    if (nextAmount > 100000) {
      return;
    }

    setDonationAmount(formatDonationAmount(nextAmount));
    setErrorMessage('');
  }

  async function handleDonate() {
    try {
      setErrorMessage('');
      updateProcessing(true);

      const amount = getDonationAmountNumber(donationAmount);

      if (!isValidDonationAmount(amount)) {
        throw new Error('후원금액은 1,000 원부터 100,000 원까지 1,000 원 단위로 입력해 주세요.');
      }

      const response = await fetch('/api/payments/portone/donation/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody(props, amount)),
      });

      const result = (await response.json()) as DonationStartResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '후원을 시작하지 못했습니다.');
      }

      if (
        !result.storeId ||
        !result.channelKey ||
        !result.paymentId ||
        !result.orderName ||
        !result.amount ||
        !result.redirectUrl
      ) {
        throw new Error('후원 결제 정보가 올바르지 않습니다.');
      }

      await PortOne.requestPayment({
        storeId: result.storeId,
        channelKey: result.channelKey,
        paymentId: result.paymentId,
        orderName: result.orderName,
        totalAmount: result.amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        redirectUrl: result.redirectUrl,
        forceRedirect: true,
      });
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '후원을 시작하지 못했습니다.');
      } else {
        setErrorMessage('후원을 시작하지 못했습니다.');
      }

      updateProcessing(false);
    }
  }

  function renderDonationForm() {
    return (
      <Stack spacing={2}>
        <TextField
          value={donationAmount}
          onChange={handleDonationAmountChange}
          disabled={isProcessing}
          inputMode="numeric"
          fullWidth
          size="small"
          slotProps={{
            input: {
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            },
          }}
        />

        {isMinor && (
          <p className="alert warning" style={{ marginTop: '8px' }}>
            <span>법정대리인 동의 없이 진행된 미성년자의 결제는 취소될 수 있습니다.</span>
          </p>
        )}

        <PaymentTerms type="donation" disabled={isProcessing} />

        <Snackbar
          open={Boolean(errorMessage)}
          message={errorMessage}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          autoHideDuration={2700}
          onClose={() => setErrorMessage('')}
        />
      </Stack>
    );
  }

  return (
    <>
      <button
        type="button"
        className="button small action"
        onClick={handleOpenDialog}
        disabled={disabled || isProcessing}
      >
        <strong>{buttonText}</strong>
      </button>

      {isMobile ? (
        <Drawer anchor="bottom" open={isDialogOpen} onClose={handleCloseDialog} className="VhiDrawer-bottom">
          <h2>{donationTitle}</h2>
          <button className="close-button" onClick={handleCloseDialog}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {renderDonationForm()}
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseDialog}
                disabled={isProcessing}
              >
                취소
              </button>
              <button type="button" className="button medium submit" onClick={handleDonate} disabled={isProcessing}>
                후원
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>{donationTitle}</DialogTitle>
          <button className="close-button" onClick={handleCloseDialog}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>{renderDonationForm()}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={handleCloseDialog} disabled={isProcessing}>
              취소
            </button>
            <button type="button" className="button medium submit" onClick={handleDonate} disabled={isProcessing}>
              후원
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
              <IdentityVerificationButton />
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isIdentityDialogOpen} onClose={handleCloseIdentityDialog} fullWidth maxWidth="xs">
          <DialogTitle>본인인증 필요</DialogTitle>
          <DialogContent dividers>
            <Stack gap={1}>
              <Typography variant="subtitle2">결제를 하기 위해서는 본인인증을 하셔야 합니다.</Typography>
              <IdentityVerificationButton />
            </Stack>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button small default" onClick={handleCloseIdentityDialog}>
              취소
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
