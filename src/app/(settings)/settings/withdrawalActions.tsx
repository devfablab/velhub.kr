'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';
import styles from '@/app/settings.module.sass';

type WithdrawalResponse = {
  ok?: boolean;
  error?: string;
};

export default function WithdrawalActions() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function handleCloseConfirm() {
    if (isSubmitting) {
      return;
    }

    setIsConfirmOpen(false);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/account/withdrawal', {
        method: 'POST',
        credentials: 'include',
      });
      const result = (await response.json()) as WithdrawalResponse;

      if (!response.ok) {
        throw new Error(result.error || '탈퇴 신청에 실패했습니다.');
      }

      const signOutResult = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '탈퇴 신청에 실패했습니다.');
      } else {
        setErrorMessage('탈퇴 신청에 실패했습니다.');
      }
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Grid size={12} className={styles.grid}>
      <Accordion
        expanded={isExpanded}
        onChange={(_event, expanded) => setIsExpanded(expanded)}
        disableGutters
        variant="outlined"
        className={`paper ${styles.paper}`}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" component="strong">
            데브허브 탈퇴
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack gap={2}>
            <Typography variant="body2">탈퇴 신청 후 30일 내에 취소할 수 있습니다.</Typography>
            <Typography variant="body2">
              탈퇴 신청과 함께 작성한 글과 댓글은 삭제처리되고, 구독과 멤버십 및 요금제의 다음 결제가 취소됩니다.
            </Typography>
            <Typography variant="body2">
              탈퇴 신청을 취소하면 삭제된 글과 댓글은 복구됩니다. 구독과 멤버십은 자동 복구되지 않습니다.
            </Typography>
            <Stack direction="row" justifyContent="flex-end">
              <button type="button" className="button small danger" onClick={() => setIsConfirmOpen(true)}>
                탈퇴 신청
              </button>
            </Stack>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Dialog open={isConfirmOpen} onClose={handleCloseConfirm} fullWidth maxWidth="xs" className="VhiDialog">
        <DialogTitle>데브허브 탈퇴</DialogTitle>
        <DialogContent>
          <Typography variant="body2">탈퇴를 신청하시겠어요?</Typography>
        </DialogContent>
        <DialogActions>
          <button type="button" className="button medium close" onClick={handleCloseConfirm} disabled={isSubmitting}>
            취소
          </button>
          <button type="button" className="button medium warning" onClick={handleSubmit} disabled={isSubmitting}>
            탈퇴 신청
          </button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
}
