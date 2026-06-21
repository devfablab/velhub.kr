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

type SeriesSubscriptionItem = {
  id: string;
  seriesKey: string;
  seriesLabel: string;
  setting: {
    id: string | null;
    isEnabled: boolean;
    price: number;
    minPrice: number;
    maxAllowedPrice: number;
    parentPrice: number;
  };
  subscribers: Subscriber[];
};

type BoardSeriesGroup = {
  id: string;
  boardKey: string;
  boardLabel: string;
  parentPrice: number;
  maxAllowedSeriesPrice: number;
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
  parentPrice?: number;
  maxAllowedPrice?: number;
  boardSubscriptionDisabled?: boolean;
  subscriptionEnabledSeriesCount?: number;
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

function getPriceNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidPrice(price: number, minPrice: number, maxAllowedPrice: number) {
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

function getEnabledSeriesRows(boards: BoardSeriesGroup[]) {
  const rows: SeriesRow[] = [];

  for (const board of boards) {
    for (const series of board.series) {
      if (series.setting.isEnabled) {
        rows.push({
          board,
          series,
        });
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
        rows.push({
          board,
          series,
        });
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

  function findSeries(boardId: string, seriesId: string) {
    const board = findBoard(boardId);

    if (!board) {
      return null;
    }

    return board.series.find((series) => series.id === seriesId) ?? null;
  }

  function getAvailableBoardsForNewRow() {
    return boards.filter((board) => board.series.some((series) => !series.setting.isEnabled));
  }

  function getAvailableSeriesForBoard(boardId: string) {
    const board = findBoard(boardId);

    if (!board) {
      return [];
    }

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
      price: formatPrice(firstAvailableRow?.series.setting.minPrice ?? 7000),
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
    if (!editingRow) {
      return;
    }

    setEditingRow({
      ...editingRow,
      boardId: event.target.value,
      seriesId: '',
      price: '7,000',
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingSeriesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) {
      return;
    }

    const nextSeriesId = event.target.value;
    const nextSeries = findSeries(editingRow.boardId, nextSeriesId);

    setEditingRow({
      ...editingRow,
      seriesId: nextSeriesId,
      price: formatPrice(nextSeries?.setting.minPrice ?? 7000),
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingPriceChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) {
      return;
    }

    const selectedSeries = findSeries(editingRow.boardId, editingRow.seriesId);
    const minPrice = selectedSeries?.setting.minPrice ?? 7000;
    const maxAllowedPrice = selectedSeries?.setting.maxAllowedPrice ?? 100000;
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

    if (nextPrice && nextPrice < minPrice) {
      setErrorMessage(`연재 구독 금액은 ${formatPrice(minPrice)}원 이상이어야 합니다.`);
      setSuccessMessage('');
      return;
    }

    if (nextPrice && nextPrice > maxAllowedPrice) {
      setErrorMessage(`연재 구독 금액은 상위 구독 금액 기준 ${formatPrice(maxAllowedPrice)}원 이하여야 합니다.`);
      setSuccessMessage('');
      return;
    }

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
    if (!editingRow) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage('');
      setSuccessMessage('');

      const selectedSeries = findSeries(editingRow.boardId, editingRow.seriesId);
      const nextPrice = getPriceNumber(editingRow.price);

      if (!editingRow.boardId) {
        throw new Error('게시판을 선택해 주세요.');
      }

      if (!editingRow.seriesId || !selectedSeries) {
        throw new Error('연재를 선택해 주세요.');
      }

      if (!isValidPrice(nextPrice, selectedSeries.setting.minPrice, selectedSeries.setting.maxAllowedPrice)) {
        throw new Error(
          `연재 구독 금액은 ${formatPrice(selectedSeries.setting.minPrice)}원부터 ${formatPrice(
            selectedSeries.setting.maxAllowedPrice,
          )}원까지 1,000원 단위로 입력해 주세요.`,
        );
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
                    minPrice: series.setting.minPrice,
                    maxAllowedPrice: result.maxAllowedPrice ?? series.setting.maxAllowedPrice,
                    parentPrice: result.parentPrice ?? series.setting.parentPrice,
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

      const result = await saveSeriesSubscription({
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
                    maxAllowedPrice: result.maxAllowedPrice ?? series.setting.maxAllowedPrice,
                    parentPrice: result.parentPrice ?? series.setting.parentPrice,
                  },
                }
              : series,
          ),
        })),
      );

      if (editingRow?.seriesId === row.series.id) {
        setEditingRow(null);
      }

      setSuccessMessage(
        result.boardSubscriptionDisabled
          ? '연재 구독 설정을 해제했습니다. 구독 설정된 연재가 2개 미만이 되어 게시판 구독도 자동 해제되었습니다.'
          : '연재 구독 설정을 해제했습니다.',
      );
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
    if (!editingRow) {
      return null;
    }

    const availableBoards = getAvailableBoardsForNewRow();
    const selectedBoard = findBoard(editingRow.boardId);
    const availableSeries = getAvailableSeriesForBoard(editingRow.boardId);
    const selectedSeries = findSeries(editingRow.boardId, editingRow.seriesId);

    return (
      <div className={`paper ${styles.paper}`}>
        <Stack gap={2}>
          {siteType === 'community' ? (
            <TextField
              select
              label="게시판 선택"
              value={editingRow.boardId}
              onChange={handleEditingBoardChange}
              disabled={isSaving || editingRow.mode === 'edit'}
              fullWidth
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
            disabled={isSaving || !editingRow.boardId || editingRow.mode === 'edit'}
            fullWidth
          >
            {availableSeries.map((series) => (
              <MenuItem key={series.id} value={series.id}>
                {series.seriesLabel}
              </MenuItem>
            ))}
          </TextField>

          {selectedSeries ? (
            <Typography variant="body2" color="text.secondary">
              최소 {formatPrice(selectedSeries.setting.minPrice)}원 · 최대{' '}
              {formatPrice(selectedSeries.setting.maxAllowedPrice)}원
            </Typography>
          ) : null}

          <TextField
            label="구독 금액"
            value={editingRow.price}
            onChange={handleEditingPriceChange}
            fullWidth
            InputProps={{
              endAdornment: <InputAdornment position="end">원</InputAdornment>,
            }}
          />

          <Stack direction="row" gap={1}>
            <Button type="button" variant="contained" onClick={handleSaveEditingRow} disabled={isSaving}>
              저장
            </Button>
            <Button type="button" onClick={() => setEditingRow(null)} disabled={isSaving}>
              취소
            </Button>
          </Stack>
        </Stack>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Stack gap={2}>
        <Typography variant="h6" component="h2">
          연재 구독
        </Typography>
        <LoadingIndicator />
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      <Typography variant="h6" component="h2">
        연재 구독
      </Typography>

      {errorMessage ? (
        <Typography color="error" role="alert">
          {errorMessage}
        </Typography>
      ) : null}

      {successMessage ? (
        <Typography color="primary" role="status">
          {successMessage}
        </Typography>
      ) : null}

      {!boards.length ? (
        <Typography color="text.secondary">{emptyMessage || '연재가 설정되지 않았습니다'}</Typography>
      ) : null}

      {boards.length && !enabledSeriesRows.length && !editingRow ? (
        <Typography color="text.secondary">설정된 연재 구독이 없습니다.</Typography>
      ) : null}

      {enabledSeriesRows.map((row) => {
        const isEditingThisSeries = editingRow?.mode === 'edit' && editingRow.seriesId === row.series.id;

        return (
          <Paper key={row.series.id} variant="outlined" sx={{ p: 2 }}>
            <Stack gap={2}>
              {isEditingThisSeries ? (
                renderEditingRow()
              ) : (
                <Stack gap={1}>
                  <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
                    <Stack gap={0.5}>
                      {siteType === 'community' ? (
                        <Typography variant="body2" color="text.secondary">
                          {row.board.boardLabel}
                        </Typography>
                      ) : null}
                      <Typography fontWeight={700}>{row.series.seriesLabel}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        월 {formatPrice(row.series.setting.price)}원
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        최소 {formatPrice(row.series.setting.minPrice)}원 · 최대{' '}
                        {formatPrice(row.series.setting.maxAllowedPrice)}원
                      </Typography>
                    </Stack>
                    <Stack direction="row" gap={1}>
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
                        onClick={() => void handleDisableSeriesSubscription(row)}
                        disabled={isSaving}
                      >
                        <RemoveRoundedIcon />
                      </IconButton>
                    </Stack>
                  </Stack>

                  {row.series.subscribers.length ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>구독자</TableCell>
                            <TableCell>상태</TableCell>
                            <TableCell>유지 기간</TableCell>
                            <TableCell>최근 결제일</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {row.series.subscribers.map((subscriber) => (
                            <TableRow key={subscriber.id}>
                              <TableCell>{subscriber.nickname}</TableCell>
                              <TableCell>{subscriber.status}</TableCell>
                              <TableCell>{subscriber.activeMonths}개월째</TableCell>
                              <TableCell>{formatDateTime(subscriber.lastPaidAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : null}
                </Stack>
              )}
            </Stack>
          </Paper>
        );
      })}

      {editingRow?.mode === 'new' ? renderEditingRow() : null}

      {boards.length ? (
        <Button
          type="button"
          variant="outlined"
          startIcon={<AddRoundedIcon />}
          onClick={handleAddRow}
          disabled={isSaving || Boolean(editingRow) || availableSeriesRows.length === 0}
        >
          연재 구독 추가
        </Button>
      ) : null}
    </Stack>
  );
}
