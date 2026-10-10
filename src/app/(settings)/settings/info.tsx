'use client';

import { type JSX, useRef, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Chip,
  Grid,
  Stack,
  styled,
  TextField,
  Typography,
} from '@mui/material';
import { ACTIVITY_NAME_MAX_LENGTH, ACTIVITY_NAME_MIN_LENGTH, isValidActivityName } from '@/lib/auth/emailSignUp';
import { getSupabaseBrowser } from '@/lib/supabase';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_FILE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function isExternalAvatarValue(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

export default function UserInfo({
  initialData,
  initialError,
}: {
  initialData: { userName?: string; avatar?: string; avatarUrl?: string; bio?: string } | null;
  initialError: string;
}) {
  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const supabase = getSupabaseBrowser();

  const [isLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const [userName, setUserName] = useState(initialData?.userName ?? '');
  const [avatar, setAvatar] = useState(initialData?.avatar ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatarUrl ?? '');
  const [bio, setBio] = useState(initialData?.bio ?? '');

  const [userNameDraft, setUserNameDraft] = useState(initialData?.userName ?? '');
  const [isEditingUserName, setIsEditingUserName] = useState(false);

  const [isSubmittingAvatar, setIsSubmittingAvatar] = useState(false);
  const [isSubmittingUserName, setIsSubmittingUserName] = useState(false);

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [userNameError, setUserNameError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] }>({
    title: null,
    messages: [],
  });
  const [successMessage, setSuccessMessage] = useState('');

  function getAvatarDisplayUrl() {
    const value = avatarUrl || avatar;

    if (!value) {
      return '/broken-image.jpg';
    }

    if (isExternalAvatarValue(value)) {
      return value;
    }

    const publicUrlResult = supabase.storage.from('avatar').getPublicUrl(value);

    return publicUrlResult.data.publicUrl || '/broken-image.jpg';
  }

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  function handleUserNameChange(event: InputChangeEvent) {
    setUserNameDraft(event.currentTarget.value);
    setUserNameError('');
  }

  function openErrorDialog(title: string | null, messages: string[]) {
    setErrorMessage('');
    setSuccessMessage('');
    setErrorDialog({ title, messages });
  }

  async function saveInfo(nextUserName: string, nextAvatar: string, nextBio: string) {
    const response = await fetch('/api/info/general/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        userName: nextUserName,
        avatar: nextAvatar,
        bio: nextBio,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        response.status >= 500 ||
          !result ||
          typeof result !== 'object' ||
          typeof (result as { error?: unknown }).error !== 'string'
          ? ''
          : (result as { error: string }).error,
      );
    }

    const savedInfo = result as { userName?: string; avatar?: string; avatarUrl?: string; bio?: string };
    setUserName(savedInfo.userName ?? '');
    setAvatar(savedInfo.avatar ?? '');
    setAvatarUrl(savedInfo.avatarUrl ?? '');
    setBio(savedInfo.bio ?? '');

    setUserNameDraft(savedInfo.userName ?? '');
  }

  async function handleSubmitUserName(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmittingUserName) {
      return;
    }

    const trimmedUserName = userNameDraft.trim();

    if (!isValidActivityName(trimmedUserName)) {
      const message = '활동명은 2자 이상 10자 이하로 입력해 주세요.';
      setUserNameError(message);
      (event.currentTarget as HTMLFormElement).reportValidity();
      openErrorDialog('활동명 수정', [message]);
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmittingUserName(true);

    try {
      await saveInfo(trimmedUserName, avatar, bio);
      setIsEditingUserName(false);
      setSuccessMessage('활동명이 수정되었습니다.');
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : '';
      setUserNameError(message || '활동명 수정에 실패했습니다.');
      openErrorDialog(message ? '활동명 수정' : null, [
        message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      ]);
    } finally {
      setIsSubmittingUserName(false);
    }
  }

  async function handleAvatarFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || isSubmittingAvatar) {
      inputElement.value = '';
      return;
    }

    if (!ALLOWED_AVATAR_FILE_TYPES.has(selectedFile.type)) {
      const message = 'JPG, PNG, GIF, WEBP 형식의 이미지 파일만 업로드할 수 있습니다.';
      setAvatarError(message);
      openErrorDialog('아바타 수정', [message]);
      inputElement.value = '';
      return;
    }

    if (selectedFile.size <= 0 || selectedFile.size > MAX_AVATAR_FILE_SIZE) {
      const message = '아바타 이미지는 5MB 이하로 업로드해 주세요.';
      setAvatarError(message);
      openErrorDialog('아바타 수정', [message]);
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setAvatarError('');
    setSuccessMessage('');
    setIsSubmittingAvatar(true);

    try {
      const currentAvatarValue = avatarUrl || avatar;

      const formData = new FormData();
      formData.append('file', selectedFile);

      const addResponse = await fetch('/api/attachment/add/avatar/user', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const addResult = await addResponse.json().catch(() => null);

      if (!addResponse.ok) {
        throw new Error(
          addResponse.status >= 500 ||
            !addResult ||
            typeof addResult !== 'object' ||
            typeof (addResult as { error?: unknown }).error !== 'string'
            ? ''
            : (addResult as { error: string }).error,
        );
      }

      const nextAvatar =
        addResult && typeof addResult === 'object' && typeof (addResult as { avatar?: unknown }).avatar === 'string'
          ? (addResult as { avatar: string }).avatar.trim()
          : '';

      if (!nextAvatar) {
        throw new Error('업로드된 아바타 정보를 확인하지 못했습니다.');
      }

      await saveInfo(userName, nextAvatar, bio);

      if (currentAvatarValue && !isExternalAvatarValue(currentAvatarValue)) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: currentAvatarValue }),
        });

        if (!deleteResponse.ok) {
          console.error('[settings-avatar] previous avatar delete failed');
        }
      }
      setSuccessMessage('아바타가 수정되었습니다.');
    } catch (unknownError) {
      const message = unknownError instanceof Error ? unknownError.message : '';
      setAvatarError(message || '아바타 수정에 실패했습니다.');
      openErrorDialog(message ? '아바타 수정' : null, [
        message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      ]);
    } finally {
      setIsSubmittingAvatar(false);
      inputElement.value = '';
    }
  }

  function handleClickAvatarUpload() {
    if (isSubmittingAvatar) {
      return;
    }

    fileInputReference.current?.click();
  }

  function handleCancelUserName() {
    setUserNameDraft(userName);
    setIsEditingUserName(false);
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

  const hasUnsetField = !userName || !avatar;

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
              기본정보
            </Typography>

            <Chip
              label={hasUnsetField ? '미설정 항목 있음' : '설정됨'}
              size="small"
              color={hasUnsetField ? 'warning' : 'success'}
              className={hasUnsetField ? 'chip warning' : 'chip success'}
            />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack gap={3}>
            <Stack gap={1.5} alignItems="flex-start">
              <Avatar
                src={getAvatarDisplayUrl() || '/broken-image.jpg'}
                alt={userName}
                sx={{ width: 80, height: 80 }}
              />

              <VisuallyHiddenInput
                ref={fileInputReference}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarFileChange}
              />

              <button
                type="button"
                className="button small action"
                onClick={handleClickAvatarUpload}
                disabled={isSubmittingAvatar}
              >
                아바타 수정
              </button>
              {avatarError ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{avatarError}</span>
                </p>
              ) : null}
            </Stack>

            <Stack gap={1.5}>
              <Typography variant="subtitle2" component="strong">
                활동명
              </Typography>
              {!isEditingUserName ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" component="span">
                    {userName}
                  </Typography>
                  <button type="button" className="button medium action" onClick={() => setIsEditingUserName(true)}>
                    활동명 수정
                  </button>
                </Stack>
              ) : (
                <Box component="form" noValidate onSubmit={handleSubmitUserName}>
                  <Stack gap={1} direction="row">
                    <TextField
                      size="small"
                      value={userNameDraft}
                      onChange={handleUserNameChange}
                      slotProps={{
                        htmlInput: {
                          required: true,
                          minLength: ACTIVITY_NAME_MIN_LENGTH,
                          maxLength: ACTIVITY_NAME_MAX_LENGTH,
                        },
                      }}
                      fullWidth
                      error={Boolean(userNameError)}
                      helperText={userNameError || '활동명은 2자 이상 10자 이하로 입력해 주세요.'}
                    />

                    <button
                      type="button"
                      className="button medium cancel"
                      onClick={handleCancelUserName}
                      disabled={isSubmittingUserName}
                    >
                      취소
                    </button>
                    <button type="submit" className="button medium submit" disabled={isSubmittingUserName}>
                      저장
                    </button>
                  </Stack>
                </Box>
              )}
            </Stack>

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
