'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FormErrorDialog from '@/components/FormErrorDialog';

type Props = {
  siteName: string;
};

type RejoinMode = 'restore' | 'reset';

type RejoinResponse = {
  ok?: boolean;
  error?: string;
};

export default function Opt({ siteName }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('lg'));

  async function handleRejoin(mode: RejoinMode) {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(`/api/users/${siteName}/me/rejoin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          mode,
        }),
      });

      const result = (await response.json()) as RejoinResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '재가입에 실패했습니다.');
      }

      router.replace(`/${siteName}`);
      router.refresh();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '재가입에 실패했습니다.');
      } else {
        setErrorMessage('재가입에 실패했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  return (
    <Stack gap={2.5}>
      <p className="alert info">
        <InfoOutlineRoundedIcon />
        <span>재가입할 때 탈퇴 전에 작성한 글과 댓글을 복구할 수 있습니다.</span>
      </p>
      <p className="alert warning">
        <WarningAmberRoundedIcon />
        <span>
          초기화 후 재가입하면 기존 글과 댓글, 해당 글에 첨부한 이미지 파일이 모두 영구 삭제되며 복구할 수 없습니다.
        </span>
      </p>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      <Stack direction="row" gap={2} justifyContent="flex-end">
        <button
          type="button"
          className="button medium action"
          onClick={() => void handleRejoin('restore')}
          disabled={isSubmitting}
        >
          복구 후 재가입하기
        </button>
        <button
          type="button"
          className="button medium action"
          onClick={() => setIsResetConfirmOpen(true)}
          disabled={isSubmitting}
        >
          초기화 후 재가입하기
        </button>
      </Stack>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isResetConfirmOpen}
          onClose={() => !isSubmitting && setIsResetConfirmOpen(false)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>초기화 후 재가입</h2>
          <button
            type="button"
            className="close-button"
            onClick={() => setIsResetConfirmOpen(false)}
            disabled={isSubmitting}
            aria-label="닫기"
          >
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <ul>
              <li>기존 글, 댓글, 첨부 파일은 영구 삭제되며 복구할 수 없습니다.</li>
              <li>결제 또는 후원 이력이 있는 글은 거래 내역 보존을 위해 삭제하지 않고 복구됩니다.</li>
            </ul>
          </div>
          <div className="drawer-dialog-actions">
            <button
              type="button"
              className="button small cancel"
              onClick={() => setIsResetConfirmOpen(false)}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className="button small danger"
              onClick={() => void handleRejoin('reset')}
              disabled={isSubmitting}
            >
              초기화 후 재가입
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isResetConfirmOpen}
          onClose={() => !isSubmitting && setIsResetConfirmOpen(false)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>초기화 후 재가입</DialogTitle>
          <DialogContent>
            <ul>
              <li>기존 글, 댓글, 첨부 파일은 영구 삭제되며 복구할 수 없습니다.</li>
              <li>결제 또는 후원 이력이 있는 글은 거래 내역 보존을 위해 삭제하지 않고 복구됩니다.</li>
            </ul>
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="cancel-button"
              onClick={() => setIsResetConfirmOpen(false)}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="button"
              className="delete-button"
              onClick={() => void handleRejoin('reset')}
              disabled={isSubmitting}
            >
              초기화 후 재가입
            </button>
          </DialogActions>
        </Dialog>
      )}

      <FormErrorDialog
        open={Boolean(errorMessage)}
        title={null}
        messages={[errorMessage]}
        onClose={() => setErrorMessage('')}
      />
    </Stack>
  );
}
