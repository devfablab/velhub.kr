'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type ReportTargetType = 'site' | 'board' | 'post' | 'comment';

type RightsReportCategory =
  | 'rights_defamation'
  | 'rights_personality_rights'
  | 'rights_copyright'
  | 'rights_trademark'
  | 'rights_counterfeit'
  | 'rights_design_patent_utility';

type RightsOwnerType = 'individual' | 'organization';

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

const maxCopyrightProofFileSize = 2 * 1024 * 1024;

const rightsReportCategoryOptions = [
  {
    value: 'rights_defamation',
    label: '명예훼손',
    description: '특정인 · 단체 대상 비방 · 허위사실 유포',
  },
  {
    value: 'rights_personality_rights',
    label: '초상권 ∙ 사생활 등 인격권',
    description: '특정인 사진 · 개인정보 무단 노출',
  },
  {
    value: 'rights_copyright',
    label: '저작권',
    description: '글 · 이미지 · 영상 등 저작물 무단 복제 · 공유',
  },
  {
    value: 'rights_trademark',
    label: '상표권',
    description: '상표를 상업적 목적으로 무단 사용',
  },
  {
    value: 'rights_counterfeit',
    label: '위조상품',
    description: '소유 권리를 무단으로 활용한 가품 판매',
  },
  {
    value: 'rights_design_patent_utility',
    label: '디자인 ∙ 특허 ∙ 실용신안',
    description: '해당 권리의 무단 사용',
  },
] satisfies { value: RightsReportCategory; label: string; description: string }[];

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

