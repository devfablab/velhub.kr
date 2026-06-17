'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
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

function getPriceNumber(value: string) {
  return Number(value.replace(/[^0-9]/g, ''));
}

function isValidPrice(price: number) {
  if (!Number.isInteger(price)) {
    return false;
  }

  if (price < 1000) {
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
    if (!editingRow) {
      return;
    }

    setEditingRow({
      ...editingRow,
      boardId: event.target.value,
      seriesId: '',
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingSeriesChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) {
      return;
    }

    setEditingRow({
      ...editingRow,
      seriesId: event.target.value,
    });
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleEditingPriceChange(event: ChangeEvent<HTMLInputElement>) {
    if (!editingRow) {
      return;
    }

    const nextPrice = getPriceNumber(event.target.value);

    if (!isValidPrice(nextPrice)) {
      return;
    }

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
    if (!editingRow) {
      return;
    }

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
    if (!editingRow) {
      return null;
    }

    const availableBoards = getAvailableBoardsForNewRow();
    const selectedBoard = findBoard(editingRow.boardId);
    const availableSeries = getAvailableSeriesForBoard(editingRow.boardId);

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        {siteType === 'community' ? (
          <TextField
            select
            value={editingRow.boardId}
            onChange={handleEditingBoardChange}
            disabled={editingRow.mode === 'edit' || isSaving}
            fullWidth
            inputProps={{
              'aria-label': '게시판 선택',
            }}
          >
            <MenuItem value="" disabled>
              게시판 선택
            </MenuItem>
            {(editingRow.mode === 'edit' && selectedBoard ? [selectedBoard] : availableBoards).map((board) => (
              <MenuItem key={board.id} value={board.id}>
                {board.boardLabel}
              </MenuItem>
            ))}
          </TextField>
        ) : null}

        <TextField
          select
          value={editingRow.seriesId}
          onChange={handleEditingSeriesChange}
          disabled={editingRow.mode === 'edit' || !editingRow.boardId || isSaving}
          fullWidth
          inputProps={{
            'aria-label': '연재 선택',
          }}
        >
          <MenuItem value="" disabled>
            연재 선택
          </MenuItem>
          {availableSeries.map((series) => (
            <MenuItem key={series.id} value={series.id}>
              {series.seriesLabel}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          value={editingRow.price}
          onChange={handleEditingPriceChange}
          disabled={isSaving}
          inputProps={{
            inputMode: 'numeric',
            'aria-label': '구독 금액',
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">원</InputAdornment>,
          }}
        />

        <IconButton
          type="button"
          aria-label="연재 구독 설정 저장"
          onClick={handleSaveEditingRow}
          disabled={!editingRow.seriesId || isSaving}
        >
          <EditRoundedIcon />
        </IconButton>
      </Stack>
    );
  }

  if (isLoading) {
    return (
      <Paper variant="outlined">
        <Stack spacing={2} sx={{ p: 3 }}>
          <Typography variant="h6">연재 구독</Typography>
          <LoadingIndicator />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <Stack spacing={2} sx={{ p: 3 }}>
        <Typography variant="h6">연재 구독</Typography>

        {errorMessage ? (
          <Typography role="status" color="error">
            {errorMessage}
          </Typography>
        ) : null}

        {successMessage ? (
          <Typography role="status" color="primary">
            {successMessage}
          </Typography>
        ) : null}

        {!boards.length ? <Typography>{emptyMessage || '연재가 설정되지 않았습니다'}</Typography> : null}

        {boards.length && !enabledSeriesRows.length && !editingRow ? (
          <Typography>설정된 연재 구독이 없습니다</Typography>
        ) : null}

        <Stack spacing={2}>
          {enabledSeriesRows.map((row) => {
            const isEditingThisSeries = editingRow?.mode === 'edit' && editingRow.seriesId === row.series.id;

            return (
              <Stack key={row.series.id} spacing={1}>
                {isEditingThisSeries ? (
                  renderEditingRow()
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    {siteType === 'community' ? (
                      <TextField
                        value={row.board.boardLabel}
                        disabled
                        fullWidth
                        inputProps={{
                          'aria-label': '설정된 게시판',
                        }}
                      />
                    ) : null}

                    <TextField
                      value={row.series.seriesLabel}
                      disabled
                      fullWidth
                      inputProps={{
                        'aria-label': '설정된 연재',
                      }}
                    />

                    <TextField
                      value={formatPrice(row.series.setting.price)}
                      disabled
                      inputProps={{
                        'aria-label': '설정된 구독 금액',
                      }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">원</InputAdornment>,
                      }}
                    />

                    <IconButton
                      type="button"
                      aria-label="연재 구독 설정 수정"
                      onClick={() => handleEditRow(row)}
                      disabled={isSaving || Boolean(editingRow)}
                    >
                      <EditRoundedIcon />
                    </IconButton>

                    <IconButton
                      type="button"
                      aria-label="연재 구독 설정 해제"
                      onClick={() => void handleDisableSeriesSubscription(row)}
                      disabled={isSaving}
                    >
                      <RemoveRoundedIcon />
                    </IconButton>
                  </Stack>
                )}

                {row.series.subscribers.length ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
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
            );
          })}

          {editingRow?.mode === 'new' ? renderEditingRow() : null}
        </Stack>

        {boards.length ? (
          <div>
            <IconButton
              type="button"
              aria-label="연재 구독 설정 추가"
              onClick={handleAddRow}
              disabled={Boolean(editingRow) || !availableSeriesRows.length || isSaving}
            >
              <AddRoundedIcon />
            </IconButton>
          </div>
        ) : null}
      </Stack>
    </Paper>
  );
}
