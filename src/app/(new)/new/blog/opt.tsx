'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  styled,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';

type PlanRow = {
  id: string;
  category_key: string;
  category_label: string;
  plan_key: string;
  plan_label: string;
  price: number;
  product_type: string;
};

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

const SUPABASE_AVATAR_PREFIX = 'supabase:';

function isSupabaseAvatarValue(value: string) {
  return value.startsWith(SUPABASE_AVATAR_PREFIX);
}

function getSupabaseAvatarPath(value: string) {
  return value.replace(SUPABASE_AVATAR_PREFIX, '').trim();
}

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

export default function Opt() {
  const router = useRouter();
  const fileInputReference = useRef<HTMLInputElement | null>(null);

  const [siteKey, setSiteKey] = useState('');
  const [siteKeyStatusMessage, setSiteKeyStatusMessage] = useState('');
  const [siteLabel, setSiteLabel] = useState('');
  const [siteLabelStatusMessage, setSiteLabelStatusMessage] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [visibilityType, setVisibilityType] = useState<VisibilityType>('public');
  const [themeType, setThemeType] = useState<ThemeType>('default');
  const [isShutdown, setIsShutdown] = useState(false);
  const [commentProvider, setCommentProvider] = useState<CommentProvider>('disqus');
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planType, setPlanType] = useState('');

  const [isCheckingSiteKey, setIsCheckingSiteKey] = useState(false);
  const [isCheckingSiteLabel, setIsCheckingSiteLabel] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch('/api/plans', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '요금제 목록을 불러오지 못했습니다.');
        }

        const allPlans = Array.isArray(result.plans) ? result.plans : [];
        const nextPlans = allPlans.filter((planRow: PlanRow) => planRow.category_key === 'blog');

        setPlans(nextPlans);

        if (nextPlans.length > 0) {
          setPlanType(nextPlans[0].id);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          openErrorDialog(unknownError.message || '요금제 목록을 불러오지 못했습니다.');
        } else {
          openErrorDialog('요금제 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoadingPlans(false);
      }
    }

    void loadPlans();
  }, []);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  function openErrorDialog(message: string) {
    setErrorMessage(message);
    setSuccessMessage('');
    setIsErrorDialogOpen(true);
  }

  function closeErrorDialog() {
    setIsErrorDialogOpen(false);
  }

  function handleSiteKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeSiteKey(event.currentTarget.value);

    setSiteKey(normalizedValue);
    setSiteKeyStatusMessage('');
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleSiteLabelChange(event: InputChangeEvent) {
    setSiteLabel(event.currentTarget.value);
    setSiteLabelStatusMessage('');
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleSummaryChange(event: TextAreaChangeEvent | InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  function handleThemeTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'default') {
      return;
    }

    setThemeType(nextValue);
  }

  function handleCommentProviderChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'none' && nextValue !== 'giscus' && nextValue !== 'disqus' && nextValue !== 'velhub') {
      return;
    }

    setCommentProvider(nextValue);
  }

  function handleVisibilityTypeChange(event: InputChangeEvent) {
    setVisibilityType(event.currentTarget.checked ? 'public' : 'private');
  }

  function handleIsShutdownChange(event: InputChangeEvent) {
    setIsShutdown(event.currentTarget.checked);
  }

  function handlePlanTypeChange(event: InputChangeEvent) {
    setPlanType(event.currentTarget.value);
  }

  async function handleCheckSiteKey() {
    if (isCheckingSiteKey) {
      return;
    }

    const normalizedSiteKey = normalizeSiteKey(siteKey);

    setSiteKey(normalizedSiteKey);
    setErrorMessage('');
    setSuccessMessage('');
    setSiteKeyStatusMessage('');

    if (!normalizedSiteKey) {
      openErrorDialog('사이트 식별자를 입력해주세요.');
      return;
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      openErrorDialog("영소문자, 하이픈('-'), 숫자만 사용 가능합니다.");
      return;
    }

    setIsCheckingSiteKey(true);

    try {
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

      const result = await response.json();

      if (typeof result.normalizedSiteKey === 'string') {
        setSiteKey(result.normalizedSiteKey);
      }

      if (!response.ok) {
        throw new Error(result.error ?? '사이트 식별자 확인에 실패했습니다.');
      }

      setSiteKeyStatusMessage('사용 가능한 사이트 식별자입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        openErrorDialog(unknownError.message || '사이트 식별자 확인에 실패했습니다.');
      } else {
        openErrorDialog('사이트 식별자 확인에 실패했습니다.');
      }
    } finally {
      setIsCheckingSiteKey(false);
    }
  }

  async function handleCheckSiteLabel() {
    if (isCheckingSiteLabel) {
      return;
    }

    const trimmedSiteLabel = siteLabel.trim();

    setErrorMessage('');
    setSuccessMessage('');
    setSiteLabelStatusMessage('');

    if (!trimmedSiteLabel) {
      openErrorDialog('사이트명을 입력해주세요.');
      return;
    }

    setIsCheckingSiteLabel(true);

    try {
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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '사이트명 확인에 실패했습니다.');
      }

      setSiteLabelStatusMessage('사용 가능한 사이트명입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        openErrorDialog(unknownError.message || '사이트명 확인에 실패했습니다.');
      } else {
        openErrorDialog('사이트명 확인에 실패했습니다.');
      }
    } finally {
      setIsCheckingSiteLabel(false);
    }
  }

  async function handleProfilePictureFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || isUploadingAvatar) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingAvatar(true);

    try {
      if (profilePicture && isSupabaseAvatarValue(profilePicture)) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: getSupabaseAvatarPath(profilePicture),
          }),
        });

        const deleteResult = await deleteResponse.json();

        if (!deleteResponse.ok) {
          throw new Error(deleteResult.error ?? '기존 프로필 이미지 삭제에 실패했습니다.');
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
        throw new Error(addResult.error ?? '프로필 이미지 업로드에 실패했습니다.');
      }

      const nextProfilePicture =
        typeof addResult.avatar === 'string' && addResult.avatar.trim() ? addResult.avatar.trim() : '';

      if (!nextProfilePicture) {
        throw new Error('업로드된 프로필 이미지 정보를 확인하지 못했습니다.');
      }

      setProfilePicture(nextProfilePicture);
      setProfilePictureUrl(typeof addResult.url === 'string' ? addResult.url : '');
      setSuccessMessage('프로필 이미지가 업로드되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        openErrorDialog(unknownError.message || '프로필 이미지 업로드에 실패했습니다.');
      } else {
        openErrorDialog('프로필 이미지 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingAvatar(false);
      inputElement.value = '';
    }
  }

  function handleClickProfilePictureUpload() {
    if (isUploadingAvatar) {
      return;
    }

    fileInputReference.current?.click();
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || isCheckingSiteKey || isCheckingSiteLabel || isUploadingAvatar || isLoadingPlans) {
      return;
    }

    const normalizedSiteKey = normalizeSiteKey(siteKey);
    const trimmedSiteLabel = siteLabel.trim();
    const trimmedSummary = summary.trim();

    setSiteKey(normalizedSiteKey);
    setErrorMessage('');
    setSuccessMessage('');
    setSiteKeyStatusMessage('');
    setSiteLabelStatusMessage('');

    if (!normalizedSiteKey) {
      openErrorDialog('사이트 식별자를 입력해주세요.');
      return;
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      openErrorDialog("영소문자, 하이픈('-'), 숫자만 사용 가능합니다.");
      return;
    }

    if (!planType) {
      openErrorDialog('요금제를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/site/blog/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteKey: normalizedSiteKey,
          siteLabel: trimmedSiteLabel,
          profilePicture,
          summary: trimmedSummary,
          visibilityType,
          themeType,
          planType,
          isShutdown,
          commentProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 개설에 실패했습니다.');
      }

      setSuccessMessage('블로그가 개설되었습니다.');
      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        openErrorDialog(unknownError.message || '블로그 개설에 실패했습니다.');
      } else {
        openErrorDialog('블로그 개설에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Paper elevation={0} sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <Stack spacing={1.5}>
              <TextField
                label="사이트 식별자"
                value={siteKey}
                onChange={handleSiteKeyChange}
                fullWidth
                helperText="영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다."
                size="medium"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">{baseUrl}/</InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          type="button"
                          variant="outlined"
                          onClick={handleCheckSiteKey}
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

              {siteKeyStatusMessage ? (
                <Alert severity="success" variant="outlined">
                  {siteKeyStatusMessage}
                </Alert>
              ) : null}
            </Stack>

            <Stack spacing={1.5}>
              <TextField
                label="사이트명"
                value={siteLabel}
                onChange={handleSiteLabelChange}
                fullWidth
                size="small"
                helperText="입력하지 않으면 사이트 식별자를 기준으로 자동 생성됩니다."
                slotProps={{
                  input: {
                    endAdornment: siteLabel.trim() ? (
                      <InputAdornment position="end">
                        <Button
                          type="button"
                          variant="outlined"
                          onClick={handleCheckSiteLabel}
                          disabled={isCheckingSiteLabel}
                          size="small"
                        >
                          중복 확인
                        </Button>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />

              {siteLabelStatusMessage ? (
                <Alert severity="success" variant="outlined">
                  {siteLabelStatusMessage}
                </Alert>
              ) : null}
            </Stack>

            <Stack spacing={1.5} alignItems="flex-start">
              {profilePictureUrl ? (
                <Box
                  component="img"
                  src={profilePictureUrl}
                  alt="사이트 프로필 이미지"
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : null}

              <VisuallyHiddenInput
                ref={fileInputReference}
                type="file"
                accept="image/*"
                onChange={handleProfilePictureFileChange}
              />

              <Button
                type="button"
                variant="outlined"
                onClick={handleClickProfilePictureUpload}
                disabled={isUploadingAvatar}
              >
                프로필 이미지 업로드
              </Button>
            </Stack>

            <TextField
              label="요약"
              size="small"
              value={summary}
              onChange={handleSummaryChange}
              fullWidth
              multiline
              minRows={4}
            />

            <Stack spacing={1}>
              <FormLabel>테마</FormLabel>
              <RadioGroup value={themeType} onChange={handleThemeTypeChange}>
                <FormControlLabel value="default" control={<Radio />} label="default" />
              </RadioGroup>
            </Stack>

            <Stack spacing={1}>
              <FormLabel>요금제</FormLabel>
              <RadioGroup value={planType} onChange={handlePlanTypeChange}>
                {plans.map((planRow) => (
                  <FormControlLabel
                    key={planRow.id}
                    value={planRow.id}
                    control={<Radio />}
                    label={`${planRow.plan_label} (${planRow.price.toLocaleString()}원)`}
                  />
                ))}
              </RadioGroup>
            </Stack>

            <Stack spacing={1}>
              <FormLabel>댓글 방식 (댓글 서비스 제공자)</FormLabel>
              <RadioGroup value={commentProvider} onChange={handleCommentProviderChange}>
                <FormControlLabel value="velhub" control={<Radio />} label="velhub (데브허브 유저 전용)" />
                <FormControlLabel value="disqus" control={<Radio />} label="disqus" />
                <FormControlLabel value="giscus" control={<Radio />} label="giscus" />
                <FormControlLabel value="none" control={<Radio />} label="댓글 사용 안함" />
              </RadioGroup>
            </Stack>

            <Stack direction="row" spacing={3}>
              <FormControlLabel
                control={<Switch checked={visibilityType === 'public'} onChange={handleVisibilityTypeChange} />}
                label={visibilityType === 'public' ? '공개' : '비공개'}
              />

              <FormControlLabel
                control={<Switch checked={isShutdown} onChange={handleIsShutdownChange} />}
                label={isShutdown ? '중단' : '운영'}
              />
            </Stack>

            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || isCheckingSiteKey || isCheckingSiteLabel || isUploadingAvatar || isLoadingPlans}
              fullWidth
              size="large"
            >
              블로그 개설
            </Button>

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

            <Alert variant="filled" severity="info">
              개설이 완료되면 사이트 운영자 권한이 부여됩니다.
            </Alert>
          </Stack>
        </Box>
      </Paper>

      <Dialog open={isErrorDialogOpen} onClose={closeErrorDialog} fullWidth maxWidth="xs">
        <DialogTitle>개설할 수 없습니다</DialogTitle>
        <DialogContent>
          <Typography>하단 에러 메시지를 확인해 주세요</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="contained" onClick={closeErrorDialog}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
