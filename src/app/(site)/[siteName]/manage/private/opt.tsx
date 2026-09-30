'use client';

import { type FormEvent, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

type Category = {
  id: string | null;
  label: string;
};

export type BoardResponse = {
  siteType?: string | null;
  board?: { id: string; board_label: string; is_image_enabled: boolean } | null;
  categories?: { id: string; category_label: string }[];
  error?: string;
};

type Notice = {
  title: string;
  message: string;
};

type FormSubmitEvent = FormEvent<HTMLFormElement>;

type OptProps = { initialData: BoardResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [isSaving, setIsSaving] = useState(false);
  const [isCommunity] = useState(initialData?.siteType === 'community');
  const [isInstalled, setIsInstalled] = useState(Boolean(initialData?.board));
  const [boardLabel, setBoardLabel] = useState(initialData?.board?.board_label ?? '');
  const [isImageEnabled, setIsImageEnabled] = useState(initialData?.board?.is_image_enabled ?? true);
  const [categories, setCategories] = useState<Category[]>(
    initialData?.categories?.length
      ? initialData.categories.map((category) => ({ id: category.id, label: category.category_label }))
      : [{ id: null, label: '분류없음' }],
  );
  const [notice, setNotice] = useState<Notice | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '불러오기 실패' : null);
  const [boardLabelError, setBoardLabelError] = useState('');
  const [categoryErrors, setCategoryErrors] = useState<Record<number, string>>({});
  const [pendingCategoryIndex, setPendingCategoryIndex] = useState<number | null>(null);

  function showError(message: string, title: string | null = '비공개 게시판 설정') {
    setErrorMessage(message);
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  function changeCategory(index: number, label: string) {
    setCategoryErrors((previousErrors) => {
      const nextErrors = { ...previousErrors };
      delete nextErrors[index];
      return nextErrors;
    });
    setCategories((previous) =>
      previous.map((category, categoryIndex) => (categoryIndex === index ? { ...category, label } : category)),
    );
  }

  function getCategoryValidationErrors() {
    const nextErrors: Record<number, string> = {};
    const labels = new Map<string, number>();

    categories.forEach((category, index) => {
      const label = normalizeText(category.label);

      if (!label) {
        nextErrors[index] = '카테고리 이름을 입력해주세요.';
        return;
      }

      const existingIndex = labels.get(label);

      if (existingIndex !== undefined) {
        nextErrors[index] = '카테고리 이름은 중복해서 입력할 수 없습니다.';
        nextErrors[existingIndex] = '카테고리 이름은 중복해서 입력할 수 없습니다.';
        return;
      }

      labels.set(label, index);
    });

    return nextErrors;
  }

  function handleRequestCategoryDelete(index: number) {
    if (categories.length === 1) {
      return;
    }

    setPendingCategoryIndex(index);
  }

  function handleConfirmCategoryDelete() {
    if (pendingCategoryIndex === null) {
      return;
    }

    setCategories((previous) => previous.filter((_, categoryIndex) => categoryIndex !== pendingCategoryIndex));
    setCategoryErrors({});
    setPendingCategoryIndex(null);
  }

  const categoryMoveTargetLabel =
    pendingCategoryIndex === 0 ? categories[1]?.label || '기본' : categories[0]?.label || '기본';

  async function handleSave(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSaving) return;

    const normalizedBoardLabel = normalizeText(boardLabel);
    const nextCategoryErrors = getCategoryValidationErrors();

    setBoardLabelError(normalizedBoardLabel ? '' : '게시판 이름을 입력해주세요.');
    setCategoryErrors(nextCategoryErrors);

    if (!normalizedBoardLabel || Object.keys(nextCategoryErrors).length > 0) {
      showError(
        !normalizedBoardLabel ? '게시판 이름을 입력해주세요.' : Object.values(nextCategoryErrors)[0],
        '입력 내용 확인',
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/private-board/manage', {
        method: isInstalled ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardLabel: normalizedBoardLabel,
          isImageEnabled,
          categories: categories.map((category) => ({ id: category.id, label: category.label })),
        }),
      });
      const result = (await response.json()) as BoardResponse;

      if (!response.ok)
        throw new Error(result.error ?? `비공개 게시판 ${isInstalled ? '수정' : '설치'}에 실패했습니다.`);

      if (result.board) {
        setIsInstalled(true);
        setBoardLabel(result.board.board_label);
        setIsImageEnabled(result.board.is_image_enabled);
      }

      if (result.categories) {
        setCategories(result.categories.map((category) => ({ id: category.id, label: category.category_label })));
      }

      setNotice({
        title: isInstalled ? '수정 완료' : '설치 완료',
        message: `비공개 게시판을 ${isInstalled ? '수정' : '설치'}했습니다.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `비공개 게시판 ${isInstalled ? '수정' : '설치'}에 실패했습니다.`;

      if (message.includes('카테고리')) {
        setCategoryErrors({ 0: message });
      } else {
        setBoardLabelError(message);
      }

      showError(message, error instanceof TypeError ? null : isInstalled ? '수정 실패' : '설치 실패');
    } finally {
      setIsSaving(false);
    }
  }

  if (initialError) {
    return (
      <Container pageTitle="비공개 게시판" pageBack={`/${siteName}/manage`}>
        <div className={`container ${styles.container}`}>
          <ScreenState kind="error">{initialError}</ScreenState>
        </div>
        <FormErrorDialog
          open={isErrorDialogOpen}
          title={errorDialogTitle}
          messages={[initialError]}
          onClose={() => setIsErrorDialogOpen(false)}
        />
      </Container>
    );
  }

  if (!isCommunity) {
    return (
      <Container pageTitle="비공개 게시판" pageBack={`/${siteName}/manage`}>
        <div className={`container ${styles.container}`}>
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>커뮤니티에서만 사용할 수 있습니다.</span>
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="비공개 게시판" pageBack={`/${siteName}/manage`}>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>비공개 게시판의 기본 설정을 관리합니다.</span>
          </p>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
          <form onSubmit={(event) => void handleSave(event)}>
          <div className={`paper ${styles.paper}`}>
            <Stack gap={2}>
              <Typography variant="h6">게시판 설정</Typography>
              <TextField
                value={boardLabel}
                onChange={(event) => setBoardLabel(event.target.value)}
                placeholder="게시판 이름"
                required
                error={Boolean(boardLabelError)}
                helperText={boardLabelError}
                fullWidth
                size="small"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={isImageEnabled} onChange={(event) => setIsImageEnabled(event.target.checked)} />
                }
                label="첨부 이미지 사용"
              />
            </Stack>
          </div>
          <div className={`paper ${styles.paper}`}>
            <Stack gap={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">카테고리</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => setCategories((previous) => [...previous, { id: null, label: '' }])}
                >
                  <AddRoundedIcon />
                  추가
                </button>
              </Stack>
              {categories.map((category, index) => (
                <Stack direction="row" gap={1} key={category.id ?? `new-${index}`} alignItems="center">
                  <TextField
                    value={category.label}
                    onChange={(event) => changeCategory(index, event.target.value)}
                    placeholder={index === 0 ? '기본 카테고리' : '카테고리'}
                    fullWidth
                    size="small"
                    required
                    error={Boolean(categoryErrors[index])}
                    helperText={categoryErrors[index]}
                  />
                  <IconButton
                    aria-label="카테고리 삭제"
                    disabled={categories.length === 1}
                    onClick={() => handleRequestCategoryDelete(index)}
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </div>
          <Stack direction="row" justifyContent="flex-end">
            <button
              type="submit"
              className="button medium submit"
              disabled={isSaving}
            >
              {isInstalled ? '수정 완료' : '설치 완료'}
            </button>
          </Stack>
          </form>
        </div>
      </div>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(notice)}
          onClose={() => setNotice(null)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>{notice?.title}</h2>
          <button type="button" className="close-button" onClick={() => setNotice(null)} aria-label="팝업 닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <Typography variant="subtitle2">{notice?.message}</Typography>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small submit" onClick={() => setNotice(null)}>
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(notice)}
          onClose={() => setNotice(null)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>{notice?.title}</DialogTitle>
          <button type="button" className="close-button" onClick={() => setNotice(null)} aria-label="팝업 닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="subtitle2">{notice?.message}</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setNotice(null)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={pendingCategoryIndex !== null}
          onClose={() => setPendingCategoryIndex(null)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>카테고리 삭제</h2>
          <div className="VhiDrawer-bottom-content">
            <Typography variant="subtitle2">
              해당 카테고리의 글은 {categoryMoveTargetLabel} 카테고리로 이동합니다.
            </Typography>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small cancel" onClick={() => setPendingCategoryIndex(null)}>
              취소
            </button>
            <button type="button" className="button small danger" onClick={handleConfirmCategoryDelete}>
              삭제
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={pendingCategoryIndex !== null}
          onClose={() => setPendingCategoryIndex(null)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>카테고리 삭제</DialogTitle>
          <DialogContent>
            <Typography variant="subtitle2">
              해당 카테고리의 글은 {categoryMoveTargetLabel} 카테고리로 이동합니다.
            </Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={() => setPendingCategoryIndex(null)}>
              취소
            </button>
            <button type="button" className="delete-button" onClick={handleConfirmCategoryDelete}>
              삭제
            </button>
          </DialogActions>
        </Dialog>
      )}
      <FormErrorDialog
        open={isErrorDialogOpen}
        title={errorDialogTitle}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setIsErrorDialogOpen(false)}
      />
    </Container>
  );
}
