'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import {
  Alert,
  Avatar,
  Button,
  FormControlLabel,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { formatDate, formatDateTimeFull } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

type EditableField =
  | 'site_key'
  | 'site_label'
  | 'profile_picture'
  | 'summary'
  | 'visibility_type'
  | 'theme_type'
  | 'is_shutdown';

type RhizomesInfo = {
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  summary: string | null;
  site_type: string;
  visibility_type: string;
  theme_type: string;
  is_shutdown: boolean;
};

type SitesInfo = {
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string;
  log: string;
};

type Props = {
  siteName: string;
};

const SUPABASE_AVATAR_PREFIX = 'supabase:';

function isSupabaseAvatarValue(value: string) {
  return value.startsWith(SUPABASE_AVATAR_PREFIX);
}

function getSupabaseAvatarPath(value: string) {
  return value.replace(SUPABASE_AVATAR_PREFIX, '').trim();
}

export default function Opt({ siteName }: Props) {
  const fileInputReference = useRef<HTMLInputElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [rhizomes, setRhizomes] = useState<RhizomesInfo | null>(null);
  const [sites, setSites] = useState<SitesInfo | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState<string | boolean>('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    async function loadInfo() {
      try {
        const response = await fetch(`/api/info/general/site/${siteName}/edit`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '사이트 정보를 불러오지 못했습니다.');
        }

        setRhizomes(result.rhizomes);
        setSites(result.sites);
        setProfilePictureUrl(result.profilePictureUrl ?? '');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '사이트 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('사이트 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInfo();
  }, [siteName]);

  function startEdit(field: EditableField, value: string | boolean | null) {
    setEditingField(field);
    setDraftValue(typeof value === 'boolean' ? value : (value ?? ''));
    setErrorMessage('');
    setSuccessMessage('');
  }

  function cancelEdit() {
    setEditingField(null);
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleTextChange(event: InputChangeEvent | TextAreaChangeEvent) {
    setDraftValue(event.currentTarget.value);
  }

  function handleSwitchChange(event: InputChangeEvent) {
    setDraftValue(event.currentTarget.checked);
  }

  async function refreshInfo(nextSiteName?: string) {
    const targetSiteName = nextSiteName ?? siteName;

    const response = await fetch(`/api/info/general/site/${targetSiteName}/edit`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? '사이트 정보를 불러오지 못했습니다.');
    }

    setRhizomes(result.rhizomes);
    setSites(result.sites);
    setProfilePictureUrl(result.profilePictureUrl ?? '');
  }

  async function saveField(field: EditableField, value?: string | boolean) {
    if (!rhizomes || isSubmitting) {
      return;
    }

    const nextValue = value ?? draftValue;

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/info/general/site/${siteName}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          field,
          value: nextValue,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '사이트 정보 수정에 실패했습니다.');
      }

      await refreshInfo(result.siteName);

      if (field === 'site_key' && typeof result.siteName === 'string') {
        window.location.href = `/${result.siteName}/manage/general`;
        return;
      }

      setEditingField(null);
      setSuccessMessage('저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '사이트 정보 수정에 실패했습니다.');
      } else {
        setErrorMessage('사이트 정보 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleProfilePictureFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !rhizomes || isUploadingAvatar) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingAvatar(true);

    try {
      if (rhizomes.profile_picture && isSupabaseAvatarValue(rhizomes.profile_picture)) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: getSupabaseAvatarPath(rhizomes.profile_picture),
          }),
        });

        const deleteResult = await deleteResponse.json();

        if (!deleteResponse.ok) {
          throw new Error(deleteResult.error ?? '기존 아바타 삭제에 실패했습니다.');
        }
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      const addResponse = await fetch('/api/attachment/add/avatar/site', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const addResult = await addResponse.json();

      if (!addResponse.ok) {
        throw new Error(addResult.error ?? '아바타 업로드에 실패했습니다.');
      }

      const nextProfilePicture =
        typeof addResult.avatar === 'string' && addResult.avatar.trim() ? addResult.avatar.trim() : '';

      if (!nextProfilePicture) {
        throw new Error('업로드된 아바타 정보를 확인하지 못했습니다.');
      }

      await saveField('profile_picture', nextProfilePicture);
      setSuccessMessage('아바타가 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '아바타 저장에 실패했습니다.');
      } else {
        setErrorMessage('아바타 저장에 실패했습니다.');
      }
    } finally {
      setIsUploadingAvatar(false);
      inputElement.value = '';
    }
  }

  function handleClickAvatarUpload() {
    if (isUploadingAvatar) {
      return;
    }

    fileInputReference.current?.click();
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  if (isLoading || !rhizomes || !sites) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2 }}>
        <Stack spacing={1.5} alignItems="center">
          {profilePictureUrl ? (
            <Avatar src={profilePictureUrl} alt="사이트 아바타" sx={{ width: 96, height: 96 }} />
          ) : (
            <Avatar sx={{ width: 96, height: 96 }}>
              <PersonIcon />
            </Avatar>
          )}

          <input
            ref={fileInputReference}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleProfilePictureFileChange}
          />

          <Button type="button" variant="outlined" onClick={handleClickAvatarUpload} disabled={isUploadingAvatar}>
            {profilePictureUrl ? '이미지 교체' : '이미지 추가'}
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Typography>
          {rhizomes.site_label} {formatDate(rhizomes.created_at)}에 생성
        </Typography>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>사이트 식별자</Typography>
          {editingField === 'site_key' ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{
                alignItems: 'center',
              }}
            >
              <TextField
                value={String(draftValue)}
                onChange={handleTextChange}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">{baseUrl}/</InputAdornment>,
                  },
                }}
              />
              <Button
                type="button"
                variant="contained"
                onClick={() => void saveField('site_key')}
                disabled={isSubmitting}
                sx={{ whiteSpace: 'nowrap' }}
                size="large"
              >
                수정 완료
              </Button>
              <Button type="button" onClick={() => cancelEdit()} size="large">
                취소
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{rhizomes.site_key}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('site_key', rhizomes.site_key)}>
                수정
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>사이트명</Typography>
          {editingField === 'site_label' ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <TextField value={String(draftValue)} onChange={handleTextChange} fullWidth size="small" />
              <Button
                type="button"
                variant="contained"
                onClick={() => void saveField('site_label')}
                disabled={isSubmitting}
                size="large"
                sx={{ whiteSpace: 'nowrap' }}
              >
                수정 완료
              </Button>
              <Button type="button" onClick={() => cancelEdit()} size="large">
                취소
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{rhizomes.site_label ?? ''}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('site_label', rhizomes.site_label)}>
                수정
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>사이트 설명</Typography>
          {editingField === 'summary' ? (
            <>
              <TextField value={String(draftValue)} onChange={handleTextChange} fullWidth multiline minRows={4} />
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('summary')}
                  disabled={isSubmitting}
                >
                  수정 완료
                </Button>
                <Button type="button" onClick={() => cancelEdit()}>
                  취소
                </Button>
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{rhizomes.summary ?? ''}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('summary', rhizomes.summary)}>
                수정
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>테마</Typography>
          {editingField === 'theme_type' ? (
            <>
              <TextField value={String(draftValue)} onChange={handleTextChange} fullWidth />
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('theme_type')}
                  disabled={isSubmitting}
                >
                  변경 완료
                </Button>
                <Button type="button" onClick={() => cancelEdit()}>
                  취소
                </Button>
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{rhizomes.theme_type}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('theme_type', rhizomes.theme_type)}>
                변경
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>{rhizomes.site_type === 'blog' ? '블로그' : '커뮤니티'} 공개</Typography>
          {editingField === 'visibility_type' ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={draftValue === 'public'}
                    onChange={(event) => setDraftValue(event.currentTarget.checked ? 'public' : 'private')}
                  />
                }
                label={draftValue === 'public' ? '공개' : '비공개'}
              />
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  alignItems: 'center',
                }}
              >
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('visibility_type')}
                  disabled={isSubmitting}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  변경 완료
                </Button>
                <Button type="button" onClick={() => cancelEdit()}>
                  취소
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{rhizomes.visibility_type === 'public' ? '공개' : '비공개'}</Typography>
              <Button
                type="button"
                variant="outlined"
                onClick={() => startEdit('visibility_type', rhizomes.visibility_type)}
              >
                변경
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography>운영중단</Typography>
          {editingField === 'is_shutdown' ? (
            <Stack
              direction="row"
              spacing={2}
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <FormControlLabel
                control={<Switch checked={Boolean(draftValue)} onChange={handleSwitchChange} />}
                label={Boolean(draftValue) ? '중단' : '운영'}
              />
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('is_shutdown')}
                  disabled={isSubmitting}
                >
                  변경 완료
                </Button>
                <Button type="button" onClick={() => cancelEdit()}>
                  취소
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{rhizomes.is_shutdown ? '중단함' : '운영중'}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('is_shutdown', rhizomes.is_shutdown)}>
                변경
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 0, overflow: 'hidden' }}>
        <Table sx={{ tableLayout: 'fixed', width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>수정내역</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>수정일</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>수정자</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{sites.log}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeFull(sites.updated_at)} 변경</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{sites.updated_by_name}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
    </Stack>
  );
}
