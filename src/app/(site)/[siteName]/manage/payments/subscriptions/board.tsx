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
};

type BoardSubscriptionItem = {
  id: string;
  boardKey: string;
  boardLabel: string;
  setting: {
    id: string | null;
    isEnabled: boolean;
    price: number;
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
  const availableBoards = boards.filter((board) => !board.setting.isEnabled);

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

  function handleAddRow() {
    setEditingRow({
      mode: 'new',
      boardId: '',
      price: '1,000',
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

    setEditingRow({
      ...editingRow,
      boardId: event.target.value,
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

      const nextPrice = getPriceNumber(editingRow.price);

      if (!editingRow.boardId) {
        throw new Error('게시판을 선택해 주세요.');
      }

      if (!isValidPrice(nextPrice)) {
        throw new Error('구독 금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.');
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
                setting: {
                  id: result.settingId ?? board.setting.id,
                  isEnabled: true,
                  price: nextPrice,
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

    const selectableBoards =
      editingRow.mode === 'edit' ? boards.filter((board) => board.id === editingRow.boardId) : availableBoards;

    return (
      <Stack direction="row" spacing={1} alignItems="center">
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
          {selectableBoards.map((board) => (
            <MenuItem key={board.id} value={board.id}>
              {board.boardLabel}
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
          aria-label="게시판 구독 설정 저장"
          onClick={handleSaveEditingRow}
          disabled={!editingRow.boardId || isSaving}
        >
          <EditRoundedIcon />
        </IconButton>
      </Stack>
    );
  }

  if (!isAvailable) {
    return null;
  }

  if (isLoading) {
    return (
      <Paper variant="outlined">
        <Stack spacing={2} sx={{ p: 3 }}>
          <Typography variant="h6">게시판 구독</Typography>
          <LoadingIndicator />
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <Stack spacing={2} sx={{ p: 3 }}>
        <Typography variant="h6">게시판 구독</Typography>

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

        {!boards.length ? <Typography>구독을 설정할 수 있는 게시판이 없습니다.</Typography> : null}

        {boards.length && !enabledBoards.length && !editingRow ? (
          <Typography>설정된 게시판 구독이 없습니다</Typography>
        ) : null}

        <Stack spacing={2}>
          {enabledBoards.map((board) => {
            const isEditingThisBoard = editingRow?.mode === 'edit' && editingRow.boardId === board.id;

            return (
              <Stack key={board.id} spacing={1}>
                {isEditingThisBoard ? (
                  renderEditingRow()
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      value={board.boardLabel}
                      disabled
                      fullWidth
                      inputProps={{
                        'aria-label': '설정된 게시판',
                      }}
                    />

                    <TextField
                      value={formatPrice(board.setting.price)}
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
                      aria-label="게시판 구독 설정 수정"
                      onClick={() => handleEditRow(board)}
                      disabled={isSaving || Boolean(editingRow)}
                    >
                      <EditRoundedIcon />
                    </IconButton>

                    <IconButton
                      type="button"
                      aria-label="게시판 구독 설정 해제"
                      onClick={() => void handleDisableBoardSubscription(board)}
                      disabled={isSaving}
                    >
                      <RemoveRoundedIcon />
                    </IconButton>
                  </Stack>
                )}

                {board.subscribers.length ? (
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
                        {board.subscribers.map((subscriber) => (
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
              aria-label="게시판 구독 설정 추가"
              onClick={handleAddRow}
              disabled={Boolean(editingRow) || !availableBoards.length || isSaving}
            >
              <AddRoundedIcon />
            </IconButton>
          </div>
        ) : null}
      </Stack>
    </Paper>
  );
}
