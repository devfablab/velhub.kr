'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
  board_type: string;
  post_type: 'none' | 'prefix' | 'series';
};

type PrefixRow = {
  id: string;
  created_at: string;
  prefix_key: number;
  prefix_label: string;
  board_id: string;
  site_id: string;
};

type PrefixListResponse = {
  board?: BoardRow;
  prefixes?: PrefixRow[];
  error?: string;
};

type PrefixSaveResponse = {
  ok?: boolean;
  prefix?: PrefixRow;
  error?: string;
};

type PrefixDeleteResponse = {
  ok?: boolean;
  error?: string;
};

type DialogMode = 'new' | 'edit' | 'delete' | null;

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName).toLowerCase();

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [prefixes, setPrefixes] = useState<PrefixRow[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState<PrefixRow | null>(null);
  const [prefixLabel, setPrefixLabel] = useState('');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const sortedPrefixes = useMemo(() => {
    return [...prefixes].sort((a, b) => a.prefix_key - b.prefix_key);
  }, [prefixes]);

  useEffect(() => {
    async function loadPrefixes() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/${boardName}/prefix?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PrefixListResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '말머리 목록을 불러오지 못했습니다.');
        }

        if (!result.board) {
          throw new Error('말머리 목록을 불러오지 못했습니다.');
        }

        setBoard(result.board);
        setPrefixes(Array.isArray(result.prefixes) ? result.prefixes : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '말머리 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('말머리 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPrefixes();
  }, [boardName, siteName]);

  function resetDialog() {
    setSelectedPrefix(null);
    setPrefixLabel('');
    setDialogErrorMessage('');
  }

  function handleOpenNewDialog() {
    resetDialog();
    setDialogMode('new');
  }

  function handleOpenEditDialog(prefix: PrefixRow) {
    setSelectedPrefix(prefix);
    setPrefixLabel(prefix.prefix_label);
    setDialogErrorMessage('');
    setDialogMode('edit');
  }

  function handleOpenDeleteDialog(prefix: PrefixRow) {
    setSelectedPrefix(prefix);
    setPrefixLabel(prefix.prefix_label);
    setDialogErrorMessage('');
    setDialogMode('delete');
  }

  function handleCloseDialog() {
    if (isSubmitting) {
      return;
    }

    resetDialog();
    setDialogMode(null);
  }

  function handlePrefixLabelChange(event: InputChangeEvent) {
    setPrefixLabel(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  function isDuplicatePrefixLabel(prefixId: string | null, prefixLabelValue: string) {
    return prefixes.some((prefix) => prefix.prefix_label === prefixLabelValue && prefix.id !== prefixId);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    const normalizedPrefixLabel = normalizeText(prefixLabel);

    if (!normalizedPrefixLabel) {
      setDialogErrorMessage('말머리명을 입력해주세요.');
      return;
    }

    if (dialogMode === 'new' && isDuplicatePrefixLabel(null, normalizedPrefixLabel)) {
      setDialogErrorMessage('이미 존재하는 말머리입니다.');
      return;
    }

    if (dialogMode === 'edit' && selectedPrefix && isDuplicatePrefixLabel(selectedPrefix.id, normalizedPrefixLabel)) {
      setDialogErrorMessage('이미 존재하는 말머리입니다.');
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsSubmitting(true);

      if (dialogMode === 'new') {
        const response = await fetch(`/api/boards/${boardName}/prefix/new`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            siteName,
            prefixLabel: normalizedPrefixLabel,
          }),
        });

        const result = (await response.json()) as PrefixSaveResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '말머리 생성에 실패했습니다.');
        }

        if (!result.prefix) {
          throw new Error('말머리 생성에 실패했습니다.');
        }

        setPrefixes((previousPrefixes) => [...previousPrefixes, result.prefix as PrefixRow]);
        setDialogMode(null);
        resetDialog();
        setSnackbarMessage('말머리가 등록되었습니다.');
        return;
      }

      if (dialogMode === 'edit' && selectedPrefix) {
        const response = await fetch(`/api/boards/${boardName}/prefix/${selectedPrefix.prefix_key}/edit`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            siteName,
            prefixLabel: normalizedPrefixLabel,
          }),
        });

        const result = (await response.json()) as PrefixSaveResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '말머리 수정에 실패했습니다.');
        }

        if (!result.prefix) {
          throw new Error('말머리 수정에 실패했습니다.');
        }

        setPrefixes((previousPrefixes) =>
          previousPrefixes.map((prefix) => (prefix.id === result.prefix?.id ? (result.prefix as PrefixRow) : prefix)),
        );
        setDialogMode(null);
        resetDialog();
        setSnackbarMessage('말머리가 수정되었습니다.');
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '말머리 저장에 실패했습니다.');
      } else {
        setDialogErrorMessage('말머리 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!selectedPrefix || isSubmitting) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch(
        `/api/boards/${boardName}/prefix/${selectedPrefix.prefix_key}/delete?siteName=${siteName}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as PrefixDeleteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '말머리 삭제에 실패했습니다.');
      }

      setPrefixes((previousPrefixes) => previousPrefixes.filter((prefix) => prefix.id !== selectedPrefix.id));
      setDialogMode(null);
      resetDialog();
      setSnackbarMessage('말머리가 삭제되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '말머리 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('말머리 삭제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Container pageTitle="말머리 관리" menu="contents">
      <div className="container">
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {board ? (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">게시판</Typography>
              <Typography variant="body2">{board.board_label ?? ''}</Typography>
            </Stack>
          ) : null}

          <Alert severity="warning" variant="outlined">
            포스팅에 1번 이상 사용한 말머리는 삭제할 수 없습니다.
          </Alert>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button type="button" variant="contained" onClick={handleOpenNewDialog}>
              말머리 추가
            </Button>
            <span />
          </Stack>

          {errorMessage ? (
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          ) : null}

          {sortedPrefixes.length === 0 ? (
            <Paper sx={{ p: 3 }}>
              <Typography>등록된 말머리가 없습니다.</Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>번호</TableCell>
                    <TableCell>말머리명</TableCell>
                    <TableCell>생성일</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedPrefixes.map((prefix) => (
                    <TableRow key={prefix.id}>
                      <TableCell>{prefix.prefix_key}</TableCell>
                      <TableCell>{prefix.prefix_label}</TableCell>
                      <TableCell>{formatDateTimeDetail(prefix.created_at)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            type="button"
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenEditDialog(prefix)}
                          >
                            수정
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleOpenDeleteDialog(prefix)}
                          >
                            삭제
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Dialog
            open={dialogMode === 'new' || dialogMode === 'edit'}
            onClose={handleCloseDialog}
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle>{dialogMode === 'new' ? '말머리 추가' : '말머리 수정'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  label="말머리명"
                  value={prefixLabel}
                  onChange={handlePrefixLabelChange}
                  fullWidth
                  size="small"
                />

                {dialogErrorMessage ? (
                  <Alert severity="error" variant="filled">
                    {dialogErrorMessage}
                  </Alert>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={handleCloseDialog} disabled={isSubmitting}>
                취소
              </Button>
              <Button type="button" variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
                저장
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={dialogMode === 'delete'} onClose={handleCloseDialog} fullWidth maxWidth="xs">
            <DialogTitle>말머리 삭제</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography variant="body2">해당 말머리를 삭제하시겠습니까?</Typography>

                {dialogErrorMessage ? (
                  <Alert severity="error" variant="filled">
                    {dialogErrorMessage}
                  </Alert>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={handleCloseDialog} disabled={isSubmitting}>
                취소
              </Button>
              <Button type="button" color="error" variant="contained" onClick={handleDelete} disabled={isSubmitting}>
                삭제
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2500}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
