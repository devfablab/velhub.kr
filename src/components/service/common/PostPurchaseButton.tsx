'use client';

import { useEffect, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PortOne from '@portone/browser-sdk/v2';
import { requestGuardianIdentityVerification } from '@/lib/identity/requestGuardianVerification';
import { useMinorPaymentControl } from '@/lib/payments/useMinorPaymentControl';
import IdentityVerificationButton from './IdentityVerificationButton';
import PaymentTerms from './PaymentTerms';
import styles from '@/app/board.module.sass';

type PostPurchaseStartResponse = {
  ok?: boolean;
  alreadyPurchased?: boolean;
  storeId?: string;
  channelKey?: string;
  paymentId?: string;
  orderNo?: string;
  orderName?: string;
  amount?: number;
  redirectUrl?: string;
  failUrl?: string;
  error?: string;
  guardianAuthRequired?: boolean;
};

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  price: number;
  buttonText?: string;
  buttonClassName?: string;
  hideButtonIcon?: boolean;
  popup?: boolean;
  disabled?: boolean;
  redirectUrl?: string;
  failUrl?: string;
  successUrl?: string;
  onProcessingChange?: (isProcessing: boolean) => void;
};

type IdentityStatusResponse = {
  exists: boolean;
  identity: {
    purchase_available?: boolean;
    birth_date: string;
  } | null;
  error?: string;
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

function getSuccessUrl({ siteName, boardName, contentId, successUrl }: Props) {
  if (successUrl) {
    return successUrl;
  }

  return `/${siteName}/${boardName}/${contentId}/purchase/success`;
}

function getFailUrl({ siteName, boardName, contentId, failUrl }: Props) {
  if (failUrl) {
    return failUrl;
  }

  return `/${siteName}/${boardName}/${contentId}/purchase/fail`;
}

export default function PostPurchaseButton(props: Props) {
  const { mode: minorControlMode, isBlocked, isLoaded: isMinorControlLoaded } = useMinorPaymentControl();
  const {
    siteName,
    boardName,
    contentId,
    price,
    buttonText,
    buttonClassName,
    hideButtonIcon = false,
    popup,
    disabled = false,
    onProcessingChange,
  } = props;

  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [isUnder14Age, setIsUnder14Age] = useState(false);
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [purchaseAvailable, setPurchaseAvailable] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  useEffect(() => {
    let ignore = false;

    async function checkOwnerAge() {
      try {
        const response = await fetch(`/api/site/public?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SitePublicResponse;

        if (!ignore) {
          setPurchaseAvailable(Boolean(response.ok && result.siteInfo?.purchase_available));
        }
      } catch {
        if (!ignore) {
          setPurchaseAvailable(false);
        }
      }
    }

    async function checkIdentity() {
      try {
        const response = await fetch('/api/identity/portone/status', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as IdentityStatusResponse;

        if (!ignore) {
          setHasIdentity(response.ok && Boolean(result.exists));
          setIsMinor(response.ok && result.exists && result.identity ? !isAdult(result.identity.birth_date) : false);
          setIsUnder14Age(
            response.ok && result.exists && result.identity ? isUnder14(result.identity.birth_date) : false,
          );
          setIsReady(true);
        }
      } catch {
        if (!ignore) {
          setIsReady(true);
        }
      }
    }

    void checkOwnerAge();
    void checkIdentity();

    return () => {
      ignore = true;
    };
  }, [siteName]);

  if (!isReady) {
    return null;
  }

  function updateProcessing(nextIsProcessing: boolean) {
    setIsProcessing(nextIsProcessing);
    onProcessingChange?.(nextIsProcessing);
  }

  function handleOpenConfirm() {
    if (!hasIdentity) {
      setIsIdentityDialogOpen(true);
      return;
    }
    setErrorMessage('');
    setIsConfirmOpen(true);
  }

  function handleCloseConfirm() {
    if (isProcessing) {
      return;
    }

    setIsConfirmOpen(false);
  }

  function handleCloseIdentityDialog() {
    setIsIdentityDialogOpen(false);
  }

  function handleIdentityVerified() {
    handleCloseIdentityDialog();
    window.requestAnimationFrame(() => window.location.reload());
  }

  async function handlePurchase(guardianIdentityVerificationId?: string) {
    try {
      setErrorMessage('');

      updateProcessing(true);

      const response = await fetch('/api/payments/portone/purchase/start', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          boardName,
          contentId,
          successUrl: getSuccessUrl(props),
          failUrl: getFailUrl(props),
          guardianIdentityVerificationId,
        }),
      });

      const result = (await response.json()) as PostPurchaseStartResponse;

      if (!response.ok) {
        if (result.guardianAuthRequired && !guardianIdentityVerificationId) {
          updateProcessing(false);
          await handlePurchase(await requestGuardianIdentityVerification());
          return;
        }
        throw new Error(result.error ?? '포스팅 구매를 시작하지 못했습니다.');
      }

      if (result.alreadyPurchased) {
        window.location.reload();
        return;
      }

      if (
        !result.storeId ||
        !result.channelKey ||
        !result.paymentId ||
        !result.orderName ||
        !result.amount ||
        !result.redirectUrl
      ) {
        throw new Error('포스팅 구매 결제 정보가 올바르지 않습니다.');
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
        setErrorMessage(unknownError.message || '포스팅 구매를 시작하지 못했습니다.');
      } else {
        setErrorMessage('포스팅 구매를 시작하지 못했습니다.');
      }

      updateProcessing(false);
    }
  }

  function renderPurchaseConsent() {
    return (
      <div style={{ marginTop: 20 }}>
        <PaymentTerms type="purchase" disabled={isProcessing} />
        {minorControlMode === 'guardian_auth_required' && (
          <p className="alert warning" style={{ marginTop: '8px' }}>
            <span>결제 방침에 따라 <strong>법정대리인(부모님)의 본인인증</strong>이 필요합니다.</span>
          </p>
        )}
        {isMinor && minorControlMode !== 'guardian_auth_required' && (
          <p className="alert warning" style={{ marginTop: '8px' }}>
            <span>법정대리인 동의 없이 진행된 미성년자의 결제는 취소될 수 있습니다.</span>
          </p>
        )}
      </div>
    );
  }

  if (!purchaseAvailable) {
    return;
  }

  if (!isMinorControlLoaded || isUnder14Age || isBlocked) {
    return null;
  }

  const purchaseButtonLabel = minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 소장' : '포스팅 소장';
  const triggerButtonLabel = buttonText ?? purchaseButtonLabel;
  const triggerButtonClassName = buttonClassName ?? styles.button;
  const purchaseQuestion = `포스팅을 ${price.toLocaleString('ko-KR')} 원에 소장하시겠어요?`;

  return (
    <>
      {popup ? (
        <>
          {renderPurchaseConsent()}
          <Stack gap={1.5}>
            <button
              type="button"
              className={popup ? 'button medium submit' : styles.button}
              onClick={() => void handlePurchase()}
              disabled={disabled || isProcessing}
            >
              {popup || hideButtonIcon ? null : <SellOutlinedIcon />}
              <strong>{purchaseButtonLabel}</strong>
            </button>
          </Stack>
        </>
      ) : (
        <button
          type="button"
          className={popup ? 'button medium submit' : triggerButtonClassName}
          onClick={handleOpenConfirm}
          disabled={disabled || isProcessing}
        >
          {hideButtonIcon ? null : <SellOutlinedIcon />}
          <strong>{triggerButtonLabel}</strong>
        </button>
      )}

      {isMobile ? (
        <Drawer anchor="bottom" open={isConfirmOpen} onClose={handleCloseConfirm} className="VhiDrawer-bottom">
          <h2>포스팅 소장</h2>
          <button type="button" className="close-button" onClick={handleCloseConfirm} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>

          <Stack gap={3}>
            <Stack>
              <Typography variant="body2">{purchaseQuestion}</Typography>
              {renderPurchaseConsent()}
            </Stack>

            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleCloseConfirm}
                disabled={isProcessing}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void handlePurchase()}
                disabled={disabled || isProcessing}
              >{minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 결제' : '결제하기'}</button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isConfirmOpen}
          onClose={handleCloseConfirm}
          aria-labelledby="post-purchase-dialog-title"
          className="VhiDialog"
        >
          <DialogTitle id="post-purchase-dialog-title">포스팅 소장</DialogTitle>
          <button type="button" className="close-button" onClick={handleCloseConfirm} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>

          <DialogContent>
            <Stack>
              <Typography variant="body2">{purchaseQuestion}</Typography>
              {renderPurchaseConsent()}
            </Stack>
          </DialogContent>

          <DialogActions>
            <button type="button" className="button medium close" onClick={handleCloseConfirm} disabled={isProcessing}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handlePurchase()}
              disabled={disabled || isProcessing}
            >{minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 결제' : '결제하기'}</button>
          </DialogActions>
        </Dialog>
      )}

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
            <button type="button" className="button medium cancel" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isIdentityDialogOpen} onClose={handleCloseIdentityDialog} fullWidth maxWidth="xs" className="VhiDialog">
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
            <button type="button" className="button medium close" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
