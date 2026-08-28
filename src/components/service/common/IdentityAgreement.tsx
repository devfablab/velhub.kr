'use client';

import { useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

type AgreementType = 'identity' | 'settlement';

type IdentityAgreementProps = {
  type: AgreementType;
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  showAgreementCheck?: boolean;
};

function openLawWindow(url: string) {
  window.open(
    url,
    `velhub-law-${Date.now()}`,
    [
      'popup=yes',
      'width=960',
      'height=760',
      'left=80',
      'top=80',
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
    ].join(','),
  );
}

function AgreementContent({ type }: { type: AgreementType }) {
  if (type === 'identity') {
    return (
      <Stack gap={2}>
        <Typography variant="body2">
          데브허브는 수익 활동 자격 확인과 정산정보 등록을 위해 본인인증을 진행합니다.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>수집 · 이용 목적</TableCell>
              <TableCell>수집 항목</TableCell>
              <TableCell>보유 · 이용 기간</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>본인확인, 수익 활동 자격 확인, 정산 대상자 확인</TableCell>
              <TableCell>이름, 생년월일, 성별</TableCell>
              <TableCell>회원 탈퇴 확정 시까지</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Typography variant="body2">
          본인인증 정보 수집 · 이용에 동의하지 않을 권리가 있습니다. 다만 동의를 거부하면 정산정보 등록 및 수익 활동을
          이용할 수 없습니다.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      <Typography variant="body2">
        데브허브는 수익 활동 자격 확인, 정산금 지급, 정산 관련 안내 및 세무 처리를 위해 아래 개인정보를 수집 ·
        이용합니다.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>구분</TableCell>
            <TableCell>수집 · 이용 목적</TableCell>
            <TableCell>수집 항목</TableCell>
            <TableCell>보유 · 이용 기간</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>공통</TableCell>
            <TableCell>본인확인, 수익 활동 자격 확인, 정산 대상자 확인, 정산금 지급, 정산 관련 안내</TableCell>
            <TableCell>이름, 생년월일, 성별, 은행명, 계좌번호, 예금주, 결제 이메일</TableCell>
            <TableCell>회원 탈퇴 확정 시까지. 단, 정산 및 세무 처리 기록은 관련 법령에 따라 5년</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>개인 회원</TableCell>
            <TableCell>사업소득 원천징수, 간이지급명세서 및 지급명세서 제출 등 세무 처리</TableCell>
            <TableCell>주민등록번호, 사업소득 유형</TableCell>
            <TableCell>관련 정산 및 세무 처리 기록 발생일로부터 5년</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>기업 회원</TableCell>
            <TableCell>기업 정산 대상 확인 및 세무 처리</TableCell>
            <TableCell>회사명 또는 법인명, 사업자등록번호, 사업자등록증</TableCell>
            <TableCell>관련 정산 및 세무 처리 기록 발생일로부터 5년</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Typography variant="body2">
        개인정보 수집 · 이용에 동의하지 않을 권리가 있습니다. 다만 동의를 거부하면 정산정보 등록 및 수익 활동을 이용할
        수 없습니다.
      </Typography>
      <Stack gap={1}>
        <Typography variant="subtitle2">주민등록번호 처리 안내</Typography>
        <Typography variant="body2">
          데브허브는 사업소득 원천징수, 간이지급명세서 및 지급명세서 제출 등 세무 처리를 위해 주민등록번호를 처리합니다.
          주민등록번호는 「소득세법」에 따른 지급명세서 제출 의무 이행에 필요한 범위에서만 처리하며, 관련 법령에 따라
          안전하게 보관합니다.
        </Typography>
        <Typography variant="body2">
          사업소득 지급자는 지급명세서와 간이지급명세서를 제출해야 합니다.{' '}
          <button
            type="button"
            className="button-term"
            onClick={() => openLawWindow('https://law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900035105')}
          >
            소득세법 제164조
          </button>
          {', '}
          <button
            type="button"
            className="button-term"
            onClick={() =>
              openLawWindow('https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030573049')
            }
          >
            소득세법 제164조의3
          </button>
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function IdentityAgreement({
  type,
  open,
  onClose,
  onConfirm,
  showAgreementCheck = true,
}: IdentityAgreementProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [isAgreed, setIsAgreed] = useState(false);
  const title = type === 'identity' ? '본인인증 이용안내' : '정산정보 수집 · 이용 안내';
  const agreementLabel = type === 'identity' ? '[필수] 본인인증 이용안내 동의' : '[필수] 정산정보 수집 · 이용 동의';
  const closeClassName = isMobile ? 'button medium cancel' : 'button medium close';

  const actions = showAgreementCheck ? (
    <>
      <button type="button" className={closeClassName} onClick={onClose}>
        취소
      </button>
      <button type="button" className="button medium submit" disabled={!isAgreed} onClick={onConfirm}>
        다음
      </button>
    </>
  ) : (
    <button type="button" className={closeClassName} onClick={onClose}>
      확인
    </button>
  );

  const content = (
    <Stack gap={3}>
      <AgreementContent type={type} />
      {showAgreementCheck ? (
        <FormControlLabel
          control={<Checkbox checked={isAgreed} onChange={(event) => setIsAgreed(event.target.checked)} />}
          label={<Typography variant="body2">{agreementLabel}</Typography>}
        />
      ) : null}
    </Stack>
  );

  if (isMobile) {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom">
        <h2>{title}</h2>
        <button type="button" className="close-button" onClick={onClose}>
          <CloseRoundedIcon />
        </button>
        {content}
        <Stack direction="column" spacing={1.5}>
          {actions}
        </Stack>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth className="VhiDialog">
      <DialogTitle>{title}</DialogTitle>
      <button type="button" className="close-button" onClick={onClose}>
        <CloseRoundedIcon />
      </button>
      <DialogContent>{content}</DialogContent>
      <DialogActions>{actions}</DialogActions>
    </Dialog>
  );
}
