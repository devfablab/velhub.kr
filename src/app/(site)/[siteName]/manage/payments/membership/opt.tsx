'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Divider,
  FormControlLabel,
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
import { normalizeText } from '@/lib/utils';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

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

            {successMessage ? (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>{successMessage}</span>
              </p>
            ) : null}

            <div className={`paper ${styles.paper}`}>
              <Stack gap={3}>
                <Stack gap={1}>
                  <Typography variant="subtitle2">멤버십 설정</Typography>
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>
                      멤버십 금액은 {requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 설정할
                      수 있습니다.
                    </span>
                  </p>
                  {maxSeriesPrice > 0 ? (
                    <p className="alert info">
                      <InfoOutlineRoundedIcon />
                      <span>현재 연재 구독 최고가는 ${maxSeriesPrice.toLocaleString('ko-KR')}원입니다.</span>
                    </p>
                  ) : null}
                </Stack>

                <Divider />

                <FormControlLabel
                  control={
                    <IOSSwitch sx={{ m: 1 }} checked={isMembershipEnabled} onChange={handleMembershipEnabledChange} />
                  }
                  label="멤버십 사용"
                />

                <TextField
                  value={membershipPrice}
                  onChange={handleMembershipPriceChange}
                  helperText={`${requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`}
                  disabled={isSaving}
                  fullWidth
                  size="small"
                />

                <div>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSaveMembershipSetting}
                    disabled={isSaving}
                  >
                    저장
                  </button>
                </div>
              </Stack>
            </div>

            <div className={`paper ${styles.paper}`}>
              <Stack gap={3}>
                <Typography variant="subtitle2">멤버십 구독자</Typography>

                {members.length ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>결제자</TableCell>
                          <TableCell>상태</TableCell>
                          <TableCell>유지기간</TableCell>
                          <TableCell>최근 결제액</TableCell>
                          <TableCell>누적 결제액</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {members.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>{member.nickname}</TableCell>
                            <TableCell>{member.status}</TableCell>
                            <TableCell>{formatDateTime(member.lastPaidAt)}</TableCell>
                            <TableCell>{formatAmount(member.lastPaidAmount)}</TableCell>
                            <TableCell>{formatAmount(member.totalPaidAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>아직 멤버십 구독자가 없습니다.</span>
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