function normalizeRightsReportCategory(value: string | null): RightsReportCategory | '' {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (
    normalizedValue === 'rights_defamation' ||
    normalizedValue === 'rights_personality_rights' ||
    normalizedValue === 'rights_copyright' ||
    normalizedValue === 'rights_trademark' ||
    normalizedValue === 'rights_counterfeit' ||
    normalizedValue === 'rights_design_patent_utility'
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

function isOwnerRequiredCategory(value: RightsReportCategory | '') {
  return value === 'rights_defamation' || value === 'rights_personality_rights' || value === 'rights_copyright';
}

function getRightsReportCategoryTitle(value: RightsReportCategory | '') {
  return rightsReportCategoryOptions.find((option) => option.value === value)?.label ?? '권리침해 신고';
}

function getSingleCopyrightProofFileError(file: File, currentFiles: File[]) {
  if (currentFiles.length >= 5) {
    return '저작물 원본임을 증명할 수 있는 PDF는 최대 5개까지 첨부할 수 있습니다.';
  }

  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    return '저작물 원본임을 증명할 수 있는 파일은 PDF만 첨부할 수 있습니다.';
  }

  if (file.size > maxCopyrightProofFileSize) {
    return '저작물 원본임을 증명할 수 있는 PDF는 1개당 2MB 이하만 첨부할 수 있습니다.';
  }

  return '';
}

export default function Opt() {
  const searchParams = useSearchParams();

  const targetTypeParam = useMemo(() => normalizeTargetType(searchParams.get('targetType')), [searchParams]);
  const initialReportCategory = useMemo(
    () => normalizeRightsReportCategory(searchParams.get('reportCategory')),
    [searchParams],
  );

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
  const hasInitialReportCategory = Boolean(initialReportCategory);

  const [reportCategory, setReportCategory] = useState<RightsReportCategory | ''>(initialReportCategory);
  const [reportUrl, setReportUrl] = useState('');

  const [reporterName, setReporterName] = useState('');
  const [reporterLoading, setReporterLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rightsOwnerType, setRightsOwnerType] = useState<RightsOwnerType | ''>('');

  const [copyrightOriginalUrlInput, setCopyrightOriginalUrlInput] = useState('');
  const [copyrightOriginalUrls, setCopyrightOriginalUrls] = useState<string[]>([]);
  const [copyrightProofFiles, setCopyrightProofFiles] = useState<File[]>([]);

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
      } catch {
        setErrorMessage('신고자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      } finally {
        setReporterLoading(false);
      }
    }

    void loadReporter();
  }, []);

  function resetCategoryFields() {
    setRightsOwnerType('');
    setCopyrightOriginalUrlInput('');
    setCopyrightOriginalUrls([]);
    setCopyrightProofFiles([]);
  }

  function handleReportCategoryChange(changeEvent: SelectChangeEvent) {
    setReportCategory(changeEvent.target.value as RightsReportCategory);
    resetCategoryFields();
    setErrorMessage('');
  }

  function handleRightsOwnerTypeChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const value = changeEvent.currentTarget.value;

    if (value === 'individual' || value === 'organization') {
      setRightsOwnerType(value);
      setErrorMessage('');
    }
  }

  function handleAddCopyrightOriginalUrl() {
    const nextUrl = copyrightOriginalUrlInput.trim();

    if (!nextUrl) {
      return;
    }

    if (copyrightOriginalUrls.length >= 10) {
      setErrorMessage('저작물 원본 URL은 최대 10개까지 입력할 수 있습니다.');
      return;
    }

    setCopyrightOriginalUrls((currentUrls) => [...currentUrls, nextUrl]);
    setCopyrightOriginalUrlInput('');
    setErrorMessage('');
  }

  function handleRemoveCopyrightOriginalUrl(urlIndex: number) {
    setCopyrightOriginalUrls((currentUrls) => currentUrls.filter((url, index) => index !== urlIndex));
    setErrorMessage('');
  }

  function handleCopyrightProofFileChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.currentTarget.files?.[0] ?? null;

    changeEvent.currentTarget.value = '';

    if (!file) {
      return;
    }

    const fileError = getSingleCopyrightProofFileError(file, copyrightProofFiles);

    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    setCopyrightProofFiles((currentFiles) => [...currentFiles, file]);
    setErrorMessage('');
  }

  function handleRemoveCopyrightProofFile(fileIndex: number) {
    setCopyrightProofFiles((currentFiles) => currentFiles.filter((file, index) => index !== fileIndex));
    setErrorMessage('');
  }

  function validateInputs() {
    if (!reportCategory) {
      return '신고 사유를 선택해 주세요.';
    }

    if (hasTargetParams && !targetType) {
      return '신고 대상이 올바르지 않습니다.';
    }

    if (!hasTargetParams && !reportUrl.trim()) {
      return '신고대상 URL을 입력해 주세요.';
    }

    if (!email.trim()) {
      return '이메일을 입력해 주세요.';
    }

    if (!phone.trim()) {
      return '전화번호를 입력해 주세요.';
    }

    if (isOwnerRequiredCategory(reportCategory) && !rightsOwnerType) {
      return '권리 소유자를 선택해 주세요.';
    }

    if (
      reportCategory === 'rights_copyright' &&
      copyrightOriginalUrls.length === 0 &&
      copyrightProofFiles.length === 0
    ) {
      return '저작물 원본 URL 또는 저작물 원본임을 증명할 수 있는 PDF 중 하나는 입력해 주세요.';
    }

    return '';
  }

  async function handleSubmit() {
    const validationMessage = validateInputs();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const formData = new FormData();

    formData.append('reportCategory', reportCategory);
    formData.append('targetType', targetType);
    formData.append('siteName', siteName);
    formData.append('boardName', boardName);
    formData.append('contentId', contentId);
    formData.append('commentId', commentId);
    formData.append('reportUrl', reportUrl.trim());

    formData.append('email', email.trim());
    formData.append('phone', phone.trim());
    formData.append('rightsOwnerType', rightsOwnerType);

    copyrightOriginalUrls.forEach((url) => {
      formData.append('copyrightOriginalUrls', url);
    });

    copyrightProofFiles.forEach((file) => {
      formData.append('copyrightProofFiles', file);
    });

    try {
      setSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/reports/rights/new', {
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
          <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
            <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
              이름
            </Typography>
            <Typography variant="body2">{reporterName}</Typography>
          </Stack>
        )}
      </Box>
    );
  }

  function renderReportCategorySelect() {
    if (hasInitialReportCategory) {
      return (
        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            선택하신 신고 사유
          </Typography>
          <p className="alert warning">
            <span>{getRightsReportCategoryTitle(reportCategory)}</span>
          </p>
        </Stack>
      );
    }

    return (
      <Stack direction={isMobile ? 'column' : 'row'} gap={1} alignItems={isMobile ? 'flex-start' : 'center'}>
        <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
          신고 사유
        </Typography>
        <FormControl fullWidth size="small">
          <Select
            displayEmpty
            value={reportCategory}
            onChange={handleReportCategoryChange}
            renderValue={(selected) => {
              if (!selected) {
                return '신고 사유 선택';
              }

              return rightsReportCategoryOptions.find((option) => option.value === selected)?.label ?? '';
            }}
          >
            <MenuItem value="" disabled>
              신고 사유 선택
            </MenuItem>
            {rightsReportCategoryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label} - {option.description}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    );
  }

  function renderReportUrlField() {
    if (hasTargetParams) {
      return null;
    }

    return (
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
          <span>신고대상을 확인할 수 있는 주소를 입력해 주세요.</span>
        </p>
      </Stack>
    );
  }

  function renderCommonFields() {
    return (
      <Stack gap={2}>
        {renderReporterInfo()}
        {renderReportCategorySelect()}
        {renderReportUrlField()}

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
            전화번호
          </Typography>
          <TextField
            value={phone}
            onChange={(changeEvent) => setPhone(changeEvent.currentTarget.value)}
            fullWidth
            size="small"
          />
        </Stack>
      </Stack>
    );
  }

  function renderOwnerTypeField() {
    if (!isOwnerRequiredCategory(reportCategory)) {
      return null;
    }

    return (
      <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
        <Typography
          variant="subtitle2"
          sx={{ minWidth: isMobile ? 'auto' : 150, position: isMobile ? 'static' : 'relative', top: 9 }}
        >
          권리 소유자
        </Typography>
        <RadioGroup
          value={rightsOwnerType}
          onChange={handleRightsOwnerTypeChange}
          sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}
        >
          <FormControlLabel value="individual" control={<Radio />} label="개인 (본인 ∙ 가족 ∙ 지인 등)" />
          <FormControlLabel value="organization" control={<Radio />} label="단체 (기업 ∙ 개인사업자 등)" />
        </RadioGroup>
      </Stack>
    );
  }

  function renderCopyrightFields() {
    if (reportCategory !== 'rights_copyright') {
      return null;
    }

    return (
      <Stack gap={2}>
        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            저작물 원본 URL
          </Typography>

          <Stack gap={1} sx={{ width: '100%' }}>
            {copyrightOriginalUrls.map((url, urlIndex) => (
              <Stack
                key={`${url}-${urlIndex}`}
                direction="row"
                gap={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="body2">{url}</Typography>
                <button
                  type="button"
                  className="button small danger"
                  onClick={() => handleRemoveCopyrightOriginalUrl(urlIndex)}
                >
                  URL 삭제
                </button>
              </Stack>
            ))}

            {copyrightOriginalUrls.length < 10 ? (
              <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
                <TextField
                  placeholder="예) https://example.com/your-original-work"
                  value={copyrightOriginalUrlInput}
                  onChange={(changeEvent) => setCopyrightOriginalUrlInput(changeEvent.currentTarget.value)}
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <button type="button" className="button small action" onClick={handleAddCopyrightOriginalUrl}>
                            URL 추가
                          </button>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Stack>
            ) : null}

            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>저작물 원본 URL은 최대 10개까지 입력할 수 있습니다.</span>
            </p>
          </Stack>
        </Stack>

        <Stack direction={isMobile ? 'column' : 'row'} gap={1}>
          <Typography variant="subtitle2" sx={{ minWidth: isMobile ? 'auto' : 150 }}>
            원본 증명 PDF
          </Typography>

          <Stack gap={1} sx={{ width: '100%' }}>
            {copyrightProofFiles.map((file, fileIndex) => (
              <Stack
                key={`${file.name}-${file.size}-${fileIndex}`}
                direction="row"
                gap={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="body2">{file.name}</Typography>
                <button
                  type="button"
                  className="button small danger"
                  onClick={() => handleRemoveCopyrightProofFile(fileIndex)}
                >
                  파일 삭제
                </button>
              </Stack>
            ))}

            {copyrightProofFiles.length < 5 ? (
              <Box>
                <Button component="label" className="button small action">
                  파일 추가
                  <VisuallyHiddenInput
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleCopyrightProofFileChange}
                  />
                </Button>
              </Box>
            ) : null}

            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>PDF 파일 최대 5개, 1개당 2MB 이하로 첨부할 수 있습니다.</span>
            </p>
          </Stack>
        </Stack>
      </Stack>
    );
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
            {renderCommonFields()}
            {renderOwnerTypeField()}
            {renderCopyrightFields()}

            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}

            <Stack direction="row" justifyContent="flex-end">
              <button
                type="button"
                className="button medium submit"
                onClick={handleSubmit}
                disabled={submitting || reporterLoading}
              >
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
