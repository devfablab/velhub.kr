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
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';
import Container from '../../menu';

type SeriesSubscriber = {
  id: string;
  nickname: string;
  status: string;
  activeMonths: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  totalPaidAmount: number;
};

type SeriesSubscriptionSetting = {
  id: string | null;
  isEnabled: boolean;
  price: number;
  minPrice: number;
  maxAllowedPrice: number;
  parentPrice: number;
};

type SeriesSubscriptionItem = {
  id: string;
  seriesKey: string;
  seriesLabel: string;
  setting: SeriesSubscriptionSetting;
  subscribers: SeriesSubscriber[];
};

type SeriesBoardItem = {
  id: string;
  boardKey: string;
  boardLabel: string;
  parentPrice: number;
  maxAllowedSeriesPrice: number;
  series: SeriesSubscriptionItem[];
};

type SeriesSubscriptionResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
    siteType: string;
  };
  boards?: SeriesBoardItem[];
  emptyMessage?: string;
  error?: string;
};

type SeriesSubscriptionSaveResponse = {
  ok?: boolean;
  settingId?: string;
  parentPrice?: number;
  maxAllowedPrice?: number;
  error?: string;
};

function formatPrice(value: number) {
  if (!value) {
    return '';
  }

  return value.toLocaleString('ko-KR');
}

function getPriceNumber(value: string) {
  const numberText = value.replace(/[^0-9]/g, '');

  if (!numberText) {
    return 0;
  }

  return Number(numberText);
}

function getMaxSeriesPrice(setting: SeriesSubscriptionSetting) {
  return Math.min(setting.maxAllowedPrice, 100000);
}

function normalizeSeriesSubscriptionItems(boards: SeriesBoardItem[]) {
  return boards.map((board) => ({
    ...board,
    series: board.series.map((series) => {
      const maxPrice = getMaxSeriesPrice(series.setting);
      const normalizedPrice =
        series.setting.price >= series.setting.minPrice && series.setting.price <= maxPrice
          ? series.setting.price
          : series.setting.minPrice;

      return {
        ...series,
        setting: {
          ...series.setting,
          price: normalizedPrice,
        },
      };
    }),
  }));
}

