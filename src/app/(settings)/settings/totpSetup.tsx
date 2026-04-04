'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { getSupabaseBrowser } from '@/lib/supabase';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type TotpFactor = {
  id: string;
  status?: string;
  friendly_name?: string | null;
};

type AssuranceLevel = 'aal1' | 'aal2' | null;

type PendingSetup = {
  factorId: string;
  secret: string;
  qrCodeSvg: string;
};

export default function TotpSetup() {
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSetting, setIsSetting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const [currentLevel, setCurrentLevel] = useState<AssuranceLevel>(null);
  const [totpFactors, setTotpFactors] = useState<TotpFactor[]>([]);
  const [pendingSetup, setPendingSetup] = useState<PendingSetup | null>(null);

  const [verifyCode, setVerifyCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
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

      setCurrentLevel((assuranceLevelResult.data.currentLevel as AssuranceLevel) ?? null);

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

  useEffect(() => {
    void loadTotpState();
  }, []);

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  function handleVerifyCodeChange(event: InputChangeEvent) {
    setVerifyCode(event.currentTarget.value.trim());
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

  async function handleSetOrReset() {
    if (isSetting || isRemoving) {
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
        const isConfirmed = window.confirm('진짜로 재설정하시겠어요?');

        if (!isConfirmed) {
          setIsSetting(false);
          return;
        }

        if (currentLevel !== 'aal2') {
          throw new Error('재설정은 2단계 인증까지 완료된 로그인 상태에서만 가능합니다.');
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

  async function handleVerify(event: FormSubmitEvent) {
    event.preventDefault();

    if (isVerifying) {
      return;
    }

    if (!pendingSetup?.factorId) {
      setErrorMessage('먼저 앱 기반 2단계 인증을 설정해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!verifyCode) {
      setErrorMessage('인증 코드를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
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

      setPendingSetup(null);
      setVerifyCode('');
      setSuccessMessage('앱 기반 2단계 인증 설정이 완료되었습니다.');
      await loadTotpState();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '인증 코드 확인에 실패했습니다.');
      } else {
        setErrorMessage('인증 코드 확인에 실패했습니다.');
      }
    } finally {
      setIsVerifying(false);
    }
  }

  if (isLoading) {
    return null;
  }

  let statusLabel = '미설정';
  let statusColor: 'default' | 'success' | 'warning' = 'default';

  if (verifiedFactor) {
    statusLabel = '설정 완료';
    statusColor = 'success';
  } else if (pendingSetup || pendingFactor) {
    statusLabel = '설정 진행 중';
    statusColor = 'warning';
  }

  return (
    <Accordion expanded={isExpanded} onChange={handleAccordionChange} disableGutters elevation={0}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box
          sx={{
            width: '100%',
            pr: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography variant="h6" component="h2">
            앱 기반 2단계 인증
          </Typography>

          <Chip label={statusLabel} size="small" color={statusColor} />
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Stack spacing={2.5}>
          <Button
            type="button"
            variant="contained"
            onClick={() => void handleSetOrReset()}
            disabled={isSetting || isRemoving}
            fullWidth
          >
            {verifiedFactor ? '2단계 인증 재설정' : '2단계 인증 설정'}
          </Button>

          {pendingSetup ? (
            <Stack spacing={2.5}>
              <Typography variant="body2">QR 코드를 인증 앱으로 스캔해주세요.</Typography>

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

              <Typography variant="body2">QR 스캔이 어려우면 아래 키를 직접 입력해주세요.</Typography>

              <Typography
                variant="body2"
                sx={{
                  wordBreak: 'break-all',
                }}
              >
                {pendingSetup.secret}
              </Typography>

              <Typography variant="body2">
                앱 등록 이후 반드시 인증 코드를 입력하셔야 데브허브 서버에 등록이 완료됩니다.
              </Typography>

              <Box component="form" onSubmit={handleVerify}>
                <Stack spacing={2.5}>
                  <TextField
                    id="verifyCode"
                    label="인증 코드"
                    type="text"
                    value={verifyCode}
                    onChange={handleVerifyCodeChange}
                    fullWidth
                  />

                  <Button type="submit" variant="outlined" disabled={isVerifying} fullWidth>
                    인증 코드 확인
                  </Button>
                </Stack>
              </Box>
            </Stack>
          ) : null}

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
