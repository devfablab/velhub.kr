'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import {
  IconButton,
  InputAdornment,
  MenuItem,
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
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/manage.module.sass';

type Subscriber = {
  id: string;
  nickname: string;
  status: string;
  activeMonths: number;
  lastPaidAt: string | null;
};

type BoardSubscriptionItem = {
  id: string;
  boardKey: string;
  boardLabel: string;
  canEnableBoardSubscription: boolean;
  subscriptionEnabledSeriesCount: number;
  setting: {
    id: string | null;
    isEnabled: boolean;
    price: number;
    requiredMinPrice: number;
    maxSeriesPrice: number;
  };
  subscribers: Subscriber[];
};

type BoardSubscriptionsResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
    siteType: string;
  };
  boards?: BoardSubscriptionItem[];
  error?: string;
};

type SaveBoardSubscriptionResponse = {
  ok?: boolean;
  settingId?: string;
  requiredMinPrice?: number;
  maxSeriesPrice?: number;
  subscriptionEnabledSeriesCount?: number;
  error?: string;
};

type EditingRow = {
  mode: 'new' | 'edit';
  boardId: string;
  price: string;
} | null;

function formatPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function getPriceNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidPrice(price: number, requiredMinPrice: number) {
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

function formatDateTime(value: string | null) {
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

export default function BoardSubscriptions() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [boards, setBoards] = useState<BoardSubscriptionItem[]>([]);
  const [editingRow, setEditingRow] = useState<EditingRow>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const enabledBoards = boards.filter((board) => board.setting.isEnabled);
  const availableBoards = boards.filter((board) => !board.setting.isEnabled && board.canEnableBoardSubscription);

  async function loadBoardSubscriptions() {
    try {
      setErrorMessage('');
      setSuccessMessage('');

      const response = await fetch(`/api/manage/payments/subscriptions/board?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as BoardSubscriptionsResponse;

      if (!response.ok) {
        if (response.status === 400 && result.error === '게시판 구독은 커뮤니티에서만 사용할 수 있습니다.') {
          setIsAvailable(false);
          return;
        }

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

  useEffect(() => {
    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadBoardSubscriptions();
  }, [siteName]);

  function findBoard(boardId: string) {
    return boards.find((board) => board.id === boardId) ?? null;
  }

  function handleAddRow() {
    const firstAvailableBoard = availableBoards[0] ?? null;

    setEditingRow({
      mode: 'new',
      boardId: firstAvailableBoard?.id ?? '',
      price: formatPrice(firstAvailableBoard?.setting.requiredMinPrice ?? 10000),
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditRow(board: BoardSubscriptionItem) {
    setEditingRow({
      mode: 'edit',
      boardId: board.id,
      price: formatPrice(board.setting.price),
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingBoardChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) {
      return;
    }

    const nextBoardId = event.target.value;
    const nextBoard = findBoard(nextBoardId);

    setEditingRow({
      ...editingRow,
      boardId: nextBoardId,
      price: formatPrice(nextBoard?.setting.requiredMinPrice ?? 10000),
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingPriceChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) {
      return;
    }

    const selectedBoard = findBoard(editingRow.boardId);
    const requiredMinPrice = selectedBoard?.setting.requiredMinPrice ?? 10000;
    const nextPrice = getPriceNumber(event.target.value);

    if (nextPrice > 100000) {
      return;
    }

    if (nextPrice > 0 && nextPrice % 1000 !== 0) {
      return;
    }

    setEditingRow({
      ...editingRow,
      price: nextPrice ? formatPrice(nextPrice) : '',
    });

    if (nextPrice && nextPrice < requiredMinPrice) {
      setErrorMessage(`게시판 구독 금액은 ${formatPrice(requiredMinPrice)}원 이상이어야 합니다.`);
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveBoardSubscription({
    boardId,
    isEnabled,
    price,
  }: {
    boardId: string;
    isEnabled: boolean;
    price: number;
  }) {
    const response = await fetch(`/api/manage/payments/subscriptions/board?siteName=${siteName}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        boardId,
        isEnabled,
        price,
      }),
    });

    const result = (await response.json()) as SaveBoardSubscriptionResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '게시판 구독 설정을 저장하지 못했습니다.');
    }

    return result;
  }

  async function handleSaveEditingRow() {
    if (!editingRow) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const selectedBoard = findBoard(editingRow.boardId);
      const nextPrice = getPriceNumber(editingRow.price);

      if (!editingRow.boardId || !selectedBoard) {
        throw new Error('게시판을 선택해 주세요.');
      }

      if (!selectedBoard.canEnableBoardSubscription) {
        throw new Error('게시판 구독은 구독 설정된 연재가 2개 이상일 때만 사용할 수 있습니다.');
      }

      if (!isValidPrice(nextPrice, selectedBoard.setting.requiredMinPrice)) {
        throw new Error(
          `게시판 구독 금액은 ${formatPrice(selectedBoard.setting.requiredMinPrice)}원부터 100,000원까지 1,000원 단위로 입력해 주세요.`,
        );
      }

      const result = await saveBoardSubscription({
        boardId: editingRow.boardId,
        isEnabled: true,
        price: nextPrice,
      });

      setBoards((currentBoards) =>
        currentBoards.map((board) =>
          board.id === editingRow.boardId
            ? {
                ...board,
                subscriptionEnabledSeriesCount:
                  result.subscriptionEnabledSeriesCount ?? board.subscriptionEnabledSeriesCount,
                setting: {
                  id: result.settingId ?? board.setting.id,
                  isEnabled: true,
                  price: nextPrice,
                  requiredMinPrice: result.requiredMinPrice ?? board.setting.requiredMinPrice,
                  maxSeriesPrice: result.maxSeriesPrice ?? board.setting.maxSeriesPrice,
                },
              }
            : board,
        ),
      );

      setEditingRow(null);
      setSuccessMessage('게시판 구독 설정을 저장했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 구독 설정을 저장하지 못했습니다.');
      } else {
        setErrorMessage('게시판 구독 설정을 저장하지 못했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisableBoardSubscription(board: BoardSubscriptionItem) {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      await saveBoardSubscription({
        boardId: board.id,
        isEnabled: false,
        price: board.setting.price,
      });

      setBoards((currentBoards) =>
        currentBoards.map((currentBoard) =>
          currentBoard.id === board.id
            ? {
                ...currentBoard,
                setting: {
                  ...currentBoard.setting,
                  isEnabled: false,
                },
              }
            : currentBoard,
        ),
      );

      if (editingRow?.boardId === board.id) {
        setEditingRow(null);
      }

      setSuccessMessage('게시판 구독 설정을 해제했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 구독 설정을 해제하지 못했습니다.');
      } else {
        setErrorMessage('게시판 구독 설정을 해제하지 못했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  function renderEditingRow() {
    if (!editingRow) {
      return null;
    }

    const selectedBoard = findBoard(editingRow.boardId);
    const selectableBoards = editingRow.mode === 'edit' && selectedBoard ? [selectedBoard] : availableBoards;

    return (
      <Stack gap={2}>
        <TextField
          select
          value={editingRow.boardId}
          onChange={handleEditingBoardChange}
          disabled={isSaving || editingRow.mode === 'edit'}
          fullWidth
          size="small"
          slotProps={{
            select: {
              displayEmpty: true,
              renderValue: (selected) => {
                const selectedBoardId = typeof selected === 'string' ? selected : '';
                const renderBoard = findBoard(selectedBoardId);

                return renderBoard?.boardLabel ?? '게시판 선택';
              },
            },
          }}
        >
          <MenuItem value="">
            <i style={{ width: 14, height: 14, marginRight: 8 }} />
            게시판 선택
          </MenuItem>
          {selectableBoards.map((board) => (
            <MenuItem key={board.id} value={board.id}>
              {editingRow.boardId === board.id ? (
                <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
              ) : (
                <i style={{ width: 14, height: 14, marginRight: 8 }} />
              )}
              {board.boardLabel}
            </MenuItem>
          ))}
        </TextField>
        {selectedBoard ? (
          <Typography variant="body2" color="text.secondary">
            구독 설정된 연재 {selectedBoard.subscriptionEnabledSeriesCount}개 · 최소 금액{' '}
            {formatPrice(selectedBoard.setting.requiredMinPrice)}원
          </Typography>
        ) : null}
        <TextField
          value={editingRow.price}
          onChange={handleEditingPriceChange}
          fullWidth
          size="small"
          slotProps={{
            input: {
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            },
          }}
        />
        <Stack direction="row" gap={1} justifyContent="flex-end">
          <button
            type="button"
            className="button medium cancel"
            onClick={() => setEditingRow(null)}
            disabled={isSaving}
          >
            취소
          </button>
          <button type="button" className="button medium submit" onClick={handleSaveEditingRow} disabled={isSaving}>
            저장
          </button>
        </Stack>
      </Stack>
    );
  }

  if (!isAvailable) {
    return null;
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

  return (
    <div className={`paper ${styles.paper}`}>
      <Stack gap={2}>
        <Typography variant="subtitle2">게시판 구독</Typography>

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

        {!boards.length ? (
          <p className="alert warning">
            <WarningAmberRoundedIcon />
            <span>구독을 설정할 수 있는 게시판이 없습니다.</span>
          </p>
        ) : null}

        {boards.length && !enabledBoards.length && !editingRow ? (
          <p className="alert warning">
            <WarningAmberRoundedIcon />
            <span>설정된 게시판 구독이 없습니다.</span>
          </p>
        ) : null}

        {enabledBoards.map((board) => {
          const isEditingThisBoard = editingRow?.mode === 'edit' && editingRow.boardId === board.id;

          return (
            <div className={`paper ${styles.paper}`} key={board.id}>
              <Stack gap={2}>
                {isEditingThisBoard ? (
                  renderEditingRow()
                ) : (
                  <Stack gap={1}>
                    <Stack direction="row" gap={1} alignItems="flex-start" justifyContent="space-between">
                      <Stack gap={0.5}>
                        <Typography variant="subtitle2">{board.boardLabel}</Typography>
                        <Typography variant="body2">월 {formatPrice(board.setting.price)} 원</Typography>
                        <Typography variant="body2" color="text.secondary">
                          구독 설정된 연재 {board.subscriptionEnabledSeriesCount}개 (최소 금액{' '}
                          {formatPrice(board.setting.requiredMinPrice)} 원)
                        </Typography>
                      </Stack>
                      <Stack direction="row" gap={1}>
                        <IconButton
                          type="button"
                          aria-label="게시판 구독 수정"
                          onClick={() => handleEditRow(board)}
                          disabled={isSaving || Boolean(editingRow)}
                        >
                          <EditRoundedIcon sx={{ width: 17, height: 17 }} />
                        </IconButton>
                        <IconButton
                          type="button"
                          aria-label="게시판 구독 해제"
                          onClick={() => void handleDisableBoardSubscription(board)}
                          disabled={isSaving}
                        >
                          <RemoveRoundedIcon sx={{ width: 17, height: 17 }} />
                        </IconButton>
                      </Stack>
                    </Stack>

                    {board.subscribers.length ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>구독자</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>유지 기간</TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>최근 결제일</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {board.subscribers.map((subscriber) => (
                              <TableRow key={subscriber.id}>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{subscriber.nickname}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{subscriber.status}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{subscriber.activeMonths}개월째</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                  {formatDateTime(subscriber.lastPaidAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : null}
                  </Stack>
                )}
              </Stack>
            </div>
          );
        })}

        {editingRow?.mode === 'new' ? renderEditingRow() : null}

        {availableBoards.length === 0 ? (
          <p className="alert warning">
            <WarningAmberRoundedIcon />
            <span>구독 설정된 연재가 2개 이상인 게시판이 있어야 게시판 구독 추가가 가능합니다.</span>
          </p>
        ) : null}
        {boards.length ? (
          <button
            type="button"
            className="button small action"
            onClick={handleAddRow}
            disabled={isSaving || Boolean(editingRow) || availableBoards.length === 0}
          >
            <span>게시판 구독 추가</span>
            <AddRoundedIcon />
          </button>
        ) : null}
      </Stack>
    </div>
  );
}