function isValidSeriesSubscriptionPrice(price: number, minPrice: number, maxAllowedPrice: number) {
  if (!Number.isInteger(price)) {
    return false;
  }

  if (price < minPrice) {
    return false;
  }

  if (price > maxAllowedPrice) {
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

export default function SeriesSubscriptions() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [savingSeriesId, setSavingSeriesId] = useState('');
  const [siteType, setSiteType] = useState('');
  const [boards, setBoards] = useState<SeriesBoardItem[]>([]);
  const [emptyMessage, setEmptyMessage] = useState('연재가 설정되지 않았습니다.');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadSeriesSubscriptions() {
      try {
        setErrorMessage('');
        setSuccessMessage('');

        const response = await fetch(`/api/manage/payments/subscriptions/series?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SeriesSubscriptionResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '연재 구독 정보를 불러오지 못했습니다.');
        }

        setSiteType(result.site?.siteType ?? '');

        setBoards(normalizeSeriesSubscriptionItems(result.boards ?? []));
        setEmptyMessage(result.emptyMessage ?? '연재가 설정되지 않았습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '연재 구독 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('연재 구독 정보를 불러오지 못했습니다.');
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

    void loadSeriesSubscriptions();
  }, [siteName]);

  function updateSeriesSetting(seriesId: string, nextSetting: Partial<SeriesSubscriptionSetting>) {
    setBoards((currentBoards) =>
      currentBoards.map((board) => ({
        ...board,
        series: board.series.map((series) => {
          if (series.id !== seriesId) {
            return series;
          }

          return {
            ...series,
            setting: {
              ...series.setting,
              ...nextSetting,
            },
          };
        }),
      })),
    );
  }

  function handleSeriesEnabledChange(seriesId: string, event: ChangeEvent<HTMLInputElement>) {
    updateSeriesSetting(seriesId, {
      isEnabled: event.target.checked,
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleSeriesPriceChange(seriesId: string, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const targetSeries = boards.flatMap((board) => board.series).find((series) => series.id === seriesId);
    const nextPrice = getPriceNumber(event.target.value);

    if (!targetSeries) {
      return;
    }

    if (nextPrice > getMaxSeriesPrice(targetSeries.setting)) {
      return;
    }

    updateSeriesSetting(seriesId, {
      price: nextPrice,
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleSaveSeriesSetting(series: SeriesSubscriptionItem) {
    try {
      setSavingSeriesId(series.id);
      setErrorMessage('');
      setSuccessMessage('');

      if (
        !isValidSeriesSubscriptionPrice(series.setting.price, series.setting.minPrice, series.setting.maxAllowedPrice)
      ) {
        throw new Error(
          `${series.seriesLabel} 구독 금액은 ${series.setting.minPrice.toLocaleString('ko-KR')}원부터 ${getMaxSeriesPrice(series.setting).toLocaleString('ko-KR')}원까지 1,000원 단위로 입력해 주세요.`,
        );
      }

      const response = await fetch(`/api/manage/payments/subscriptions/series?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seriesId: series.id,
          isEnabled: series.setting.isEnabled,
          price: series.setting.price,
        }),
      });

      const result = (await response.json()) as SeriesSubscriptionSaveResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 구독 설정을 저장하지 못했습니다.');
      }

      updateSeriesSetting(series.id, {
        id: result.settingId ?? series.setting.id,
        parentPrice: result.parentPrice ?? series.setting.parentPrice,
        maxAllowedPrice: result.maxAllowedPrice ?? series.setting.maxAllowedPrice,
      });

      setSuccessMessage(`${series.seriesLabel} 구독 설정을 저장했습니다.`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '연재 구독 설정을 저장하지 못했습니다.');
      } else {
        setErrorMessage('연재 구독 설정을 저장하지 못했습니다.');
      }
    } finally {
      setSavingSeriesId('');
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
          <Stack spacing={1}>
            <Typography variant="h6">연재 구독 설정</Typography>
            <Typography variant="body2" color="text.secondary">
              연재 구독 금액은 7,000원부터 100,000원까지 1,000원 단위로 설정할 수 있습니다. 블로그 멤버십 또는 게시판
              구독이 켜져 있으면 7:10 비율을 기준으로 연재 구독 금액의 상한이 제한됩니다.
            </Typography>
          </Stack>
        </Paper>

        {boards.length ? (
          <Stack spacing={3}>
            {boards.map((board) => (
              <Paper key={board.id} sx={{ p: 3 }}>
                <Stack spacing={3}>
                  {siteType === 'community' ? (
                    <>
                      <Stack spacing={1}>
                        <Typography variant="h6">{board.boardLabel}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {board.parentPrice > 0
                            ? `상위 구독 금액은 ${board.parentPrice.toLocaleString('ko-KR')}원입니다. 이 게시판의 연재 구독은 최대 ${board.maxAllowedSeriesPrice.toLocaleString('ko-KR')}원까지 설정할 수 있습니다.`
                            : '상위 구독이 꺼져 있어 연재 구독은 100,000원까지 설정할 수 있습니다.'}
                        </Typography>
                      </Stack>

                      <Divider />
                    </>
                  ) : null}

                  <Stack spacing={3}>
                    {board.series.map((series) => {
                      const maxPrice = getMaxSeriesPrice(series.setting);

                      return (
                        <Paper key={series.id} variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={3}>
                            <Stack spacing={1}>
                              <Typography variant="subtitle1">{series.seriesLabel}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {series.setting.parentPrice > 0
                                  ? `연재 구독 금액은 ${series.setting.minPrice.toLocaleString('ko-KR')}원부터 ${maxPrice.toLocaleString('ko-KR')}원까지 1,000원 단위로 설정할 수 있습니다.`
                                  : `연재 구독 금액은 ${series.setting.minPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 설정할 수 있습니다.`}
                              </Typography>
                            </Stack>

                            <FormControlLabel
                              control={
                                <Switch
                                  checked={series.setting.isEnabled}
                                  onChange={(event) => handleSeriesEnabledChange(series.id, event)}
                                />
                              }
                              label="연재 구독 사용"
                            />

                            <Stack spacing={0.75}>
                              <Typography variant="subtitle2">연재 구독 금액</Typography>
                              <TextField
                                type="text"
                                value={formatPrice(series.setting.price)}
                                onChange={(event) => handleSeriesPriceChange(series.id, event)}
                                helperText={`${series.setting.minPrice.toLocaleString('ko-KR')}원부터 ${maxPrice.toLocaleString('ko-KR')}원까지 1,000원 단위로 입력해 주세요.`}
                                inputProps={{
                                  inputMode: 'numeric',
                                  'aria-label': `${series.seriesLabel} 연재 구독 금액`,
                                }}
                                disabled={savingSeriesId === series.id}
                                fullWidth
                              />
                            </Stack>

                            <div>
                              <Button
                                variant="contained"
                                onClick={() => handleSaveSeriesSetting(series)}
                                disabled={savingSeriesId === series.id}
                              >
                                저장
                              </Button>
                            </div>

                            <Divider />

                            <Stack spacing={2}>
                              <Typography variant="subtitle2">구독자</Typography>

                              {series.subscribers.length ? (
                                <Stack spacing={2}>
                                  {series.subscribers.map((subscriber) => (
                                    <Paper key={subscriber.id} variant="outlined" sx={{ p: 2 }}>
                                      <Stack spacing={1}>
                                        <Typography>닉네임: {subscriber.nickname}</Typography>
                                        <Typography>상태: {subscriber.status}</Typography>
                                        <Typography>유지 기간: {subscriber.activeMonths}개월째</Typography>
                                        <Typography>최근 결제일: {formatDateTime(subscriber.lastPaidAt)}</Typography>
                                        <Typography>
                                          최근 결제금액: {formatAmount(subscriber.lastPaidAmount)}
                                        </Typography>
                                        <Typography>
                                          누적 결제금액: {formatAmount(subscriber.totalPaidAmount)}
                                        </Typography>
                                      </Stack>
                                    </Paper>
                                  ))}
                                </Stack>
                              ) : (
                                <Typography color="text.secondary">아직 이 연재의 구독자가 없습니다.</Typography>
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Typography color="text.secondary">{emptyMessage}</Typography>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
