'use client';

import { useEffect, useState, type JSX } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

export default function UserInfo() {
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const [userName, setUserName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');

  const [userNameDraft, setUserNameDraft] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');

  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
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
        setBio(result.bio ?? '');

        setUserNameDraft(result.userName ?? '');
        setAvatarDraft(result.avatar ?? '');
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

  function handleAccordionChange(_event: React.SyntheticEvent, expanded: boolean) {
    setIsExpanded(expanded);
  }

  function handleUserNameChange(event: InputChangeEvent) {
    setUserNameDraft(event.currentTarget.value);
  }

  function handleAvatarChange(event: InputChangeEvent) {
    setAvatarDraft(event.currentTarget.value);
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
    setBio(result.bio ?? '');

    setUserNameDraft(result.userName ?? '');
    setAvatarDraft(result.avatar ?? '');
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

  async function handleSubmitAvatar(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmittingAvatar) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmittingAvatar(true);

    try {
      await saveInfo(userName, avatarDraft.trim(), bio);
      setIsEditingAvatar(false);
      setSuccessMessage('아바타가 수정되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '아바타 수정에 실패했습니다.');
      } else {
        setErrorMessage('아바타 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmittingAvatar(false);
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

  function handleCancelUserName() {
    setUserNameDraft(userName);
    setIsEditingUserName(false);
  }

  function handleCancelAvatar() {
    setAvatarDraft(avatar);
    setIsEditingAvatar(false);
  }

  function handleCancelBio() {
    setBioDraft(bio);
    setIsEditingBio(false);
  }

  if (isLoading) {
    return null;
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
            기본정보
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Stack spacing={3}>
          <Stack spacing={1.5} alignItems="flex-start">
            {avatar ? (
              <Avatar src={avatar} alt={userName || '아바타'} sx={{ width: 80, height: 80 }} />
            ) : (
              <Avatar sx={{ width: 80, height: 80 }}>
                <PersonIcon />
              </Avatar>
            )}

            {!isEditingAvatar ? (
              <Button type="button" variant="outlined" onClick={() => setIsEditingAvatar(true)}>
                아바타 수정
              </Button>
            ) : (
              <Box component="form" onSubmit={handleSubmitAvatar} sx={{ width: '100%' }}>
                <Stack spacing={1.5}>
                  <TextField label="아바타 이미지 URL" value={avatarDraft} onChange={handleAvatarChange} fullWidth />

                  <Stack direction="row" spacing={1.5}>
                    <Button type="submit" variant="contained" disabled={isSubmittingAvatar}>
                      저장
                    </Button>
                    <Button type="button" variant="outlined" onClick={handleCancelAvatar} disabled={isSubmittingAvatar}>
                      취소
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Stack>

          <Stack spacing={1.5}>
            {!isEditingUserName ? (
              <>
                <Typography variant="subtitle2">활동명</Typography>
                <Typography>{userName || '-'}</Typography>
                <Button type="button" variant="outlined" onClick={() => setIsEditingUserName(true)}>
                  활동명 수정
                </Button>
              </>
            ) : (
              <Box component="form" onSubmit={handleSubmitUserName}>
                <Stack spacing={1.5}>
                  <TextField label="활동명" value={userNameDraft} onChange={handleUserNameChange} fullWidth />

                  <Stack direction="row" spacing={1.5}>
                    <Button type="submit" variant="contained" disabled={isSubmittingUserName}>
                      저장
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={handleCancelUserName}
                      disabled={isSubmittingUserName}
                    >
                      취소
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Stack>

          <Stack spacing={1.5}>
            {!isEditingBio ? (
              <>
                <Typography variant="subtitle2">자기소개</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{bio || '아직 설정하지 않았습니다.'}</Typography>
                <Button type="button" variant="outlined" onClick={() => setIsEditingBio(true)}>
                  자기소개 수정
                </Button>
              </>
            ) : (
              <Box component="form" onSubmit={handleSubmitBio}>
                <Stack spacing={1.5}>
                  <TextField
                    label="자기소개"
                    value={bioDraft}
                    onChange={handleBioChange}
                    fullWidth
                    multiline
                    minRows={4}
                  />

                  <Stack direction="row" spacing={1.5}>
                    <Button type="submit" variant="contained" disabled={isSubmittingBio}>
                      저장
                    </Button>
                    <Button type="button" variant="outlined" onClick={handleCancelBio} disabled={isSubmittingBio}>
                      취소
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Stack>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
