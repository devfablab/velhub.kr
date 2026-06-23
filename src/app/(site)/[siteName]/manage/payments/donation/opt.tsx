'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
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
      <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="결제 관리" pageBack={`/${siteName}/manage`} menu="payments">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack gap={3}>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <div className={`paper ${styles.paper}`}>
              <Stack gap={1}>
                <Typography variant="subtitle2">후원 요약</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>사이트 후원</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>글 후원</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>총 후원</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatPrice(donationData?.summary?.siteDonationTotalAmount ?? 0)} (
                          {donationData?.summary?.siteDonationCount ?? 0}건)
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatPrice(donationData?.summary?.postDonationTotalAmount ?? 0)} (
                          {donationData?.summary?.postDonationCount ?? 0}건)
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatPrice(donationData?.summary?.totalAmount ?? 0)} ({donationData?.summary?.count ?? 0}건)
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </div>

            <div className={`paper ${styles.paper}`}>
              <Stack gap={2}>
                <Typography variant="subtitle2">후원 내역</Typography>

                {donationData?.donations?.length ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>후원 종류</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>후원자</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>후원일</TableCell>
                          <TableCell sx={{ textAlign: 'right' }}>후원금액</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {donationData.donations.map((donation) => (
                          <TableRow key={donation.id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {donation.post ? (
                                <Tooltip
                                  title={`${donation.post.boardLabel ?? donation.post.boardKey ?? '게시판'} / ${donation.post.subject}`}
                                >
                                  <button type="button" className={styles.tooltip}>
                                    {getDonationKindLabel(donation.donationKind)}
                                  </button>
                                </Tooltip>
                              ) : (
                                getDonationKindLabel(donation.donationKind)
                              )}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{donation.nickname}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {formatDateTime(donation.approvedAt ?? donation.createdAt)}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                              {formatPrice(donation.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>아직 받은 후원이 없습니다.</span>
                  </p>
                )}
              </Stack>
            </div>
          </Stack>
        </div>
      </div>
    </Container>
  );
}
