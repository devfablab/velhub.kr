'use client';

import { useState } from 'react';
import PortOne from '@portone/browser-sdk/v2';
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
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
};

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
  buttonText?: string;
  popup?: boolean;
  disabled?: boolean;
  redirectUrl?: string;
  failUrl?: string;
  onProcessingChange?: (isProcessing: boolean) => void;
};

const PURCHASE_CONSENT_TEXT =
  '결제 즉시 디지털 콘텐츠 제공이 시작되며, 이에 따라 청약철회가 제한될 수 있음에 동의합니다.';

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
  const { siteName, boardName, contentId, popup, disabled = false, onProcessingChange } = props;

  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPurchaseConsentChecked, setIsPurchaseConsentChecked] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  function updateProcessing(nextIsProcessing: boolean) {
    setIsProcessing(nextIsProcessing);
    onProcessingChange?.(nextIsProcessing);
  }

  function handleOpenConfirm() {
    setErrorMessage('');
    setIsPurchaseConsentChecked(false);
    setIsConfirmOpen(true);
  }

  function handleCloseConfirm() {
    if (isProcessing) {
      return;
    }

    setIsConfirmOpen(false);
  }

  async function handlePurchase() {
    try {
      setErrorMessage('');

      if (!isPurchaseConsentChecked) {
        setErrorMessage('디지털 콘텐츠 제공 및 청약철회 제한에 동의해 주세요.');
        return;
      }

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
        }),
      });

      const result = (await response.json()) as PostPurchaseStartResponse;

      if (!response.ok) {
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
      <Stack direction="row">
        <Checkbox
          checked={isPurchaseConsentChecked}
          onChange={(event) => setIsPurchaseConsentChecked(event.target.checked)}
          disabled={isProcessing}
          size="small"
          id="Purchase"
        />
        <label htmlFor="Purchase" style={{ marginTop: 20, fontSize: 14 }}>
          {PURCHASE_CONSENT_TEXT}
        </label>
        ;
      </Stack>
    );
  }

  return (
    <>
      {popup ? (
        <Stack gap={2}>
          {renderPurchaseConsent()}

          <button
            type="button"
            className={popup ? 'button medium submit' : styles.button}
            onClick={handlePurchase}
            disabled={disabled || isProcessing || !isPurchaseConsentChecked}
          >
            {popup ? null : <SellOutlinedIcon />}
            <strong>포스팅 소장</strong>
          </button>
        </Stack>
      ) : (
        <button
          type="button"
          className={popup ? 'button medium submit' : styles.button}
          onClick={handleOpenConfirm}
          disabled={disabled || isProcessing}
        >
          {popup ? null : <SellOutlinedIcon />}
          <strong>포스팅 소장</strong>
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
              <Typography variant="body2">포스팅을 소장하시겠어요?</Typography>
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
                onClick={handlePurchase}
                disabled={disabled || isProcessing || !isPurchaseConsentChecked}
              >
                결제하기
              </button>
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
              <Typography variant="body2">포스팅을 소장하시겠어요?</Typography>
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
              onClick={handlePurchase}
              disabled={disabled || isProcessing || !isPurchaseConsentChecked}
            >
              결제하기
            </button>
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
    </>
  );
}
