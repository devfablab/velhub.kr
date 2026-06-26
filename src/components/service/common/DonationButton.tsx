'use client';

import { type ChangeEvent, useState } from 'react';
import PortOne from '@portone/browser-sdk/v2';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import styles from '@/app/board.module.sass';

type DonationTargetType = 'site' | 'series' | 'board' | 'post';

type DonationStartResponse = {
  storeId?: string;
  channelKey?: string;
  orderNo?: string;
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

type BoardDonationProps = CommonProps & {
  targetType: 'board';
  boardName: string;
  successUrl?: string;
  failUrl?: string;
};

type PostDonationProps = CommonProps & {
  targetType: 'post';
  boardName: string;
  contentId: string;
  successUrl?: string;
  failUrl?: string;
};

type Props = SiteDonationProps | BoardDonationProps | PostDonationProps;

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
  if (props.targetType === 'post') {
    return 'post';
  }

  if (props.targetType === 'board') {
    return 'board';
  }

  return 'site';
}

function getDonationTitle(props: Props) {
  const targetType = getTargetType(props);

  if (targetType === 'post') {
    return '포스팅 후원';
  }

  if (targetType === 'board') {
    return '게시판 후원';
  }

  return '블로그 후원';
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

function createRequestBody(props: Props, amount: number) {
  if (props.targetType === 'post') {
    return {
      targetType: 'post',
      siteName: props.siteName,
      boardName: props.boardName,
      contentId: props.contentId,
      amount,
      successUrl: getSuccessUrl(props),
      failUrl: getFailUrl(props),
    };
  }

  if (props.targetType === 'board') {
    return {
      targetType: 'board',
      siteName: props.siteName,
      boardName: props.boardName,
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

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const donationTitle = getDonationTitle(props);

  function updateProcessing(nextIsProcessing: boolean) {
    setIsProcessing(nextIsProcessing);
    onProcessingChange?.(nextIsProcessing);
  }

  function handleOpenDialog() {
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
        throw new Error('후원금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.');
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
        !result.orderNo ||
        !result.orderName ||
        !result.amount ||
        !result.redirectUrl
      ) {
        throw new Error('후원 결제 정보가 올바르지 않습니다.');
      }

      await PortOne.requestPayment({
        storeId: result.storeId,
        channelKey: result.channelKey,
        paymentId: result.orderNo,
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
        className={props.targetType === 'post' ? styles.button : 'button small action'}
        onClick={handleOpenDialog}
        disabled={disabled || isProcessing}
      >
        {props.targetType === 'post' ? <VolunteerActivismOutlinedIcon fontSize="small" /> : null}
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
    </>
  );
}
