'use client';

import { type ChangeEvent, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PortOne from '@portone/browser-sdk/v2';
import { requestGuardianIdentityVerification } from '@/lib/identity/requestGuardianVerification';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/payments/currencyInput';
import FormErrorDialog from '@/components/FormErrorDialog';
import IdentityVerificationButton from './IdentityVerificationButton';
import MinorPaymentControl, { type MinorPaymentControlResult } from './MinorPaymentControl';
import PaymentEmailDialog from './PaymentEmailDialog';
import PaymentTerms from './PaymentTerms';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';

type DonationTargetType = 'site' | 'series' | 'post';

type DonationStartResponse = {
  storeId?: string;
  channelKey?: string;
  orderNo?: string;
  paymentId?: string;
  orderName?: string;
  amount?: number;
  customerName?: string;
  paymentEmail?: string;
  paymentPhone?: string;
  redirectUrl?: string;
  error?: string;
  guardianAuthRequired?: boolean;
};

type CommonProps = {
  siteName: string;
  initialStatus?: DonationStatusResponse | null;
  buttonText?: string;
  triggerClassName?: string;
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

type PostDonationProps = CommonProps & {
  targetType: 'post';
  boardName: string;
  contentId: string;
  commentFormId?: string;
  successUrl?: string;
  failUrl?: string;
};

type Props = SiteDonationProps | SeriesDonationProps | PostDonationProps;

type IdentityStatusResponse = {
  exists: boolean;
  identity: {
    purchase_available?: boolean;
    birth_date: string;
  } | null;
  error?: string;
};

export type DonationStatusResponse = {
  isEnabled?: boolean;
  paymentEmail?: string | null;
  paymentPhone?: string | null;
  customerName?: string | null;
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
  return props.targetType === 'series' || props.targetType === 'post' ? props.targetType : 'site';
}

function getDonationTitle(props: Props) {
  if (getTargetType(props) === 'post') return '후원 댓글';
  return getTargetType(props) === 'series' ? '연재 후원' : '블로그 후원';
}

function getSuccessUrl(props: Props) {
  if (props.successUrl) {
    return props.successUrl;
  }

  if (props.targetType === 'post') {
    return `/${props.siteName}/${props.boardName}/${props.contentId}/donation/success`;
  }

  return `/${props.siteName}/donation/success`;
}

function getFailUrl(props: Props) {
  if (props.failUrl) {
    return props.failUrl;
  }

  if (props.targetType === 'post') {
    return `/${props.siteName}/${props.boardName}/${props.contentId}/donation/fail`;
  }

  return `/${props.siteName}/donation/fail`;
}

function getPostDonationCommentContent(props: PostDonationProps) {
  if (typeof document === 'undefined' || !props.commentFormId) {
    return '';
  }

  const form = document.getElementById(props.commentFormId);

  if (!(form instanceof HTMLFormElement)) {
    return '';
  }

  return String(new FormData(form).get('content') ?? '');
}

function createRequestBody(props: Props, amount: number) {
  if (props.targetType === 'post') {
    return {
      targetType: 'post',
      siteName: props.siteName,
      boardName: props.boardName,
      contentId: props.contentId,
      commentContent: getPostDonationCommentContent(props),
      amount,
      successUrl: getSuccessUrl(props),
      failUrl: getFailUrl(props),
    };
  }

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
  const siteInitialData = useSiteInitialData();
  const identityStatus = siteInitialData?.identityStatus as IdentityStatusResponse | null;
  const siteProfile = siteInitialData?.blogProfile as { donation?: DonationStatusResponse | null } | null;
  const initialStatus = props.initialStatus ?? (props.targetType === 'series' ? null : siteProfile?.donation) ?? null;
  const { buttonText = '후원하기', triggerClassName, disabled = false, onProcessingChange } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1,000');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [amountError, setAmountError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const canShowDonationButton = props.targetType === 'post' || Boolean(initialStatus?.isEnabled);
  const hasIdentity = Boolean(identityStatus?.exists);
  const [paymentEmail, setPaymentEmail] = useState(String(initialStatus?.paymentEmail ?? ''));
  const [paymentPhone, setPaymentPhone] = useState(String(initialStatus?.paymentPhone ?? ''));
  const isMinor = Boolean(
    identityStatus?.exists && identityStatus.identity && !isAdult(identityStatus.identity.birth_date),
  );
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [isPaymentEmailDialogOpen, setIsPaymentEmailDialogOpen] = useState(false);
  const [minorControlMode, setMinorControlMode] = useState<MinorPaymentControlResult['mode']>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const donationTitle = getDonationTitle(props);
  if (!canShowDonationButton) {
    return null;
  }

  function updateProcessing(nextIsProcessing: boolean) {
    setIsProcessing(nextIsProcessing);
    onProcessingChange?.(nextIsProcessing);
  }

  async function handleOpenDialog() {
    if (!hasIdentity) {
      setIsIdentityDialogOpen(true);
      return;
    }

    let currentPaymentEmail = paymentEmail;
    let currentPaymentPhone = paymentPhone;

    if (!currentPaymentEmail || !currentPaymentPhone) {
      try {
        const response = await fetch('/api/payments/portone/billing-method/status', {
          cache: 'no-store',
          credentials: 'include',
        });
        const result = (await response.json()) as {
          paymentEmail?: string | null;
          paymentPhone?: string | null;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? '결제 정보를 확인하지 못했습니다.');
        }

        currentPaymentEmail = String(result.paymentEmail ?? '');
        currentPaymentPhone = String(result.paymentPhone ?? '');
        setPaymentEmail(currentPaymentEmail);
        setPaymentPhone(currentPaymentPhone);
      } catch (error) {
        setErrorTitle(donationTitle);
        setErrorMessage(error instanceof Error ? error.message : '결제 정보를 확인하지 못했습니다.');
        return;
      }
    }

    if (!currentPaymentEmail || !currentPaymentPhone) {
      setIsPaymentEmailDialogOpen(true);
      return;
    }

    setDonationAmount('1,000');
    setErrorMessage('');
    setErrorTitle(null);
    setAmountError('');
    setIsDialogOpen(true);
  }

  function handleMinorPaymentControl(result: MinorPaymentControlResult) {
    setMinorControlMode(result.mode);

    if (result.isBlocked) {
      setErrorMessage('이 계정은 만 19세가 될 때까지 결제 · 구매 · 후원을 이용할 수 없습니다.');
      return;
    }

    handleOpenDialog();
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

  function handleIdentityVerified() {
    handleCloseIdentityDialog();
    window.requestAnimationFrame(() => window.location.reload());
  }

  function handlePaymentEmailSaved(savedPaymentEmail: string, savedPaymentPhone: string) {
    setPaymentEmail(savedPaymentEmail);
    setPaymentPhone(savedPaymentPhone);
    setDonationAmount('1,000');
    setErrorMessage('');
    setErrorTitle(null);
    setAmountError('');
    setIsDialogOpen(true);
  }

  function handleDonationAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const nextAmount = parseCurrencyInput(event.target.value);

    if (nextAmount > 100000) {
      return;
    }

    setDonationAmount(formatCurrencyInput(nextAmount));
    setErrorMessage('');
    setErrorTitle(null);
    setAmountError('');
  }

  async function handleDonate(guardianIdentityVerificationId?: string) {
    try {
      setErrorMessage('');
      updateProcessing(true);

      const amount = parseCurrencyInput(donationAmount);

      if (!isValidDonationAmount(amount)) {
        const message = '후원금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해주세요.';
        setAmountError(message);
        setErrorTitle('후원금액 확인');
        setErrorMessage(message);
        return;
      }

      const response = await fetch(
        props.targetType === 'post'
          ? '/api/payments/portone/donation/post/start'
          : '/api/payments/portone/donation/start',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...createRequestBody(props, amount), guardianIdentityVerificationId }),
        },
      );

      const result = (await response.json()) as DonationStartResponse;

      if (!response.ok) {
        if (result.guardianAuthRequired && !guardianIdentityVerificationId) {
          const verifiedId = await requestGuardianIdentityVerification();
          updateProcessing(false);
          await handleDonate(verifiedId);
          return;
        }
        setErrorTitle(response.status < 500 ? donationTitle : null);
        throw new Error(result.error ?? '후원을 시작하지 못했습니다.');
      }

      if (
        !result.storeId ||
        !result.channelKey ||
        !result.paymentId ||
        !result.orderName ||
        !result.amount ||
        !result.customerName ||
        !result.paymentEmail ||
        !result.paymentPhone ||
        !result.redirectUrl
      ) {
        setErrorTitle(null);
        throw new Error('후원 결제 정보가 올바르지 않습니다.');
      }

      const paymentResult = await PortOne.requestPayment({
        storeId: result.storeId,
        channelKey: result.channelKey,
        paymentId: result.paymentId,
        orderName: result.orderName,
        totalAmount: result.amount,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: {
          fullName: result.customerName,
          email: result.paymentEmail,
          phoneNumber: result.paymentPhone,
        },
        redirectUrl: result.redirectUrl,
        forceRedirect: true,
      });

      if (paymentResult?.code) {
        setErrorTitle(donationTitle);
        throw new Error(paymentResult.message || paymentResult.pgMessage || '결제 창을 열지 못했습니다.');
      }
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
      <Stack gap={2}>
        <TextField
          value={donationAmount}
          onChange={handleDonationAmountChange}
          disabled={isProcessing}
          required
          error={Boolean(amountError)}
          helperText={amountError || '1,000원부터 100,000원까지 1,000원 단위로 입력해주세요.'}
          inputMode="numeric"
          slotProps={{
            htmlInput: { min: 1000, max: 100000, step: 1000 },
            input: {
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            },
          }}
          fullWidth
          size="small"
        />

        {minorControlMode === 'guardian_auth_required' && (
          <p className="alert warning" style={{ marginTop: '8px' }}>
            <span>
              결제 방침에 따라 <strong>법정대리인(부모님)의 본인인증</strong>이 필요합니다.
            </span>
          </p>
        )}
        {isMinor && minorControlMode !== 'guardian_auth_required' && (
          <p className="alert warning" style={{ marginTop: '8px' }}>
            <span>법정대리인 동의 없이 진행된 미성년자의 결제는 취소될 수 있습니다.</span>
          </p>
        )}

        <PaymentTerms type="donation" disabled={isProcessing} />
      </Stack>
    );
  }

  return (
    <>
      <MinorPaymentControl onResolved={handleMinorPaymentControl} onError={setErrorMessage}>
        {({ check, isChecking }) => (
          <button
            type="button"
            className={triggerClassName ?? 'button small action'}
            onClick={check}
            disabled={disabled || isProcessing || isChecking}
          >
            {triggerClassName ? buttonText : <strong>{buttonText}</strong>}
          </button>
        )}
      </MinorPaymentControl>

      <FormErrorDialog
        open={Boolean(errorMessage) && !isDialogOpen}
        title={errorTitle}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => {
          setErrorMessage('');
          setErrorTitle(null);
        }}
      />

      <PaymentEmailDialog
        open={isPaymentEmailDialogOpen}
        onClose={() => setIsPaymentEmailDialogOpen(false)}
        requireEmail={!paymentEmail}
        requirePhone={!paymentPhone}
        onSaved={handlePaymentEmailSaved}
      />

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isDialogOpen}
          onClose={handleCloseDialog}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>{donationTitle}</h2>
          <button type="button" className="close-button" onClick={handleCloseDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{renderDonationForm()}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={handleCloseDialog} disabled={isProcessing}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleDonate()}
              disabled={isProcessing}
            >
              {minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 후원' : '후원'}
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>{donationTitle}</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{renderDonationForm()}</DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={handleCloseDialog} disabled={isProcessing}>
              취소
            </button>
            <button type="button" onClick={() => void handleDonate()} disabled={isProcessing}>
              {minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 후원' : '후원'}
            </button>
          </DialogActions>
        </Dialog>
      )}
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isIdentityDialogOpen}
          onClose={handleCloseIdentityDialog}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>본인인증 필요</h2>
          <button type="button" className="close-button" onClick={handleCloseIdentityDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>

          <div className="VhiDrawer-bottom-content">
            <Stack gap={1}>
              <Typography variant="subtitle2">결제를 하기 위해서는 본인인증을 하셔야 합니다.</Typography>
              <IdentityVerificationButton onVerified={handleIdentityVerified} />
            </Stack>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium submit" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isIdentityDialogOpen}
          onClose={handleCloseIdentityDialog}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>본인인증 필요</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseIdentityDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent dividers>
            <Stack gap={1}>
              <Typography variant="subtitle2">결제를 하기 위해서는 본인인증을 하셔야 합니다.</Typography>
              <IdentityVerificationButton onVerified={handleIdentityVerified} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}
      <FormErrorDialog
        open={Boolean(errorMessage) && isDialogOpen}
        title={errorTitle}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => {
          setErrorMessage('');
          setErrorTitle(null);
        }}
      />
    </>
  );
}
