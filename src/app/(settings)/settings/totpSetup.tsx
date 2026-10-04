'use client';

import { type JSX, useMemo, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type TotpFactor = {
  id: string;
  status?: string;
  friendly_name?: string | null;
};

type PendingSetup = {
  factorId: string;
  secret: string;
  qrCodeSvg: string;
};

export default function TotpSetup({
  initialFactors,
  initialError,
}: {
  initialFactors: TotpFactor[];
  initialError: string;
}) {
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSetting, setIsSetting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [totpFactors, setTotpFactors] = useState<TotpFactor[]>(initialFactors);
  const [pendingSetup, setPendingSetup] = useState<PendingSetup | null>(null);

  const [verifyCode, setVerifyCode] = useState('');
  const [resetVerifyCode, setResetVerifyCode] = useState('');
  const [isResetVerificationOpen, setIsResetVerificationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [verifyCodeError, setVerifyCodeError] = useState('');
  const [resetVerifyCodeError, setResetVerifyCodeError] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] }>({
    title: null,
    messages: [],
  });
  const [successMessage, setSuccessMessage] = useState('');

  const qrCodeImageSource = useMemo(() => {
    if (!pendingSetup?.qrCodeSvg) {
      return '';
    }

    return pendingSetup.qrCodeSvg;
  }, [pendingSetup]);

  const verifiedFactor = totpFactors.find((factor) => factor.status === 'verified') ?? null;
  const pendingFactor = totpFactors.find((factor) => factor.status !== 'verified') ?? null;

  async function getFreshTotpFactors() {
    const factorsResult = await supabase.auth.mfa.listFactors();

    if (factorsResult.error) {
      throw new Error(factorsResult.error.message);
    }

    return (factorsResult.data.totp ?? []) as TotpFactor[];
  }

  async function loadTotpState() {
    setIsLoading(true);

    try {
      const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceLevelResult.error) {
        throw new Error(assuranceLevelResult.error.message);
      }

      const freshTotpFactors = await getFreshTotpFactors();
      setTotpFactors(freshTotpFactors);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '앱 기반 2단계 인증 상태를 불러오지 못했습니다.');
      } else {
        setErrorMessage('앱 기반 2단계 인증 상태를 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  function handleVerifyCodeChange(event: InputChangeEvent) {
    setVerifyCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6));
    setVerifyCodeError('');
  }

  function openFormError(title: string | null, messages: string[]) {
    setErrorMessage('');
    setSuccessMessage('');
    setErrorDialog({ title, messages });
  }

  async function removeFactor(targetFactorId: string) {
    const unenrollResult = await supabase.auth.mfa.unenroll({
      factorId: targetFactorId,
    });

    if (unenrollResult.error) {
      throw new Error(unenrollResult.error.message);
    }
  }

  async function createPendingSetup() {
    const enrollResult = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `authenticator-${Date.now()}`,
    });

    if (enrollResult.error) {
      throw new Error(enrollResult.error.message);
    }

    setPendingSetup({
      factorId: enrollResult.data.id,
      secret: enrollResult.data.totp.secret,
      qrCodeSvg: enrollResult.data.totp.qr_code,
    });

    setVerifyCode('');
  }

  async function handleSetOrReset(isResetVerified = false) {
    if (isSetting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSetting(true);

    try {
      const freshTotpFactors = await getFreshTotpFactors();
      const freshVerifiedFactor = freshTotpFactors.find((factor) => factor.status === 'verified') ?? null;
      const freshPendingFactor = freshTotpFactors.find((factor) => factor.status !== 'verified') ?? null;

      setTotpFactors(freshTotpFactors);

      if (freshVerifiedFactor) {
        if (!isResetVerified) {
          setIsResetVerificationOpen(true);
          return;
        }

        await removeFactor(freshVerifiedFactor.id);
      }

      if (freshPendingFactor) {
        await removeFactor(freshPendingFactor.id);
      }

      setPendingSetup(null);
      await createPendingSetup();

      const refreshedTotpFactors = await getFreshTotpFactors();
      setTotpFactors(refreshedTotpFactors);

      setSuccessMessage('인증 앱에서 QR 코드를 등록한 뒤 6자리 인증 코드를 입력해주세요.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '앱 기반 2단계 인증 설정을 진행하지 못했습니다.');
      } else {
        setErrorMessage('앱 기반 2단계 인증 설정을 진행하지 못했습니다.');
      }
    } finally {
      setIsSetting(false);
    }
  }

  async function handleResetVerification(event: FormSubmitEvent) {
    event.preventDefault();
    if (isSetting || isVerifying || !verifiedFactor) return;

    if (!/^\d{6}$/.test(resetVerifyCode)) {
      const message = '인증 코드는 숫자 6자리로 입력해 주세요.';
      setResetVerifyCodeError(message);
      (event.currentTarget as HTMLFormElement).reportValidity();
      openFormError('인증 코드 확인', [message]);
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setResetVerifyCodeError('');

    try {
      const challengeResult = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id });
      if (challengeResult.error) throw challengeResult.error;

      const verifyResult = await supabase.auth.mfa.verify({
        factorId: verifiedFactor.id,
        challengeId: challengeResult.data.id,
        code: resetVerifyCode,
      });
      if (verifyResult.error) throw new Error('인증 코드가 올바르지 않습니다.');

      setResetVerifyCode('');
      setIsResetVerificationOpen(false);
      await handleSetOrReset(true);
    } catch {
      const message = '인증 코드가 올바르지 않습니다.';
      setResetVerifyCodeError(message);
      openFormError('인증 코드 확인', [message]);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleVerify(event: FormSubmitEvent) {
    event.preventDefault();

    if (isVerifying) {
      return;
    }

    if (!pendingSetup?.factorId) {
      openFormError('2단계 인증 설정', ['먼저 앱 기반 2단계 인증을 설정해 주세요.']);
      return;
    }

    if (!/^\d{6}$/.test(verifyCode)) {
      const message = '인증 코드는 숫자 6자리로 입력해 주세요.';
      setVerifyCodeError(message);
      (event.currentTarget as HTMLFormElement).reportValidity();
      openFormError('인증 코드 확인', [message]);
      return;
    }

    setErrorMessage('');
    setVerifyCodeError('');
    setSuccessMessage('');
    setIsVerifying(true);

    try {
      const challengeResult = await supabase.auth.mfa.challenge({
        factorId: pendingSetup.factorId,
      });

      if (challengeResult.error) {
        throw new Error(challengeResult.error.message);
      }

      const verifyResult = await supabase.auth.mfa.verify({
        factorId: pendingSetup.factorId,
        challengeId: challengeResult.data.id,
        code: verifyCode,
      });

      if (verifyResult.error) {
        throw new Error(verifyResult.error.message);
      }

      const recoveryCodeResponse = await fetch('/api/auth/mfa/recovery-code', {
        method: 'POST',
        credentials: 'include',
      });
      const recoveryCodeResult = (await recoveryCodeResponse.json().catch(() => null)) as {
        errors?: string[];
      } | null;

      if (!recoveryCodeResponse.ok) {
        throw new Error(recoveryCodeResult?.errors?.[0] ?? '복구 코드를 발급하지 못했습니다.');
      }

      setPendingSetup(null);
      setVerifyCode('');
      setSuccessMessage(
        '앱 기반 2단계 인증 설정이 완료되었습니다.\n앞으로 인증 앱의 6자리 코드 또는 이메일로 전송된 복구 코드로 2단계 인증할 수 있습니다.',
      );
      await loadTotpState();
    } catch {
      const message = '인증 코드가 올바르지 않거나 요청을 처리하지 못했습니다.';
      setVerifyCodeError(message);
      openFormError('인증 코드 확인', [message]);
    } finally {
      setIsVerifying(false);
    }
  }

  if (isLoading) {
    return (
      <Grid size={12}>
        <Stack justifyContent="center" alignItems="center">
          <LoadingIndicator />
        </Stack>
      </Grid>
    );
  }

  let statusLabel = '미설정';
  let statusName: 'chip default' | 'chip success' | 'chip warning' = 'chip default';

  if (verifiedFactor) {
    statusLabel = '설정 완료';
    statusName = 'chip success';
  } else if (pendingSetup || pendingFactor) {
    statusLabel = '설정 진행 중';
    statusName = 'chip warning';
  }

  return (
    <Grid size={12} className={styles.grid}>
      <Accordion
        expanded={isExpanded}
        onChange={handleAccordionChange}
        disableGutters
        variant="outlined"
        className={`paper ${styles.paper}`}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack
            alignContent="center"
            justifyContent="space-between"
            gap={2}
            direction="row"
            sx={{ width: '100%', pr: 1 }}
          >
            <Typography variant="subtitle2" component="strong">
              앱 기반 2단계 인증
            </Typography>

            <Chip label={statusLabel} size="small" className={statusName} />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack gap={2.5}>
            {isResetVerificationOpen && verifiedFactor ? (
              <Box component="form" noValidate onSubmit={handleResetVerification}>
                <Stack gap={1}>
                  <Typography variant="subtitle2">현재 인증 앱 코드 확인</Typography>
                  <TextField
                    placeholder="XXXXXX"
                    type="text"
                    value={resetVerifyCode}
                    onChange={(event: InputChangeEvent) => {
                      setResetVerifyCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6));
                      setResetVerifyCodeError('');
                    }}
                    inputProps={{
                      inputMode: 'numeric',
                      pattern: '[0-9]{6}',
                      minLength: 6,
                      maxLength: 6,
                      required: true,
                    }}
                    fullWidth
                    size="small"
                    error={Boolean(resetVerifyCodeError)}
                    helperText={resetVerifyCodeError || '인증 앱의 숫자 6자리를 입력해 주세요.'}
                  />
                  <Stack direction="row" justifyContent="flex-end" gap={1}>
                    <button
                      type="button"
                      className="button medium cancel"
                      onClick={() => setIsResetVerificationOpen(false)}
                    >
                      취소
                    </button>
                    <button type="submit" className="button medium warning" disabled={isVerifying}>
                      인증 후 재설정
                    </button>
                  </Stack>
                </Stack>
              </Box>
            ) : pendingSetup ? (
              <Stack gap={2.5}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>아래 QR 코드를 인증 앱으로 스캔해주세요.</span>
                </p>

                {qrCodeImageSource ? (
                  <Box
                    component="img"
                    src={qrCodeImageSource}
                    alt="앱 기반 2단계 인증 QR 코드"
                    sx={{
                      width: '100%',
                      maxWidth: 240,
                      alignSelf: 'center',
                    }}
                  />
                ) : null}

                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>QR 스캔이 어려우면 아래 키를 직접 입력해주세요.</span>
                </p>

                <code>{pendingSetup.secret}</code>

                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>
                    앱 등록 이후 반드시 하단의 입력폼에 인증코드를 입력하셔야 데브허브 서버에 등록이 완료됩니다.
                  </span>
                </p>

                <Box component="form" noValidate onSubmit={handleVerify}>
                  <Stack gap={2.5}>
                    <Stack gap={1}>
                      <Typography variant="subtitle2">인증코드 입력</Typography>
                      <TextField
                        id="verifyCode"
                        placeholder="XXXXXX"
                        type="text"
                        value={verifyCode}
                        onChange={handleVerifyCodeChange}
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]{6}', minLength: 6, maxLength: 6 }}
                        size="small"
                        fullWidth
                        error={Boolean(verifyCodeError)}
                        helperText={verifyCodeError || '인증 앱의 숫자 6자리를 입력해 주세요.'}
                      />
                    </Stack>

                    <button type="submit" className="button medium submit" disabled={isVerifying}>
                      인증 코드 확인
                    </button>
                  </Stack>
                </Box>
              </Stack>
            ) : (
              <button
                type="button"
                className="button medium action"
                onClick={() => void handleSetOrReset()}
                disabled={isSetting}
              >
                {verifiedFactor ? '2단계 인증 재설정' : '2단계 인증 설정'}
              </button>
            )}

            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
            <PopupMessage
              open={Boolean(successMessage)}
              message={successMessage}
              onClose={() => setSuccessMessage('')}
            />
            <FormErrorDialog
              open={Boolean(errorDialog.messages.length)}
              title={errorDialog.title}
              messages={errorDialog.messages}
              onClose={() => setErrorDialog({ title: null, messages: [] })}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
