'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type DonationKind = 'site' | 'post';

type DonationItem = {
  id: string;
  orderNo: string;
  donationKind: DonationKind;
  nickname: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  approvedAt: string | null;
  createdAt: string;
  post: {
    id: string;
    subject: string;
    slug: number;
    boardId: string;
    boardKey: string | null;
    boardLabel: string | null;
  } | null;
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
    siteDonationCount: number;
    siteDonationTotalAmount: number;
    postDonationCount: number;
    postDonationTotalAmount: number;
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

function getDonationKindLabel(donationKind: DonationKind) {
  if (donationKind === 'post') {
    return '글 후원';
  }

  return '사이트 후원';
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
      <Container menu="payments">
        <LoadingIndicator />
      </Container>
    );
  }

  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack gap={3}>
            {errorMessage ? (
              <Typography color="error" role="alert">
                {errorMessage}
              </Typography>
            ) : null}

            <div className={`paper ${styles.paper}`}>
              <Stack gap={1}>
                <Typography variant="h6" component="h2">
                  후원 요약
                </Typography>
                <Typography>받은 후원 수: {donationData?.summary?.count ?? 0}건</Typography>
                <Typography>받은 후원 총액: {formatPrice(donationData?.summary?.totalAmount ?? 0)}</Typography>
                <Divider />
                <Typography>
                  사이트 후원: {donationData?.summary?.siteDonationCount ?? 0}건 ·{' '}
                  {formatPrice(donationData?.summary?.siteDonationTotalAmount ?? 0)}
                </Typography>
                <Typography>
                  글 후원: {donationData?.summary?.postDonationCount ?? 0}건 ·{' '}
                  {formatPrice(donationData?.summary?.postDonationTotalAmount ?? 0)}
                </Typography>
              </Stack>
            </div>

            <div className={`paper ${styles.paper}`}>
              <Stack gap={2}>
                <Typography variant="h6" component="h2">
                  후원 내역
                </Typography>

                {donationData?.donations?.length ? (
                  <Stack gap={2} divider={<Divider />}>
                    {donationData.donations.map((donation) => (
                      <Stack key={donation.id} gap={0.5}>
                        <Typography fontWeight={700}>{getDonationKindLabel(donation.donationKind)}</Typography>
                        <Typography>후원자: {donation.nickname}</Typography>
                        <Typography>후원금액: {formatPrice(donation.amount)}</Typography>
                        <Typography>후원일: {formatDateTime(donation.approvedAt ?? donation.createdAt)}</Typography>
                        {donation.post ? (
                          <Typography>
                            후원 글: {donation.post.boardLabel ?? donation.post.boardKey ?? '게시판'} /{' '}
                            {donation.post.subject}
                          </Typography>
                        ) : null}
                        <Typography>주문번호: {donation.orderNo}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary">아직 받은 후원이 없습니다.</Typography>
                )}
              </Stack>
            </div>
          </Stack>
        </div>
      </div>
    </Container>
  );
}
