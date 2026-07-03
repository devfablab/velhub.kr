'use client';

import { useState, type MouseEvent, type SyntheticEvent } from 'react';
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
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  guidelineReportItemsByTargetType,
  type GuidelineReportCategory,
  type ReportTargetType,
} from '@/lib/reports/guidelines';
import styles from '@/app/reports.module.sass';

type ReportButtonProps = {
  targetType: ReportTargetType;
  siteName: string;
  boardName?: string | null;
  contentId?: string | number | null;
  commentId?: string | number | null;
};

type ReportResponse = {
  ok?: boolean;
  error?: string;
};

export default function ReportButton({
  targetType,
  siteName,
  boardName = null,
  contentId = null,
  commentId = null,
}: ReportButtonProps) {
  const [menuAnchorElement, setMenuAnchorElement] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<GuidelineReportCategory | false>(false);
  const [selectedCategory, setSelectedCategory] = useState<GuidelineReportCategory | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [completed, setCompleted] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const menuOpen = Boolean(menuAnchorElement);
  const guidelineReportItems = guidelineReportItemsByTargetType[targetType];

  function handleMenuOpen(mouseEvent: MouseEvent<HTMLButtonElement>) {
    setMenuAnchorElement(mouseEvent.currentTarget);
  }

  function handleMenuClose() {
    setMenuAnchorElement(null);
  }

  function handleOpen() {
    setMenuAnchorElement(null);
    setOpen(true);
    setErrorMessage('');
    setCompleted(false);
  }

  function handleClose() {
    if (submitting) {
      return;
    }

    setOpen(false);
    setExpandedCategory(false);
    setSelectedCategory('');
    setErrorMessage('');
    setCompleted(false);
  }

  function handleAccordionChange(reportCategory: GuidelineReportCategory) {
    return function handleAccordionChangeEvent(syntheticEvent: SyntheticEvent, expanded: boolean) {
      setExpandedCategory(expanded ? reportCategory : false);
    };
  }

  function handleCheck(reportCategory: GuidelineReportCategory) {
    setSelectedCategory((currentCategory) => (currentCategory === reportCategory ? '' : reportCategory));
    setErrorMessage('');
  }

  async function handleSubmit() {
    if (!selectedCategory) {
      setErrorMessage('신고 사유를 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    const response = await fetch('/api/reports/new', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetType,
        siteName,
        boardName,
        contentId,
        commentId,
        reportCategory: selectedCategory,
      }),
    });

    const result = (await response.json().catch(() => ({
      error: '신고 처리 중 응답을 확인하지 못했습니다.',
    }))) as ReportResponse;

    setSubmitting(false);

    if (!response.ok || result.error) {
      setErrorMessage(result.error ?? '신고를 접수하지 못했습니다.');
      return;
    }

    setCompleted(true);
  }

  return (
    <>
      <IconButton type="button" aria-label="신고 메뉴 열기" aria-haspopup="menu" onClick={handleMenuOpen}>
        <MoreHorizIcon />
      </IconButton>

      <Menu anchorEl={menuAnchorElement} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem onClick={handleOpen}>신고하기</MenuItem>
      </Menu>

      {isMobile ? (
        <Drawer anchor="bottom" open={open} onClose={handleClose} className="VhiDrawer-bottom">
          <h2>신고하기</h2>
          <button className="close-button" onClick={handleClose}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {completed ? (
              <Typography variant="subtitle2">신고가 접수되었습니다.</Typography>
            ) : (
              <>
                {errorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{errorMessage}</span>
                  </p>
                ) : null}

                <div className={`paper ${styles.Accordion}`}>
                  {guidelineReportItems.map((item) => (
                    <Accordion
                      key={item.value}
                      expanded={expandedCategory === item.value}
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
                            <Checkbox
                              checked={selectedCategory === item.value}
                              onChange={() => handleCheck(item.value)}
                            />
                          }
                          label="이 내용으로 신고합니다"
                        />
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </div>
              </>
            )}

            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={handleClose} disabled={submitting}>
                {completed ? '닫기' : '취소'}
              </button>
              {completed ? null : (
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedCategory}
                >
                  신고 접수
                </button>
              )}
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" className="VhiDialog">
          <DialogTitle>신고하기</DialogTitle>
          <button className="close-button" onClick={handleClose}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            {completed ? (
              <Typography variant="subtitle2">신고가 접수되었습니다.</Typography>
            ) : (
              <>
                {errorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{errorMessage}</span>
                  </p>
                ) : null}

                <div className={`paper ${styles.Accordion}`}>
                  {guidelineReportItems.map((item) => (
                    <Accordion
                      key={item.value}
                      expanded={expandedCategory === item.value}
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
                            <Checkbox
                              checked={selectedCategory === item.value}
                              onChange={() => handleCheck(item.value)}
                            />
                          }
                          label="이 내용으로 신고합니다"
                        />
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </div>
              </>
            )}
          </DialogContent>

          <DialogActions>
            <button type="button" className="button medium close" onClick={handleClose} disabled={submitting}>
              {completed ? '닫기' : '취소'}
            </button>
            {completed ? null : (
              <button
                type="button"
                className="button medium submit"
                onClick={handleSubmit}
                disabled={submitting || !selectedCategory}
              >
                신고 접수
              </button>
            )}
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
