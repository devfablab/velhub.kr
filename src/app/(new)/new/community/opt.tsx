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
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextAreaChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['textarea']['onChange']>>[0];

type VisibilityType = 'public' | 'private';
type ThemeType = 'default';
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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);

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

  function handleThemeTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'default') {
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
      router.replace('/');
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
              />

              <Button type="button" variant="outlined" onClick={handleCheckSiteKey} disabled={isCheckingSiteKey}>
                사이트 식별자 확인
              </Button>

              {siteKeyStatusMessage ? <Alert severity="success">{siteKeyStatusMessage}</Alert> : null}
            </Stack>

            <TextField
              label="사이트명"
              value={siteLabel}
              onChange={handleSiteLabelChange}
              fullWidth
              helperText="입력하지 않으면 사이트 식별자가 사이트명으로 사용됩니다."
            />

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

              <input
                ref={fileInputReference}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
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

            <TextField label="요약" value={summary} onChange={handleSummaryChange} fullWidth multiline minRows={4} />

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
              <FormLabel>가입 방식</FormLabel>
              <RadioGroup value={joinType} onChange={handleJoinTypeChange}>
                <FormControlLabel value="open" control={<Radio />} label="오픈가입" />
                <FormControlLabel value="invite" control={<Radio />} label="초대가입" />
              </RadioGroup>
            </Stack>

            <TextField select label="글 작성 정책" value={policyPost} onChange={handlePolicyPostChange} fullWidth>
              <MenuItem value="comment_0">가입 후 바로 글쓰기 가능</MenuItem>
              <MenuItem value="comment_1">댓글 1개 등록 후 글쓰기 가능</MenuItem>
              <MenuItem value="comment_3">댓글 3개 등록 후 글쓰기 가능</MenuItem>
              <MenuItem value="comment_5">댓글 5개 등록 후 글쓰기 가능</MenuItem>
            </TextField>

            <TextField
              select
              label="댓글 작성 정책"
              value={policyComment}
              onChange={handlePolicyCommentChange}
              fullWidth
            >
              <MenuItem value="estimate_0">가입 후 바로 댓글쓰기 가능</MenuItem>
              <MenuItem value="estimate_1">가입 6시간 이후 댓글쓰기 가능</MenuItem>
              <MenuItem value="estimate_3">가입 12시간 이후 댓글쓰기 가능</MenuItem>
              <MenuItem value="estimate_5">가입 24시간 이후 댓글쓰기 가능</MenuItem>
            </TextField>

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
              disabled={isSubmitting || isCheckingSiteKey || isUploadingAvatar || isLoadingPlans}
              fullWidth
            >
              커뮤니티 개설
            </Button>

            {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
            {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

            <Typography variant="body2">개설이 완료되면 소유자 권한이 부여됩니다.</Typography>
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
