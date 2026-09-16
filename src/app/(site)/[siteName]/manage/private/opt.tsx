'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
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
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

type Category = {
  id: string | null;
  label: string;
};

type BoardResponse = {
  siteType?: string | null;
  board?: { id: string; board_label: string; is_image_enabled: boolean } | null;
  categories?: { id: string; category_label: string }[];
  error?: string;
};

type Notice = {
  title: string;
  message: string;
};

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommunity, setIsCommunity] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [boardLabel, setBoardLabel] = useState('');
  const [isImageEnabled, setIsImageEnabled] = useState(true);
  const [categories, setCategories] = useState<Category[]>([{ id: null, label: '분류없음' }]);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/private-board/manage?siteName=${siteName}`, { credentials: 'include' });
        const result = (await response.json()) as BoardResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '비공개 게시판 정보를 불러오지 못했습니다.');
        }

        setIsCommunity(result.siteType === 'community');
        setIsInstalled(Boolean(result.board));
        setBoardLabel(result.board?.board_label ?? '');
        setIsImageEnabled(result.board?.is_image_enabled ?? true);
        setCategories(
          result.categories?.length
            ? result.categories.map((category) => ({ id: category.id, label: category.category_label }))
            : [{ id: null, label: '분류없음' }],
        );
      } catch (error) {
        setNotice({
          title: '불러오기 실패',
          message: error instanceof Error ? error.message : '비공개 게시판 정보를 불러오지 못했습니다.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [siteName]);

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

  if (isLoading) {
    return (
      <Container pageTitle="비공개 게시판" pageBack={`/${siteName}/manage`}>
        <div className={`container ${styles.container}`}>
          <div className="loading-container">
            <LoadingIndicator />
          </div>
        </div>
      </Container>
    );
  }

  if (!isCommunity) {
    return (
      <Container pageTitle="비공개 게시판" pageBack={`/${siteName}/manage`}>
        <div className={`container ${styles.container}`}>
          <p className="alert error">커뮤니티에서만 사용할 수 있습니다.</p>
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
        <Drawer anchor="bottom" open={Boolean(notice)} onClose={() => setNotice(null)} className="VhiDrawer-bottom">
          <h2>{notice?.title}</h2>
          <button type="button" className="close-button" onClick={() => setNotice(null)} aria-label="팝업 닫기">
            <CloseRoundedIcon />
          </button>
          <Stack gap={2} sx={{ pt: 1 }}>
            <Typography variant="subtitle2">{notice?.message}</Typography>
            <button type="button" onClick={() => setNotice(null)} className="button medium submit">
              확인
            </button>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={Boolean(notice)} onClose={() => setNotice(null)} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>{notice?.title}</DialogTitle>
          <button type="button" className="close-button" onClick={() => setNotice(null)} aria-label="팝업 닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="subtitle2">{notice?.message}</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setNotice(null)} className="button medium submit">
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}
