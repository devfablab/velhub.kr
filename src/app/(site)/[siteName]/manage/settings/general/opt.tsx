'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Avatar,
  Button,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  styled,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDate, formatDateTimeFull, normalizeText } from '@/lib/utils';

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

type ThemeType = 'default' | 'coral' | 'teal' | 'royalblue' | 'slateblue' | 'seagreen' | 'orchid' | 'tomato';

type SiteInfoInfo = {
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

type SiteKeyCheckResponse = {
  ok?: boolean;
  normalizedSiteKey?: string;
  error?: string;
};

type SiteLabelCheckResponse = {
  ok?: boolean;
  normalizedSiteLabel?: string;
  error?: string;
};

const THEME_TYPES: ThemeType[] = ['default', 'coral', 'teal', 'royalblue', 'slateblue', 'seagreen', 'orchid', 'tomato'];

function normalizeSiteKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isThemeType(value: string): value is ThemeType {
  return THEME_TYPES.includes(value as ThemeType);
}

function applyColorSet(themeType: string) {
  document.documentElement.setAttribute('data-colorset', themeType);
}

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

export default function Opt() {
  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [isLoading, setIsLoading] = useState(true);
  const [siteInfo, setSiteInfo] = useState<SiteInfoInfo | null>(null);
  const [sites, setSites] = useState<SitesInfo | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState<string | boolean>('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  const [isCheckingSiteKey, setIsCheckingSiteKey] = useState(false);
  const [checkedSiteKey, setCheckedSiteKey] = useState('');
  const [isSiteKeyAvailable, setIsSiteKeyAvailable] = useState(false);
  const [siteKeyCheckMessage, setSiteKeyCheckMessage] = useState('');

  const [isCheckingSiteLabel, setIsCheckingSiteLabel] = useState(false);
  const [checkedSiteLabel, setCheckedSiteLabel] = useState('');
  const [isSiteLabelAvailable, setIsSiteLabelAvailable] = useState(false);
  const [siteLabelCheckMessage, setSiteLabelCheckMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

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

        setSiteInfo(result.siteInfo);
        setSites(result.sites);
        applyColorSet(result.siteInfo.theme_type);
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

  function resetSiteKeyCheck() {
    setCheckedSiteKey('');
    setIsSiteKeyAvailable(false);
    setSiteKeyCheckMessage('');
  }

  function resetSiteLabelCheck() {
    setCheckedSiteLabel('');
    setIsSiteLabelAvailable(false);
    setSiteLabelCheckMessage('');
  }

  function startEdit(field: EditableField, value: string | boolean | null) {
    setEditingField(field);
    setDraftValue(typeof value === 'boolean' ? value : (value ?? ''));
    setErrorMessage('');
    setSuccessMessage('');
    resetSiteKeyCheck();
    resetSiteLabelCheck();

    if (field === 'site_key' && typeof value === 'string') {
      setCheckedSiteKey(value);
      setIsSiteKeyAvailable(true);
    }

    if (field === 'site_label' && typeof value === 'string') {
      setCheckedSiteLabel(value.trim());
      setIsSiteLabelAvailable(Boolean(value.trim()));
    }
  }

  function cancelEdit() {
    if (editingField === 'theme_type' && siteInfo) {
      applyColorSet(siteInfo.theme_type);
    }

    setEditingField(null);
    setErrorMessage('');
    setSuccessMessage('');
    resetSiteKeyCheck();
    resetSiteLabelCheck();
  }

  function handleTextChange(event: InputChangeEvent | TextAreaChangeEvent) {
    setDraftValue(event.currentTarget.value);
  }

  function handleSiteKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeSiteKey(event.currentTarget.value);

    setDraftValue(normalizedValue);
    setErrorMessage('');
    setSuccessMessage('');
    resetSiteKeyCheck();
  }

  function handleSiteLabelChange(event: InputChangeEvent) {
    setDraftValue(event.currentTarget.value);
    setErrorMessage('');
    setSuccessMessage('');
    resetSiteLabelCheck();
  }

  function handleThemeTypeChange(event: InputChangeEvent) {
    const nextValue = event.target.value;

    if (!isThemeType(nextValue)) {
      return;
    }

    setDraftValue(nextValue);
    applyColorSet(nextValue);
  }

  function handleSwitchChange(event: InputChangeEvent) {
    setDraftValue(event.currentTarget.checked);
  }

  async function handleCheckSiteKey() {
    if (!siteInfo || isCheckingSiteKey) {
      return;
    }

    const normalizedSiteKey = normalizeSiteKey(String(draftValue));

    setDraftValue(normalizedSiteKey);
    setErrorMessage('');
    setSuccessMessage('');
    resetSiteKeyCheck();

    if (!normalizedSiteKey) {
      setErrorMessage('사이트 식별자를 입력해주세요.');
      return;
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      setErrorMessage("영소문자, 하이픈('-'), 숫자만 사용 가능합니다.");
      return;
    }

    if (normalizedSiteKey === siteInfo.site_key) {
      setCheckedSiteKey(normalizedSiteKey);
      setIsSiteKeyAvailable(true);
      setSiteKeyCheckMessage('현재 사용 중인 사이트 식별자입니다.');
      return;
    }

    try {
      setIsCheckingSiteKey(true);

      const response = await fetch('/api/site/check-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteKey: normalizedSiteKey,
        }),
      });

      const result = (await response.json()) as SiteKeyCheckResponse;

      if (typeof result.normalizedSiteKey === 'string') {
        setDraftValue(result.normalizedSiteKey);
      }

      if (!response.ok || !result.ok) {
        setCheckedSiteKey(result.normalizedSiteKey ?? normalizedSiteKey);
        setIsSiteKeyAvailable(false);
        setErrorMessage(result.error ?? '사용할 수 없는 사이트 식별자입니다.');
        return;
      }

      setCheckedSiteKey(result.normalizedSiteKey ?? normalizedSiteKey);
      setIsSiteKeyAvailable(true);
      setSiteKeyCheckMessage('사용 가능한 사이트 식별자입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '사이트 식별자 확인에 실패했습니다.');
      } else {
        setErrorMessage('사이트 식별자 확인에 실패했습니다.');
      }
      resetSiteKeyCheck();
    } finally {
      setIsCheckingSiteKey(false);
    }
  }

  async function handleCheckSiteLabel() {
    if (!siteInfo || isCheckingSiteLabel) {
      return;
    }

    const trimmedSiteLabel = String(draftValue).trim();

    setErrorMessage('');
    setSuccessMessage('');
    resetSiteLabelCheck();

    if (!trimmedSiteLabel) {
      setErrorMessage('사이트명을 입력해주세요.');
      return;
    }

    if (trimmedSiteLabel === (siteInfo.site_label ?? '').trim()) {
      setCheckedSiteLabel(trimmedSiteLabel);
      setIsSiteLabelAvailable(true);
      setSiteLabelCheckMessage('현재 사용 중인 사이트명입니다.');
      return;
    }

    try {
      setIsCheckingSiteLabel(true);

      const response = await fetch('/api/site/check-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteLabel: trimmedSiteLabel,
        }),
      });

      const result = (await response.json()) as SiteLabelCheckResponse;

      if (typeof result.normalizedSiteLabel === 'string') {
        setDraftValue(result.normalizedSiteLabel);
      }

      if (!response.ok || !result.ok) {
        setCheckedSiteLabel(result.normalizedSiteLabel ?? trimmedSiteLabel);
        setIsSiteLabelAvailable(false);
        setErrorMessage(result.error ?? '사용할 수 없는 사이트명입니다.');
        return;
      }

      setCheckedSiteLabel(result.normalizedSiteLabel ?? trimmedSiteLabel);
      setIsSiteLabelAvailable(true);
      setSiteLabelCheckMessage('사용 가능한 사이트명입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '사이트명 확인에 실패했습니다.');
      } else {
        setErrorMessage('사이트명 확인에 실패했습니다.');
      }
      resetSiteLabelCheck();
    } finally {
      setIsCheckingSiteLabel(false);
    }
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

    setSiteInfo(result.siteInfo);
    setSites(result.sites);
    applyColorSet(result.siteInfo.theme_type);
    setProfilePictureUrl(result.profilePictureUrl ?? '');
  }

  async function saveField(field: EditableField, value?: string | boolean) {
    if (!siteInfo || isSubmitting) {
      return;
    }

    const nextValue = value ?? draftValue;

    if (field === 'site_key') {
      const normalizedSiteKey = normalizeSiteKey(String(nextValue));

      if (!isSiteKeyAvailable || checkedSiteKey !== normalizedSiteKey) {
        setErrorMessage('사이트 식별자 중복 확인을 해주세요.');
        setSuccessMessage('');
        return;
      }
    }

    if (field === 'site_label') {
      const trimmedSiteLabel = String(nextValue).trim();

      if (trimmedSiteLabel && (!isSiteLabelAvailable || checkedSiteLabel !== trimmedSiteLabel)) {
        setErrorMessage('사이트명 중복 확인을 해주세요.');
        setSuccessMessage('');
        return;
      }
    }

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
        window.location.href = `/${result.siteName}/manage/settings/general`;
        return;
      }

      setEditingField(null);
      resetSiteKeyCheck();
      resetSiteLabelCheck();
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

    if (!selectedFile || !siteInfo || isUploadingAvatar) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingAvatar(true);

    try {
      if (siteInfo.profile_picture) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: siteInfo.profile_picture,
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

  if (isLoading || !siteInfo || !sites) {
    return null;
  }

  return (
    <Stack spacing={2}>
      {isNotMobile && (
        <Typography variant="h5" component="h1">
          기본 설정
        </Typography>
      )}

      <Typography variant="subtitle2">
        {siteInfo.site_type === 'blog' ? '블로그' : '커뮤니티'} ‘{siteInfo.site_label}’{' '}
        {formatDate(siteInfo.created_at)}에 개설
      </Typography>

      <Stack spacing={1.5} alignItems="center">
        <Avatar
          src={profilePictureUrl || '/broken-image.jpg'}
          alt={siteInfo.site_label ?? ''}
          sx={{ width: 96, height: 96 }}
        />

        <VisuallyHiddenInput
          ref={fileInputReference}
          type="file"
          accept="image/*"
          onChange={handleProfilePictureFileChange}
        />

        <Button type="button" variant="outlined" onClick={handleClickAvatarUpload} disabled={isUploadingAvatar}>
          {profilePictureUrl ? '이미지 교체' : '이미지 추가'}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">사이트 식별자</Typography>
          {editingField === 'site_key' ? (
            <>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'flex-start',
                }}
              >
                <TextField
                  value={String(draftValue)}
                  onChange={handleSiteKeyChange}
                  fullWidth
                  size="small"
                  helperText="영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다."
                  slotProps={{
                    input: {
                      startAdornment: <InputAdornment position="start">{baseUrl}/</InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            type="button"
                            variant="outlined"
                            onClick={() => void handleCheckSiteKey()}
                            disabled={isCheckingSiteKey}
                            size="small"
                          >
                            중복 확인
                          </Button>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="button"
                  onClick={() => cancelEdit()}
                  size="large"
                  variant="outlined"
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('site_key')}
                  disabled={isSubmitting || isCheckingSiteKey}
                  sx={{ whiteSpace: 'nowrap' }}
                  size="large"
                >
                  수정 완료
                </Button>
              </Stack>
              {siteKeyCheckMessage ? (
                <Alert severity="success" variant="outlined">
                  {siteKeyCheckMessage}
                </Alert>
              ) : null}
            </>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{siteInfo.site_key}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('site_key', siteInfo.site_key)}>
                수정
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">사이트명</Typography>
          {editingField === 'site_label' ? (
            <>
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <TextField
                  value={String(draftValue)}
                  onChange={handleSiteLabelChange}
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            type="button"
                            variant="outlined"
                            onClick={() => void handleCheckSiteLabel()}
                            disabled={isCheckingSiteLabel}
                            size="small"
                          >
                            중복 확인
                          </Button>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Button
                  type="button"
                  onClick={() => cancelEdit()}
                  size="large"
                  variant="outlined"
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('site_label')}
                  disabled={isSubmitting || isCheckingSiteLabel}
                  size="large"
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  수정 완료
                </Button>
              </Stack>
              {siteLabelCheckMessage ? (
                <Alert severity="success" variant="outlined">
                  {siteLabelCheckMessage}
                </Alert>
              ) : null}
            </>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{siteInfo.site_label ?? ''}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('site_label', siteInfo.site_label)}>
                수정
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">사이트 설명</Typography>
          {editingField === 'summary' ? (
            <>
              <TextField
                value={String(draftValue)}
                onChange={handleTextChange}
                fullWidth
                multiline
                size="small"
                minRows={4}
              />
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <Button type="button" onClick={() => cancelEdit()} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
                  취소
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('summary')}
                  disabled={isSubmitting}
                >
                  수정 완료
                </Button>
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{siteInfo.summary ?? ''}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('summary', siteInfo.summary)}>
                수정
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">테마</Typography>
          {editingField === 'theme_type' ? (
            <>
              <TextField
                select
                value={String(draftValue || 'default')}
                onChange={handleThemeTypeChange}
                fullWidth
                size="small"
              >
                {THEME_TYPES.map((themeValue) => (
                  <MenuItem key={themeValue} value={themeValue}>
                    {themeValue}
                  </MenuItem>
                ))}
              </TextField>
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <Button type="button" onClick={() => cancelEdit()} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
                  취소
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('theme_type')}
                  disabled={isSubmitting}
                >
                  변경 완료
                </Button>
              </Stack>
            </>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography>{siteInfo.theme_type}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('theme_type', siteInfo.theme_type)}>
                변경
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">{siteInfo.site_type === 'blog' ? '블로그' : '커뮤니티'} 공개</Typography>
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
                <Button type="button" onClick={() => cancelEdit()} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
                  취소
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('visibility_type')}
                  disabled={isSubmitting}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  변경 완료
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">{siteInfo.visibility_type === 'public' ? '공개' : '비공개'}</Typography>
              <Button
                type="button"
                variant="outlined"
                onClick={() => startEdit('visibility_type', siteInfo.visibility_type)}
              >
                변경
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">운영중단</Typography>
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
                <Button type="button" onClick={() => cancelEdit()} variant="outlined" sx={{ whiteSpace: 'nowrap' }}>
                  취소
                </Button>
                <Button
                  type="button"
                  variant="contained"
                  onClick={() => void saveField('is_shutdown')}
                  disabled={isSubmitting}
                >
                  변경 완료
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">{siteInfo.is_shutdown ? '중단함' : '운영중'}</Typography>
              <Button type="button" variant="outlined" onClick={() => startEdit('is_shutdown', siteInfo.is_shutdown)}>
                변경
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined">
        <Table size="small">
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
  );
}
