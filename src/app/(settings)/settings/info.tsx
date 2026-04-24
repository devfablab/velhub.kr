'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  Stack,
  styled,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { getSupabaseBrowser } from '@/lib/supabase';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

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

function isExternalAvatarValue(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

export default function UserInfo() {
  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const [userName, setUserName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  const [userNameDraft, setUserNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');

  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);

  const [isSubmittingAvatar, setIsSubmittingAvatar] = useState(false);
  const [isSubmittingUserName, setIsSubmittingUserName] = useState(false);
  const [isSubmittingBio, setIsSubmittingBio] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadBasicInfo() {
      try {
        const response = await fetch('/api/info/general/user', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '기본정보를 불러오지 못했습니다.');
        }

        setUserName(result.userName ?? '');
        setAvatar(result.avatar ?? '');
        setAvatarUrl(result.avatarUrl ?? '');
        setBio(result.bio ?? '');

        setUserNameDraft(result.userName ?? '');
        setBioDraft(result.bio ?? '');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '기본정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('기본정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadBasicInfo();
  }, []);

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
  }

  function handleBioChange(event: TextAreaChangeEvent | InputChangeEvent) {
    setBioDraft(event.currentTarget.value);
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? '기본정보 수정에 실패했습니다.');
    }

    setUserName(result.userName ?? '');
    setAvatar(result.avatar ?? '');
    setAvatarUrl(result.avatarUrl ?? '');
    setBio(result.bio ?? '');

    setUserNameDraft(result.userName ?? '');
    setBioDraft(result.bio ?? '');
  }

  async function handleSubmitUserName(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmittingUserName) {
      return;
    }

    const trimmedUserName = userNameDraft.trim();

    if (!trimmedUserName) {
      setErrorMessage('활동명을 입력해주세요.');
      setSuccessMessage('');
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
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '활동명 수정에 실패했습니다.');
      } else {
        setErrorMessage('활동명 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmittingUserName(false);
    }
  }

  async function handleSubmitBio(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmittingBio) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmittingBio(true);

    try {
      await saveInfo(userName, avatar, bioDraft.trim());
      setIsEditingBio(false);
      setSuccessMessage('자기소개가 수정되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '자기소개 수정에 실패했습니다.');
      } else {
        setErrorMessage('자기소개 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmittingBio(false);
    }
  }

  async function handleAvatarFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || isSubmittingAvatar) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmittingAvatar(true);

    try {
      const currentAvatarValue = avatarUrl || avatar;

      if (currentAvatarValue && !isExternalAvatarValue(currentAvatarValue)) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: currentAvatarValue,
          }),
        });

        const deleteResult = await deleteResponse.json();

        if (!deleteResponse.ok) {
          throw new Error(deleteResult.error ?? '기존 아바타 삭제에 실패했습니다.');
        }
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      const addResponse = await fetch('/api/attachment/add/avatar/user', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const addResult = await addResponse.json();

      if (!addResponse.ok) {
        throw new Error(addResult.error ?? '아바타 업로드에 실패했습니다.');
      }

      const nextAvatar = typeof addResult.avatar === 'string' && addResult.avatar.trim() ? addResult.avatar.trim() : '';

      if (!nextAvatar) {
        throw new Error('업로드된 아바타 정보를 확인하지 못했습니다.');
      }

      await saveInfo(userName, nextAvatar, bio);
      setSuccessMessage('아바타가 수정되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '아바타 수정에 실패했습니다.');
      } else {
        setErrorMessage('아바타 수정에 실패했습니다.');
      }
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

  function handleCancelBio() {
    setBioDraft(bio);
    setIsEditingBio(false);
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

  const hasUnsetField = !userName || !avatar || !bio;

  return (
    <Grid size={12}>
      <Accordion expanded={isExpanded} onChange={handleAccordionChange} disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack
            alignContent="center"
            justifyContent="space-between"
            gap={2}
            direction="row"
            sx={{ width: '100%', pr: 1 }}
          >
            <Typography variant="subtitle2" component="span">
              기본정보
            </Typography>

            <Chip
              label={hasUnsetField ? '미설정 항목 있음' : '설정됨'}
              size="small"
              color={hasUnsetField ? 'warning' : 'success'}
            />
          </Stack>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={3}>
            <Stack spacing={1.5} alignItems="flex-start">
              <Avatar src={getAvatarDisplayUrl()} alt={userName || ''} sx={{ width: 80, height: 80 }} />

              <VisuallyHiddenInput
                ref={fileInputReference}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
              />

              <Button type="button" variant="outlined" onClick={handleClickAvatarUpload} disabled={isSubmittingAvatar}>
                아바타 수정
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2">활동명</Typography>
              {!isEditingUserName ? (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" component="span">
                    {userName}
                  </Typography>
                  <Button type="button" variant="outlined" onClick={() => setIsEditingUserName(true)}>
                    활동명 수정
                  </Button>
                </Stack>
              ) : (
                <Box component="form" onSubmit={handleSubmitUserName}>
                  <Stack spacing={1} direction="row">
                    <TextField size="small" value={userNameDraft} onChange={handleUserNameChange} fullWidth />

                    <Button
                      type="button"
                      variant="outlined"
                      onClick={handleCancelUserName}
                      disabled={isSubmittingUserName}
                    >
                      취소
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSubmittingUserName}>
                      저장
                    </Button>
                  </Stack>
                </Box>
              )}
            </Stack>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2">자기소개</Typography>
              {!isEditingBio ? (
                <Stack spacing={1.5}>
                  {bio ? (
                    <Typography component="p" sx={{ whiteSpace: 'pre-wrap' }}>
                      {bio}
                    </Typography>
                  ) : (
                    <Typography variant="body1">자기소개 등록이 필요합니다</Typography>
                  )}
                  <Stack spacing={1.5} alignItems="flex-end">
                    <Button type="button" variant="outlined" onClick={() => setIsEditingBio(true)}>
                      자기소개 수정
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Box component="form" onSubmit={handleSubmitBio}>
                  <Stack spacing={1.5}>
                    <TextField
                      value={bioDraft}
                      onChange={handleBioChange}
                      fullWidth
                      multiline
                      size="small"
                      minRows={4}
                    />

                    <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                      <Button type="button" variant="outlined" onClick={handleCancelBio} disabled={isSubmittingBio}>
                        취소
                      </Button>
                      <Button type="submit" variant="contained" disabled={isSubmittingBio}>
                        저장
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Stack>

            {errorMessage ? (
              <Alert severity="error" variant="filled">
                {errorMessage}
              </Alert>
            ) : null}
            {successMessage ? (
              <Alert severity="success" variant="outlined">
                {successMessage}
              </Alert>
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Grid>
  );
}
