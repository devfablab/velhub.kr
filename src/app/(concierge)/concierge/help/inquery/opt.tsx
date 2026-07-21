'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Anchor from '@/components/Anchor';

type LegalType = 'illegal_info' | 'illegal_filming' | 'privacy';

type ReportTargetType = 'site' | 'board' | 'post' | 'comment';

type SubmitResponse = {
  ok?: boolean;
  error?: string;
};

type SettlementResponse = {
  exists?: boolean;
  identity?: {
    name: string;
    birth_date: string;
    gender: string;
    identity_verified_at: string;
  } | null;
  settlement?: {
    settlement_type: string;
    company_name: string | null;
    company_number: string | null;
  } | null;
  message?: string;
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

const maxFileSize = 5 * 1024 * 1024;

const legalTypeOptions = [
  { value: 'illegal_info', label: '정보통신망법에 따른 불법정보/허위조작정보' },
  { value: 'illegal_filming', label: '불법촬영물등이 포함됨' },
  { value: 'privacy', label: '개인정보가 포함됨' },
] satisfies { value: LegalType; label: string }[];

const illegalInfoCategoryOptions = [
  { value: 'obscene_distribution', label: '음란물 배포 및 공개 전시 정보' },
  { value: 'false_fact_defamation', label: '허위사실 적시 명예훼손 정보' },
  { value: 'hate_speech', label: '폭력·차별 선동 및 증오 조장 등 혐오정보' },
  { value: 'fear_anxiety_repeated_message', label: '공포·불안 유발 메시지(또는 영상) 반복 전송 정보' },
  { value: 'system_damage_disruption', label: '정보통신시스템 훼손·변조 및 운용방해 정보' },
  { value: 'youth_harmful_media_violation', label: '연령 확인·표시 의무 위반 청소년유해매체물' },
  { value: 'illegal_gambling', label: '불법 사행성 행위 관련 정보' },
  { value: 'personal_info_illegal_trade', label: '개인정보 불법 거래 정보' },
  { value: 'weapons_explosives_manufacturing', label: '총포·화약류 제조방법 및 설계 정보' },
  { value: 'drug_use_manufacture_trade', label: '마약류 사용·제조·매매 및 알선 정보' },
  { value: 'national_secret_leak', label: '국가기밀 누설 정보' },
  { value: 'national_security_law_violation', label: '국가보안법 위반 정보' },
  { value: 'other_criminal_purpose_aiding', label: '기타 범죄 목적·교사·방조 정보' },
];

const falseManipulatedInfoCategoryOptions = [
  { value: 'false_information', label: '내용의 전부 또는 일부가 허위인 정보(허위정보)' },
  { value: 'manipulated_information', label: '내용을 사실로 오인하도록 변형된 정보(조작정보)' },
];

const filmingRequestTypeOptions = [
  { value: 'distribution_report', label: '불법촬영물등 유통신고' },
  { value: 'deletion_request', label: '불법촬영물등 삭제요청' },
];

const filmingReasonTypeOptions = [
  { value: 'illegal_filming', label: '불법촬영물' },
  { value: 'deepfake', label: '허위영상물' },
  { value: 'child_youth_sexual_exploitation', label: '아동·청소년 성착취물' },
];

const privacyReportTypeOptions = [
  { value: 'post', label: '게시글' },
  { value: 'comment', label: '댓글' },
  { value: 'other', label: '그 외' },
];

function formatBirthDate(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 6 && digits.length !== 8) {
    return value;
  }

  const currentYear = new Date().getFullYear();
  const currentYearLastTwoDigits = currentYear % 100;

  const year =
    digits.length === 8
      ? Number(digits.slice(0, 4))
      : Number(digits.slice(0, 2)) <= currentYearLastTwoDigits
        ? 2000 + Number(digits.slice(0, 2))
        : 1900 + Number(digits.slice(0, 2));

  const monthStartIndex = digits.length === 8 ? 4 : 2;
  const month = Number(digits.slice(monthStartIndex, monthStartIndex + 2));
  const day = Number(digits.slice(monthStartIndex + 2, monthStartIndex + 4));

  if (!year || !month || !day) {
    return value;
  }

  return `${year}년 ${month}월 ${day}일`;
}

function normalizeLegalType(value: string | null): LegalType | '' {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === 'illegal_info' || normalizedValue === 'illegal-info') {
    return 'illegal_info';
  }

  if (normalizedValue === 'illegal_filming' || normalizedValue === 'illegal-filming') {
    return 'illegal_filming';
  }

  if (normalizedValue === 'privacy') {
    return 'privacy';
  }

  return '';
}

function normalizeTargetType(value: string | null): ReportTargetType | '' {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (
    normalizedValue === 'site' ||
    normalizedValue === 'board' ||
    normalizedValue === 'post' ||
    normalizedValue === 'comment'
  ) {
    return normalizedValue;
  }

  return '';
}

function inferTargetType({
  targetType,
  siteName,
  boardName,
  contentId,
  commentId,
}: {
  targetType: ReportTargetType | '';
  siteName: string;
  boardName: string;
  contentId: string;
  commentId: string;
}): ReportTargetType | '' {
  if (targetType) {
    return targetType;
  }

  if (!siteName) {
    return '';
  }

  if (commentId) {
    return 'comment';
  }

  if (contentId) {
    return 'post';
  }

  if (boardName) {
    return 'board';
  }

  return 'site';
}

