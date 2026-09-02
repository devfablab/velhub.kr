'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Divider,
  FormControlLabel,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { formatCurrencyInput, parseCurrencyInput } from '@/lib/payments/currencyInput';
import { normalizeText } from '@/lib/utils';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/manage.module.sass';

type BlogSubscriptionMember = {
  id: string;
  nickname: string;
  status: string;
  activeMonths: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  totalPaidAmount: number;
};

type BlogSubscriptionResponse = {
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
  members?: BlogSubscriptionMember[];
  ownerStatus?: {
    isOwner: boolean;
    isCreator: boolean;
    status: string | null;
  };
  error?: string;
};

import SettlementForm from '@/components/service/common/SettlementForm';
import { ServiceErrorIcon } from '@/components/Svgs';

type BlogSubscriptionSaveResponse = {
  ok?: boolean;
  settingId?: string;
  requiredMinPrice?: number;
  maxSeriesPrice?: number;
  error?: string;
};

function isValidBlogSubscriptionPrice(price: number, requiredMinPrice: number) {
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
  const [isBlogSubscriptionEnabled, setIsBlogSubscriptionEnabled] = useState(false);
  const [blogSubscriptionPrice, setBlogSubscriptionPrice] = useState('10,000');
  const [requiredMinPrice, setRequiredMinPrice] = useState(10000);
  const [maxSeriesPrice, setMaxSeriesPrice] = useState(0);
  const [members, setMembers] = useState<BlogSubscriptionMember[]>([]);
  const [blogSubscriptionData, setBlogSubscriptionData] = useState<BlogSubscriptionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadBlogSubscription() {
      try {
        setErrorMessage('');
        setSuccessMessage('');

        const response = await fetch(`/api/manage/payments/subscriptions/site?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BlogSubscriptionResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '블로그 구독 정보를 불러오지 못했습니다.');
        }

        const nextRequiredMinPrice = result.setting?.requiredMinPrice ?? 10000;
        const nextPrice = result.setting?.price ?? nextRequiredMinPrice;

        setIsBlogSubscriptionEnabled(Boolean(result.setting?.isEnabled));
        setRequiredMinPrice(nextRequiredMinPrice);
        setMaxSeriesPrice(result.setting?.maxSeriesPrice ?? 0);
        setBlogSubscriptionPrice(formatCurrencyInput(Math.max(nextPrice, nextRequiredMinPrice)));
        setMembers(result.members ?? []);
        setBlogSubscriptionData(result);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '블로그 구독 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('블로그 구독 정보를 불러오지 못했습니다.');
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

    void loadBlogSubscription();
  }, [siteName]);

  function handleBlogSubscriptionEnabledChange(event: ChangeEvent<HTMLInputElement>) {
    setIsBlogSubscriptionEnabled(event.target.checked);
    setSuccessMessage('');
    setErrorMessage('');
  }

  function handleBlogSubscriptionPriceChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPrice = parseCurrencyInput(event.target.value);

    if (nextPrice > 100000) {
      return;
    }

    setBlogSubscriptionPrice(formatCurrencyInput(nextPrice));
    setSuccessMessage('');
    setErrorMessage('');
  }

  async function handleSaveBlogSubscriptionSetting() {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const price = parseCurrencyInput(blogSubscriptionPrice);

      if (isBlogSubscriptionEnabled && !isValidBlogSubscriptionPrice(price, requiredMinPrice)) {
        throw new Error(
          `블로그 구독료는 ${requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`,
        );
      }

      const response = await fetch(`/api/manage/payments/subscriptions/site?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: isBlogSubscriptionEnabled,
          price,
        }),
      });

      const result = (await response.json()) as BlogSubscriptionSaveResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 구독 설정을 저장하지 못했습니다.');
      }

      if (typeof result.requiredMinPrice === 'number') {
        setRequiredMinPrice(result.requiredMinPrice);
      }

      if (typeof result.maxSeriesPrice === 'number') {
        setMaxSeriesPrice(result.maxSeriesPrice);
      }

      setSuccessMessage('블로그 구독 설정을 저장했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '블로그 구독 설정을 저장하지 못했습니다.');
      } else {
        setErrorMessage('블로그 구독 설정을 저장하지 못했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className={`paper ${styles.paper}`}>
        <div className="loading-container">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  if (errorMessage === '블로그 구독은 블로그에서만 사용할 수 있습니다.') {
    return (
      <div className="paper page-error">
        <ServiceErrorIcon />
        <p>{errorMessage}</p>
      </div>
    );
  }

  if (blogSubscriptionData?.ownerStatus && !blogSubscriptionData.ownerStatus.isCreator) {
    return (
      <Stack gap={3}>
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>운영자는 작가가 아니기 때문에 수익을 낼 수 없습니다.</span>
        </p>
      </Stack>
    );
  }

  if (blogSubscriptionData?.ownerStatus && blogSubscriptionData.ownerStatus.status !== 'approved') {
    return (
      <Stack gap={3}>
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>운영자 계정의 정산정보에 문제가 있습니다.</span>
        </p>
        {blogSubscriptionData.ownerStatus.isOwner && (
          <div className={`paper ${styles.paper}`}>
            <SettlementForm />
          </div>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={3}>
      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {successMessage ? (
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>{successMessage}</span>
        </p>
      ) : null}

      <div className={`paper ${styles.paper}`}>
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="subtitle2">블로그 구독</Typography>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>
                블로그 구독료는 {requiredMinPrice.toLocaleString('ko-KR')} 원부터 100,000 원까지 1,000 원 단위로 설정할
                수 있습니다.
              </span>
            </p>
            {maxSeriesPrice > 0 ? (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>현재 연재 구독 최고가는 {maxSeriesPrice.toLocaleString('ko-KR')} 원입니다.</span>
              </p>
            ) : null}
          </Stack>

          <Divider />

          <FormControlLabel
            control={
              <IOSSwitch
                sx={{ m: 1 }}
                checked={isBlogSubscriptionEnabled}
                onChange={handleBlogSubscriptionEnabledChange}
              />
            }
            label="블로그 구독 사용"
          />

          <TextField
            value={blogSubscriptionPrice}
            onChange={handleBlogSubscriptionPriceChange}
            inputMode="numeric"
            helperText={`${requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`}
            disabled={isSaving}
            fullWidth
            size="small"
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">원</InputAdornment>,
              },
            }}
          />

          <div>
            <button
              type="button"
              className="button medium submit"
              onClick={handleSaveBlogSubscriptionSetting}
              disabled={isSaving}
            >
              저장
            </button>
          </div>
        </Stack>
      </div>

      <div className={`paper ${styles.paper}`}>
        <Stack gap={3}>
          <Typography variant="subtitle2">블로그 구독자</Typography>

          {members.length ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>결제자</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>유지기간</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>최근 결제액</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>누적 결제액</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{member.nickname}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{member.status}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(member.lastPaidAt)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {formatAmount(member.lastPaidAmount)}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {formatAmount(member.totalPaidAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>아직 블로그 구독자가 없습니다.</span>
            </p>
          )}
        </Stack>
      </div>
    </Stack>
  );
}
