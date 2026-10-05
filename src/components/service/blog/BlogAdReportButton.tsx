'use client';

import { type MouseEvent, type SyntheticEvent, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FormErrorDialog from '@/components/FormErrorDialog';
import styles from '@/app/reports.module.sass';

type Reason = 'unsafe_link' | 'illegal_or_harmful_site' | 'different_destination' | 'broken_link';

const reasons: { value: Reason; title: string; descriptions: string[] }[] = [
  {
    value: 'unsafe_link',
    title: '안전하지 않은 링크입니다.',
    descriptions: ['피싱, 악성코드, 개인정보 탈취 등이 의심되는 경우'],
  },
  {
    value: 'illegal_or_harmful_site',
    title: '불법 또는 유해한 사이트로 연결됩니다.',
    descriptions: ['불법 상품·도박·성인물 등 이용에 부적절한 사이트로 연결되는 경우'],
  },
  {
    value: 'different_destination',
    title: '표시된 정보와 다른 사이트로 연결됩니다.',
    descriptions: ['상품명 또는 협찬사 정보와 관계없는 사이트로 연결되는 경우'],
  },
  {
    value: 'broken_link',
    title: '링크가 동작하지 않습니다.',
    descriptions: ['페이지를 열 수 없거나 존재하지 않는 주소로 연결되는 경우'],
  },
];

type Props = {
  siteName: string;
  adId: string;
  targetType: 'ad' | 'postAd';
};

export default function BlogAdReportButton({ siteName, adId, targetType }: Props) {
  const [menuAnchorElement, setMenuAnchorElement] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedReason, setExpandedReason] = useState<Reason | false>(false);
  const [selectedReason, setSelectedReason] = useState<Reason | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  function closeMenu() {
    setMenuAnchorElement(null);
  }

  function openReport() {
    closeMenu();
    setOpen(true);
    setError('');
    setCompleted(false);
  }

  function closeReport() {
    if (isSubmitting) return;
    setOpen(false);
    setExpandedReason(false);
    setSelectedReason('');
    setError('');
    setCompleted(false);
  }

  function handleAccordionChange(reason: Reason) {
    return (_event: SyntheticEvent, expanded: boolean) => setExpandedReason(expanded ? reason : false);
  }

  function handleReasonChange(reason: Reason) {
    setSelectedReason((currentReason) => (currentReason === reason ? '' : reason));
    setError('');
  }

  async function submit() {
    if (!selectedReason) {
      setError('신고 사유를 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch(
        `/api/site/${encodeURIComponent(siteName)}/blog-ads/${encodeURIComponent(adId)}/report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType, reason: selectedReason }),
        },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || '신고를 접수하지 못했습니다.');
      setCompleted(true);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '신고를 접수하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderContent() {
    if (completed) return <Typography variant="subtitle2">신고가 접수되었습니다.</Typography>;

    return (
      <>
        {error ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{error}</span>
          </p>
        ) : null}
        <div className={`paper ${styles.Accordion}`}>
          {reasons.map((item) => (
            <Accordion
              key={item.value}
              expanded={expandedReason === item.value}
              onChange={handleAccordionChange(item.value)}
            >
              <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                <Typography variant="subtitle2">{item.title}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <ul className={styles.reports}>
                  {item.descriptions.map((description) => (
                    <li key={description}>{description}</li>
                  ))}
                </ul>
                <FormControlLabel
                  control={
                    <Checkbox checked={selectedReason === item.value} onChange={() => handleReasonChange(item.value)} />
                  }
                  label="이 내용으로 신고합니다"
                />
              </AccordionDetails>
            </Accordion>
          ))}
        </div>
      </>
    );
  }

  function renderSubmitButton() {
    if (completed) return null;

    return (
      <button
        type="button"
        className={isMobile ? 'button small submit' : undefined}
        onClick={() => void submit()}
        disabled={isSubmitting || !selectedReason}
      >
        신고 접수
      </button>
    );
  }

  return (
    <>
      <IconButton
        type="button"
        aria-label="신고 메뉴 열기"
        aria-haspopup="menu"
        onClick={(event: MouseEvent<HTMLButtonElement>) => setMenuAnchorElement(event.currentTarget)}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu anchorEl={menuAnchorElement} open={Boolean(menuAnchorElement)} onClose={closeMenu}>
        <MenuItem dense onClick={openReport}>
          <ListItemIcon>
            <ReportOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>광고 신고하기</ListItemText>
        </MenuItem>
      </Menu>
      {isMobile ? (
        <Drawer anchor="bottom" open={open} onClose={closeReport} className="VhiDrawer-bottom VhiDrawer-bottom-service">
          <h2>신고하기</h2>
          <button type="button" className="close-button" onClick={closeReport} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{renderContent()}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small cancel" onClick={closeReport} disabled={isSubmitting}>
              {completed ? '닫기' : '취소'}
            </button>
            {renderSubmitButton()}
          </div>
        </Drawer>
      ) : (
        <Dialog open={open} onClose={closeReport} fullWidth maxWidth="sm" className="vh-dialog vh-alert-dialog">
          <DialogTitle>신고하기</DialogTitle>
          <button type="button" className="close-button" onClick={closeReport} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{renderContent()}</DialogContent>
          <DialogActions>
            <button type="button" onClick={closeReport} disabled={isSubmitting}>
              {completed ? '닫기' : '취소'}
            </button>
            {renderSubmitButton()}
          </DialogActions>
        </Dialog>
      )}
      <FormErrorDialog
        open={Boolean(error)}
        title={null}
        messages={error ? [error] : []}
        onClose={() => setError('')}
      />
    </>
  );
}
