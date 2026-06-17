'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Avatar,
  Box,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Select,
  SelectChangeEvent,
  Snackbar,
  Stack,
  styled,
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
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { formatDate, formatDateTimeFull, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

type EditableField =
  | 'site_key'
  | 'site_label'
  | 'profile_picture'
  | 'profile_logo'
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
  profile_logo: string | null;
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
  const logoInputReference = useRef<HTMLInputElement | null>(null);
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [isLoading, setIsLoading] = useState(true);
  const [siteInfo, setSiteInfo] = useState<SiteInfoInfo | null>(null);
  const [sites, setSites] = useState<SitesInfo | null>(null);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState<string | boolean>('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profileLogoUrl, setProfileLogoUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
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
  const isMobile = !isNotMobile;

  useEffect(() => {
    async function loadInfo() {
      try {
        const response = await fetch(`/api/info/general/site/${siteName}`, {
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
        setProfileLogoUrl(result.profileLogoUrl ?? '');
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

  function handleThemeTypeChange(event: SelectChangeEvent) {
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
    setProfileLogoUrl(result.profileLogoUrl ?? '');
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

  async function handleProfileLogoFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !siteInfo || isUploadingLogo) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const addResponse = await fetch('/api/attachment/add/site-logo', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const addResult = await addResponse.json();

      if (!addResponse.ok) {
        throw new Error(addResult.error ?? '사이트 로고 업로드에 실패했습니다.');
      }

      const nextProfileLogo = typeof addResult.logo === 'string' && addResult.logo.trim() ? addResult.logo.trim() : '';

      if (!nextProfileLogo) {
        throw new Error('업로드된 사이트 로고 정보를 확인하지 못했습니다.');
      }

      await saveField('profile_logo', nextProfileLogo);
      setSuccessMessage('사이트 로고가 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '사이트 로고 저장에 실패했습니다.');
      } else {
        setErrorMessage('사이트 로고 저장에 실패했습니다.');
      }
    } finally {
      setIsUploadingLogo(false);
      inputElement.value = '';
    }
  }

  function handleClickAvatarUpload() {
    if (isUploadingAvatar) {
      return;
    }

    fileInputReference.current?.click();
  }

  function handleClickLogoUpload() {
    if (isUploadingLogo) {
      return;
    }

    logoInputReference.current?.click();
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  if (isLoading) {
    return (
      <Container pageTitle="사이트 정보" pageBack={`/${siteName}/manage`} menu="settings">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (!siteInfo) {
    return (
      <Container pageTitle="사이트 정보" pageBack={`/${siteName}/manage`} menu="settings">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper paper-error ${styles.paper}`}>사이트 정보를 불러오지 못했습니다</div>
          </div>
        </div>
      </Container>
    );
  }

  if (!sites) {
    return (
      <Container
        pageTitle={siteInfo.site_type === 'blog' ? '블로그 정보' : '커뮤니티 정보'}
        pageBack={`/${siteName}/manage`}
        menu="settings"
      >
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <div className={`paper paper-error ${styles.paper}`}>업데이트 정보를 불러오지 못했습니다</div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container
      pageTitle={siteInfo.site_type === 'blog' ? '블로그 정보' : '커뮤니티 정보'}
      pageBack={`/${siteName}/manage`}
      menu="settings"
    >
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <Snackbar
            open={Boolean(successMessage)}
            message={successMessage}
            autoHideDuration={2700}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            onClose={() => setSuccessMessage('')}
          />

          <Typography variant="subtitle2" sx={{ p: 2 }}>
            {siteInfo.site_type === 'blog' ? '블로그' : '커뮤니티'} ‘{siteInfo.site_label}’{' '}
            {formatDate(siteInfo.created_at)}에 개설
          </Typography>
          <Stack gap={1.5} alignItems="center">
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

            <button
              type="button"
              className="button small action"
              onClick={handleClickAvatarUpload}
              disabled={isUploadingAvatar}
            >
              {profilePictureUrl ? '사이트 아바타 이미지 교체' : '사이트 아바타 이미지 추가'}
            </button>
          </Stack>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">사이트 로고</Typography>

            <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
              {profileLogoUrl ? (
                <Box
                  component="img"
                  src={profileLogoUrl}
                  alt={`${siteInfo.site_label ?? siteInfo.site_key} 로고`}
                  sx={{
                    maxWidth: 240,
                    maxHeight: 80,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Typography variant="body2">등록된 사이트 로고가 없습니다.</Typography>
              )}

              <VisuallyHiddenInput
                ref={logoInputReference}
                type="file"
                accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
                onChange={handleProfileLogoFileChange}
              />

              <button
                type="button"
                className="button small action"
                onClick={handleClickLogoUpload}
                disabled={isUploadingLogo}
              >
                {profileLogoUrl ? '로고 교체' : '로고 추가'}
              </button>
            </Stack>
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">사이트 식별자</Typography>
            {editingField === 'site_key' ? (
              <>
                <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
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
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => void handleCheckSiteKey()}
                              disabled={isCheckingSiteKey}
                            >
                              중복 확인
                            </button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Stack gap={1} direction="row" justifyContent="flex-end">
                    <button
                      type="button"
                      onClick={() => cancelEdit()}
                      className={`button ${isMobile ? 'small' : 'medium'} cancel`}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className={`button ${isMobile ? 'small' : 'medium'} submit`}
                      onClick={() => void saveField('site_key')}
                      disabled={isSubmitting || isCheckingSiteKey}
                    >
                      수정 완료
                    </button>
                  </Stack>
                </Stack>
                {siteKeyCheckMessage ? (
                  <Snackbar
                    open={Boolean(siteKeyCheckMessage)}
                    message={siteKeyCheckMessage}
                    autoHideDuration={2700}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    onClose={() => setSiteKeyCheckMessage('')}
                  />
                ) : null}
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography>{siteInfo.site_key}</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => startEdit('site_key', siteInfo.site_key)}
                >
                  수정
                </button>
              </Stack>
            )}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">사이트명</Typography>
            {editingField === 'site_label' ? (
              <>
                <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                  <TextField
                    value={String(draftValue)}
                    onChange={handleSiteLabelChange}
                    fullWidth
                    size="small"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => void handleCheckSiteLabel()}
                              disabled={isCheckingSiteLabel}
                            >
                              중복 확인
                            </button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Stack gap={1} direction="row" justifyContent="flex-end">
                    <button
                      type="button"
                      className={`button ${isMobile ? 'small' : 'medium'} cancel`}
                      onClick={() => cancelEdit()}
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      className={`button ${isMobile ? 'small' : 'medium'} submit`}
                      onClick={() => void saveField('site_label')}
                      disabled={isSubmitting || isCheckingSiteLabel}
                    >
                      수정 완료
                    </button>
                  </Stack>
                </Stack>
                {siteLabelCheckMessage ? (
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>{siteLabelCheckMessage}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography>{siteInfo.site_label ?? ''}</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => startEdit('site_label', siteInfo.site_label)}
                >
                  수정
                </button>
              </Stack>
            )}
          </div>
          <div className={`paper ${styles.paper}`}>
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
                  gap={2}
                  sx={{
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                  }}
                >
                  <button type="button" className="button medium cancel" onClick={() => cancelEdit()}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void saveField('summary')}
                    disabled={isSubmitting}
                  >
                    수정 완료
                  </button>
                </Stack>
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography>{siteInfo.summary ?? ''}</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => startEdit('summary', siteInfo.summary)}
                >
                  수정
                </button>
              </Stack>
            )}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">테마</Typography>
            {editingField === 'theme_type' ? (
              <>
                <Select value={String(draftValue || 'default')} onChange={handleThemeTypeChange} fullWidth size="small">
                  {THEME_TYPES.map((themeValue) => (
                    <MenuItem key={themeValue} value={themeValue}>
                      {draftValue === themeValue ? (
                        <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                      ) : (
                        <i style={{ width: 14, height: 14, marginRight: 8 }} />
                      )}
                      {themeValue}
                    </MenuItem>
                  ))}
                </Select>
                <Stack
                  direction="row"
                  gap={2}
                  sx={{
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                  }}
                >
                  <button type="button" className="button medium cancel" onClick={() => cancelEdit()}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void saveField('theme_type')}
                    disabled={isSubmitting}
                  >
                    변경 완료
                  </button>
                </Stack>
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography>{siteInfo.theme_type}</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => startEdit('theme_type', siteInfo.theme_type)}
                >
                  변경
                </button>
              </Stack>
            )}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">{siteInfo.site_type === 'blog' ? '블로그' : '커뮤니티'} 공개</Typography>
            {editingField === 'visibility_type' ? (
              <Stack
                direction="row"
                gap={2}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <FormControlLabel
                  label={draftValue === 'public' ? '공개' : '비공개'}
                  control={
                    <IOSSwitch
                      sx={{ m: 1 }}
                      checked={draftValue === 'public'}
                      onChange={(event) => setDraftValue(event.currentTarget.checked ? 'public' : 'private')}
                    />
                  }
                />
                <Stack
                  direction="row"
                  gap={2}
                  sx={{
                    alignItems: 'center',
                  }}
                >
                  <button type="button" className="button medium cancel" onClick={() => cancelEdit()}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void saveField('visibility_type')}
                    disabled={isSubmitting}
                  >
                    변경 완료
                  </button>
                </Stack>
              </Stack>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">{siteInfo.visibility_type === 'public' ? '공개' : '비공개'}</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => startEdit('visibility_type', siteInfo.visibility_type)}
                >
                  변경
                </button>
              </Stack>
            )}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">운영 여부</Typography>
            {editingField === 'is_shutdown' ? (
              <Stack
                direction="row"
                gap={2}
                sx={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <FormControlLabel
                  label={Boolean(draftValue) ? '중단' : '운영'}
                  control={<IOSSwitch sx={{ m: 1 }} checked={Boolean(draftValue)} onChange={handleSwitchChange} />}
                />

                <Stack
                  direction="row"
                  gap={2}
                  sx={{
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                  }}
                >
                  <button type="button" className="button medium cancel" onClick={() => cancelEdit()}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void saveField('is_shutdown')}
                    disabled={isSubmitting}
                  >
                    변경 완료
                  </button>
                </Stack>
              </Stack>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">{siteInfo.is_shutdown ? '중단함' : '운영중'}</Typography>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => startEdit('is_shutdown', siteInfo.is_shutdown)}
                >
                  변경
                </button>
              </Stack>
            )}
          </div>
          <div className={`paper paper-p0 ${styles.paper}`}>
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
          </div>
        </div>
      </div>
    </Container>
  );
}
