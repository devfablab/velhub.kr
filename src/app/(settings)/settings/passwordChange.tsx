'use client';

import { type JSX, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Box, Grid, Stack, TextField, Typography } from '@mui/material';
import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/lib/auth/password';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FieldErrors = { currentPassword: string; nextPassword: string; nextPasswordConfirm: string };

const EMPTY_FIELD_ERRORS: FieldErrors = { currentPassword: '', nextPassword: '', nextPasswordConfirm: '' };

export default function PasswordChange({
  initialHasPassword,
  initialError,
}: {
  initialHasPassword: boolean;
  initialError: string;
}) {
  const router = useRouter();
  const [isLoading] = useState(false);
  const [hasPassword] = useState(initialHasPassword);
  const [isExpanded, setIsExpanded] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] }>({
    title: null,
    messages: [],
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCurrentPasswordChange(event: InputChangeEvent) {
    setCurrentPassword(event.currentTarget.value);
    setFieldErrors((previousValue) => ({ ...previousValue, currentPassword: '' }));
  }

  function handleNextPasswordChange(event: InputChangeEvent) {
    setNextPassword(event.currentTarget.value);
    setFieldErrors((previousValue) => ({ ...previousValue, nextPassword: '' }));
  }

  function handleNextPasswordConfirmChange(event: InputChangeEvent) {
    setNextPasswordConfirm(event.currentTarget.value);
    setFieldErrors((previousValue) => ({ ...previousValue, nextPasswordConfirm: '' }));
  }

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  function openErrorDialog(title: string | null, messages: string[], nextFieldErrors = EMPTY_FIELD_ERRORS) {
    setErrorMessage('');
    setSuccessMessage('');
    setFieldErrors(nextFieldErrors);
    setErrorDialog({ title, messages });
  }

  function getFieldErrors() {
    const errors: FieldErrors = {
      currentPassword: currentPassword ? '' : '현재 비밀번호를 입력해 주세요.',
      nextPassword: !nextPassword
        ? '새 비밀번호를 입력해 주세요.'
        : !isValidPassword(nextPassword)
          ? PASSWORD_REQUIREMENTS
          : '',
      nextPasswordConfirm: !nextPasswordConfirm
        ? '새 비밀번호 확인을 입력해 주세요.'
        : nextPassword !== nextPasswordConfirm
          ? '새 비밀번호가 일치하지 않습니다.'
          : currentPassword === nextPassword
            ? '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'
            : '',
    };

    return { errors, messages: Object.values(errors).filter(Boolean) };
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validation = getFieldErrors();

    if (validation.messages.length > 0) {
      (event.currentTarget as HTMLFormElement).reportValidity();
      openErrorDialog('비밀번호 변경', validation.messages, validation.errors);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, nextPassword, nextPasswordConfirm }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        title?: string;
        errors?: string[];
        fieldErrors?: FieldErrors;
      } | null;

      if (!response.ok || !result?.ok) {
        if (response.status >= 500 || !result?.errors?.length) {
          openErrorDialog(null, ['요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.']);
        } else {
          openErrorDialog(result.title ?? '비밀번호 변경', result.errors, result.fieldErrors ?? EMPTY_FIELD_ERRORS);
        }
        setIsSubmitting(false);
        return;
      }

      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
      setSuccessMessage('비밀번호가 변경되어 모든 디바이스에서 로그아웃되었습니다.');

      router.replace('/');
    } catch {
      openErrorDialog(null, ['요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.']);
      setIsSubmitting(false);
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

  if (!hasPassword) {
    return null;
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
              비밀번호 변경
            </Typography>
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack gap={2.5}>
              <Stack gap={1}>
                <Typography variant="subtitle2">현재 비밀번호</Typography>
                <TextField
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={handleCurrentPasswordChange}
                  size="small"
                  fullWidth
                  error={Boolean(fieldErrors.currentPassword)}
                  helperText={fieldErrors.currentPassword}
                  slotProps={{ htmlInput: { required: true } }}
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">새 비밀번호</Typography>
                <TextField
                  id="nextPassword"
                  type="password"
                  autoComplete="new-password"
                  value={nextPassword}
                  onChange={handleNextPasswordChange}
                  size="small"
                  fullWidth
                  error={Boolean(fieldErrors.nextPassword)}
                  helperText={fieldErrors.nextPassword || PASSWORD_REQUIREMENTS}
                  slotProps={{ htmlInput: { required: true } }}
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">새 비밀번호 확인</Typography>
                <TextField
                  id="nextPasswordConfirm"
                  type="password"
                  autoComplete="new-password"
                  value={nextPasswordConfirm}
                  onChange={handleNextPasswordConfirmChange}
                  size="small"
                  fullWidth
                  error={Boolean(fieldErrors.nextPasswordConfirm)}
                  helperText={fieldErrors.nextPasswordConfirm}
                  slotProps={{ htmlInput: { required: true } }}
                />
              </Stack>

              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>비밀번호 변경시 자동으로 로그아웃됩니다.</span>
              </p>

              <button type="submit" className="button medium submit" disabled={isSubmitting}>
                비밀번호 변경
              </button>

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
          </Box>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
