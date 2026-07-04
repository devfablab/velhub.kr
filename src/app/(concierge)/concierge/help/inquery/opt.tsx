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
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

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
            <Stack direction="row" gap={1}>
              <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
                이름
              </Typography>
              <Typography variant="body2">{reporterName}</Typography>
            </Stack>
            {reporterCompanyName ? (
              <Stack direction="row" gap={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
                  단체명
                </Typography>
                <Typography variant="body2">{reporterCompanyName}</Typography>
              </Stack>
            ) : null}
            <Stack direction="row" gap={1}>
              <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
                생년월일
              </Typography>
              <Typography variant="body2">{formatBirthDate(reporterBirthDate)}</Typography>
            </Stack>
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
      <Stack direction="row" gap={1} alignItems="center">
        <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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
        {renderLegalTypeSelect()}

        {!hasTargetParams ? (
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
              문제 있는 링크
            </Typography>
            <TextField
              value={reportUrl}
              onChange={(changeEvent) => setReportUrl(changeEvent.currentTarget.value)}
              fullWidth
              size="small"
            />
          </Stack>
        ) : null}

        <Stack direction="row" gap={1} alignItems="center">
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            이메일
          </Typography>
          <TextField
            value={email}
            onChange={(changeEvent) => setEmail(changeEvent.currentTarget.value)}
            fullWidth
            size="small"
          />
        </Stack>

        <Stack direction="row" gap={1} alignItems="center">
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            휴대폰 또는 전화번호
          </Typography>
          <TextField
            value={phone}
            onChange={(changeEvent) => setPhone(changeEvent.currentTarget.value)}
            fullWidth
            size="small"
          />
        </Stack>

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150, position: 'relative', top: 9 }}>
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
      </Stack>
    );
  }

  function renderIllegalInfoForm() {
    return (
      <Stack gap={2}>
        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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
          <Stack direction="row" gap={1}>
            <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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
          <Stack direction="row" gap={1}>
            <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            신고 내용
          </Typography>
          <TextField
            value={reportContent}
            onChange={(changeEvent) => setReportContent(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            신고 이유
          </Typography>
          <TextField
            value={reportReason}
            onChange={(changeEvent) => setReportReason(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            신고 근거
          </Typography>
          <TextField
            value={reportBasis}
            onChange={(changeEvent) => setReportBasis(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        {requestType === 'illegal_info' || requestType === 'false_manipulated_info' ? (
          <Stack justifyContent="flex-end" alignItems="flex-end">
            <Typography variant="body2" sx={{ minWidth: 150 }}>
              「정보통신망법」제44조의12에 따라 위와 같이 신고·삭제요청을 합니다.
            </Typography>
            {requestType === 'illegal_info' ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={illegalInfoConfirmed}
                    onChange={(changeEvent) => setIllegalInfoConfirmed(changeEvent.currentTarget.checked)}
                  />
                }
                label="불법정보 신고·요청 확인"
              />
            ) : null}

            {requestType === 'false_manipulated_info' ? (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={falseManipulatedInfoConfirmed}
                    onChange={(changeEvent) => setFalseManipulatedInfoConfirmed(changeEvent.currentTarget.checked)}
                  />
                }
                label="허위조작정보 신고·요청 확인"
              />
            ) : null}
          </Stack>
        ) : null}

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
        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150, position: 'relative', top: 9 }}>
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

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150, position: 'relative', top: 9 }}>
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

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            신고·요청 대상
          </Typography>
          <TextField
            value={filmingTarget}
            onChange={(changeEvent) => setFilmingTarget(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack justifyContent="flex-end" alignItems="flex-end">
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            「전기통신사업법」 제22조의5제1항에 따라 위와 같이 신고ㆍ삭제요청을 합니다.
          </Typography>
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

        <Stack justifyContent="flex-end" alignItems="flex-end">
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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
        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            노출된 정보
          </Typography>
          <TextField
            value={exposedInformation}
            onChange={(changeEvent) => setExposedInformation(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>

        <Stack direction="row" gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
            요청사유
          </Typography>
          <TextField
            value={privacyRequestReason}
            onChange={(changeEvent) => setPrivacyRequestReason(changeEvent.currentTarget.value)}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />
        </Stack>
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
    <div className="container">
      <div className="content">
        <div className="paper">
          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}

          <Stack gap={3}>
            {initialLegalType ? (
              <Stack direction="row" gap={1}>
                <Typography variant="subtitle2" sx={{ minWidth: 150 }}>
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
        </div>
      </div>

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
