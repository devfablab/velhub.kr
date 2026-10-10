'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { isValidActivityName } from '@/lib/auth/emailSignUp';
import { runInputAdornmentAction } from '@/lib/input/runInputAdornmentAction';
import {
  EMPTY_SITE_CREATE_FIELD_ERRORS,
  getSiteKeyError,
  getSiteLabelError,
  SiteCreateFieldErrors,
  validateSiteCreateFields,
} from '@/lib/site/createValidation.shared';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import PopupMessage from '@/components/PopupMessage';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/new.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

type VisibilityType = 'public' | 'private';
type ThemeType = 'default' | 'coral' | 'teal' | 'royalblue' | 'slateblue' | 'seagreen' | 'orchid' | 'tomato';
type JoinType = 'open' | 'invite';
type PolicyPost = 'comment_0' | 'comment_1' | 'comment_3' | 'comment_5';
type PolicyComment = 'estimate_0' | 'estimate_1' | 'estimate_3' | 'estimate_5';
type ErrorDialogState = { title: string | null; messages: string[] };

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

function normalizeSiteKeyInput(rawValue: string) {
  return rawValue.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
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
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [visibilityType, setVisibilityType] = useState<VisibilityType>('public');
  const [themeType, setThemeType] = useState<ThemeType>('default');
  const [joinType, setJoinType] = useState<JoinType>('open');
  const [policyPost, setPolicyPost] = useState<PolicyPost>('comment_1');
  const [policyComment, setPolicyComment] = useState<PolicyComment>('estimate_0');

  const [isCheckingSiteKey, setIsCheckingSiteKey] = useState(false);
  const [isCheckingSiteLabel, setIsCheckingSiteLabel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SiteCreateFieldErrors>(EMPTY_SITE_CREATE_FIELD_ERRORS);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState>({ title: null, messages: [] });
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [baseUrl, setBaseUrl] = useState('');

  const { themeMode, setThemeMode } = useThemeMode();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

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
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-colorset', themeType);
  }, [themeType]);

  useEffect(() => {
    return () => {
      if (profilePictureUrl) {
        URL.revokeObjectURL(profilePictureUrl);
      }
    };
  }, [profilePictureUrl]);

  function openErrorDialog(
    message: string | string[],
    options: { title?: string | null; fieldErrors?: SiteCreateFieldErrors } = {},
  ) {
    const messages = Array.isArray(message) ? message : [message];
    setErrorMessage(messages.join('\n'));
    setSuccessMessage('');
    setFieldErrors(options.fieldErrors ?? EMPTY_SITE_CREATE_FIELD_ERRORS);
    setErrorDialog({ title: options.title === undefined ? '개설 정보 확인' : options.title, messages });
    setIsErrorDialogOpen(true);
  }

  function openUnknownErrorDialog() {
    openErrorDialog('요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', { title: null });
  }

  function closeErrorDialog() {
    setIsErrorDialogOpen(false);
  }

  function handleSiteKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeSiteKeyInput(event.currentTarget.value).slice(0, 15);

    setSiteKey(normalizedValue);
    setSiteKeyStatusMessage('');
    setFieldErrors((previousValue) => ({ ...previousValue, siteKey: '', siteLabel: '' }));
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleSiteLabelChange(event: InputChangeEvent) {
    setSiteLabel(event.currentTarget.value.slice(0, 10));
    setSiteLabelStatusMessage('');
    setFieldErrors((previousValue) => ({ ...previousValue, siteLabel: '' }));
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleSummaryChange(event: TextAreaChangeEvent | InputChangeEvent) {
    setSummary(event.currentTarget.value.slice(0, 52));
    setFieldErrors((previousValue) => ({ ...previousValue, summary: '' }));
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

  async function handleCheckSiteKey() {
    if (isCheckingSiteKey) {
      return;
    }

    const normalizedSiteKey = normalizeSiteKey(siteKey);

    setSiteKey(normalizedSiteKey);
    setErrorMessage('');
    setSuccessMessage('');
    setSiteKeyStatusMessage('');

    const siteKeyError = getSiteKeyError(normalizedSiteKey);

    if (siteKeyError) {
      openErrorDialog(siteKeyError, {
        fieldErrors: { ...EMPTY_SITE_CREATE_FIELD_ERRORS, siteKey: siteKeyError },
      });
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

      const result: unknown = await response.json().catch(() => null);

      if (
        result &&
        typeof result === 'object' &&
        typeof (result as { normalizedSiteKey?: unknown }).normalizedSiteKey === 'string'
      ) {
        setSiteKey((result as { normalizedSiteKey: string }).normalizedSiteKey);
      }

      if (!response.ok) {
        const message =
          result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string'
            ? (result as { error: string }).error
            : '';

        if (response.status >= 500 || !message) {
          openUnknownErrorDialog();
        } else {
          openErrorDialog(message, {
            title: '사이트 주소 확인',
            fieldErrors: { ...EMPTY_SITE_CREATE_FIELD_ERRORS, siteKey: message },
          });
        }
        return;
      }

      setSiteKeyStatusMessage('사용 가능한 사이트 주소입니다.');
    } catch {
      openUnknownErrorDialog();
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

    const siteLabelError = getSiteLabelError(normalizeSiteKey(siteKey), trimmedSiteLabel);

    if (siteLabelError) {
      openErrorDialog(siteLabelError, {
        title: '사이트명 확인',
        fieldErrors: { ...EMPTY_SITE_CREATE_FIELD_ERRORS, siteLabel: siteLabelError },
      });
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

      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string'
            ? (result as { error: string }).error
            : '';

        if (response.status >= 500 || !message) {
          openUnknownErrorDialog();
        } else {
          openErrorDialog(message, {
            title: '사이트명 확인',
            fieldErrors: { ...EMPTY_SITE_CREATE_FIELD_ERRORS, siteLabel: message },
          });
        }
        return;
      }

      setSiteLabelStatusMessage('사용 가능한 사이트명입니다.');
    } catch {
      openUnknownErrorDialog();
    } finally {
      setIsCheckingSiteLabel(false);
    }
  }

  function handleProfilePictureFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile) {
      inputElement.value = '';
      return;
    }

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    const isAllowedFile =
      (extension === 'png' && selectedFile.type === 'image/png') ||
      ((extension === 'jpg' || extension === 'jpeg') && selectedFile.type === 'image/jpeg') ||
      (extension === 'webp' && selectedFile.type === 'image/webp') ||
      (extension === 'svg' && selectedFile.type === 'image/svg+xml');

    inputElement.value = '';

    if (!isAllowedFile) {
      const profilePictureError = 'PNG, JPG, WEBP, SVG 파일만 선택할 수 있습니다.';
      openErrorDialog(profilePictureError, {
        fieldErrors: { ...EMPTY_SITE_CREATE_FIELD_ERRORS, profilePicture: profilePictureError },
      });
      return;
    }

    setErrorMessage('');
    setFieldErrors((previousValue) => ({ ...previousValue, profilePicture: '' }));
    setProfilePictureFile(selectedFile);
    setProfilePictureUrl(URL.createObjectURL(selectedFile));
    setSuccessMessage('프로필 이미지를 선택했습니다.');
  }

  function handleClickProfilePictureUpload() {
    fileInputReference.current?.click();
  }

  function handleDeleteProfilePicture() {
    setProfilePictureFile(null);
    setProfilePictureUrl('');
    setSuccessMessage('프로필 이미지를 삭제했습니다.');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || isCheckingSiteKey) {
      return;
    }

    const normalizedSiteKey = normalizeSiteKey(siteKey);
    const trimmedSiteLabel = siteLabel.trim();
    const trimmedSummary = summary.trim();

    setSiteKey(normalizedSiteKey);
    setErrorMessage('');
    setSuccessMessage('');
    setSiteKeyStatusMessage('');

    const validation = validateSiteCreateFields({
      siteKey: normalizedSiteKey,
      siteLabel: trimmedSiteLabel,
      summary: trimmedSummary,
    });

    if (validation.messages.length > 0) {
      (event.currentTarget as HTMLFormElement).reportValidity();
      openErrorDialog(validation.messages, { title: '입력 내용 확인', fieldErrors: validation.fieldErrors });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('siteKey', normalizedSiteKey);
      formData.append('siteLabel', trimmedSiteLabel);
      formData.append('summary', trimmedSummary);
      formData.append('visibilityType', visibilityType);
      formData.append('themeType', themeType);
      formData.append('joinType', joinType);
      formData.append('policyPost', policyPost);
      formData.append('policyComment', policyComment);

      if (profilePictureFile) {
        formData.append('profilePicture', profilePictureFile);
      }

      const response = await fetch('/api/site/community/new', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          result && typeof result === 'object' && typeof (result as { error?: unknown }).error === 'string'
            ? (result as { error: string }).error
            : '';
        const responseFieldErrors =
          result && typeof result === 'object' && 'fieldErrors' in result
            ? (result as { fieldErrors: SiteCreateFieldErrors }).fieldErrors
            : EMPTY_SITE_CREATE_FIELD_ERRORS;

        if (response.status >= 500 || !message) {
          openUnknownErrorDialog();
        } else {
          openErrorDialog(message, {
            title: response.status === 403 ? '개설 제한' : '개설 정보 확인',
            fieldErrors: responseFieldErrors,
          });
        }
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage('커뮤니티가 개설되었습니다.');
      router.replace(`/${siteKey}`);
    } catch {
      openUnknownErrorDialog();
      setIsSubmitting(false);
    }
  }

  const openCancelDialog = () => setIsCancelDialogOpen(true);
  const closeCancelDialog = () => setIsCancelDialogOpen(false);

  const handleConfirmCancel = () => {
    setIsCancelDialogOpen(false);
    router.push('/');
  };

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  return (
    <Box component="form" noValidate onSubmit={handleSubmit}>
      <div className={`paper ${styles.paper}`}>
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="subtitle2">커뮤니티 주소</Typography>
            <TextField
              value={siteKey}
              onChange={handleSiteKeyChange}
              onKeyDown={(event) => runInputAdornmentAction(event, handleCheckSiteKey, isCheckingSiteKey)}
              fullWidth
              error={Boolean(fieldErrors.siteKey)}
              helperText={
                fieldErrors.siteKey || `영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다. ${siteKey.length} / 15`
              }
              size="small"
              slotProps={{
                htmlInput: { required: true, minLength: 5, maxLength: 15, pattern: '[a-z][a-z0-9-]*' },
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
              value={siteLabel}
              onChange={handleSiteLabelChange}
              onKeyDown={(event) =>
                runInputAdornmentAction(event, handleCheckSiteLabel, !siteLabel.trim() || isCheckingSiteLabel)
              }
              fullWidth
              required={!isValidActivityName(normalizeSiteKey(siteKey))}
              size="small"
              error={Boolean(fieldErrors.siteLabel)}
              helperText={
                fieldErrors.siteLabel ||
                (isValidActivityName(normalizeSiteKey(siteKey))
                  ? `입력하면 2자 이상 10자 이하로 작성해 주세요. 비우면 커뮤니티 주소 기준으로 자동 생성됩니다. ${siteLabel.length} / 10`
                  : `커뮤니티 주소가 10자를 초과하면 사이트명을 입력해야 합니다. ${siteLabel.length} / 10`)
              }
              slotProps={{
                htmlInput: { minLength: 2, maxLength: 10 },
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
              accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleProfilePictureFileChange}
            />

            {profilePictureFile ? (
              <Stack direction="row">
                <button type="button" className="button small danger" onClick={handleDeleteProfilePicture}>
                  이미지 삭제
                </button>
              </Stack>
            ) : null}
            {fieldErrors.profilePicture ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{fieldErrors.profilePicture}</span>
              </p>
            ) : null}
          </Stack>

          <Stack gap={1}>
            <Typography variant="subtitle2">커뮤니티 간단설명</Typography>
            <TextField
              size="small"
              value={summary}
              onChange={handleSummaryChange}
              fullWidth
              multiline
              minRows={4}
              error={Boolean(fieldErrors.summary)}
              helperText={fieldErrors.summary || `${summary.length} / 52`}
              slotProps={{ htmlInput: { maxLength: 52 } }}
            />
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
            <Typography variant="subtitle2">가입 방식</Typography>
            <RadioGroup value={joinType} onChange={handleJoinTypeChange}>
              <FormControlLabel value="open" control={<Radio />} label="오픈가입" />
              <FormControlLabel value="invite" control={<Radio />} label="초대가입" />
            </RadioGroup>
            <div className="paper">
              <Typography variant="body2">초대가입으로 설정하시면 초대장 받은 유저만 가입이 가능합니다.</Typography>
            </div>
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
            <div className="paper">
              <Typography variant="body2">
                비공개로 설정하시면 운영자, 매니저, 멤버만 커뮤니티 글을 읽을 수 있습니다.
              </Typography>
            </div>
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
        <button type="button" className="button medium close" onClick={openCancelDialog}>
          개설 취소
        </button>
        <button type="submit" className="button medium submit" disabled={isSubmitting || isCheckingSiteKey}>
          커뮤니티 개설
        </button>
      </div>

      <PopupMessage open={Boolean(successMessage)} message={successMessage} onClose={() => setSuccessMessage('')} />

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isCancelDialogOpen}
          onClose={closeCancelDialog}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>개설 취소</h2>
          <button type="button" className="close-button" onClick={closeCancelDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <Typography>정말로 개설을 취소하시겠어요?</Typography>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={closeCancelDialog}>
              닫기
            </button>
            <button type="button" className="button medium danger" onClick={handleConfirmCancel}>
              개설 취소
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isCancelDialogOpen}
          onClose={closeCancelDialog}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>개설 취소</DialogTitle>
          <button type="button" className="close-button" onClick={closeCancelDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography>정말로 개설을 취소하시겠어요?</Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={closeCancelDialog}>
              닫기
            </button>
            <button type="button" className="danger-button" onClick={handleConfirmCancel}>
              개설 취소
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isErrorDialogOpen}
          onClose={closeErrorDialog}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          {errorDialog.title ? <h2>{errorDialog.title}</h2> : null}
          <button type="button" className="close-button" onClick={closeErrorDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            {errorDialog.title ? (
              <ul>
                {errorDialog.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : (
              <p className="alert popup-error">
                <ErrorOutlineRoundedIcon />
                <span>{errorDialog.messages[0]}</span>
              </p>
            )}
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium submit" onClick={closeErrorDialog}>
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isErrorDialogOpen}
          onClose={closeErrorDialog}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          {errorDialog.title ? <DialogTitle>{errorDialog.title}</DialogTitle> : null}
          <button type="button" className="close-button" onClick={closeErrorDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            {errorDialog.title ? (
              <ul>
                {errorDialog.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : (
              <p className="alert popup-error">
                <ErrorOutlineRoundedIcon />
                <span>{errorDialog.messages[0]}</span>
              </p>
            )}
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={closeErrorDialog}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
