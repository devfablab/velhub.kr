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

type Reason =
  | 'unsafe_link'
  | 'illegal_or_harmful_site'
  | 'different_destination'
  | 'non_product_link'
  | 'problematic_product'
  | 'broken_link';

const reasons: { value: Reason; title: string; descriptions: string[] }[] = [
  {
    value: 'unsafe_link',
    title: '안전하지 않은 링크입니다.',
    descriptions: [
      '피싱·사칭 사이트이거나 악성코드·악성 앱 설치를 유도하는 것으로 의심되는 경우',
      '로그인·결제·개인정보 입력을 비정상적으로 요구하는 경우',
      '단축 URL이나 여러 번의 이동으로 실제 도착지를 숨기는 경우',
      '단순한 가격·품질·배송 불만은 해당하지 않습니다.',
    ],
  },
  {
    value: 'illegal_or_harmful_site',
    title: '불법 또는 유해한 사이트로 연결됩니다.',
    descriptions: [
      '도박·불법 대출·성인물 등 불법·유해 사이트로 연결되는 경우',
      '위조품·불법 복제물을 주로 판매하는 사이트로 연결되는 경우',
      '성인 인증 없이 청소년에게 유해한 내용이 노출되는 경우',
      '단순한 가격·품질·배송 불만은 해당하지 않습니다.',
    ],
  },
  {
    value: 'different_destination',
    title: '표시된 정보와 다른 곳으로 연결됩니다.',
    descriptions: [
      '표시된 쇼핑몰이 아닌 다른 쇼핑몰이나 사이트로 연결되는 경우',
      '표시된 상품이 아닌 다른 상품 페이지로 연결되는 경우',
      '협찬사로 표시된 업체와 관계없는 곳으로 연결되는 경우',
    ],
  },
  {
    value: 'non_product_link',
    title: '상품과 관련 없는 링크입니다.',
    descriptions: [
      '상품 페이지가 아닌 회원가입·이벤트·앱 설치 페이지로 연결되는 경우',
      '다른 블로그·카페·SNS 등 홍보용 페이지로 연결되는 경우',
      '상품 정보 없이 추천인 코드 입력이나 포인트 적립을 유도하는 경우',
    ],
  },
  {
    value: 'problematic_product',
    title: '판매나 광고가 금지된 상품입니다.',
    descriptions: [
      '의약품을 온라인으로 판매하는 경우',
      '건강기능식품·화장품·일반 식품이 질병 치료나 예방 효과를 내세우는 경우',
      "'100% 효과', '부작용 없음'처럼 효능이나 결과를 보장하는 경우",
      '위조품이나 판매가 금지된 물품인 경우',
      '단순한 가격·품질·배송 불만은 해당하지 않습니다.',
    ],
  },
  {
    value: 'broken_link',
    title: '링크가 동작하지 않습니다.',
    descriptions: [
      '페이지가 열리지 않거나 오류 페이지(404 등)가 표시되는 경우',
      '판매가 끝났거나 삭제된 상품 페이지로 연결되는 경우',
      '보안 경고가 떠서 페이지에 들어갈 수 없는 경우',
    ],
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
            <button type="button" className="button medium close" onClick={closeReport} disabled={isSubmitting}>
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
