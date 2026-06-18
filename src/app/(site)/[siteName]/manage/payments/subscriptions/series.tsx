'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';

type Subscriber = {
  id: string;
  nickname: string;
  status: string;
  activeMonths: number;
  lastPaidAt: string | null;
  lastPaidAmount: number | null;
  totalPaidAmount: number;
};

type SeriesSubscriptionItem = {
  id: string;
  seriesKey: string;
  seriesLabel: string;
  setting: {
    id: string | null;
    isEnabled: boolean;
    price: number;
  };
  subscribers: Subscriber[];
};

type BoardSeriesGroup = {
  id: string;
  boardKey: string;
  boardLabel: string;
  series: SeriesSubscriptionItem[];
};

type SeriesSubscriptionsResponse = {
  site?: {
    id: string;
    siteKey: string;
    siteLabel: string | null;
    siteType: string;
  };
  boards?: BoardSeriesGroup[];
  emptyMessage?: string;
  error?: string;
};

type SaveSeriesSubscriptionResponse = {
  ok?: boolean;
  settingId?: string;
  error?: string;
};

type EditingRow = {
  mode: 'new' | 'edit';
  boardId: string;
  seriesId: string;
  price: string;
} | null;

type SeriesRow = {
  board: BoardSeriesGroup;
  series: SeriesSubscriptionItem;
};