function getLegalTypeTitle(legalType: LegalType | '') {
  return legalTypeOptions.find((option) => option.value === legalType)?.label ?? '법적 신고';
}

function toggleArrayValue(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }

  return [...values, value];
}

function getFileError(files: File[]) {
  if (files.length === 0) {
    return '파일을 첨부해 주세요.';
  }

  if (files.length > 2) {
    return '파일은 최대 2개까지 첨부할 수 있습니다.';
  }

  const invalidFile = files.find(
    (file) => file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'),
  );

  if (invalidFile) {
    return 'PDF 파일만 첨부할 수 있습니다.';
  }

  const oversizedFile = files.find((file) => file.size > maxFileSize);

  if (oversizedFile) {
    return 'PDF 파일은 1개당 5MB 이하만 첨부할 수 있습니다.';
  }

  return '';
}

function getSingleFileError(file: File, currentFiles: File[]) {
  if (currentFiles.length >= 2) {
    return '파일은 최대 2개까지 첨부할 수 있습니다.';
  }

  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    return 'PDF 파일만 첨부할 수 있습니다.';
  }

  if (file.size > maxFileSize) {
    return 'PDF 파일은 1개당 10MB 이하만 첨부할 수 있습니다.';
  }

  return '';
}

export default function Opt() {
  const searchParams = useSearchParams();

  const initialLegalType = useMemo(
    () => normalizeLegalType(searchParams.get('legalType') || searchParams.get('requestType')),
    [searchParams],
  );

  const targetTypeParam = useMemo(() => normalizeTargetType(searchParams.get('targetType')), [searchParams]);

  const siteName = normalizeText(searchParams.get('siteName')).toLowerCase();
  const boardName = normalizeText(searchParams.get('boardName')).toLowerCase();
  const contentId = normalizeText(searchParams.get('contentId')) || normalizeText(searchParams.get('slug'));
  const commentId = normalizeText(searchParams.get('commentId'));
  const targetType = inferTargetType({
    targetType: targetTypeParam,
    siteName,
    boardName,
    contentId,
    commentId,
  });

  const hasTargetParams = Boolean(siteName);
  const hasInitialLegalType = Boolean(initialLegalType);

  const [selectedLegalType, setSelectedLegalType] = useState<LegalType | ''>(initialLegalType);
  const [reportUrl, setReportUrl] = useState('');

  const [reporterName, setReporterName] = useState('');
  const [reporterCompanyName, setReporterCompanyName] = useState('');
  const [reporterBirthDate, setReporterBirthDate] = useState('');
  const [reporterCompanyNumber, setReporterCompanyNumber] = useState('');
  const [reporterLoading, setReporterLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const [requestType, setRequestType] = useState('');
  const [illegalInfoCategories, setIllegalInfoCategories] = useState<string[]>([]);
  const [falseManipulatedInfoCategories, setFalseManipulatedInfoCategories] = useState<string[]>([]);
  const [reportContent, setReportContent] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportBasis, setReportBasis] = useState('');
  const [illegalInfoConfirmed, setIllegalInfoConfirmed] = useState(false);
  const [falseManipulatedInfoConfirmed, setFalseManipulatedInfoConfirmed] = useState(false);
  const [illegalInfoNoticeConfirmed, setIllegalInfoNoticeConfirmed] = useState(false);

  const [filmingRequestTypes, setFilmingRequestTypes] = useState<string[]>([]);
  const [filmingReasonTypes, setFilmingReasonTypes] = useState<string[]>([]);
  const [filmingTarget, setFilmingTarget] = useState('');
  const [filmingRequestConfirmed, setFilmingRequestConfirmed] = useState(false);
  const [filmingNoticeConfirmed, setFilmingNoticeConfirmed] = useState(false);

  const [privacyReportType, setPrivacyReportType] = useState('');
  const [exposedInformation, setExposedInformation] = useState('');
  const [privacyRequestReason, setPrivacyRequestReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    async function loadReporter() {
      try {
        setReporterLoading(true);

        const response = await fetch('/api/settlement', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json().catch(() => ({
          message: '신고자 정보를 불러오지 못했습니다.',
        }))) as SettlementResponse;

        if (!response.ok || result.message) {
          setErrorMessage(result.message ?? '신고자 정보를 불러오지 못했습니다.');
          return;
        }

        setReporterName(result.identity?.name ?? '');
        setReporterBirthDate(result.identity?.birth_date ?? '');
        setReporterCompanyName(result.settlement?.company_name ?? '');
        setReporterCompanyNumber(result.settlement?.company_number ?? '');
      } catch {
        setErrorMessage('신고자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setReporterLoading(false);
      }
    }

    void loadReporter();
  }, []);

  function resetTypeFields() {
    setRequestType('');
    setIllegalInfoCategories([]);
    setFalseManipulatedInfoCategories([]);
    setReportContent('');
    setReportReason('');
    setReportBasis('');
    setIllegalInfoConfirmed(false);
    setFalseManipulatedInfoConfirmed(false);
    setIllegalInfoNoticeConfirmed(false);

    setFilmingRequestTypes([]);
    setFilmingReasonTypes([]);
    setFilmingTarget('');
    setFilmingRequestConfirmed(false);
    setFilmingNoticeConfirmed(false);

    setPrivacyReportType('');
    setExposedInformation('');
    setPrivacyRequestReason('');
  }

  function handleLegalTypeChange(changeEvent: SelectChangeEvent) {
    setSelectedLegalType(changeEvent.target.value as LegalType);
    resetTypeFields();
    setErrorMessage('');
  }

  function handleRequestTypeChange(changeEvent: SelectChangeEvent) {
    setRequestType(changeEvent.target.value);
    setIllegalInfoCategories([]);
    setFalseManipulatedInfoCategories([]);
    setIllegalInfoConfirmed(false);
    setFalseManipulatedInfoConfirmed(false);
  }

  function handlePrivacyReportTypeChange(changeEvent: SelectChangeEvent) {
    setPrivacyReportType(changeEvent.target.value);
  }

  function handleFileChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.currentTarget.files?.[0] ?? null;

    changeEvent.currentTarget.value = '';

    if (!file) {
      return;
    }

    const fileError = getSingleFileError(file, files);

    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    setErrorMessage('');
    setFiles((currentFiles) => [...currentFiles, file]);
  }

  function handleRemoveFile(fileIndex: number) {
    setFiles((currentFiles) => currentFiles.filter((file, index) => index !== fileIndex));
    setErrorMessage('');
  }

  function validateCommonInputs() {
    if (!selectedLegalType) {
      return '신고 유형을 선택해 주세요.';
    }

    if (hasTargetParams && !targetType) {
      return '신고 대상이 올바르지 않습니다.';
    }

    if (!hasTargetParams && !reportUrl.trim()) {
      return '문제가 있는 링크를 입력해 주세요.';
    }

    if (!email.trim()) {
      return '이메일을 입력해 주세요.';
    }

    if (!phone.trim()) {
      return '휴대폰 또는 전화번호를 입력해 주세요.';
    }

    return getFileError(files);
  }

  function validateIllegalInfoInputs() {
    if (!requestType) {
      return '신고·요청 구분을 선택해 주세요.';
    }

    if (requestType === 'illegal_info' && illegalInfoCategories.length === 0) {
      return '불법정보 신고·요청 구분을 선택해 주세요.';
    }

    if (requestType === 'false_manipulated_info' && falseManipulatedInfoCategories.length === 0) {
      return '허위조작정보 신고·요청 구분을 선택해 주세요.';
    }

    if (!reportContent.trim()) {
      return '신고 내용을 입력해 주세요.';
    }

    if (!reportReason.trim()) {
      return '신고 이유를 입력해 주세요.';
    }

    if (!reportBasis.trim()) {
      return '신고 근거를 입력해 주세요.';
    }

    if (requestType === 'illegal_info' && !illegalInfoConfirmed) {
      return '불법정보 신고·요청 확인이 필요합니다.';
    }

    if (requestType === 'false_manipulated_info' && !falseManipulatedInfoConfirmed) {
      return '허위조작정보 신고·요청 확인이 필요합니다.';
    }

    if (!illegalInfoNoticeConfirmed) {
      return '불법정보/허위조작정보 신고 유의사항 확인이 필요합니다.';
    }

    return '';
  }

  function validateIllegalFilmingInputs() {
    if (filmingRequestTypes.length === 0) {
      return '신고·요청 구분을 선택해 주세요.';
    }

    if (filmingReasonTypes.length === 0) {
      return '신고·요청 사유를 선택해 주세요.';
    }

    if (!filmingTarget.trim()) {
      return '신고·요청 대상을 입력해 주세요.';
    }

    if (!filmingRequestConfirmed) {
      return '불법촬영물등 신고·요청 확인이 필요합니다.';
    }

    if (!filmingNoticeConfirmed) {
      return '불법촬영물등 신고 유의사항 확인이 필요합니다.';
    }

    return '';
  }

  function validatePrivacyInputs() {
    if (!privacyReportType) {
      return '신고유형을 선택해 주세요.';
    }

    if (!exposedInformation.trim()) {
      return '노출된 정보를 입력해 주세요.';
    }

    if (!privacyRequestReason.trim()) {
      return '요청사유를 입력해 주세요.';
    }

    return '';
  }

  function validateInputs() {
    const commonErrorMessage = validateCommonInputs();

    if (commonErrorMessage) {
      return commonErrorMessage;
    }

    if (selectedLegalType === 'illegal_info') {
      return validateIllegalInfoInputs();
    }

    if (selectedLegalType === 'illegal_filming') {
      return validateIllegalFilmingInputs();
    }

    if (selectedLegalType === 'privacy') {
      return validatePrivacyInputs();
    }

    return '신고 유형을 선택해 주세요.';
  }

  async function handleSubmit() {
    const validationMessage = validateInputs();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const formData = new FormData();

    formData.append('legalType', selectedLegalType);
    formData.append('targetType', targetType);
    formData.append('siteName', siteName);
    formData.append('boardName', boardName);
    formData.append('contentId', contentId);
    formData.append('commentId', commentId);
    formData.append('reportUrl', reportUrl.trim());

    formData.append('email', email.trim());
    formData.append('phone', phone.trim());

    files.forEach((file) => {
      formData.append('files', file);
    });

    formData.append('requestType', requestType);

    illegalInfoCategories.forEach((value) => {
      formData.append('illegalInfoCategories', value);
    });

    falseManipulatedInfoCategories.forEach((value) => {
      formData.append('falseManipulatedInfoCategories', value);
    });

    formData.append('reportContent', reportContent.trim());
    formData.append('reportReason', reportReason.trim());
    formData.append('reportBasis', reportBasis.trim());
    formData.append('illegalInfoConfirmed', String(illegalInfoConfirmed));
    formData.append('falseManipulatedInfoConfirmed', String(falseManipulatedInfoConfirmed));
    formData.append('illegalInfoNoticeConfirmed', String(illegalInfoNoticeConfirmed));

    filmingRequestTypes.forEach((value) => {
      formData.append('filmingRequestTypes', value);
    });

    filmingReasonTypes.forEach((value) => {
      formData.append('filmingReasonTypes', value);
    });

    formData.append('filmingTarget', filmingTarget.trim());
    formData.append('filmingRequestConfirmed', String(filmingRequestConfirmed));
    formData.append('filmingNoticeConfirmed', String(filmingNoticeConfirmed));

    formData.append('privacyReportType', privacyReportType);
    formData.append('exposedInformation', exposedInformation.trim());
    formData.append('privacyRequestReason', privacyRequestReason.trim());

    try {
      setSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/reports/legals/new', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = (await response.json().catch(() => ({
        error: '신고 접수 응답을 확인하지 못했습니다.',
      }))) as SubmitResponse;

      if (!response.ok || result.error) {
        setErrorMessage(result.error ?? '신고를 접수하지 못했습니다.');
        return;
      }

      setSnackbarOpen(true);
    } catch {
      setErrorMessage('신고를 접수하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  function renderReporterInfo() {
    return (
      <Box>
        {reporterLoading ? (
          <Stack justifyContent="center" alignItems="center">
            <LoadingIndicator />
          </Stack>
        ) : (
          <Stack gap={1}>
            <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
              <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                이름
              </Typography>
              <Typography variant="body2">{reporterName}</Typography>
            </Stack>
            <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
              <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                생년월일
              </Typography>
              <Typography variant="body2">{formatBirthDate(reporterBirthDate)}</Typography>
            </Stack>
            {selectedLegalType !== 'privacy' ? (
              <>
                {reporterCompanyName ? (
                  <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                    <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                      단체명
                    </Typography>
                    <Typography variant="body2">{reporterCompanyName}</Typography>
                  </Stack>
                ) : null}
                {reporterCompanyNumber ? (
                  <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                    <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                      사업자번호
                    </Typography>
                    <Typography variant="body2">{reporterCompanyNumber}</Typography>
                  </Stack>
                ) : null}
              </>
            ) : null}
          </Stack>
        )}
      </Box>
    );
  }

  function renderLegalTypeSelect() {
    if (hasInitialLegalType) {
      return null;
    }

    return (
      <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
        <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
          신고 유형
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            displayEmpty
            value={selectedLegalType}
            onChange={handleLegalTypeChange}
            renderValue={(selected) => {
              if (!selected) {
                return '신고 유형 선택';
              }
              return legalTypeOptions.find((option) => option.value === selected)?.label ?? '';
            }}
          >
            <MenuItem value="" disabled>
              신고 유형 선택
            </MenuItem>
            {legalTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    );
  }

  function renderCommonFields() {
    return (
      <Stack gap={2}>
        {renderReporterInfo()}

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            이메일
          </Typography>
          <TextField
            value={email}
            onChange={(changeEvent) => setEmail(changeEvent.currentTarget.value)}
            fullWidth
            size="small"
          />
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            휴대폰 또는 전화번호
          </Typography>
          <TextField
            value={phone}
            onChange={(changeEvent) => setPhone(changeEvent.currentTarget.value)}
            fullWidth
            size="small"
          />
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150, position: 'relative', top: 9 }}>
            파일첨부
          </Typography>

          <Stack direction="column" gap={1} sx={{ width: '100%' }}>
            <Stack gap={1} sx={{ width: '100%' }}>
              {files.map((file, fileIndex) => (
                <Stack
                  key={`${file.name}-${file.size}-${fileIndex}`}
                  direction="row"
                  gap={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle2">{file.name}</Typography>
                  <button type="button" className="button small danger" onClick={() => handleRemoveFile(fileIndex)}>
                    파일 삭제
                  </button>
                </Stack>
              ))}
            </Stack>

            {files.length < 2 ? (
              <Box>
                <Button component="label" className="button small action">
                  파일 추가
                  <VisuallyHiddenInput type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
                </Button>
              </Box>
            ) : null}

            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>PDF 파일 최대 2개, 1개당 10MB 이하로 첨부할 수 있습니다.</span>
            </p>
          </Stack>
        </Stack>
        {renderLegalTypeSelect()}
      </Stack>
    );
  }

  function renderIllegalInfoForm() {
    return (
      <Stack gap={2}>
        <div className="paper">
          <Typography variant="subtitle2">불법정보/허위조작정보 신고센터</Typography>
          <Typography variant="body2">
            정보통신망 이용촉진 및 정보보호 등에 관한 법률 제44조의12 제2항에 따라 신고를 하려는 자는 불법정보 또는
            허위조작정보로 인식한 정보의 구체적 위치, 해당 정보가 불법정보 또는 허위조작정보인 이유와 근거, 연락처 등
            대통령령으로 정하는 사항을 기재하여 접수할 수 있습니다.
          </Typography>
          <Typography variant="body2">
            다만, 동법 제44조의12 제8항에 따라 언론사, 인터넷뉴스서비스사업자 및 인터넷 멀티미디어 방송사업자에 대해서는
            정보 삭제 등 일부 조치를 적용할 수 없습니다.
          </Typography>
        </div>
        <div className="paper">
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: 137 }}>
              불법정보
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                ① 음란한 부호·문언·음향·화상 또는 영상을 배포·판매·임대하거나 공공연하게 전시하는 내용의 정보
              </Typography>
              <Typography variant="body2">
                ② 사람을 비방할 목적으로 공공연하게 거짓의 사실을 드러내어 타인의 명예를 훼손하는 내용의 정보
              </Typography>
              <Stack>
                <Typography variant="body2">
                  ③ 공공연하게 인종, 국가, 지역, 성별, 장애, 연령, 사회적 신분, 소득수준 또는 재산상태를 이유로 특정
                  개인이나 집단에 대해
                </Typography>
                <Typography variant="body2">- 직접적인 폭력이나 차별을 선동하는 정보</Typography>
                <Typography variant="body2">
                  - 증오심을 심각하게 조장하여 특정 개인이나 집단의 인간으로서의 존엄성을 현저히 훼손하는 정보
                </Typography>
              </Stack>
              <Typography variant="body2">
                ④ 공포심이나 불안감을 유발하는 부호·문언·음향·화상 또는 영상을 반복적으로 상대방에게 도달하도록 하는
                내용의 정보
              </Typography>
              <Typography variant="body2">
                ⑤ 정당한 사유 없이 정보통신시스템, 데이터 또는 프로그램 등을 훼손·멸실·변경·위조하거나 그 운용을
                방해하는 내용의 정보
              </Typography>
              <Stack>
                <Typography variant="body2">
                  ⑥ 「청소년 보호법」에 따른 청소년유해매체물로서 상대방의 연령 확인, 표시의무 등 법령에 따른 의무를
                  이행하지 아니하고 영리를 목적으로 제공하는 내용의 정보 / 법령에 따라 금지되는 사행행위
                </Typography>
                <Typography variant="body2">
                  - 이 법 또는 개인정보 보호에 관한 법령을 위반하여 개인정보를 거래하는 내용의 정보
                </Typography>
                <Typography variant="body2">- 총포·화약류를 제조할 수 있는 방법이나 설계도 등의 정보</Typography>
                <Typography variant="body2">
                  - 마약류 사용, 제조, 매매 또는 매매의 알선 등에 해당하는 내용의 정보
                </Typography>
              </Stack>
              <Typography variant="body2">⑦ 법령에 따라 분류된 비밀 등 국가기밀을 누설하는 내용의 정보</Typography>
              <Typography variant="body2">⑧ 「국가보안법」에서 금지하는 행위를 수행하는 내용의 정보</Typography>
              <Typography variant="body2">
                ⑨ 그 밖에 범죄를 목적으로 하거나 교사(敎唆) 또는 방조하는 내용의 정보
              </Typography>
            </Stack>
          </Stack>
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: 137 }}>
              허위조작정보
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                다음 각 호에 해당한다는 사실을 알았음에도 손해를 끼칠 의도 또는 부당한 이익을 얻을 목적으로 타인의
                인격권이나 재산권 또는 공공의 이익을 침해하는 다음 각 호의 허위조작정보를 유통하는 경우. 다만, 풍자와
                패러디는 제외.
              </Typography>
              <Stack>
                <Typography variant="body2">1. 내용의 전부 또는 일부가 허위인 정보(이하 “허위정보”라 한다)</Typography>
                <Typography variant="body2">2. 내용을 사실로 오인하도록 변형된 정보(이하 “조작정보”라 한다)</Typography>
              </Stack>
            </Stack>
          </Stack>
        </div>
        {!hasTargetParams ? (
          <Stack gap={1}>
            <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
              <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                신고대상 URL
              </Typography>
              <TextField
                value={reportUrl}
                onChange={(changeEvent) => setReportUrl(changeEvent.currentTarget.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>
                신고유형이 댓글인 경우 화면에 보이는 작성자 정보와 작성시간을 아래 “신고내용”에 전달해 주세요.
              </span>
            </p>
          </Stack>
        ) : null}

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            신고·요청 구분
          </Typography>
          <Select
            displayEmpty
            value={requestType}
            onChange={handleRequestTypeChange}
            fullWidth
            size="small"
            renderValue={(selected) => {
              if (!selected) {
                return '신고·요청 구분 선택';
              }
              return selected === 'illegal_info' ? '불법정보' : '허위조작정보';
            }}
          >
            <MenuItem value="" disabled>
              신고·요청 구분 선택
            </MenuItem>
            <MenuItem value="illegal_info">불법정보</MenuItem>
            <MenuItem value="false_manipulated_info">허위조작정보</MenuItem>
          </Select>
        </Stack>

        {requestType === 'illegal_info' ? (
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              불법정보 신고·요청 구분
            </Typography>
            <Stack>
              {illegalInfoCategoryOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={illegalInfoCategories.includes(option.value)}
                      onChange={() => setIllegalInfoCategories((current) => toggleArrayValue(current, option.value))}
                    />
                  }
                  label={option.label}
                />
              ))}
            </Stack>
          </Stack>
        ) : null}

        {requestType === 'false_manipulated_info' ? (
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              허위조작 신고·요청 구분
            </Typography>
            <Stack>
              {falseManipulatedInfoCategoryOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={falseManipulatedInfoCategories.includes(option.value)}
                      onChange={() =>
                        setFalseManipulatedInfoCategories((current) => toggleArrayValue(current, option.value))
                      }
                    />
                  }
                  label={option.label}
                />
              ))}
            </Stack>
          </Stack>
        ) : null}

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography
            variant="subtitle2"
            sx={{ minWidth: isMobile ? 'auto' : 150, position: isMobile ? 'static' : 'relative', top: 9 }}
          >
            신고 내용
          </Typography>
          <TextField
            placeholder="게시물 내에서 불법정보 또는 허위조작정보로 신고하려는 내용(문구, 이미지 등)을 구체적으로 기재하여 주시기 바랍니다."
            value={reportContent}
            onChange={(changeEvent) => setReportContent(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography
            variant="subtitle2"
            sx={{ minWidth: isMobile ? 'auto' : 150, position: isMobile ? 'static' : 'relative', top: 9 }}
          >
            신고 이유
          </Typography>
          <TextField
            placeholder="해당 정보를 불법정보 또는 허위조작정보로 판단하신 이유를 기재하여 주시기 바랍니다."
            value={reportReason}
            onChange={(changeEvent) => setReportReason(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography
            variant="subtitle2"
            sx={{ minWidth: isMobile ? 'auto' : 150, position: isMobile ? 'static' : 'relative', top: 9 }}
          >
            신고 근거
          </Typography>
          <TextField
            placeholder="해당 정보를 불법정보 또는 허위조작정보로 판단하신 근거를 기재하고 증빙자료를 첨부해주시기 바랍니다."
            value={reportBasis}
            onChange={(changeEvent) => setReportBasis(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack>
          <Typography variant="subtitle2">
            「정보통신망법」제44조의12에 따라 위와 같이 신고·삭제요청을 합니다.
          </Typography>
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={illegalInfoConfirmed}
                  onChange={(changeEvent) => setIllegalInfoConfirmed(changeEvent.currentTarget.checked)}
                />
              }
              label="불법정보 신고·요청 확인"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={falseManipulatedInfoConfirmed}
                  onChange={(changeEvent) => setFalseManipulatedInfoConfirmed(changeEvent.currentTarget.checked)}
                />
              }
              label="허위조작정보 신고·요청 확인"
            />
          </Stack>
        </Stack>

        <div className="paper">
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              개인정보 수집 <br hidden={isMobile} />및 이용 안내
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                고객 문의 처리를 위해 개인정보 보호법 제15조제1항제4호(계약의 체결/이행)에 따라, 다음과 같은 개인정보를
                수집·이용합니다.
              </Typography>
              <Stack>
                <Typography variant="body2">- 수집하는 개인정보 항목</Typography>
                <Typography variant="body2">
                  [필수] 이메일, 신고·요청자 이름 (기관·단체명), 휴대폰 번호 (전화번호)
                </Typography>
                <Typography variant="body2">
                  ※ 선택 항목 입력 시 정확하고 신속한 문의 내용 확인 및 처리가 가능하나, 입력하지 않으셔도 고객 문의
                  접수가 가능합니다.
                </Typography>
                <Typography variant="body2">자세한 사항은 개인정보 처리방침을 참고해주시기 바랍니다.</Typography>
              </Stack>
            </Stack>
          </Stack>

          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              신고 남용에 따른 <br hidden={isMobile} />
              접수 제한 안내
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                원활한 신고 처리를 위해 정보통신망법 제44조의13(신고 남용에 대한 조치) 및 한국인터넷자율정책기구(KISO)
                가이드라인에 따라, 명백한 근거 없이 신고를 빈번하게 하는 등 신고 제도를 남용한다고 판단되는 경우 일정
                기간 신고 접수가 제한될 수 있습니다.
              </Typography>
            </Stack>
          </Stack>
        </div>

        <Stack justifyContent="flex-end" alignItems="flex-end">
          <Typography variant="subtitle2">불법정보/허위조작정보 신고 유의사항</Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={illegalInfoNoticeConfirmed}
                onChange={(changeEvent) => setIllegalInfoNoticeConfirmed(changeEvent.currentTarget.checked)}
              />
            }
            label="위 내용을 확인했습니다."
          />
        </Stack>
      </Stack>
    );
  }

  function renderIllegalFilmingForm() {
    return (
      <Stack gap={2}>
        <div className="paper">
          <Typography variant="body2">
            불법촬영물등에 대한 신고 및 삭제요청은 전기통신사업법 제22조의5 제1항 및 동법 시행령 제30조의5 제2항에 따라,
            다음의 링크에서 “불법촬영물등 유통 신고·삭제요청서”를 다운로드 받아 여기에 작성하여 제출하시거나, 같은
            서식의 내용이 포함된 아래의 입력란에 직접 기입하여 접수시키실 수 있습니다.
          </Typography>
          <Stack>
            <Typography variant="subtitle2">※ 불법촬영물등 유통 신고·삭제요청서 다운로드</Typography>
            <Typography variant="body2">
              - 불법촬영물등 유통 신고·삭제요청서 다운받기 :{' '}
              <Anchor href="/[별지_서식]_불법촬영물등_유통_신고ㆍ삭제요청서.hwp" className="link">
                한글파일
              </Anchor>{' '}
              /{' '}
              <Anchor href="/[별지_서식]_불법촬영물등_유통_신고ㆍ삭제요청서.docx" className="link">
                워드파일
              </Anchor>
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="subtitle2">※ 유의사항</Typography>
            <Typography variant="body2">
              - 신고·삭제요청(서) 각각의 항목 중 기재되지 않은 항목이 있거나, 대상이 된 불법촬영물등이 특정되지 않아
              검토가 어려운 경우, 삭제 등의 조치가 취해지지 못하고 신고·삭제요청하신 내용에 대해 보완을 요청 드릴 수
              있습니다.
            </Typography>
          </Stack>
        </div>
        {!hasTargetParams ? (
          <Stack gap={1}>
            <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
              <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                신고대상 URL
              </Typography>
              <TextField
                value={reportUrl}
                onChange={(changeEvent) => setReportUrl(changeEvent.currentTarget.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>
                신고유형이 댓글인 경우 화면에 보이는 작성자 정보와 작성시간을 아래 “신고·요청 대상”에 전달해 주세요.
              </span>
            </p>
          </Stack>
        ) : null}
        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150, position: 'relative', top: 9 }}>
            신고·요청 구분
          </Typography>
          <Stack>
            {filmingRequestTypeOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={filmingRequestTypes.includes(option.value)}
                    onChange={() => setFilmingRequestTypes((current) => toggleArrayValue(current, option.value))}
                  />
                }
                label={option.label}
              />
            ))}
          </Stack>
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150, position: 'relative', top: 9 }}>
            신고·요청 사유
          </Typography>
          <Stack>
            {filmingReasonTypeOptions.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={filmingReasonTypes.includes(option.value)}
                    onChange={() => setFilmingReasonTypes((current) => toggleArrayValue(current, option.value))}
                  />
                }
                label={option.label}
              />
            ))}
          </Stack>
        </Stack>

        <div className="paper">
          <Stack>
            <Typography variant="subtitle2">■ 불법촬영물</Typography>
            <Typography variant="body2">
              ① 성적 욕망 또는 수치심을 유발할 수 있는 사람의 신체를 촬영대상자의 의사에 반하여 촬영한 것
            </Typography>
            <Typography variant="body2">
              ② 성적 욕망 또는 수치심을 유발할 수 있는 사람의 신체를 촬영 당시에는 촬영대상자의 의사에 반하지 아니한
              경우(자신의 신체를 직접 촬영한 경우를 포함)에도 사후에 촬영대상자의 의사에 반하여 유통된 촬영물
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="subtitle2">■ 허위 영상물</Typography>
            <Typography variant="body2">
              ① 유통할 목적으로 사람의 얼굴·신체 또는 음성을 대상으로 한 촬영물·영상물 또는 음성물을 그 대상자의 의사에
              반하여 성적 욕망 또는 수치심을 유발할 수 있는 형태로 편집·합성 또는 가공한 것
            </Typography>
            <Typography variant="body2">
              ② 성적 욕망 또는 수치심을 유발할 수 있는 형태로 편집·합성 또는 가공할 당시에는 그 대상자의 의사에 반하지
              아니한 경우에도 사후에 그 대상자의 의사에 반하여 유통된 촬영물·영상물 또는 음성물
            </Typography>
          </Stack>
          <Stack>
            <Typography variant="subtitle2">■ 아동·청소년 성착취물</Typography>
            <Typography variant="body2">
              아동·청소년 또는 아동·청소년으로 명백하게 인식될 수 있는 사람이나 표현물이 등장하여 성교 등 성적
              행위(아동·청소년의 신체의 전부 또는 일부를 접촉·노출하는 행위로서 일반인의 성적 수치심이나 혐오감을
              일으키는 행위도 포함)를 하는 내용이 표현된 것
            </Typography>
          </Stack>
        </div>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
          <Typography
            variant="subtitle2"
            sx={{ minWidth: isMobile ? 'auto' : 150, position: isMobile ? 'static' : 'relative', top: 9 }}
          >
            신고·요청 대상
          </Typography>
          <TextField
            placeholder="※ 불법촬영물등의 위치를 특정할 수 있도록 URL과 화면 캡쳐본을 첨부하여 주시되, URL 기재가 어려울 경우 검색어 등 해당 불법촬영물등의 위치에 대한 상세 설명을 기재하여 주시기 바랍니다."
            value={filmingTarget}
            onChange={(changeEvent) => setFilmingTarget(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <div className="paper">
          <Typography variant="body2">
            ※ 불법촬영물등에 해당하는지 여부를 판단하기 어려운 경우 사업자는 방송통신심의위원회에 심의를 요청할 수
            있으며, 이 경우 신고ㆍ삭제요청서의 정보가 방송통신심의위원회에 전달ㆍ제공될 수 있습니다.
          </Typography>
        </div>

        <Stack>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            「전기통신사업법」 제22조의5제1항에 따라 위와 같이 신고ㆍ삭제요청을 합니다.
          </Typography>
          <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={filmingRequestConfirmed}
                  onChange={(changeEvent) => setFilmingRequestConfirmed(changeEvent.currentTarget.checked)}
                />
              }
              label="불법촬영물등 신고·요청 확인"
            />
          </Stack>
        </Stack>

        <div className="paper">
          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              개인정보 수집 <br hidden={isMobile} />및 이용 안내
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                고객 문의 처리를 위해 개인정보 보호법 제15조제1항제4호(계약의 체결/이행)에 따라, 다음과 같은 개인정보를
                수집·이용합니다.
              </Typography>
              <Stack>
                <Typography variant="body2">- 수집하는 개인정보 항목</Typography>
                <Typography variant="body2">
                  [필수] 이메일, 신고·요청자 이름 (기관·단체명), 휴대폰 번호 (전화번호)
                </Typography>
                <Typography variant="body2">
                  ※ 선택 항목 입력 시 정확하고 신속한 문의 내용 확인 및 처리가 가능하나, 입력하지 않으셔도 고객 문의
                  접수가 가능합니다.
                </Typography>
                <Typography variant="body2">자세한 사항은 개인정보 처리방침을 참고해주시기 바랍니다.</Typography>
              </Stack>
            </Stack>
          </Stack>

          <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              신고 남용에 따른 <br hidden={isMobile} />
              접수 제한 안내
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                원활한 신고 처리를 위해 정보통신망법 제44조의13(신고 남용에 대한 조치) 및 한국인터넷자율정책기구(KISO)
                가이드라인에 따라, 명백한 근거 없이 신고를 빈번하게 하는 등 신고 제도를 남용한다고 판단되는 경우 일정
                기간 신고 접수가 제한될 수 있습니다.
              </Typography>
            </Stack>
          </Stack>
        </div>

        <div className="paper">
          <Typography variant="body2">
            불법촬영물은 성적 욕망 또는 수치심을 유발할 수 있는 사람의 신체를 촬영한 것으로 그에 해당하지 않는 초상권
            침해 및 명예훼손 신고는 관련법에 의거한 불법촬영물등 신고로 접수될 수 없으니 신고 내용을 다시 한번
            확인해주시기 바랍니다.
          </Typography>
        </div>

        <Stack justifyContent="flex-end" alignItems="flex-end">
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            불법촬영물등 신고 유의사항
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={filmingNoticeConfirmed}
                onChange={(changeEvent) => setFilmingNoticeConfirmed(changeEvent.currentTarget.checked)}
              />
            }
            label="위 내용을 확인하였습니다."
          />
        </Stack>
      </Stack>
    );
  }

  function renderPrivacyForm() {
    return (
      <Stack gap={2}>
        {!hasTargetParams ? (
          <Stack gap={1}>
            <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
              <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
                신고대상 URL
              </Typography>
              <TextField
                value={reportUrl}
                onChange={(changeEvent) => setReportUrl(changeEvent.currentTarget.value)}
                fullWidth
                size="small"
              />
            </Stack>
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>
                신고유형이 댓글인 경우 화면에 보이는 작성자 정보와 작성시간을 아래 “요청사유”에 전달해 주세요.
              </span>
            </p>
          </Stack>
        ) : null}
        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            신고유형
          </Typography>
          <Select
            displayEmpty
            value={privacyReportType}
            onChange={handlePrivacyReportTypeChange}
            fullWidth
            size="small"
            renderValue={(selected) => {
              if (!selected) {
                return '신고유형 선택';
              }

              return privacyReportTypeOptions.find((option) => option.value === selected)?.label ?? '';
            }}
          >
            <MenuItem value="" disabled>
              신고유형 선택
            </MenuItem>
            {privacyReportTypeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            노출된 정보
          </Typography>
          <TextField
            placeholder="실명, 연락처 등 노출된 개인정보를 입력해주세요."
            value={exposedInformation}
            onChange={(changeEvent) => setExposedInformation(changeEvent.currentTarget.value)}
            fullWidth
            size="small"
          />
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            요청사유
          </Typography>
          <TextField
            placeholder="신고유형이 댓글인 경우 화면에 보이는 작성자 정보와 작성시간을 '요청사유'에 전달해 주세요."
            value={privacyRequestReason}
            onChange={(changeEvent) => setPrivacyRequestReason(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>
        <div className="paper">
          <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              개인정보 수집 <br hidden={isMobile} />및 이용 안내
            </Typography>
            <Stack gap={1}>
              <Typography variant="body2">
                고객 문의 처리를 위해 개인정보 보호법 제15조제1항제4호(계약의 체결/이행)에 따라, 다음과 같은 개인정보를
                수집·이용합니다.
              </Typography>
              <Stack>
                <Typography variant="body2">- 수집하는 개인정보 항목</Typography>
                <Typography variant="body2">
                  [필수] 이메일, 신고·요청자 이름 (기관·단체명), 휴대폰 번호 (전화번호)
                </Typography>
                <Typography variant="body2">자세한 사항은 개인정보 처리방침을 참고해주시기 바랍니다.</Typography>
              </Stack>
            </Stack>
          </Stack>
        </div>
      </Stack>
    );
  }

  function renderTypeForm() {
    if (!selectedLegalType) {
      return null;
    }

    if (selectedLegalType === 'illegal_info') {
      return renderIllegalInfoForm();
    }

    if (selectedLegalType === 'illegal_filming') {
      return renderIllegalFilmingForm();
    }

    if (selectedLegalType === 'privacy') {
      return renderPrivacyForm();
    }

    return null;
  }

  return (
    <div className="paper">
      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      <Stack gap={3}>
        {initialLegalType ? (
          <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              선택하신 신고 사유
            </Typography>
            <p className="alert warning">
              <span>{getLegalTypeTitle(selectedLegalType)}</span>
            </p>
          </Stack>
        ) : null}

        {renderCommonFields()}
        {renderTypeForm()}

        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}

        <Stack direction="row" justifyContent="flex-end">
          <button type="button" className="button medium submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '접수 중' : '신고 접수'}
          </button>
        </Stack>
      </Stack>

      <Snackbar
        open={snackbarOpen}
        message="신고가 접수되었습니다."
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        autoHideDuration={2700}
        onClose={() => setSnackbarOpen(false)}
      />
    </div>
  );
}
