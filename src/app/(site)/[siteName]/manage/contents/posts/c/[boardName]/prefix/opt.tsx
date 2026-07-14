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
  Drawer,
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
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BoardData = {
  id: string;
  board_key: string;
  board_label: string | null;
  board_type: string;
  post_type: 'none' | 'prefix' | 'series';
};

type BoardRow = {
  data: BoardData;
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
  const isMobile = !isNotMobile;

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
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
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
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h6" component="h2" sx={{ p: 2 }}>
              말머리 관리
            </Typography>
          ) : null}
          {board ? (
            <Stack gap={1.5} direction="row" sx={{ p: 2 }}>
              <Typography variant="subtitle2">게시판</Typography>
              <Typography variant="body2">{board.data.board_label}</Typography>
            </Stack>
          ) : null}

          <p className="alert warning" style={{ paddingLeft: 16 }}>
            <WarningAmberRoundedIcon />
            <span>포스팅에 1번 이상 사용한 말머리는 삭제할 수 없습니다.</span>
          </p>

          <Stack direction="row" justifyContent="flex-end" sx={{ p: 2, pb: 0 }}>
            <button type="button" className="button small action" onClick={handleOpenNewDialog}>
              말머리 추가
            </button>
            <span />
          </Stack>

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {sortedPrefixes.length === 0 ? (
            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">등록된 말머리가 없습니다.</Typography>
            </div>
          ) : (
            <div className={`paper paper-p0 ${styles.paper}`}>
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
                        <Stack direction="row" gap={1} justifyContent="flex-end">
                          <button
                            type="button"
                            className="button small cancel"
                            onClick={() => handleOpenEditDialog(prefix)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="button small danger"
                            onClick={() => handleOpenDeleteDialog(prefix)}
                          >
                            삭제
                          </button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={dialogMode === 'new' || dialogMode === 'edit'}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom"
            >
              <h2>{dialogMode === 'new' ? '말머리 추가' : '말머리 수정'}</h2>
              <button className="close-button" onClick={handleCloseDialog}>
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <TextField
                    placeholder="말머리명"
                    value={prefixLabel}
                    onChange={handlePrefixLabelChange}
                    fullWidth
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isSubmitting}>
                    저장
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={dialogMode === 'new' || dialogMode === 'edit'}
              onClose={handleCloseDialog}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>{dialogMode === 'new' ? '말머리 추가' : '말머리 수정'}</DialogTitle>
              <button className="close-button" onClick={handleCloseDialog} disabled={isSubmitting} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <TextField
                    placeholder="말머리명"
                    value={prefixLabel}
                    onChange={handlePrefixLabelChange}
                    fullWidth
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isSubmitting}>
                  저장
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={dialogMode === 'delete'}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom"
            >
              <h2>말머리 삭제</h2>
              <button className="close-button" onClick={handleCloseDialog} disabled={isSubmitting} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography variant="body2">해당 말머리를 삭제하시겠습니까?</Typography>

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium warning"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    삭제
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={dialogMode === 'delete'}
              onClose={handleCloseDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>말머리 삭제</DialogTitle>
              <button className="close-button" onClick={handleCloseDialog} disabled={isSubmitting} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography variant="body2">해당 말머리를 삭제하시겠습니까?</Typography>

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button type="button" className="button medium warning" onClick={handleDelete} disabled={isSubmitting}>
                  삭제
                </button>
              </DialogActions>
            </Dialog>
          )}

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2700}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
