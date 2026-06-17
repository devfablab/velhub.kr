'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';

type DonationItem = {
  id: string;
  orderNo: string;
  nickname: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  approvedAt: string | null;
  createdAt: string;
};

type DonationManageResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
  };
  summary?: {
    count: number;
    totalAmount: number;
  };
  donations?: DonationItem[];
  error?: string;
};

function formatPrice(price: number | null | undefined) {
  if (typeof price !== 'number') {
    return '-';
  }

  return `${price.toLocaleString('ko-KR')}원`;
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
  const [errorMessage, setErrorMessage] = useState('');
  const [donationData, setDonationData] = useState<DonationManageResponse | null>(null);

  useEffect(() => {
    async function loadDonations() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage/payments/donation?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as DonationManageResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '후원 내역을 불러오지 못했습니다.');
        }

        setDonationData(result);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '후원 내역을 불러오지 못했습니다.');
        } else {
          setErrorMessage('후원 내역을 불러오지 못했습니다.');
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

    void loadDonations();
  }, [siteName]);

  if (isLoading) {
    return (
      <Container pageTitle="받은 후원">
        <LoadingIndicator />
      </Container>
    );
  }

  return (
    <Container pageTitle="받은 후원">
      <Stack spacing={3}>
        {errorMessage ? (
          <Typography role="status" color="error">
            {errorMessage}
          </Typography>
        ) : null}

        <Paper variant="outlined">
          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography variant="h6">후원 요약</Typography>

            <Stack spacing={1}>
              <Typography>받은 후원 수: {donationData?.summary?.count ?? 0}건</Typography>
              <Typography>받은 후원 총액: {formatPrice(donationData?.summary?.totalAmount ?? 0)}</Typography>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined">
          <Stack spacing={2} sx={{ p: 3 }}>
            <Typography variant="h6">후원 내역</Typography>

            {donationData?.donations?.length ? (
              <Stack spacing={2}>
                {donationData.donations.map((donation) => (
                  <Paper key={donation.id} variant="outlined">
                    <Stack spacing={1} sx={{ p: 2 }}>
                      <Typography>후원자: {donation.nickname}</Typography>
                      <Typography>후원금액: {formatPrice(donation.amount)}</Typography>
                      <Typography>후원일: {formatDateTime(donation.approvedAt ?? donation.createdAt)}</Typography>
                      <Typography>주문번호: {donation.orderNo}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <>
                <Divider />
                <Typography>아직 받은 후원이 없습니다.</Typography>
              </>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
