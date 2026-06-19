'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';

type MembershipMember = {
  id: string;
  nickname: string;
  status: string;
  activeMonths: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  totalPaidAmount: number;
};

type MembershipResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
  };
  setting?: {
    id: string | null;
    isEnabled: boolean;
    price: number;
    requiredMinPrice: number;
    maxSeriesPrice: number;
  };
  members?: MembershipMember[];
  error?: string;
};

type MembershipSaveResponse = {
  ok?: boolean;
  settingId?: string;
  requiredMinPrice?: number;
  maxSeriesPrice?: number;
  error?: string;
};

function formatMembershipPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function getMembershipPriceNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidMembershipPrice(price: number, requiredMinPrice: number) {
  if (!Number.isInteger(price)) {
    return false;
  }

  if (price < requiredMinPrice) {
    return false;
  }

  if (price > 100000) {
    return false;
  }

  return price % 1000 === 0;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatAmount(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '-';
  }

  return `${value.toLocaleString('ko-KR')}원`;
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMembershipEnabled, setIsMembershipEnabled] = useState(false);
  const [membershipPrice, setMembershipPrice] = useState('10,000');
  const [requiredMinPrice, setRequiredMinPrice] = useState(10000);
  const [maxSeriesPrice, setMaxSeriesPrice] = useState(0);
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadMembership() {
      try {
        setErrorMessage('');
        setSuccessMessage('');

        const response = await fetch(`/api/manage/payments/membership?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as MembershipResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '멤버십 정보를 불러오지 못했습니다.');
        }

        const nextRequiredMinPrice = result.setting?.requiredMinPrice ?? 10000;
        const nextPrice = result.setting?.price ?? nextRequiredMinPrice;

        setIsMembershipEnabled(Boolean(result.setting?.isEnabled));
        setRequiredMinPrice(nextRequiredMinPrice);
        setMaxSeriesPrice(result.setting?.maxSeriesPrice ?? 0);
        setMembershipPrice(formatMembershipPrice(Math.max(nextPrice, nextRequiredMinPrice)));
        setMembers(result.members ?? []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '멤버십 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('멤버십 정보를 불러오지 못했습니다.');
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

    void loadMembership();
  }, [siteName]);

  function handleMembershipEnabledChange(event: ChangeEvent<HTMLInputElement>) {
    setIsMembershipEnabled(event.target.checked);
    setSuccessMessage('');
    setErrorMessage('');
  }

  function handleMembershipPriceChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPrice = getMembershipPriceNumber(event.target.value);

    if (nextPrice > 100000) {
      return;
    }

    if (nextPrice % 1000 !== 0) {
      return;
    }

    setMembershipPrice(formatMembershipPrice(nextPrice));
    setSuccessMessage('');
    setErrorMessage('');
  }

  async function handleSaveMembershipSetting() {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const price = getMembershipPriceNumber(membershipPrice);

      if (isMembershipEnabled && !isValidMembershipPrice(price, requiredMinPrice)) {
        throw new Error(
          `멤버십 금액은 ${requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`,
        );
      }

      const response = await fetch(`/api/manage/payments/membership?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: isMembershipEnabled,
          price,
        }),
      });

      const result = (await response.json()) as MembershipSaveResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버십 설정을 저장하지 못했습니다.');
      }

      if (typeof result.requiredMinPrice === 'number') {
        setRequiredMinPrice(result.requiredMinPrice);
      }

      if (typeof result.maxSeriesPrice === 'number') {
        setMaxSeriesPrice(result.maxSeriesPrice);
      }

      setSuccessMessage('멤버십 설정을 저장했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '멤버십 설정을 저장하지 못했습니다.');
      } else {
        setErrorMessage('멤버십 설정을 저장하지 못했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Container>
        <LoadingIndicator />
      </Container>
    );
  }

  return (
    <Container>
      <Stack spacing={3}>
        {errorMessage ? (
          <Typography color="error" role="alert">
            {errorMessage}
          </Typography>
        ) : null}

        {successMessage ? (
          <Typography color="success.main" role="status">
            {successMessage}
          </Typography>
        ) : null}

        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="h6">멤버십 설정</Typography>
              <Typography variant="body2" color="text.secondary">
                멤버십 금액은 {requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 설정할 수
                있습니다.
                {maxSeriesPrice > 0
                  ? ` 현재 연재 구독 최고가는 ${maxSeriesPrice.toLocaleString('ko-KR')}원입니다.`
                  : ''}
              </Typography>
            </Stack>

            <Divider />

            <FormControlLabel
              control={<Switch checked={isMembershipEnabled} onChange={handleMembershipEnabledChange} />}
              label="멤버십 사용"
            />

            <TextField
              label="멤버십 금액"
              value={membershipPrice}
              onChange={handleMembershipPriceChange}
              helperText={`${requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`}
              inputProps={{
                inputMode: 'numeric',
                'aria-label': '멤버십 금액',
              }}
              disabled={isSaving}
              fullWidth
            />

            <div>
              <Button variant="contained" onClick={handleSaveMembershipSetting} disabled={isSaving}>
                저장
              </Button>
            </div>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={3}>
            <Typography variant="h6">멤버십 구독자</Typography>

            {members.length ? (
              <Stack spacing={2}>
                {members.map((member) => (
                  <Paper key={member.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Typography>닉네임: {member.nickname}</Typography>
                      <Typography>상태: {member.status}</Typography>
                      <Typography>유지 기간: {member.activeMonths}개월째</Typography>
                      <Typography>최근 결제일: {formatDateTime(member.lastPaidAt)}</Typography>
                      <Typography>최근 결제금액: {formatAmount(member.lastPaidAmount)}</Typography>
                      <Typography>누적 결제금액: {formatAmount(member.totalPaidAmount)}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">아직 멤버십 구독자가 없습니다.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
