'use client';

import { type JSX, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Grid, Stack, Typography } from '@mui/material';
import { getSecurityPinErrorMessage, SECURITY_PIN_ACKNOWLEDGE_MESSAGE } from '@/lib/auth/securityPin';
import SecurityPinFields from '@/components/auth/SecurityPinFields';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

export default function SecurityPin({
  initialHasSecurityPin,
  initialError,
}: {
  initialHasSecurityPin: boolean;
  initialError: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasSecurityPin, setHasSecurityPin] = useState(initialHasSecurityPin);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [pinError, setPinError] = useState('');
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] }>({
    title: null,
    messages: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const actionLabel = hasSecurityPin ? '보안 비밀번호 변경' : '보안 비밀번호 설정';

  function resetForm() {
    setPin('');
    setPinConfirm('');
    setIsAcknowledged(false);
    setPinError('');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextPinError =
      getSecurityPinErrorMessage(pin, pinConfirm) || (isAcknowledged ? '' : SECURITY_PIN_ACKNOWLEDGE_MESSAGE);

    if (nextPinError) {
      setPinError(nextPinError);
      setErrorDialog({ title: actionLabel, messages: [nextPinError] });
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/security-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin, pinConfirm }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        const message =
          response.status >= 500 || !result?.error
            ? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
            : result.error;
        setPinError(result?.error ?? '');
        setErrorDialog({ title: response.status >= 500 ? null : actionLabel, messages: [message] });
        return;
      }

      setSuccessMessage(hasSecurityPin ? '보안 비밀번호가 변경되었습니다.' : '보안 비밀번호가 설정되었습니다.');
      setHasSecurityPin(true);
      resetForm();
      setIsExpanded(false);
    } catch {
      setErrorDialog({ title: null, messages: ['요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'] });
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

          if (!expanded) {
            resetForm();
          }
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
              보안 비밀번호
            </Typography>
            <Chip size="small" label={hasSecurityPin ? '설정됨' : '설정 안 됨'} />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack gap={2.5}>
              <SecurityPinFields
                pin={pin}
                pinConfirm={pinConfirm}
                isAcknowledged={isAcknowledged}
                onPinChange={(value) => {
                  setPin(value);
                  setPinError('');
                }}
                onPinConfirmChange={(value) => {
                  setPinConfirm(value);
                  setPinError('');
                }}
                onAcknowledgedChange={(value) => {
                  setIsAcknowledged(value);
                  setPinError('');
                }}
                showWarning
                errorMessage={pinError}
                disabled={isSubmitting}
              />

              <button type="submit" className="button medium submit" disabled={isSubmitting}>
                {isSubmitting ? <LoadingIndicator size={20} /> : null}
                {actionLabel}
              </button>

              {errorMessage ? (
                <p className="alert error" role="alert">
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
          </Box>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
