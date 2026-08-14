'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  FormGroup,
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

type AgreementState = {
  isAgreeTerm: boolean;
  isAgreeChild: boolean;
  isAgreePrivacy: boolean;
  canSubmit: boolean;
  setAgreement: (key: 'term' | 'child' | 'privacy', value: boolean) => void;
};

const AgreementContext = createContext<AgreementState | null>(null);

export function SignupAgreementsProvider({ children }: { children: React.ReactNode }) {
  const [isAgreeTerm, setIsAgreeTerm] = useState(false);
  const [isAgreeChild, setIsAgreeChild] = useState(false);
  const [isAgreePrivacy, setIsAgreePrivacy] = useState(false);

  const value = useMemo<AgreementState>(
    () => ({
      isAgreeTerm,
      isAgreeChild,
      isAgreePrivacy,
      canSubmit: isAgreeTerm && isAgreeChild && isAgreePrivacy,
      setAgreement: (key, nextValue) => {
        if (key === 'term') setIsAgreeTerm(nextValue);
        if (key === 'child') setIsAgreeChild(nextValue);
        if (key === 'privacy') setIsAgreePrivacy(nextValue);
      },
    }),
    [isAgreeTerm, isAgreeChild, isAgreePrivacy],
  );

  return <AgreementContext.Provider value={value}>{children}</AgreementContext.Provider>;
}

export function useSignupAgreements() {
  const context = useContext(AgreementContext);

  if (!context) {
    throw new Error('SignupAgreementsProvider가 필요합니다.');
  }

  return context;
}

function PrivacyContent() {
  return (
    <Stack gap={2}>
      <Typography variant="body2">
        데브허브는 회원가입 및 서비스 제공을 위해 아래와 같이 개인정보를 수집·이용합니다.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>수집·이용 목적</TableCell>
            <TableCell>수집 항목</TableCell>
            <TableCell>보유·이용 기간</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>회원 식별, 가입 및 로그인, 계정 관리, 서비스 제공</TableCell>
            <TableCell>이메일 주소, 비밀번호, 활동명</TableCell>
            <TableCell>데브허브 탈퇴 확정 시까지</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>소셜 로그인 계정 식별 및 로그인 연동</TableCell>
            <TableCell>소셜 로그인 제공자, 제공자 계정 식별자, 이메일 주소(제공받은 경우)</TableCell>
            <TableCell>데브허브 탈퇴 확정 시까지</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Typography variant="body2">
        개인정보 수집·이용에 동의하지 않을 권리가 있습니다. 다만 동의를 거부하면 데브허브 회원가입 및 로그인 서비스를
        이용할 수 없습니다.
      </Typography>
    </Stack>
  );
}

function PrivacyAgreement({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(false);

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <FormControlLabel
          control={<Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />}
          label={<Typography variant="body2">[필수] 개인정보 수집 및 이용 동의</Typography>}
        />
        <button type="button" className="button-term" onClick={() => setOpen(true)}>
          내용 보기
        </button>
      </Stack>
      {isMobile ? (
        <Drawer anchor="bottom" open={open} onClose={() => setOpen(false)} className="VhiDrawer-bottom">
          <Stack gap={3}>
            <Typography variant="h6">개인정보 수집 및 이용 동의</Typography>
            <button className="close-button" onClick={() => setOpen(false)}>
              <CloseRoundedIcon />
            </button>
            <PrivacyContent />
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={() => setOpen(false)}>
                확인
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth className="VhiDialog">
          <DialogTitle>개인정보 수집 및 이용 동의</DialogTitle>
          <button className="close-button" onClick={() => setOpen(false)}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <PrivacyContent />
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={() => setOpen(false)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

export function SignupAgreementFields() {
  const { isAgreeTerm, isAgreeChild, isAgreePrivacy, setAgreement } = useSignupAgreements();
  const allChecked = isAgreeTerm && isAgreeChild && isAgreePrivacy;

  function setAll(value: boolean) {
    setAgreement('term', value);
    setAgreement('child', value);
    setAgreement('privacy', value);
  }

  return (
    <Stack gap={0.5} sx={{ mt: 1 }}>
      <FormGroup>
        <FormControlLabel
          control={<Checkbox checked={allChecked} onChange={(event) => setAll(event.target.checked)} />}
          label={<Typography variant="subtitle2">모두 동의합니다</Typography>}
        />
        <FormControlLabel
          control={
            <Checkbox checked={isAgreeChild} onChange={(event) => setAgreement('child', event.target.checked)} />
          }
          label={<Typography variant="body2">[필수] 만 14세 이상입니다</Typography>}
        />
      </FormGroup>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <FormControlLabel
          control={<Checkbox checked={isAgreeTerm} onChange={(event) => setAgreement('term', event.target.checked)} />}
          label={<Typography variant="body2">[필수] 이용약관 동의</Typography>}
        />
        <button
          type="button"
          className="button-term"
          onClick={() =>
            window.open(
              '/luvelhub/b/3220865262',
              'velhub-terms',
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
            )
          }
        >
          내용 보기
        </button>
      </Stack>
      <PrivacyAgreement checked={isAgreePrivacy} onChange={(value) => setAgreement('privacy', value)} />
    </Stack>
  );
}
