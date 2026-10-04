'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  InputAdornment,
  SelectChangeEvent,
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
import { normalizeCustomDomain } from '@/lib/customDomain';
import { runInputAdornmentAction } from '@/lib/input/runInputAdornmentAction';
import { formatDate, formatDateTimeFull, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import ScreenState from '@/components/service/ScreenState';
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
  | 'og_image'
  | 'promotion_image'
  | 'visibility_type'
  | 'theme_type'
  | 'is_shutdown'
  | 'custom_domain'
  | 'blog_type';

type ThemeType = 'default' | 'coral' | 'teal' | 'royalblue' | 'slateblue' | 'seagreen' | 'orchid' | 'tomato';

type SiteInfoInfo = {
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
  og_image: string | null;
  promotion_image: string | null;
  site_type: string;
  visibility_type: string;
  theme_type: string;
  is_shutdown: boolean;
  custom_domain: string | null;
};

type SitesInfo = {
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string;
  log: string;
};

export type GeneralSiteResponse = {
  siteInfo: SiteInfoInfo;
  sites: SitesInfo;
  blogType?: string | null;
  hasOwnerDomainFeature?: boolean;
  profilePictureUrl?: string | null;
  profileLogoUrl?: string | null;
  siteOgImageUrl?: string | null;
  promotionImageUrl?: string | null;
  error?: string;
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

type CustomDomainCheckResponse = {
  ok?: boolean;
  customDomain?: string;
  error?: string;
};

const THEME_TYPES: ThemeType[] = ['default', 'coral', 'teal', 'royalblue', 'slateblue', 'seagreen', 'orchid', 'tomato'];
const MAX_SITE_OG_FILE_SIZE = 1024 * 1024;
const SITE_OG_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_PROMOTION_FILE_SIZE = 1024 * 1024;
const PROMOTION_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SITE_AVATAR_FILE_SIZE = 1024 * 1024;
const SITE_AVATAR_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_SITE_LOGO_FILE_SIZE = 100 * 1024;
const SITE_LOGO_IMAGE_TYPES = new Set(['image/png', 'image/webp', 'image/svg+xml']);

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

function getCustomDomainHostName(value: string | null) {
  return normalizeCustomDomain(value).split('.')[0] || '-';
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

type OptProps = { initialData: GeneralSiteResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const logoInputReference = useRef<HTMLInputElement | null>(null);
  const siteOgInputReference = useRef<HTMLInputElement | null>(null);
  const promotionInputReference = useRef<HTMLInputElement | null>(null);
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [siteInfo, setSiteInfo] = useState<SiteInfoInfo | null>(initialData?.siteInfo ?? null);
  const [sites, setSites] = useState<SitesInfo | null>(initialData?.sites ?? null);
  const [blogType, setBlogType] = useState<string | null>(initialData?.blogType ?? null);
  const [hasOwnerDomainFeature, setHasOwnerDomainFeature] = useState(Boolean(initialData?.hasOwnerDomainFeature));
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState<string | boolean>('');
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialData?.profilePictureUrl ?? '');
  const [profileLogoUrl, setProfileLogoUrl] = useState(initialData?.profileLogoUrl ?? '');
  const [siteOgImageUrl, setSiteOgImageUrl] = useState(initialData?.siteOgImageUrl ?? '');
  const [promotionImageUrl, setPromotionImageUrl] = useState(initialData?.promotionImageUrl ?? '');
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableField, string>>>({});
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '사이트 설정' : null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isTeamMemberBlogTypeDialogOpen, setIsTeamMemberBlogTypeDialogOpen] = useState(false);
  const [isTeamConversionConfirmOpen, setIsTeamConversionConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingSiteOg, setIsUploadingSiteOg] = useState(false);
  const [isUploadingPromotion, setIsUploadingPromotion] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  const [isCheckingSiteKey, setIsCheckingSiteKey] = useState(false);
  const [checkedSiteKey, setCheckedSiteKey] = useState('');
  const [isSiteKeyAvailable, setIsSiteKeyAvailable] = useState(false);
  const [siteKeyCheckMessage, setSiteKeyCheckMessage] = useState('');

  const [isCheckingCustomDomain, setIsCheckingCustomDomain] = useState(false);
  const [checkedCustomDomain, setCheckedCustomDomain] = useState('');
  const [isCustomDomainAvailable, setIsCustomDomainAvailable] = useState(false);
  const [customDomainCheckMessage, setCustomDomainCheckMessage] = useState('');
  const [customDomainCheckError, setCustomDomainCheckError] = useState(false);

  const [isCheckingSiteLabel, setIsCheckingSiteLabel] = useState(false);
  const [checkedSiteLabel, setCheckedSiteLabel] = useState('');
  const [isSiteLabelAvailable, setIsSiteLabelAvailable] = useState(false);
  const [siteLabelCheckMessage, setSiteLabelCheckMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  function showError(message: string, field?: EditableField, title: string | null = '사이트 설정') {
    setErrorMessage(message);
    if (field) {
      setFieldErrors((previousErrors) => ({ ...previousErrors, [field]: message }));
    }
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  function clearFieldError(field?: EditableField) {
    if (field) {
      setFieldErrors((previousErrors) => ({ ...previousErrors, [field]: '' }));
    }
    setErrorMessage('');
  }

  useEffect(() => {
    if (initialData?.siteInfo) {
      applyColorSet(initialData.siteInfo.theme_type);
    }
  }, [initialData]);

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

  function resetCustomDomainCheck() {
    setCheckedCustomDomain('');
    setIsCustomDomainAvailable(false);
    setCustomDomainCheckMessage('');
    setCustomDomainCheckError(false);
  }

  function startEdit(field: EditableField, value: string | boolean | null) {
    setEditingField(field);
    setDraftValue(typeof value === 'boolean' ? value : (value ?? ''));
    clearFieldError(field);
    setSuccessMessage('');
    resetSiteKeyCheck();
    resetSiteLabelCheck();
    resetCustomDomainCheck();

    if (field === 'site_key' && typeof value === 'string') {
      setCheckedSiteKey(value);
      setIsSiteKeyAvailable(true);
    }

    if (field === 'site_label' && typeof value === 'string') {
      setCheckedSiteLabel(value.trim());
      setIsSiteLabelAvailable(Boolean(value.trim()));
    }

    if (field === 'custom_domain' && typeof value === 'string' && value.trim()) {
      const customDomain = normalizeCustomDomain(value);
      setDraftValue(customDomain);
      setCheckedCustomDomain(customDomain);
      setIsCustomDomainAvailable(true);
    }
  }

  function cancelEdit() {
    if (editingField === 'theme_type' && siteInfo) {
      applyColorSet(siteInfo.theme_type);
    }

    setEditingField(null);
    clearFieldError(editingField ?? undefined);
    setSuccessMessage('');
    resetSiteKeyCheck();
    resetSiteLabelCheck();
    resetCustomDomainCheck();
  }

  function handleTextChange(event: InputChangeEvent | TextAreaChangeEvent) {
    clearFieldError(editingField ?? undefined);
    setDraftValue(event.currentTarget.value.slice(0, editingField === 'summary' ? 52 : 10));
  }

  function handleSiteKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeSiteKey(event.currentTarget.value).slice(0, 15);

    setDraftValue(normalizedValue);
    clearFieldError('site_key');
    setSuccessMessage('');
    resetSiteKeyCheck();
  }

  function handleSiteLabelChange(event: InputChangeEvent) {
    setDraftValue(event.currentTarget.value.slice(0, 10));
    clearFieldError('site_label');
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
      showError('사이트 주소를 입력해주세요.', 'site_key');
      return;
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      showError("영소문자, 하이픈('-'), 숫자만 사용 가능합니다.", 'site_key');
      return;
    }

    if (normalizedSiteKey === siteInfo.site_key) {
      setCheckedSiteKey(normalizedSiteKey);
      setIsSiteKeyAvailable(true);
      setSiteKeyCheckMessage('현재 사용 중인 사이트 주소입니다.');
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
        showError(result.error ?? '사용할 수 없는 사이트 주소입니다.', 'site_key');
        return;
      }

      setCheckedSiteKey(result.normalizedSiteKey ?? normalizedSiteKey);
      setIsSiteKeyAvailable(true);
      setSiteKeyCheckMessage('사용 가능한 사이트 주소입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '사이트 주소 확인에 실패했습니다.', 'site_key', null);
      } else {
        showError('사이트 주소 확인에 실패했습니다.', 'site_key', null);
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
      showError('사이트명을 입력해주세요.', 'site_label');
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
        showError(result.error ?? '사용할 수 없는 사이트명입니다.', 'site_label');
        return;
      }

      setCheckedSiteLabel(result.normalizedSiteLabel ?? trimmedSiteLabel);
      setIsSiteLabelAvailable(true);
      setSiteLabelCheckMessage('사용 가능한 사이트명입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '사이트명 확인에 실패했습니다.', 'site_label', null);
      } else {
        showError('사이트명 확인에 실패했습니다.', 'site_label', null);
      }
      resetSiteLabelCheck();
    } finally {
      setIsCheckingSiteLabel(false);
    }
  }

  async function handleCheckCustomDomain() {
    if (isCheckingCustomDomain) return;

    const customDomain = normalizeCustomDomain(String(draftValue));
    setDraftValue(customDomain);
    setErrorMessage('');
    setSuccessMessage('');
    resetCustomDomainCheck();

    try {
      setIsCheckingCustomDomain(true);
      const response = await fetch('/api/site/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customDomain, siteName }),
      });
      const result = (await response.json()) as CustomDomainCheckResponse;
      const normalizedDomain = normalizeCustomDomain(result.customDomain ?? customDomain);
      setDraftValue(normalizedDomain);

      if (!response.ok || !result.ok) {
        setCheckedCustomDomain(normalizedDomain);
        setCustomDomainCheckError(true);
        showError(result.error ?? '사용하실 수 없는 도메인입니다.', 'custom_domain');
        return;
      }

      setCheckedCustomDomain(normalizedDomain);
      setIsCustomDomainAvailable(true);
      setCustomDomainCheckMessage('사용 가능한 커스텀 도메인입니다.');
    } catch {
      setCustomDomainCheckError(true);
      resetCustomDomainCheck();
      showError('커스텀 도메인 확인에 실패했습니다.', 'custom_domain', null);
    } finally {
      setIsCheckingCustomDomain(false);
    }
  }

  async function refreshInfo(nextSiteName?: string) {
    const targetSiteName = nextSiteName ?? siteName;

    const response = await fetch(`/api/info/general/site/${targetSiteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? '사이트 정보를 불러오지 못했습니다.');
    }

    setSiteInfo(result.siteInfo);
    setSites(result.sites);
    setBlogType(result.blogType ?? null);
    setHasOwnerDomainFeature(Boolean(result.hasOwnerDomainFeature));
    applyColorSet(result.siteInfo.theme_type);
    setProfilePictureUrl(result.profilePictureUrl ?? '');
    setProfileLogoUrl(result.profileLogoUrl ?? '');
    setSiteOgImageUrl(result.siteOgImageUrl ?? '');
    setPromotionImageUrl(result.promotionImageUrl ?? '');
  }

  async function saveField(field: EditableField, value?: string | boolean, confirmTeamConversion = false) {
    if (!siteInfo || isSubmitting) {
      return false;
    }

    const nextValue = value ?? draftValue;

    if (field === 'site_key') {
      const normalizedSiteKey = normalizeSiteKey(String(nextValue));

      if (!isSiteKeyAvailable || checkedSiteKey !== normalizedSiteKey) {
        showError('사이트 주소 중복 확인을 해주세요.', 'site_key');
        setSuccessMessage('');
        return false;
      }
    }

    if (field === 'site_label') {
      const trimmedSiteLabel = String(nextValue).trim();

      if (trimmedSiteLabel && (!isSiteLabelAvailable || checkedSiteLabel !== trimmedSiteLabel)) {
        showError('사이트명 중복 확인을 해주세요.', 'site_label');
        setSuccessMessage('');
        return false;
      }
    }

    if (field === 'custom_domain') {
      const customDomain = normalizeCustomDomain(String(nextValue));

      if (customDomain && (!isCustomDomainAvailable || checkedCustomDomain !== customDomain)) {
        showError('커스텀 도메인 중복 확인을 해주세요.', 'custom_domain');
        setSuccessMessage('');
        return false;
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
          confirmTeamConversion,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (
          field === 'blog_type' &&
          nextValue === 'personal' &&
          result.error === '매니저나 팀원이 존재하는 경우 1인 블로그로 변경할 수 없습니다.'
        ) {
          setIsTeamMemberBlogTypeDialogOpen(true);
          setIsSubmitting(false);
          return false;
        }

        if (field === 'blog_type' && result.requiresTeamConversionConfirmation) {
          setIsTeamConversionConfirmOpen(true);
          setIsSubmitting(false);
          return false;
        }

        const message = result.error ?? '사이트 정보 수정에 실패했습니다.';
        showError(message, field, response.status >= 500 ? null : '사이트 설정');
        setIsSubmitting(false);
        return false;
      }

      await refreshInfo(result.siteName);

      if (field === 'site_key' && typeof result.siteName === 'string') {
        window.location.href = `/${result.siteName}/manage/settings/general`;
        return true;
      }

      setEditingField(null);
      resetSiteKeyCheck();
      resetSiteLabelCheck();
      resetCustomDomainCheck();
      setSuccessMessage('저장되었습니다.');
      setIsSubmitting(false);
      return true;
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '사이트 정보 수정에 실패했습니다.', field, null);
      } else {
        showError('사이트 정보 수정에 실패했습니다.', field, null);
      }
      setIsSubmitting(false);
      return false;
    }
  }

  function handleBlogTypeSave() {
    void saveField('blog_type');
  }

  async function handleProfilePictureFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !siteInfo || isUploadingAvatar) {
      inputElement.value = '';
      return;
    }

    if (!SITE_AVATAR_IMAGE_TYPES.has(selectedFile.type.toLowerCase())) {
      showError('PNG, JPEG, WEBP, SVG 이미지만 업로드할 수 있습니다.', 'profile_picture');
      inputElement.value = '';
      return;
    }

    if (selectedFile.size >= MAX_SITE_AVATAR_FILE_SIZE) {
      showError('사이트 아바타 이미지는 1MB 미만만 업로드할 수 있습니다.', 'profile_picture');
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('siteName', siteName);

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

      const isSaved = await saveField('profile_picture', nextProfilePicture);
      if (!isSaved) {
        await fetch('/api/attachment/delete/avatar/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: nextProfilePicture, siteName }),
        }).catch(() => undefined);
        return;
      }

      if (siteInfo.profile_picture && siteInfo.profile_picture !== nextProfilePicture) {
        const deleteResponse = await fetch('/api/attachment/delete/avatar/site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: siteInfo.profile_picture, siteName }),
        });
        const deleteResult = await deleteResponse.json();
        if (!deleteResponse.ok) {
          showError(deleteResult.error ?? '기존 아바타 삭제에 실패했습니다.', 'profile_picture', null);
          return;
        }
      }
      setSuccessMessage('아바타가 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '아바타 저장에 실패했습니다.', 'profile_picture', null);
      } else {
        showError('아바타 저장에 실패했습니다.', 'profile_picture', null);
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

    if (!SITE_LOGO_IMAGE_TYPES.has(selectedFile.type.toLowerCase())) {
      showError('PNG, WEBP, SVG 이미지만 업로드할 수 있습니다.', 'profile_logo');
      inputElement.value = '';
      return;
    }

    if (selectedFile.size > MAX_SITE_LOGO_FILE_SIZE) {
      showError('사이트 로고는 최대 100KB까지 업로드할 수 있습니다.', 'profile_logo');
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('siteName', siteName);

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

      const previousProfileLogo = normalizeText(siteInfo.profile_logo);
      const isSaved = await saveField('profile_logo', nextProfileLogo);
      if (!isSaved) {
        await deleteSiteLogo(nextProfileLogo).catch(() => undefined);
        return;
      }

      if (previousProfileLogo && previousProfileLogo !== nextProfileLogo) {
        await deleteSiteLogo(previousProfileLogo).catch(() => undefined);
      }
      setSuccessMessage('사이트 로고가 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '사이트 로고 저장에 실패했습니다.', 'profile_logo', null);
      } else {
        showError('사이트 로고 저장에 실패했습니다.', 'profile_logo', null);
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

  async function deleteSiteLogo(path: string) {
    const response = await fetch('/api/attachment/delete/site-logo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteName, path }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? '사이트 로고 삭제에 실패했습니다.');
    }
  }

  async function deleteSiteOgImage(path: string) {
    const response = await fetch('/api/attachment/delete/site-og', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        siteName,
        path,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? '오픈그래프 이미지 삭제에 실패했습니다.');
    }
  }

  function handleClickSiteOgUpload() {
    if (isUploadingSiteOg) {
      return;
    }

    siteOgInputReference.current?.click();
  }

  async function deletePromotionImage(path: string) {
    const response = await fetch('/api/attachment/delete/promotion-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ siteName, path }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? '프로모션 이미지 삭제에 실패했습니다.');
    }
  }

  function handleClickPromotionUpload() {
    if (!isUploadingPromotion) {
      promotionInputReference.current?.click();
    }
  }

  async function handlePromotionFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !siteInfo || isUploadingPromotion) {
      inputElement.value = '';
      return;
    }

    if (!PROMOTION_IMAGE_TYPES.has(selectedFile.type.toLowerCase())) {
      showError('PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.', 'promotion_image');
      setSuccessMessage('');
      inputElement.value = '';
      return;
    }

    if (selectedFile.size >= MAX_PROMOTION_FILE_SIZE) {
      showError('프로모션 이미지는 1MB 미만만 업로드할 수 있습니다.', 'promotion_image');
      setSuccessMessage('');
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingPromotion(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('siteName', siteName);
      const uploadResponse = await fetch('/api/attachment/add/promotion-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error ?? '프로모션 이미지 업로드에 실패했습니다.');
      }

      const nextPath = normalizeText(uploadResult.path);
      if (!nextPath) {
        throw new Error('업로드된 프로모션 이미지 정보를 확인하지 못했습니다.');
      }

      const previousPath = normalizeText(siteInfo.promotion_image);
      const isSaved = await saveField('promotion_image', nextPath);

      if (!isSaved) {
        await deletePromotionImage(nextPath).catch(() => undefined);
        return;
      }

      if (previousPath && previousPath !== nextPath) {
        await deletePromotionImage(previousPath).catch(() => undefined);
      }

      setPromotionImageUrl(uploadResult.url ?? '');
      setSuccessMessage('프로모션 이미지가 저장되었습니다.');
    } catch (unknownError) {
      showError(
        unknownError instanceof Error
          ? unknownError.message || '프로모션 이미지 저장에 실패했습니다.'
          : '프로모션 이미지 저장에 실패했습니다.',
        'promotion_image',
        null,
      );
    } finally {
      setIsUploadingPromotion(false);
      inputElement.value = '';
    }
  }

  async function handleRemovePromotionImage() {
    const previousPath = normalizeText(siteInfo?.promotion_image);
    if (!previousPath || isUploadingPromotion) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingPromotion(true);

    try {
      const isSaved = await saveField('promotion_image', '');
      if (!isSaved) {
        return;
      }

      await deletePromotionImage(previousPath);
      setPromotionImageUrl('');
      setSuccessMessage('프로모션 이미지가 삭제되었습니다.');
    } catch (unknownError) {
      showError(
        unknownError instanceof Error
          ? unknownError.message || '프로모션 이미지 삭제에 실패했습니다.'
          : '프로모션 이미지 삭제에 실패했습니다.',
        'promotion_image',
        null,
      );
    } finally {
      setIsUploadingPromotion(false);
    }
  }

  async function handleSiteOgFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !siteInfo || isUploadingSiteOg) {
      inputElement.value = '';
      return;
    }

    if (!SITE_OG_IMAGE_TYPES.has(selectedFile.type.toLowerCase())) {
      showError('PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.', 'og_image');
      setSuccessMessage('');
      inputElement.value = '';
      return;
    }

    if (selectedFile.size >= MAX_SITE_OG_FILE_SIZE) {
      showError('오픈그래프 이미지는 1MB 미만만 업로드할 수 있습니다.', 'og_image');
      setSuccessMessage('');
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingSiteOg(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('siteName', siteName);

      const uploadResponse = await fetch('/api/attachment/add/site-og', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error ?? '오픈그래프 이미지 업로드에 실패했습니다.');
      }

      const nextPath = normalizeText(uploadResult.path);

      if (!nextPath) {
        throw new Error('업로드된 오픈그래프 이미지 정보를 확인하지 못했습니다.');
      }

      const previousPath = normalizeText(siteInfo.og_image);
      const isSaved = await saveField('og_image', nextPath);

      if (!isSaved) {
        await deleteSiteOgImage(nextPath).catch(() => undefined);
        return;
      }

      if (previousPath && previousPath !== nextPath) {
        await deleteSiteOgImage(previousPath).catch(() => undefined);
      }

      setSuccessMessage('오픈그래프 이미지가 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '오픈그래프 이미지 저장에 실패했습니다.', 'og_image', null);
      } else {
        showError('오픈그래프 이미지 저장에 실패했습니다.', 'og_image', null);
      }
    } finally {
      setIsUploadingSiteOg(false);
      inputElement.value = '';
    }
  }

  async function handleRemoveSiteOgImage() {
    const previousPath = normalizeText(siteInfo?.og_image);

    if (!previousPath || isUploadingSiteOg) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsUploadingSiteOg(true);

    try {
      const isSaved = await saveField('og_image', '');

      if (!isSaved) {
        return;
      }

      await deleteSiteOgImage(previousPath);
      setSuccessMessage('오픈그래프 이미지가 삭제되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '오픈그래프 이미지 삭제에 실패했습니다.', 'og_image', null);
      } else {
        showError('오픈그래프 이미지 삭제에 실패했습니다.', 'og_image', null);
      }
    } finally {
      setIsUploadingSiteOg(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  if (!siteInfo) {
    return (
      <Container pageTitle="사이트 정보" pageBack={`/${siteName}/manage`} menu="settings">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{initialError || '사이트 정보를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              title={errorDialogTitle}
              messages={errorMessage ? [errorMessage] : []}
              onClose={() => setIsErrorDialogOpen(false)}
            />
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
            <ScreenState kind="error">{initialError || '업데이트 정보를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              title={errorDialogTitle}
              messages={errorMessage ? [errorMessage] : []}
              onClose={() => setIsErrorDialogOpen(false)}
            />
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

          <PopupMessage open={Boolean(successMessage)} message={successMessage} onClose={() => setSuccessMessage('')} />

          <Typography variant="subtitle2" sx={{ p: 2 }}>
            {siteInfo.site_type === 'blog' ? '블로그' : '커뮤니티'} ‘{siteInfo.site_label}’{' '}
            {formatDate(siteInfo.created_at)}에 개설
          </Typography>
          <Stack gap={1.5} alignItems="center">
            <AppIconAvatar src={profilePictureUrl || null} alt={siteInfo.site_label || ''} size={96} />

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
            {fieldErrors.profile_picture ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{fieldErrors.profile_picture}</span>
              </p>
            ) : null}
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
            {fieldErrors.profile_logo ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{fieldErrors.profile_logo}</span>
              </p>
            ) : null}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">사이트 주소</Typography>
            {editingField === 'site_key' ? (
              <>
                <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                  <TextField
                    value={String(draftValue)}
                    onChange={handleSiteKeyChange}
                    onKeyDown={(event) => runInputAdornmentAction(event, handleCheckSiteKey, isCheckingSiteKey)}
                    fullWidth
                    size="small"
                    error={Boolean(fieldErrors.site_key)}
                    helperText={
                      fieldErrors.site_key ||
                      `영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다. ${String(draftValue).length} / 15`
                    }
                    slotProps={{
                      htmlInput: { maxLength: 15 },
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
                  <PopupMessage
                    open={Boolean(siteKeyCheckMessage)}
                    message={siteKeyCheckMessage}
                    onClose={() => setSiteKeyCheckMessage('')}
                  />
                ) : null}
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography variant="body2">{siteInfo.site_key}</Typography>
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
            <Typography variant="subtitle2">커스텀 도메인</Typography>
            {!hasOwnerDomainFeature && editingField !== 'custom_domain' && (
              <Typography variant="body2" sx={{ display: 'block', mt: 1 }}>
                커스텀 도메인 설정은 오너 멤버십 전용 기능입니다.
              </Typography>
            )}
            {editingField === 'custom_domain' ? (
              <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                <Stack flex={1} minWidth={0}>
                  <TextField
                    value={String(draftValue)}
                    onChange={(event) => {
                      setDraftValue(normalizeCustomDomain(event.target.value));
                      setErrorMessage('');
                      setSuccessMessage('');
                      resetCustomDomainCheck();
                    }}
                    onKeyDown={(event) =>
                      runInputAdornmentAction(event, handleCheckCustomDomain, isCheckingCustomDomain)
                    }
                    fullWidth
                    size="small"
                    disabled={!hasOwnerDomainFeature}
                    error={Boolean(fieldErrors.custom_domain)}
                    helperText={
                      fieldErrors.custom_domain || !hasOwnerDomainFeature
                        ? '커스텀 도메인 설정은 오너 멤버십 전용 기능입니다.'
                        : '프로토콜 없이 입력해주세요. 예: example.com'
                    }
                    slotProps={{
                      htmlInput: { maxLength: 253 },
                      input: {
                        startAdornment: <InputAdornment position="start">https://</InputAdornment>,
                        endAdornment: (
                          <InputAdornment position="end">
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => void handleCheckCustomDomain()}
                              disabled={isCheckingCustomDomain}
                            >
                              중복 확인
                            </button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  {customDomainCheckError ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>사용하실 수 없는 도메인입니다.</span>
                    </p>
                  ) : null}
                </Stack>
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
                    onClick={() => void saveField('custom_domain')}
                    disabled={isSubmitting || !hasOwnerDomainFeature}
                  >
                    수정 완료
                  </button>
                </Stack>
                {fieldErrors.blog_type ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{fieldErrors.blog_type}</span>
                  </p>
                ) : null}
                {customDomainCheckMessage ? (
                  <PopupMessage
                    open={Boolean(customDomainCheckMessage)}
                    message={customDomainCheckMessage}
                    onClose={() => setCustomDomainCheckMessage('')}
                  />
                ) : null}
              </Stack>
            ) : (
              <Stack direction="column" gap={3}>
                {siteInfo.custom_domain ? (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>도메인</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>{siteInfo.custom_domain}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : null}
                {hasOwnerDomainFeature || siteInfo.custom_domain !== null ? (
                  <Stack direction="column" gap={1}>
                    <p className="alert info">
                      <InfoOutlineRoundedIcon />
                      <span>아래와 같이 도메인 DNS 레코드를 추가하셔야 합니다.</span>
                    </p>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>유형</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>호스팅 이름</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>값</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>CNAME</TableCell>
                          <TableCell>{getCustomDomainHostName(siteInfo.custom_domain)}</TableCell>
                          <TableCell>cname.vercel-dns.com</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Stack>
                ) : null}
                <Stack direction="row" justifyContent="flex-end">
                  {hasOwnerDomainFeature ? (
                    <button
                      type="button"
                      className="button small action"
                      onClick={() => startEdit('custom_domain', siteInfo.custom_domain)}
                    >
                      수정
                    </button>
                  ) : (
                    <Anchor href="/memberships/creator" className="button small action">
                      커스텀 도메인 설정하기
                    </Anchor>
                  )}
                </Stack>
              </Stack>
            )}
          </div>
          {siteInfo.site_type === 'blog' && (
            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">블로그 타입</Typography>
              {editingField === 'blog_type' ? (
                <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems="center">
                  <Select
                    value={draftValue === 'team' ? 'team' : 'personal'}
                    onChange={(event) => setDraftValue(event.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="personal">1인 블로그</MenuItem>
                    <MenuItem value="team">팀 블로그</MenuItem>
                  </Select>
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
                      onClick={handleBlogTypeSave}
                      disabled={isSubmitting || draftValue === (blogType === 'team' ? 'team' : 'personal')}
                    >
                      수정 완료
                    </button>
                  </Stack>
                </Stack>
              ) : (
                <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">{blogType === 'team' ? '팀 블로그' : '1인 블로그'}</Typography>
                  <button
                    type="button"
                    className="button small action"
                    onClick={() => startEdit('blog_type', blogType === 'team' ? 'team' : 'personal')}
                  >
                    수정
                  </button>
                </Stack>
              )}
            </div>
          )}
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">사이트명</Typography>
            {editingField === 'site_label' ? (
              <>
                <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                  <TextField
                    value={String(draftValue)}
                    onChange={handleSiteLabelChange}
                    onKeyDown={(event) => runInputAdornmentAction(event, handleCheckSiteLabel, isCheckingSiteLabel)}
                    fullWidth
                    size="small"
                    error={Boolean(fieldErrors.site_label)}
                    helperText={fieldErrors.site_label || `${String(draftValue).length} / 10`}
                    slotProps={{
                      htmlInput: { maxLength: 10 },
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
                <Typography variant="body2">{siteInfo.site_label ?? ''}</Typography>
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
                  error={Boolean(fieldErrors.summary)}
                  helperText={fieldErrors.summary || `${String(draftValue).length} / 52`}
                  slotProps={{ htmlInput: { maxLength: 52 } }}
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
                {fieldErrors.theme_type ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{fieldErrors.theme_type}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography variant="body2">{siteInfo.summary ?? ''}</Typography>
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
            <Typography variant="subtitle2">오픈그래프 이미지</Typography>
            {siteOgImageUrl ? (
              <Box
                component="img"
                src={siteOgImageUrl}
                alt={`${siteInfo.site_label ?? siteInfo.site_key} 오픈그래프 이미지`}
                sx={{
                  width: '100%',
                  maxWidth: '100%',
                  aspectRatio: '1280 / 630',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>등록된 오픈그래프 이미지가 없습니다.</span>
              </p>
            )}
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>이 이미지는 카카오톡, 라인, 트위터, 페이스북 등에 링크 공유시 미리보기에 나오는 이미지입니다.</span>
            </p>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>1MB 미만의 PNG, JPEG, WEBP 이미지를 등록할 수 있습니다.</span>
            </p>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>1280 : 630 비율로 올리시는 것을 추천합니다.</span>
            </p>

            <VisuallyHiddenInput
              ref={siteOgInputReference}
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              onChange={handleSiteOgFileChange}
            />
            <Stack direction="row" gap={1} justifyContent="flex-end">
              {siteOgImageUrl ? (
                <button
                  type="button"
                  className="button small danger"
                  onClick={() => void handleRemoveSiteOgImage()}
                  disabled={isUploadingSiteOg}
                >
                  삭제
                </button>
              ) : null}
              <button
                type="button"
                className="button small action"
                onClick={handleClickSiteOgUpload}
                disabled={isUploadingSiteOg}
              >
                {siteOgImageUrl ? '이미지 교체' : '이미지 추가'}
              </button>
            </Stack>
            {fieldErrors.og_image ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{fieldErrors.og_image}</span>
              </p>
            ) : null}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">프로모션 이미지</Typography>
            {promotionImageUrl ? (
              <Box
                component="img"
                src={promotionImageUrl}
                alt={`${siteInfo.site_label ?? siteInfo.site_key} 프로모션 이미지`}
                sx={{
                  width: '100%',
                  maxWidth: '358px',
                  aspectRatio: '358 / 170',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>등록된 프로모션 이미지가 없습니다.</span>
              </p>
            )}
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>이 이미지는 메인에 공개되는 이미지입니다.</span>
            </p>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>가로 358 세로 170의 PNG, JPG, WEBP 이미지 1장이 필요합니다.</span>
            </p>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>이미지는 1MB 미만만 업로드할 수 있습니다.</span>
            </p>
            <VisuallyHiddenInput
              ref={promotionInputReference}
              type="file"
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              onChange={handlePromotionFileChange}
            />
            <Stack direction="row" gap={1} justifyContent="flex-end">
              {promotionImageUrl ? (
                <button
                  type="button"
                  className="button small danger"
                  onClick={() => void handleRemovePromotionImage()}
                  disabled={isUploadingPromotion}
                >
                  삭제
                </button>
              ) : null}
              <button
                type="button"
                className="button small action"
                onClick={handleClickPromotionUpload}
                disabled={isUploadingPromotion}
              >
                {promotionImageUrl ? '이미지 교체' : '이미지 추가'}
              </button>
            </Stack>
            {fieldErrors.promotion_image ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{fieldErrors.promotion_image}</span>
              </p>
            ) : null}
          </div>
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">테마</Typography>
            {editingField === 'theme_type' ? (
              <>
                <Select
                  value={isThemeType(String(draftValue)) ? String(draftValue) : 'default'}
                  onChange={handleThemeTypeChange}
                  fullWidth
                  size="small"
                >
                  {THEME_TYPES.map((themeValue) => (
                    <MenuItem key={themeValue} value={themeValue}>
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
                {fieldErrors.visibility_type ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{fieldErrors.visibility_type}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                <Typography variant="body2">{siteInfo.theme_type}</Typography>
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
                <Typography variant="body2">{siteInfo.visibility_type === 'public' ? '공개' : '비공개'}</Typography>
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
      <FormErrorDialog
        open={isErrorDialogOpen}
        title={errorDialogTitle}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setIsErrorDialogOpen(false)}
      />
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isTeamConversionConfirmOpen}
          onClose={() => setIsTeamConversionConfirmOpen(false)}
          className="VhiDrawer-bottom"
        >
          <h2>블로그 타입 변경</h2>
          <div className="VhiDrawer-bottom-content">
            팀 블로그로 변경하면 현재 사이트 구독이 취소되고 결제 금액이 환불됩니다. 변경하시겠어요?
          </div>
          <div className="drawer-dialog-actions">
            <button
              type="button"
              className="button medium cancel"
              onClick={() => setIsTeamConversionConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium warning"
              onClick={() => {
                setIsTeamConversionConfirmOpen(false);
                void saveField('blog_type', undefined, true);
              }}
            >
              변경
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isTeamConversionConfirmOpen}
          onClose={() => setIsTeamConversionConfirmOpen(false)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>블로그 타입 변경</DialogTitle>
          <DialogContent>
            팀 블로그로 변경하면 현재 사이트 구독이 취소되고 결제 금액이 환불됩니다. 변경하시겠어요?
          </DialogContent>
          <DialogActions>
            <button
              type="button"
              className="button medium cancel"
              onClick={() => setIsTeamConversionConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="button medium warning"
              onClick={() => {
                setIsTeamConversionConfirmOpen(false);
                void saveField('blog_type', undefined, true);
              }}
            >
              변경
            </button>
          </DialogActions>
        </Dialog>
      )}
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isTeamMemberBlogTypeDialogOpen}
          onClose={() => setIsTeamMemberBlogTypeDialogOpen(false)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>블로그 타입 변경 안내</h2>
          <button
            type="button"
            className="close-button"
            onClick={() => setIsTeamMemberBlogTypeDialogOpen(false)}
            aria-label="닫기"
          >
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">팀원 존재시 1인 블로그로 전환하실 수 없어요.</div>
          <div className="drawer-dialog-actions">
            <button
              type="button"
              className="button small submit"
              onClick={() => setIsTeamMemberBlogTypeDialogOpen(false)}
            >
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isTeamMemberBlogTypeDialogOpen}
          onClose={() => setIsTeamMemberBlogTypeDialogOpen(false)}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>블로그 타입 변경 안내</DialogTitle>
          <button
            type="button"
            className="close-button"
            onClick={() => setIsTeamMemberBlogTypeDialogOpen(false)}
            aria-label="닫기"
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>팀원 존재시 1인 블로그로 전환하실 수 없어요.</DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setIsTeamMemberBlogTypeDialogOpen(false)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}
