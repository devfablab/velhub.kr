'use client';

import { useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
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
import PortOne from '@portone/browser-sdk/v2';
import { requestGuardianIdentityVerification } from '@/lib/identity/requestGuardianVerification';
import PopupMessage from '@/components/PopupMessage';
import IdentityVerificationButton from './IdentityVerificationButton';
import MinorPaymentControl, { type MinorPaymentControlResult } from './MinorPaymentControl';
import PaymentEmailDialog from './PaymentEmailDialog';
import PaymentTerms from './PaymentTerms';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';
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
  paymentCustomerRequired?: boolean;
  paymentEmailRequired?: boolean;
  paymentPhoneRequired?: boolean;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
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
  const siteInitialData = useSiteInitialData();
  const identityStatus = siteInitialData?.identityStatus as IdentityStatusResponse | null;
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
  const hasIdentity = Boolean(identityStatus?.exists);
  const isMinor = Boolean(
    identityStatus?.exists && identityStatus.identity && !isAdult(identityStatus.identity.birth_date),
  );
  const isUnder14Age = Boolean(
    identityStatus?.exists && identityStatus.identity && isUnder14(identityStatus.identity.birth_date),
  );
  const [isIdentityDialogOpen, setIsIdentityDialogOpen] = useState(false);
  const [isPaymentCustomerDialogOpen, setIsPaymentCustomerDialogOpen] = useState(false);
  const [needsPaymentEmail, setNeedsPaymentEmail] = useState(true);
  const [needsPaymentPhone, setNeedsPaymentPhone] = useState(true);
  const purchaseAvailable = siteInitialData?.purchaseAvailable ?? false;
  const [minorControlMode, setMinorControlMode] = useState<MinorPaymentControlResult['mode']>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

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

  async function handleMinorPaymentControl(result: MinorPaymentControlResult) {
    setMinorControlMode(result.mode);

    if (result.isBlocked) {
      setErrorMessage('이 계정은 만 19세가 될 때까지 결제 · 구매 · 후원을 이용할 수 없습니다.');
      return;
    }

    if (popup) {
      await handlePurchase();
      return;
    }

    handleOpenConfirm();
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
        if (result.paymentCustomerRequired) {
          updateProcessing(false);
          setIsConfirmOpen(false);
          setNeedsPaymentEmail(Boolean(result.paymentEmailRequired));
          setNeedsPaymentPhone(Boolean(result.paymentPhoneRequired));
          setIsPaymentCustomerDialogOpen(true);
          return;
        }
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
        !result.customerEmail ||
        !result.customerPhone ||
        !result.customerName ||
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
        customer: {
          fullName: result.customerName,
          email: result.customerEmail,
          phoneNumber: result.customerPhone,
        },
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
      </div>
    );
  }

  if (!purchaseAvailable) {
    return;
  }

  if (isUnder14Age) {
    return null;
  }

  const purchaseButtonLabel = minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 소장' : '포스팅 소장';
  const triggerButtonLabel = buttonText ?? purchaseButtonLabel;
  const triggerButtonClassName = buttonClassName ?? styles.button;
  const purchaseQuestion = `포스팅을 ${price.toLocaleString('ko-KR')} 원에 소장하시겠어요?`;

  return (
    <>
      <PaymentEmailDialog
        open={isPaymentCustomerDialogOpen}
        onClose={() => setIsPaymentCustomerDialogOpen(false)}
        requireEmail={needsPaymentEmail}
        requirePhone={needsPaymentPhone}
        onSaved={() => void handlePurchase()}
      />
      <MinorPaymentControl onResolved={handleMinorPaymentControl} onError={setErrorMessage}>
        {({ check, isChecking }) =>
          popup ? (
            <>
              {renderPurchaseConsent()}
              <Stack gap={1.5}>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={check}
                  disabled={disabled || isProcessing || isChecking}
                >
                  {popup || hideButtonIcon ? null : <SellOutlinedIcon />}
                  <strong>{purchaseButtonLabel}</strong>
                </button>
              </Stack>
            </>
          ) : (
            <button
              type="button"
              className={triggerButtonClassName}
              onClick={check}
              disabled={disabled || isProcessing || isChecking}
            >
              {hideButtonIcon ? null : <SellOutlinedIcon />}
              <strong>{triggerButtonLabel}</strong>
            </button>
          )
        }
      </MinorPaymentControl>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isConfirmOpen}
          onClose={handleCloseConfirm}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>포스팅 소장</h2>
          <button type="button" className="close-button" onClick={handleCloseConfirm} disabled={isProcessing}>
            <CloseRoundedIcon />
          </button>

          <div className="VhiDrawer-bottom-content">
            <Stack>
              <Typography variant="body2">{purchaseQuestion}</Typography>
              {renderPurchaseConsent()}
            </Stack>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small cancel" onClick={handleCloseConfirm} disabled={isProcessing}>
              취소
            </button>
            <button
              type="button"
              className="button small submit"
              onClick={() => void handlePurchase()}
              disabled={disabled || isProcessing}
            >
              {minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 결제' : '결제하기'}
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isConfirmOpen}
          onClose={handleCloseConfirm}
          aria-labelledby="post-purchase-dialog-title"
          className="vh-dialog vh-alert-dialog"
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
            <button type="button" className="cancel-button" onClick={handleCloseConfirm} disabled={isProcessing}>
              취소
            </button>
            <button type="button" onClick={() => void handlePurchase()} disabled={disabled || isProcessing}>
              {minorControlMode === 'guardian_auth_required' ? '부모님 인증하고 결제' : '결제하기'}
            </button>
          </DialogActions>
        </Dialog>
      )}

      <PopupMessage
        open={Boolean(errorMessage)}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
        kind="error"
      />
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
            <button type="button" className="button small cancel" onClick={handleCloseIdentityDialog}>
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
            <button type="button" className="cancel-button" onClick={handleCloseIdentityDialog}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
