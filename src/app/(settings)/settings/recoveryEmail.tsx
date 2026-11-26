'use client';

import { type JSX, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Grid, Stack, Typography } from '@mui/material';
import {
  normalizeRecoveryEmail,
  normalizeRecoveryEmailCode,
  RECOVERY_EMAIL_CODE_LENGTH,
  RECOVERY_EMAIL_LABEL,
  getRecoveryEmailErrorMessage,
} from '@/lib/auth/recoveryEmail';
import RecoveryEmailFields from '@/components/auth/RecoveryEmailFields';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

export default function RecoveryEmail({
  initialMaskedEmail,
  accountEmail,
  isRequired,
  initialError,
}: {
  initialMaskedEmail: string;
  accountEmail: string;
  isRequired: boolean;
  initialError: string;
}) {
  const [maskedEmail, setMaskedEmail] = useState(initialMaskedEmail);
  const [isExpanded, setIsExpanded] = useState(isRequired && !initialMaskedEmail);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorDialog, setErrorDialog] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionLabel = maskedEmail ? '변경' : '등록';

  function resetForm() {
    setEmail('');
    setCode('');
    setEmailError('');
    setCodeError('');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) return;

    const normalizedEmail = normalizeRecoveryEmail(email);
    const normalizedCode = normalizeRecoveryEmailCode(code);
    const nextEmailError = getRecoveryEmailErrorMessage(normalizedEmail, accountEmail);
    const nextCodeError =
      !nextEmailError && normalizedCode.length !== RECOVERY_EMAIL_CODE_LENGTH
        ? '이메일로 받은 확인 번호 6자리를 입력해 주세요.'
        : '';

    if (nextEmailError || nextCodeError) {
      setEmailError(nextEmailError);
      setCodeError(nextCodeError);
      setErrorDialog([nextEmailError || nextCodeError]);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/recovery-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'save', email: normalizedEmail, code: normalizedCode }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        maskedEmail?: string;
        error?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        if (response.status === 403) return;

        const message =
          response.status >= 500 || !result?.error
            ? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : result.error;
        setCodeError(result?.error ?? '');
        setErrorDialog([message]);
        return;
      }

      setMaskedEmail(result.maskedEmail ?? '');
      setSuccessMessage(`${RECOVERY_EMAIL_LABEL}이 ${actionLabel}되었습니다.`);
      resetForm();
      setIsExpanded(false);
    } catch {
      setErrorDialog(['요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Grid size={12} className={styles.grid}>
      <Accordion
        expanded={isExpanded}
        onChange={(_event, expanded) => {
          setIsExpanded(expanded);

          if (!expanded) resetForm();
        }}
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
              {RECOVERY_EMAIL_LABEL}
            </Typography>
            <Chip size="small" label={maskedEmail ? '등록됨' : '등록 안 됨'} />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack gap={2.5}>
              {maskedEmail ? (
                <Typography variant="body2">
                  현재 {RECOVERY_EMAIL_LABEL}: {maskedEmail}
                </Typography>
              ) : (
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>
                    본인 확인 인증번호와 임시 보안 비밀번호를 이 이메일로 보냅니다. 등록하지 않으면 보안 비밀번호를
                    잊었을 때 복구할 수 없습니다.
                  </span>
                </p>
              )}

              <RecoveryEmailFields
                email={email}
                code={code}
                accountEmail={accountEmail}
                onEmailChange={(value) => {
                  setEmail(value);
                  setEmailError('');
                  setCodeError('');
                }}
                onCodeChange={(value) => {
                  setCode(value);
                  setCodeError('');
                }}
                emailError={emailError}
                codeError={codeError}
                onError={(message) => setErrorDialog([message])}
                disabled={isSubmitting}
              />

              <button type="submit" className="button medium submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingIndicator size={20} /> : null}
                {RECOVERY_EMAIL_LABEL} {actionLabel}
              </button>

              {initialError ? (
                <p className="alert error" role="alert">
                  <ErrorOutlineRoundedIcon />
                  <span>{initialError}</span>
                </p>
              ) : null}
              <PopupMessage
                open={Boolean(successMessage)}
                message={successMessage}
                onClose={() => setSuccessMessage('')}
              />
              <FormErrorDialog
                open={Boolean(errorDialog.length)}
                title={null}
                messages={errorDialog}
                onClose={() => setErrorDialog([])}
              />
            </Stack>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
