'use client';

import { ChangeEvent, useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

type DonationTargetType = 'site' | 'post';

type DonationStartResponse = {
  clientKey?: string;
  orderNo?: string;
  orderName?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
  error?: string;
};

type CommonProps = {
  siteName: string;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  onProcessingChange?: (isProcessing: boolean) => void;
};

type SiteDonationProps = CommonProps & {
  targetType?: 'site';
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

type Props = SiteDonationProps | PostDonationProps;

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
  return props.targetType === 'post' ? 'post' : 'site';
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

  return {
    targetType: 'site',
    siteName: props.siteName,
    amount,
    successUrl: getSuccessUrl(props),
    failUrl: getFailUrl(props),
  };
}

export default function DonationButton(props: Props) {
  const { buttonText = '후원하기', className, disabled = false, onProcessingChange } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [donationAmount, setDonationAmount] = useState('1,000');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  function handleDonationAmountChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
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

      const response = await fetch('/api/payments/toss/donation/start', {
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
        setErrorMessage(unknownError.message || '후원을 시작하지 못했습니다.');
      } else {
        setErrorMessage('후원을 시작하지 못했습니다.');
      }

      updateProcessing(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={handleOpenDialog} disabled={disabled || isProcessing}>
        {buttonText}
      </button>

      <Dialog open={isDialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="xs">
        <DialogTitle>{getTargetType(props) === 'post' ? '글 후원하기' : '후원하기'}</DialogTitle>

        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            <Stack gap={0.75}>
              <Typography variant="subtitle2">후원금액</Typography>
              <TextField
                type="text"
                value={donationAmount}
                onChange={handleDonationAmountChange}
                helperText="1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요."
                inputProps={{
                  inputMode: 'numeric',
                  'aria-label': '후원금액',
                }}
                disabled={isProcessing}
                fullWidth
              />
            </Stack>

            {errorMessage ? (
              <Typography role="alert" color="error">
                {errorMessage}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button type="button" onClick={handleCloseDialog} disabled={isProcessing}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleDonate} disabled={isProcessing}>
            후원
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
