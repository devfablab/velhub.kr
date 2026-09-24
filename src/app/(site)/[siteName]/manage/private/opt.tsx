'use client';

import { useState } from 'react';
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

type OptProps = { initialData: BoardResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [isSaving, setIsSaving] = useState(false);
  const [isCommunity, setIsCommunity] = useState(initialData?.siteType === 'community');
  const [isInstalled, setIsInstalled] = useState(Boolean(initialData?.board));
  const [boardLabel, setBoardLabel] = useState(initialData?.board?.board_label ?? '');
  const [isImageEnabled, setIsImageEnabled] = useState(initialData?.board?.is_image_enabled ?? true);
  const [categories, setCategories] = useState<Category[]>(
    initialData?.categories?.length
      ? initialData.categories.map((category) => ({ id: category.id, label: category.category_label }))
      : [{ id: null, label: '분류없음' }],
  );
  const [notice, setNotice] = useState<Notice | null>(
    initialError ? { title: '불러오기 실패', message: initialError } : null,
  );

  function changeCategory(index: number, label: string) {
    setCategories((previous) =>
      previous.map((category, categoryIndex) => (categoryIndex === index ? { ...category, label } : category)),
    );
  }

  async function handleSave() {
    if (isSaving) return;

    setIsSaving(true);

    try {
      const response = await fetch('/api/private-board/manage', {
        method: isInstalled ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardLabel,
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
      setNotice({
        title: isInstalled ? '수정 실패' : '설치 실패',
        message:
          error instanceof Error ? error.message : `비공개 게시판 ${isInstalled ? '수정' : '설치'}에 실패했습니다.`,
      });
    } finally {
      setIsSaving(false);
    }
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
          <div className={`paper ${styles.paper}`}>
            <Stack gap={2}>
              <Typography variant="h6">게시판 설정</Typography>
              <TextField
                value={boardLabel}
                onChange={(event) => setBoardLabel(event.target.value)}
                placeholder="게시판 이름"
                required
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
                  />
                  <IconButton
                    aria-label="카테고리 삭제"
                    disabled={categories.length === 1}
                    onClick={() =>
                      setCategories((previous) => previous.filter((_, categoryIndex) => categoryIndex !== index))
                    }
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </div>
          <Stack direction="row" justifyContent="flex-end">
            <button
              type="button"
              className="button medium submit"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isInstalled ? '수정 완료' : '설치 완료'}
            </button>
          </Stack>
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
    </Container>
  );
}
