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
  Drawer,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  styled,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/new.module.sass';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

type VisibilityType = 'public' | 'private';
type ThemeType = 'default' | 'coral' | 'teal' | 'royalblue' | 'slateblue' | 'seagreen' | 'orchid' | 'tomato';
type JoinType = 'open' | 'invite';
type PolicyPost = 'comment_0' | 'comment_1' | 'comment_3' | 'comment_5';
type PolicyComment = 'estimate_0' | 'estimate_1' | 'estimate_3' | 'estimate_5';

type PlanRow = {
  id: string;
  category_key: string;
  category_label: string;
  plan_key: string;
  plan_label: string;
  price: number;
  product_type: string;
};

const THEME_TYPES: ThemeType[] = ['default', 'coral', 'teal', 'royalblue', 'slateblue', 'seagreen', 'orchid', 'tomato'];

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

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedThemeMode)) {
    return storedThemeMode;
  }

  return 'system' as ThemeMode;
}

function getResolvedThemeMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
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
  const [planType, setPlanType] = useState('');
  const [isShutdown, setIsShutdown] = useState(false);
  const [joinType, setJoinType] = useState<JoinType>('open');
  const [policyPost, setPolicyPost] = useState<PolicyPost>('comment_1');
  const [policyComment, setPolicyComment] = useState<PolicyComment>('estimate_0');
  const [plans, setPlans] = useState<PlanRow[]>([]);

  const [isCheckingSiteKey, setIsCheckingSiteKey] = useState(false);
  const [isCheckingSiteLabel, setIsCheckingSiteLabel] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [baseUrl, setBaseUrl] = useState('');

  const { themeMode, setThemeMode } = useThemeMode();

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    setThemeMode(getStoredThemeMode());
    setIsMounted(true);
  }, [setThemeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    applyThemeMode(themeMode);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemThemeModeChange() {
      if (themeMode === 'system') {
        applyThemeMode('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemThemeModeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleSystemThemeModeChange);
    };
  }, [isMounted, themeMode]);

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
        const nextPlans = allPlans.filter((planRow: PlanRow) => planRow.category_key === 'community');

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

  useEffect(() => {
    document.documentElement.setAttribute('data-colorset', themeType);
  }, [themeType]);

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
  }

  function handleSummaryChange(event: TextAreaChangeEvent | InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  function handleThemeTypeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;

    if (!isThemeType(nextValue)) {
      return;
    }

    setThemeType(nextValue);
  }

  function handleVisibilityTypeChange(event: InputChangeEvent) {
    setVisibilityType(event.currentTarget.checked ? 'public' : 'private');
  }

  function handleIsShutdownChange(event: InputChangeEvent) {
    setIsShutdown(event.currentTarget.checked);
  }

  function handleJoinTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'open' && nextValue !== 'invite') {
      return;
    }

    setJoinType(nextValue);
  }

  function handlePolicyPostChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value as PolicyPost;

    if (
      nextValue !== 'comment_0' &&
      nextValue !== 'comment_1' &&
      nextValue !== 'comment_3' &&
      nextValue !== 'comment_5'
    ) {
      return;
    }

    setPolicyPost(nextValue);
  }

  function handlePolicyCommentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value as PolicyComment;

    if (
      nextValue !== 'estimate_0' &&
      nextValue !== 'estimate_1' &&
      nextValue !== 'estimate_3' &&
      nextValue !== 'estimate_5'
    ) {
      return;
    }

    setPolicyComment(nextValue);
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
      if (profilePicture) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: profilePicture,
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

    if (isSubmitting || isCheckingSiteKey || isUploadingAvatar || isLoadingPlans) {
      return;
    }

    const normalizedSiteKey = normalizeSiteKey(siteKey);
    const trimmedSiteLabel = siteLabel.trim();
    const trimmedSummary = summary.trim();

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

    if (!planType) {
      openErrorDialog('요금제를 선택해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/site/community/new', {
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
          joinType,
          policyPost,
          policyComment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '커뮤니티 개설에 실패했습니다.');
      }

      setSuccessMessage('커뮤니티가 개설되었습니다.');
      router.replace(`/${siteKey}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        openErrorDialog(unknownError.message || '커뮤니티 개설에 실패했습니다.');
      } else {
        openErrorDialog('커뮤니티 개설에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <div className={`paper ${styles.paper}`}>
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="subtitle2">커뮤니티 주소</Typography>
            <TextField
              value={siteKey}
              onChange={handleSiteKeyChange}
              fullWidth
              helperText="영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다."
              size="small"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">{baseUrl}/</InputAdornment>,
                  endAdornment: (
                    <InputAdornment position="end">
                      <button
                        type="button"
                        className="button small action"
                        onClick={handleCheckSiteKey}
                        disabled={isCheckingSiteKey}
                      >
                        중복 확인
                      </button>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {siteKeyStatusMessage ? (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>{siteKeyStatusMessage}</span>
              </p>
            ) : null}
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">커뮤니티 이름</Typography>
            <TextField
              label="커뮤니티 이름"
              value={siteLabel}
              onChange={handleSiteLabelChange}
              fullWidth
              size="small"
              helperText="입력하지 않으면 커뮤니티 주소 기준으로 자동 생성됩니다."
              slotProps={{
                input: {
                  endAdornment: siteLabel.trim() ? (
                    <InputAdornment position="end">
                      <button
                        type="button"
                        className="button small action"
                        onClick={handleCheckSiteLabel}
                        disabled={isCheckingSiteLabel}
                      >
                        중복 확인
                      </button>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
            />

            {siteLabelStatusMessage ? (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>{siteLabelStatusMessage}</span>
              </p>
            ) : null}
          </Stack>

          <Stack gap={1} direction="column">
            <Stack justifyContent="space-between" alignItems="center" direction="row">
              <Typography variant="subtitle2">커뮤니티 프로필 이미지</Typography>
              <button type="button" className="button small action" onClick={handleClickProfilePictureUpload}>
                프로필 이미지 업로드
              </button>
            </Stack>

            <AppIconAvatar src={profilePictureUrl || null} alt="" size={80} />

            <VisuallyHiddenInput
              ref={fileInputReference}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureFileChange}
            />
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">커뮤니티 간단설명</Typography>
            <TextField size="small" value={summary} onChange={handleSummaryChange} fullWidth multiline minRows={4} />
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">테마</Typography>
            <TextField select value={themeType} onChange={handleThemeTypeChange} fullWidth size="small">
              {THEME_TYPES.map((themeValue) => (
                <MenuItem key={themeValue} value={themeValue}>
                  {themeType === themeValue ? (
                    <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                  ) : (
                    <i style={{ width: 14, height: 14, marginRight: 8 }} />
                  )}
                  {themeValue}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">요금제</Typography>
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

          <Stack gap={1}>
            <Typography variant="subtitle2">가입 방식</Typography>
            <RadioGroup value={joinType} onChange={handleJoinTypeChange}>
              <FormControlLabel value="open" control={<Radio />} label="오픈가입" />
              <FormControlLabel value="invite" control={<Radio />} label="초대가입" />
            </RadioGroup>
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">글 작성 정책</Typography>
            <TextField select value={policyPost} onChange={handlePolicyPostChange} fullWidth size="small">
              <MenuItem value="comment_0">
                {policyPost === 'comment_0' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                가입 후 바로 글쓰기 가능
              </MenuItem>
              <MenuItem value="comment_1">
                {policyPost === 'comment_1' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                댓글 1개 등록 후 글쓰기 가능
              </MenuItem>
              <MenuItem value="comment_3">
                {policyPost === 'comment_3' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                댓글 3개 등록 후 글쓰기 가능
              </MenuItem>
              <MenuItem value="comment_5">
                {policyPost === 'comment_5' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                댓글 5개 등록 후 글쓰기 가능
              </MenuItem>
            </TextField>
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">댓글 작성 정책</Typography>
            <TextField select value={policyComment} onChange={handlePolicyCommentChange} fullWidth size="small">
              <MenuItem value="estimate_0">
                {policyComment === 'estimate_0' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                가입 후 바로 댓글쓰기 가능
              </MenuItem>
              <MenuItem value="estimate_1">
                {policyComment === 'estimate_1' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                가입 6시간 이후 댓글쓰기 가능
              </MenuItem>
              <MenuItem value="estimate_3">
                {policyComment === 'estimate_3' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                가입 12시간 이후 댓글쓰기 가능
              </MenuItem>
              <MenuItem value="estimate_5">
                {policyComment === 'estimate_5' ? (
                  <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                ) : (
                  <i style={{ width: 14, height: 14, marginRight: 8 }} />
                )}
                가입 24시간 이후 댓글쓰기 가능
              </MenuItem>
            </TextField>
          </Stack>

          <Stack direction="column" gap={1}>
            <Typography variant="subtitle2">커뮤니티 공개여부</Typography>
            <FormControlLabel
              control={
                <IOSSwitch sx={{ m: 1 }} checked={visibilityType === 'public'} onChange={handleVisibilityTypeChange} />
              }
              label={visibilityType === 'public' ? '공개' : '비공개'}
            />
          </Stack>
          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
        </Stack>
      </div>
      <div className={styles.actions}>
        <button type="button" className="button medium close">
          개설 취소
        </button>
        <button
          type="submit"
          className="button medium submit"
          disabled={isSubmitting || isCheckingSiteKey || isUploadingAvatar || isLoadingPlans}
        >
          커뮤니티 개설
        </button>
      </div>

      <Snackbar
        open={Boolean(successMessage)}
        message={successMessage}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
      />

      {isMobile ? (
        <Drawer anchor="bottom" open={isErrorDialogOpen} onClose={closeErrorDialog} className="VhiDrawer-bottom">
          <h2>개설 불가</h2>
          <button className="close-button" onClick={closeErrorDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>하단 에러 메시지를 확인해 주세요</Typography>
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={closeErrorDialog}>
                확인
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isErrorDialogOpen} onClose={closeErrorDialog} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>개설 불가</DialogTitle>
          <button className="close-button" onClick={closeErrorDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography>하단 에러 메시지를 확인해 주세요</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={closeErrorDialog}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
