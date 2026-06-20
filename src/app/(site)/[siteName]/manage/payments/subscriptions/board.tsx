'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import NumberField from '@/components/custom-ui/NumberField';
import { normalizeText } from '@/lib/utils';
import Container from '../../menu';

type BoardSubscriber = {
  id: string;
  nickname: string;
  status: string;
  activeMonths: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  totalPaidAmount: number;
};

type BoardSubscriptionSetting = {
  id: string | null;
  isEnabled: boolean;
  price: number;
  requiredMinPrice: number;
  maxSeriesPrice: number;
};

type BoardSubscriptionItem = {
  id: string;
  boardKey: string;
  boardLabel: string;
  setting: BoardSubscriptionSetting;
  subscribers: BoardSubscriber[];
};

type BoardSubscriptionResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
    siteType: string;
  };
  boards?: BoardSubscriptionItem[];
  error?: string;
};

type BoardSubscriptionSaveResponse = {
  ok?: boolean;
  settingId?: string;
  requiredMinPrice?: number;
  maxSeriesPrice?: number;
  error?: string;
};

function isValidBoardSubscriptionPrice(price: number, requiredMinPrice: number) {
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

export default function BoardSubscriptions() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [savingBoardId, setSavingBoardId] = useState('');
  const [boards, setBoards] = useState<BoardSubscriptionItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadBoardSubscriptions() {
      try {
        setErrorMessage('');
        setSuccessMessage('');

        const response = await fetch(`/api/manage/payments/subscriptions/board?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BoardSubscriptionResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '게시판 구독 정보를 불러오지 못했습니다.');
        }

        setBoards(result.boards ?? []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 구독 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 구독 정보를 불러오지 못했습니다.');
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

    void loadBoardSubscriptions();
  }, [siteName]);

  function updateBoardSetting(boardId: string, nextSetting: Partial<BoardSubscriptionSetting>) {
    setBoards((currentBoards) =>
      currentBoards.map((board) => {
        if (board.id !== boardId) {
          return board;
        }

        return {
          ...board,
          setting: {
            ...board.setting,
            ...nextSetting,
          },
        };
      }),
    );
  }

  function handleBoardEnabledChange(boardId: string, event: ChangeEvent<HTMLInputElement>) {
    updateBoardSetting(boardId, {
      isEnabled: event.target.checked,
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleBoardPriceChange(boardId: string, value: number | null) {
    const nextPrice = value ?? 0;

    if (nextPrice > 100000) {
      return;
    }

    if (nextPrice < 0) {
      return;
    }

    updateBoardSetting(boardId, {
      price: nextPrice,
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleSaveBoardSetting(board: BoardSubscriptionItem) {
    try {
      setSavingBoardId(board.id);
      setErrorMessage('');
      setSuccessMessage('');

      if (
        board.setting.isEnabled &&
        !isValidBoardSubscriptionPrice(board.setting.price, board.setting.requiredMinPrice)
      ) {
        throw new Error(
          `${board.boardLabel} 구독 금액은 ${board.setting.requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`,
        );
      }

      const response = await fetch(`/api/manage/payments/subscriptions/board?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId: board.id,
          isEnabled: board.setting.isEnabled,
          price: board.setting.price,
        }),
      });

      const result = (await response.json()) as BoardSubscriptionSaveResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '게시판 구독 설정을 저장하지 못했습니다.');
      }

      updateBoardSetting(board.id, {
        id: result.settingId ?? board.setting.id,
        requiredMinPrice: result.requiredMinPrice ?? board.setting.requiredMinPrice,
        maxSeriesPrice: result.maxSeriesPrice ?? board.setting.maxSeriesPrice,
      });

      setSuccessMessage(`${board.boardLabel} 구독 설정을 저장했습니다.`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 구독 설정을 저장하지 못했습니다.');
      } else {
        setErrorMessage('게시판 구독 설정을 저장하지 못했습니다.');
      }
    } finally {
      setSavingBoardId('');
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
            <Typography variant="h6">게시판 구독 설정</Typography>
            <Typography variant="body2" color="text.secondary">
              게시판 구독 금액은 10,000원부터 100,000원까지 1,000원 단위로 설정할 수 있습니다. 해당 게시판의 연재 구독
              최고가가 있으면 7:10 비율을 기준으로 최소 금액이 올라갑니다.
            </Typography>
          </Stack>
        </Paper>

        {boards.length ? (
          <Stack spacing={3}>
            {boards.map((board) => {
              const priceFieldId = `board-subscription-price-${board.id}`;
              const helperTextId = `${priceFieldId}-helper-text`;

              return (
                <Paper key={board.id} sx={{ p: 3 }}>
                  <Stack spacing={3}>
                    <Stack spacing={1}>
                      <Typography variant="h6">{board.boardLabel}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {board.setting.maxSeriesPrice > 0
                          ? `현재 이 게시판의 연재 구독 최고가는 ${board.setting.maxSeriesPrice.toLocaleString('ko-KR')}원입니다. 게시판 구독 금액은 최소 ${board.setting.requiredMinPrice.toLocaleString('ko-KR')}원 이상이어야 합니다.`
                          : `게시판 구독 금액은 최소 ${board.setting.requiredMinPrice.toLocaleString('ko-KR')}원 이상이어야 합니다.`}
                      </Typography>
                    </Stack>

                    <Divider />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={board.setting.isEnabled}
                          onChange={(event) => handleBoardEnabledChange(board.id, event)}
                        />
                      }
                      label="게시판 구독 사용"
                    />

                    <Stack spacing={0.75}>
                      <NumberField
                        id={priceFieldId}
                        label="게시판 구독 금액"
                        value={board.setting.price}
                        onValueChange={(value) => handleBoardPriceChange(board.id, value)}
                        min={0}
                        max={100000}
                        step={1000}
                        locale="ko-KR"
                        disabled={savingBoardId === board.id}
                        aria-describedby={helperTextId}
                      />
                      <Typography id={helperTextId} variant="body2" color="text.secondary">
                        {board.setting.requiredMinPrice.toLocaleString('ko-KR')}원부터 100,000원까지 1,000원 단위로
                        입력해 주세요.
                      </Typography>
                    </Stack>

                    <div>
                      <Button
                        variant="contained"
                        onClick={() => handleSaveBoardSetting(board)}
                        disabled={savingBoardId === board.id}
                      >
                        저장
                      </Button>
                    </div>

                    <Divider />

                    <Stack spacing={2}>
                      <Typography variant="subtitle1">구독자</Typography>

                      {board.subscribers.length ? (
                        <Stack spacing={2}>
                          {board.subscribers.map((subscriber) => (
                            <Paper key={subscriber.id} variant="outlined" sx={{ p: 2 }}>
                              <Stack spacing={1}>
                                <Typography>닉네임: {subscriber.nickname}</Typography>
                                <Typography>상태: {subscriber.status}</Typography>
                                <Typography>유지 기간: {subscriber.activeMonths}개월째</Typography>
                                <Typography>최근 결제일: {formatDateTime(subscriber.lastPaidAt)}</Typography>
                                <Typography>최근 결제금액: {formatAmount(subscriber.lastPaidAmount)}</Typography>
                                <Typography>누적 결제금액: {formatAmount(subscriber.totalPaidAmount)}</Typography>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="text.secondary">아직 이 게시판의 구독자가 없습니다.</Typography>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Typography color="text.secondary">구독을 설정할 수 있는 게시판이 없습니다.</Typography>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