function formatPrice(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatPaymentAmount(value: number | null | undefined) {
  if (typeof value !== 'number') return '-';

  return `${value.toLocaleString('ko-KR')}원`;
}

function getPriceNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidPrice(price: number) {
  if (!Number.isInteger(price)) return false;
  if (price < 1000) return false;
  if (price > 100000) return false;

  return price % 1000 === 0;
}

function formatDateTime(value: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getEnabledSeriesRows(boards: BoardSeriesGroup[]) {
  const rows: SeriesRow[] = [];

  for (const board of boards) {
    for (const series of board.series) {
      if (series.setting.isEnabled) {
        rows.push({ board, series });
      }
    }
  }

  return rows;
}

function getAvailableSeriesRows(boards: BoardSeriesGroup[]) {
  const rows: SeriesRow[] = [];

  for (const board of boards) {
    for (const series of board.series) {
      if (!series.setting.isEnabled) {
        rows.push({ board, series });
      }
    }
  }

  return rows;
}

export default function SeriesSubscriptions() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [siteType, setSiteType] = useState('');
  const [boards, setBoards] = useState<BoardSeriesGroup[]>([]);
  const [emptyMessage, setEmptyMessage] = useState('');
  const [editingRow, setEditingRow] = useState<EditingRow>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const enabledSeriesRows = getEnabledSeriesRows(boards);
  const availableSeriesRows = getAvailableSeriesRows(boards);

  async function loadSeriesSubscriptions() {
    try {
      setErrorMessage('');
      setSuccessMessage('');

      const response = await fetch(`/api/manage/payments/subscriptions/series?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as SeriesSubscriptionsResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 구독 정보를 불러오지 못했습니다.');
      }

      setSiteType(result.site?.siteType ?? '');
      setBoards(result.boards ?? []);
      setEmptyMessage(result.emptyMessage ?? '');
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

  useEffect(() => {
    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadSeriesSubscriptions();
  }, [siteName]);

  function findBoard(boardId: string) {
    return boards.find((board) => board.id === boardId) ?? null;
  }

  function getAvailableBoardsForNewRow() {
    return boards.filter((board) => board.series.some((series) => !series.setting.isEnabled));
  }

  function getAvailableSeriesForBoard(boardId: string) {
    const board = findBoard(boardId);

    if (!board) return [];

    if (editingRow?.mode === 'edit') {
      return board.series.filter((series) => series.id === editingRow.seriesId);
    }

    return board.series.filter((series) => !series.setting.isEnabled);
  }

  function handleAddRow() {
    const firstAvailableRow = availableSeriesRows[0] ?? null;

    setEditingRow({
      mode: 'new',
      boardId: siteType === 'blog' ? (firstAvailableRow?.board.id ?? '') : '',
      seriesId: '',
      price: '1,000',
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditRow(row: SeriesRow) {
    setEditingRow({
      mode: 'edit',
      boardId: row.board.id,
      seriesId: row.series.id,
      price: formatPrice(row.series.setting.price),
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingBoardChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) return;

    setEditingRow({
      ...editingRow,
      boardId: event.target.value,
      seriesId: '',
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingSeriesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) return;

    setEditingRow({
      ...editingRow,
      seriesId: event.target.value,
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingPriceChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) return;

    const nextPrice = getPriceNumber(event.target.value);

    if (!isValidPrice(nextPrice)) return;

    setEditingRow({
      ...editingRow,
      price: formatPrice(nextPrice),
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function saveSeriesSubscription({
    seriesId,
    isEnabled,
    price,
  }: {
    seriesId: string;
    isEnabled: boolean;
    price: number;
  }) {
    const response = await fetch(`/api/manage/payments/subscriptions/series?siteName=${siteName}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seriesId,
        isEnabled,
        price,
      }),
    });

    const result = (await response.json()) as SaveSeriesSubscriptionResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '연재 구독 설정을 저장하지 못했습니다.');
    }

    return result;
  }

  async function handleSaveEditingRow() {
    if (!editingRow) return;

    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const nextPrice = getPriceNumber(editingRow.price);

      if (!editingRow.boardId) {
        throw new Error('게시판을 선택해 주세요.');
      }

      if (!editingRow.seriesId) {
        throw new Error('연재를 선택해 주세요.');
      }

      if (!isValidPrice(nextPrice)) {
        throw new Error('구독 금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.');
      }

      const result = await saveSeriesSubscription({
        seriesId: editingRow.seriesId,
        isEnabled: true,
        price: nextPrice,
      });

      setBoards((currentBoards) =>
        currentBoards.map((board) => ({
          ...board,
          series: board.series.map((series) =>
            series.id === editingRow.seriesId
              ? {
                  ...series,
                  setting: {
                    id: result.settingId ?? series.setting.id,
                    isEnabled: true,
                    price: nextPrice,
                  },
                }
              : series,
          ),
        })),
      );
      setEditingRow(null);
      setSuccessMessage('연재 구독 설정을 저장했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '연재 구독 설정을 저장하지 못했습니다.');
      } else {
        setErrorMessage('연재 구독 설정을 저장하지 못했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisableSeriesSubscription(row: SeriesRow) {
    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      await saveSeriesSubscription({
        seriesId: row.series.id,
        isEnabled: false,
        price: row.series.setting.price,
      });

      setBoards((currentBoards) =>
        currentBoards.map((board) => ({
          ...board,
          series: board.series.map((series) =>
            series.id === row.series.id
              ? {
                  ...series,
                  setting: {
                    ...series.setting,
                    isEnabled: false,
                  },
                }
              : series,
          ),
        })),
      );

      if (editingRow?.seriesId === row.series.id) {
        setEditingRow(null);
      }

      setSuccessMessage('연재 구독 설정을 해제했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '연재 구독 설정을 해제하지 못했습니다.');
      } else {
        setErrorMessage('연재 구독 설정을 해제하지 못했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  function renderEditingRow() {
    if (!editingRow) return null;

    const availableBoards = getAvailableBoardsForNewRow();
    const selectedBoard = findBoard(editingRow.boardId);
    const availableSeries = getAvailableSeriesForBoard(editingRow.boardId);

    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          {siteType === 'community' ? (
            <TextField
              select
              label="게시판 선택"
              value={editingRow.boardId}
              onChange={handleEditingBoardChange}
              disabled={editingRow.mode === 'edit' || isSaving}
            >
              {(editingRow.mode === 'edit' && selectedBoard ? [selectedBoard] : availableBoards).map((board) => (
                <MenuItem key={board.id} value={board.id}>
                  {board.boardLabel}
                </MenuItem>
              ))}
            </TextField>
          ) : null}

          <TextField
            select
            label="연재 선택"
            value={editingRow.seriesId}
            onChange={handleEditingSeriesChange}
            disabled={editingRow.mode === 'edit' || isSaving}
          >
            {availableSeries.map((series) => (
              <MenuItem key={series.id} value={series.id}>
                {series.seriesLabel}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="구독 금액"
            value={editingRow.price}
            onChange={handleEditingPriceChange}
            disabled={isSaving}
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
          />

          <Stack direction="row" spacing={1}>
            <Button
              type="button"
              variant="contained"
              onClick={() => {
                void handleSaveEditingRow();
              }}
              disabled={isSaving}
            >
              저장
            </Button>
            <Button type="button" onClick={() => setEditingRow(null)} disabled={isSaving}>
              취소
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6">연재 구독</Typography>
        <LoadingIndicator />
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">연재 구독</Typography>

          {boards.length > 0 ? (
            <Button
              type="button"
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={handleAddRow}
              disabled={isSaving || Boolean(editingRow) || !availableSeriesRows.length}
            >
              연재 구독 추가
            </Button>
          ) : null}
        </Stack>

        {errorMessage ? (
          <Typography role="status" color="error">
            {errorMessage}
          </Typography>
        ) : null}

        {successMessage ? (
          <Typography role="status" color="success.main">
            {successMessage}
          </Typography>
        ) : null}

        {!boards.length ? <Typography>{emptyMessage || '연재가 설정되지 않았습니다'}</Typography> : null}

        {boards.length > 0 && !enabledSeriesRows.length && !editingRow ? (
          <Typography>설정된 연재 구독이 없습니다.</Typography>
        ) : null}

        {enabledSeriesRows.map((row) => {
          const isEditingThisSeries = editingRow?.mode === 'edit' && editingRow.seriesId === row.series.id;

          return (
            <Paper key={row.series.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                {isEditingThisSeries ? (
                  renderEditingRow()
                ) : (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack spacing={0.5}>
                      {siteType === 'community' ? (
                        <Typography variant="body2" color="text.secondary">
                          {row.board.boardLabel}
                        </Typography>
                      ) : null}
                      <Typography variant="subtitle1">{row.series.seriesLabel}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        월 {formatPrice(row.series.setting.price)}원
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <IconButton
                        type="button"
                        aria-label="연재 구독 수정"
                        onClick={() => handleEditRow(row)}
                        disabled={isSaving || Boolean(editingRow)}
                      >
                        <EditRoundedIcon />
                      </IconButton>
                      <IconButton
                        type="button"
                        aria-label="연재 구독 해제"
                        onClick={() => {
                          void handleDisableSeriesSubscription(row);
                        }}
                        disabled={isSaving}
                      >
                        <RemoveRoundedIcon />
                      </IconButton>
                    </Stack>
                  </Stack>
                )}

                {row.series.subscribers.length ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>구독자</TableCell>
                          <TableCell>상태</TableCell>
                          <TableCell>유지 기간</TableCell>
                          <TableCell>최근 결제일</TableCell>
                          <TableCell>최근 결제금액</TableCell>
                          <TableCell>총 결제금액</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {row.series.subscribers.map((subscriber) => (
                          <TableRow key={subscriber.id}>
                            <TableCell>{subscriber.nickname}</TableCell>
                            <TableCell>{subscriber.status}</TableCell>
                            <TableCell>{subscriber.activeMonths}개월째</TableCell>
                            <TableCell>{formatDateTime(subscriber.lastPaidAt)}</TableCell>
                            <TableCell>{formatPaymentAmount(subscriber.lastPaidAmount)}</TableCell>
                            <TableCell>{formatPaymentAmount(subscriber.totalPaidAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : null}
              </Stack>
            </Paper>
          );
        })}

        {editingRow?.mode === 'new' ? renderEditingRow() : null}
      </Stack>
    </Paper>
  );
}
