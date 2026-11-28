'use client';

import { type JSX, type ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { SECURITY_CHECK_REQUIRED_CODE, SETTINGS_CHECK_REQUIRED_CODE } from '@/lib/auth/accessContext';
import { normalizeSecurityPin } from '@/lib/auth/securityPin';
import { getSupabaseBrowser } from '@/lib/clients/supabase';
import SecurityPinInput from '@/components/auth/SecurityPinInput';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type SecurityCheckPurpose = 'access' | 'settings';

type SecurityCheckMethods = {
  password: boolean;
  totp: boolean;
  emailPin: boolean;
};

type SecurityCheckResponse = {
  ok?: boolean;
  methods?: SecurityCheckMethods;
  maskedEmail?: string;
  loggedOut?: boolean;
  error?: string;
};

const DESCRIPTIONS: Record<SecurityCheckPurpose, string> = {
  access: '계정 주인 확인이 필요합니다.',
  settings: '개인 설정은 계정 주인만 열람 가능합니다.',
};

const FIVE_FAILURES_GUIDE = '5번 틀리면 모든 기기에서 로그아웃됩니다.';

const METHOD_GUIDES: Record<keyof SecurityCheckMethods, string> = {
  password: '계정 비밀번호를 입력해 주세요.',
  totp: '2단계 인증 앱에 표시된 6자리 코드를 입력해 주세요.',
  emailPin: '보안 비밀번호 복구용 이메일로 우선 인증번호를 받으세요.',
};

const EMAIL_CODE_VALID_MILLISECONDS = 5 * 60 * 1000;

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}분 ${seconds}초`;
}

function SecurityCheckDialog({ purpose, onFinish }: { purpose: SecurityCheckPurpose; onFinish?: () => void }) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const formId = `security-check-${purpose}-form`;
  const titleId = `components-auth-security-check-${purpose}-title`;

  const [methods, setMethods] = useState<SecurityCheckMethods | null>(null);
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const pinFieldReference = useRef<HTMLDivElement>(null);
  const submitButtonReference = useRef<HTMLButtonElement>(null);
  const [emailCode, setEmailCode] = useState('');
  const [pin, setPin] = useState('');
  const [emailCodeExpiresAt, setEmailCodeExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const isBusy = isLoading || isSubmitting || isLoggedOut;
  const canClose = isLoggedOut || purpose === 'settings';
  const remainingSeconds = emailCodeExpiresAt ? Math.max(0, Math.ceil((emailCodeExpiresAt - now) / 1000)) : 0;
  const isEmailCodeExpired = Boolean(emailCodeExpiresAt) && remainingSeconds === 0;

  useEffect(() => {
    if (!emailCodeExpiresAt) return;

    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      if (currentTime >= emailCodeExpiresAt) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [emailCodeExpiresAt]);

  useEffect(() => {
    let isActive = true;

    fetch('/api/auth/security-check', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as SecurityCheckResponse | null;

        if (!isActive) return;

        if (!response.ok || !result?.methods) {
          setErrorMessage(result?.error ?? '본인 확인 방법을 불러오지 못했습니다.');
          return;
        }

        setMethods(result.methods);
      })
      .catch(() => {
        if (isActive) setErrorMessage('본인 확인 방법을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function moveToSignIn() {
    await supabase.auth.signOut({ scope: 'local' });
    router.replace('/auth/sign-in');
    router.refresh();
  }

  async function handleSendEmailCode() {
    if (isSendingEmailCode) return;

    setIsSendingEmailCode(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/security-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'send-email-code' }),
      });
      const result = (await response.json().catch(() => null)) as SecurityCheckResponse | null;

      if (!response.ok || !result?.ok) {
        setErrorMessage(result?.error ?? '인증번호를 보내지 못했습니다.');
        return;
      }

      const sentAt = Date.now();
      setEmailCode('');
      setNow(sentAt);
      setEmailCodeExpiresAt(sentAt + EMAIL_CODE_VALID_MILLISECONDS);
    } catch {
      setErrorMessage('인증번호를 보내지 못했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setIsSendingEmailCode(false);
    }
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isBusy || !methods) return;

    if (
      (methods.password && !password) ||
      (methods.totp && totpCode.length !== 6) ||
      (methods.emailPin && (emailCode.length !== 6 || pin.length !== 6))
    ) {
      setErrorMessage(
        methods.emailPin && !emailCodeExpiresAt
          ? '먼저 복구용 이메일로 인증 번호를 받아 주세요.'
          : '본인 확인 정보를 모두 입력해 주세요.',
      );
      return;
    }

    if (methods.emailPin && isEmailCodeExpired) {
      setErrorMessage('입력 시간이 지났습니다.\n인증 번호를 다시 받아 주세요.');
      return;
    }

    let isNavigating = false;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/security-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'verify', purpose, password, totpCode, emailCode, pin }),
      });
      const result = (await response.json().catch(() => null)) as SecurityCheckResponse | null;

      if (result?.loggedOut) {
        setIsLoggedOut(true);
        setErrorMessage(result.error ?? '모든 기기에서 로그아웃되었습니다.');
        return;
      }

      if (!response.ok || !result?.ok) {
        setErrorMessage(result?.error ?? '본인 확인에 실패했습니다.\n잠시 후 다시 시도해 주세요.');
        setPassword('');
        setTotpCode('');
        setPin('');
        return;
      }

      if (onFinish) {
        onFinish();
        router.refresh();
        return;
      }

      isNavigating = true;
      router.refresh();
    } catch {
      setErrorMessage('본인 확인에 실패했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      if (!isNavigating) setIsSubmitting(false);
    }
  }

  function handleClose() {
    if (purpose === 'settings' && !isLoggedOut) {
      onFinish?.();
      router.replace('/');
      return;
    }

    void moveToSignIn();
  }

  const closeLabel = isLoggedOut ? '로그인 화면으로' : '돌아가기';

  const content = (
    <Stack gap={2}>
      <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
        {DESCRIPTIONS[purpose]}
      </Typography>

      {methods ? (
        <ul className="security-check-guides">
          {(Object.keys(METHOD_GUIDES) as (keyof SecurityCheckMethods)[])
            .filter((method) => methods[method])
            .map((method) => (
              <li key={method}>{METHOD_GUIDES[method]}</li>
            ))}
          <li>{FIVE_FAILURES_GUIDE}</li>
        </ul>
      ) : null}

      {methods?.password ? (
        <Stack gap={0.75}>
          <Typography variant="subtitle2" component="label" htmlFor={`${formId}-password`}>
            계정 비밀번호
          </Typography>
          <TextField
            id={`${formId}-password`}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            disabled={isBusy}
            fullWidth
            size="small"
          />
        </Stack>
      ) : null}

      {methods?.totp ? (
        <Stack gap={0.75}>
          <Typography variant="subtitle2" component="label" htmlFor={`${formId}-totp`}>
            2단계 인증 코드
          </Typography>
          <TextField
            id={`${formId}-totp`}
            placeholder="XXXXXX"
            value={totpCode}
            onChange={(event) => setTotpCode(normalizeSecurityPin(event.currentTarget.value))}
            disabled={isBusy}
            fullWidth
            size="small"
            autoComplete="one-time-code"
            slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 6 } }}
          />
        </Stack>
      ) : null}

      {methods?.emailPin ? (
        <>
          <button
            type="button"
            className="button medium action"
            onClick={handleSendEmailCode}
            disabled={isBusy || isSendingEmailCode}
          >
            {isSendingEmailCode ? <LoadingIndicator size={20} /> : null}
            {emailCodeExpiresAt ? '인증 번호 다시 받기' : '복구용 이메일로 인증 번호 받기'}
          </button>

          {emailCodeExpiresAt ? (
            <>
              <Typography variant="body2" component="p" role="status" sx={{ whiteSpace: 'pre-line' }}>
                {isEmailCodeExpired
                  ? '입력 시간이 지났습니다.\n인증 번호를 다시 받아 주세요.'
                  : `복구용 이메일로 인증 번호가 전송되었습니다.\n전송된 인증 번호를 입력해 주세요. ${formatRemainingTime(remainingSeconds)} 이내에 입력하세요.`}
              </Typography>
              <Stack gap={0.75}>
                <Typography variant="subtitle2" component="span">
                  인증 번호
                </Typography>
                <SecurityPinInput
                  label="인증 번호"
                  value={emailCode}
                  onChange={setEmailCode}
                  onComplete={() => pinFieldReference.current?.querySelector('input')?.focus()}
                  disabled={isBusy}
                />
              </Stack>
              <Stack ref={pinFieldReference} gap={0.75}>
                <Typography variant="subtitle2" component="span">
                  보안 비밀번호
                </Typography>
                <SecurityPinInput
                  label="보안 비밀번호"
                  value={pin}
                  onChange={setPin}
                  onComplete={() => submitButtonReference.current?.focus()}
                  disabled={isBusy}
                />
              </Stack>
            </>
          ) : null}
        </>
      ) : null}

      {isLoading ? (
        <Stack alignItems="center">
          <LoadingIndicator />
        </Stack>
      ) : null}

      {errorMessage ? (
        <ul className="error-messages" role="alert">
          <li style={{ whiteSpace: 'pre-line' }}>{errorMessage}</li>
        </ul>
      ) : null}
    </Stack>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={true}
        className="VhiDrawer-bottom VhiDrawer-bottom-service"
        slotProps={{ paper: { 'aria-labelledby': titleId } }}
      >
        <h2 id={titleId}>본인 확인</h2>
        {canClose ? (
          <Tooltip title={closeLabel}>
            <button className="close-button" onClick={handleClose} disabled={isSubmitting}>
              <CloseRoundedIcon />
            </button>
          </Tooltip>
        ) : null}
        <div className="VhiDrawer-bottom-content">
          <Box id={formId} component="form" onSubmit={handleSubmit}>
            {content}
          </Box>
        </div>
        <div className="drawer-dialog-actions">
          {canClose ? (
            <button type="button" className="cancel-button" onClick={handleClose} disabled={isSubmitting}>
              {closeLabel}
            </button>
          ) : null}
          <button ref={submitButtonReference} type="submit" form={formId} disabled={isBusy || !methods}>
            {isBusy ? <LoadingIndicator size={20} /> : null}
            확인
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Dialog open={true} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>본인 확인</DialogTitle>
      {canClose ? (
        <Tooltip title={closeLabel}>
          <button className="close-button" onClick={handleClose} disabled={isSubmitting}>
            <CloseRoundedIcon />
          </button>
        </Tooltip>
      ) : null}
      <DialogContent>
        <Box id={formId} component="form" onSubmit={handleSubmit}>
          {content}
        </Box>
      </DialogContent>
      <DialogActions>
        {canClose ? (
          <button type="button" className="cancel-button" onClick={handleClose} disabled={isSubmitting}>
            {closeLabel}
          </button>
        ) : null}
        <button ref={submitButtonReference} type="submit" form={formId} disabled={isBusy || !methods}>
          {isBusy ? <LoadingIndicator size={20} /> : null}
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}

function getRequiredPurpose(code: unknown): SecurityCheckPurpose | null {
  if (code === SECURITY_CHECK_REQUIRED_CODE) return 'access';
  if (code === SETTINGS_CHECK_REQUIRED_CODE) return 'settings';
  return null;
}

function isSameOriginApiRequest(input: RequestInfo | URL) {
  const requestUrl = input instanceof Request ? input.url : input.toString();
  const url = new URL(requestUrl, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith('/api/');
}

function useRequiredSecurityCheck(isEnabled: boolean) {
  const [requiredPurpose, setRequiredPurpose] = useState<SecurityCheckPurpose | null>(null);

  useEffect(() => {
    if (!isEnabled) return;

    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      if (response.status === 403 && isSameOriginApiRequest(input)) {
        const result = (await response
          .clone()
          .json()
          .catch(() => null)) as { code?: unknown } | null;
        const purpose = getRequiredPurpose(result?.code);

        if (purpose) {
          setRequiredPurpose((currentPurpose) => currentPurpose ?? purpose);
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isEnabled]);

  return [requiredPurpose, () => setRequiredPurpose(null)] as const;
}

export default function SecurityCheckGuard({
  children,
  needsCheck,
  purpose,
}: {
  children: ReactNode;
  needsCheck: boolean;
  purpose: SecurityCheckPurpose;
}) {
  const [requiredPurpose, clearRequiredPurpose] = useRequiredSecurityCheck(purpose === 'access' && !needsCheck);

  if (!needsCheck) {
    return (
      <>
        {requiredPurpose ? (
          <SecurityCheckDialog key={requiredPurpose} purpose={requiredPurpose} onFinish={clearRequiredPurpose} />
        ) : null}
        {children}
      </>
    );
  }

  return (
    <>
      <SecurityCheckDialog purpose={purpose} />
      <main>
        <div className="container">
          <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingIndicator />
          </div>
        </div>
      </main>
    </>
  );
}
