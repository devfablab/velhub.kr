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
  status: '유지 중' | '중단';
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
  };
  members?: MembershipMember[];
  error?: string;
};

type MembershipSaveResponse = {
  ok?: boolean;
  settingId?: string;
  error?: string;
};

function formatMembershipPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number') return '-';

  return `${value.toLocaleString('ko-KR')}원`;
}

function getMembershipPriceNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidMembershipPrice(price: number) {
  if (!Number.isInteger(price)) {
    return false;
  }

  if (price < 1000) {
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

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMembershipEnabled, setIsMembershipEnabled] = useState(false);
  const [membershipPrice, setMembershipPrice] = useState('1,000');
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

        setIsMembershipEnabled(Boolean(result.setting?.isEnabled));
        setMembershipPrice(formatMembershipPrice(result.setting?.price ?? 1000));
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

    if (!isValidMembershipPrice(nextPrice)) {
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

      if (!isValidMembershipPrice(price)) {
        throw new Error('멤버십 금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.');
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
      <Container pageTitle="블로그 멤버십">
        <LoadingIndicator />
      </Container>
    );
  }

  return (
    <Container pageTitle="블로그 멤버십">
      <Stack spacing={3}>
        {errorMessage ? (
          <Typography role="status" color="error">
            {errorMessage}
          </Typography>
        ) : null}

        {successMessage ? (
          <Typography role="status" color="primary">
            {successMessage}
          </Typography>
        ) : null}

        <Paper variant="outlined">
          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography variant="h6">멤버십 설정</Typography>

            <FormControlLabel
              control={
                <Switch checked={isMembershipEnabled} onChange={handleMembershipEnabledChange} disabled={isSaving} />
              }
              label="멤버십 사용"
            />

            <TextField
              value={membershipPrice}
              onChange={handleMembershipPriceChange}
              fullWidth
              margin="normal"
              placeholder="월 멤버십 금액"
              inputProps={{
                inputMode: 'numeric',
              }}
              helperText="최소 1,000원, 최대 100,000원까지 1,000원 단위로 입력할 수 있습니다."
              disabled={isSaving}
            />

            <div>
              <Button type="button" variant="contained" onClick={handleSaveMembershipSetting} disabled={isSaving}>
                저장
              </Button>
            </div>
          </Stack>
        </Paper>

        <Paper variant="outlined">
          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography variant="h6">멤버십 구독자</Typography>

            {members.length ? (
              <Stack spacing={2}>
                {members.map((member) => (
                  <Paper key={member.id} variant="outlined">
                    <Stack spacing={1} sx={{ p: 2 }}>
                      <Typography>닉네임: {member.nickname}</Typography>
                      <Typography>상태: {member.status}</Typography>
                      <Typography>유지 기간: {member.activeMonths}개월째</Typography>
                      <Typography>최근 결제일: {formatDateTime(member.lastPaidAt)}</Typography>
                      <Typography>최근 결제금액: {formatPrice(member.lastPaidAmount)}</Typography>
                      <Typography>총 결제금액: {formatPrice(member.totalPaidAmount)}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <>
                <Divider />
                <Typography>아직 멤버십 구독자가 없습니다.</Typography>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
