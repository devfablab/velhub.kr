'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { SelectChangeEvent } from '@mui/material/Select';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Anchor from '@/components/Anchor';
import styles from '@/app/concierge.module.sass';

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
  // {
  //   value: 'rights_trademark',
  //   label: '상표권',
  //   description: '상표를 상업적 목적으로 무단 사용',
  // },
  // {
  //   value: 'rights_counterfeit',
  //   label: '위조상품',
  //   description: '소유 권리를 무단으로 활용한 가품 판매',
  // },
  // {
  //   value: 'rights_design_patent_utility',
  //   label: '디자인 ∙ 특허 ∙ 실용신안',
  //   description: '해당 권리의 무단 사용',
  // },
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

  const selectedReportCategoryOption =
    rightsReportCategoryOptions.find((option) => option.value === reportCategory) ?? null;

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

  function renderReportCategoryGuide() {
    if (!selectedReportCategoryOption) {
      return null;
    }

    return (
      <>
        <Typography variant="body2">{selectedReportCategoryOption.description}</Typography>
        <div className={`paper ${styles.Accordion}`}>
          {reportCategory === 'rights_defamation' ||
          reportCategory === 'rights_personality_rights' ||
          reportCategory === 'rights_copyright' ? (
            <>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="rights_defamation1-panel-content"
                  id="rights_defamation1-panel-header"
                >
                  <Typography component="span">신고 가능한 게시물 유형</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack gap={1} sx={{ pt: 2, pb: 2 }}>
                    <Stack>
                      <Typography variant="subtitle2">권리 침해 신고(게시중단) 요청이 가능한 영역</Typography>
                      <Typography variant="body2">1. 서비스: 커뮤니티, 블로그</Typography>
                      <Typography variant="body2">2. 영역: 서비스 전역. (글 포함, 댓글)</Typography>
                    </Stack>
                    <Stack>
                      <Typography variant="subtitle2">권리 침해 신고(게시중단) 요청이 불가능한 영역</Typography>
                      <Typography variant="body2">1. 외부 사이트 게시물: 웹문서 영역 등</Typography>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="rights_defamation2-panel-content"
                  id="rights_defamation2-panel-header"
                >
                  <Typography component="span">[단체]에서 권리 침해 신고를 접수할 때 필요한 서류</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack gap={1} sx={{ pt: 2, pb: 2 }}>
                    <Typography variant="subtitle2">
                      저작권 침해 사유로 권리 침해 신고(게시중단 요청)를 접수하는 단체는 아래의 서류를 반드시 구비해야
                      합니다.
                    </Typography>
                    <Typography variant="body2">1. 사업자등록증 또는 법인등록증 사본</Typography>
                    <Typography variant="body2">
                      2. 권리 침해를 받은 당사자가 아닌 대리인이 접수하는 경우, 단체 직인이나 대표의 서명이 날인된
                      위임장
                    </Typography>
                    <Stack>
                      <Typography variant="body2">3. 저작권리자임을 소명할 수 있는 자료</Typography>
                      <Typography variant="body2">
                        - 자신이 그 저작물 등의 권리자로 표시된 저작권 등의 등록증 사본 또는 그에 상당하는 자료
                      </Typography>
                      <Typography variant="body2">
                        - 자신의 성명 등 또는 널리 알려진 이명이 표시되어 있는 그 저작물 등의 사본 또는 그에 상당하는
                        자료
                      </Typography>
                      <Typography variant="body2">
                        - 저작권 등을 가지고 있는 자로부터 적법하게 복제·전송의 허락을 받은 사실을 증명하는 계약서 사본
                        또는 그에 상당하는 자료
                      </Typography>
                      <Typography variant="body2">
                        - 그 저작물 등의 저작재산권의 보호기간이 끝난 경우 그 사실을 확인할 수 있는 자료
                      </Typography>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="rights_defamation3-panel-content"
                  id="rights_defamation3-panel-header"
                >
                  <Typography component="span">[개인]이 권리 침해 신고를 접수할 때 필요한 서류</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack gap={1} sx={{ pt: 2, pb: 2 }}>
                    <Typography variant="subtitle2">
                      저작권 침해 사유로 권리 침해 신고(게시중단 요청)를 접수하는 개인은 아래의 서류를 반드시 구비해야
                      합니다.
                    </Typography>
                    <Typography variant="body2">1. 사업자등록증 또는 법인등록증 사본</Typography>
                    <Typography variant="body2">
                      2. 권리 침해를 받은 당사자가 아닌 대리인이 접수하는 경우, 당사자의 직인 또는 서명이 날인된 위임장
                    </Typography>
                    <Stack>
                      <Typography variant="body2">3. 저작권리자임을 소명할 수 있는 자료</Typography>
                      <Typography variant="body2">
                        - 자신이 그 저작물 등의 권리자로 표시된 저작권 등의 등록증 사본 또는 그에 상당하는 자료
                      </Typography>
                      <Typography variant="body2">
                        - 자신의 성명 등 또는 널리 알려진 이명이 표시되어 있는 그 저작물 등의 사본 또는 그에 상당하는
                        자료
                      </Typography>
                      <Typography variant="body2">
                        - 저작권 등을 가지고 있는 자로부터 적법하게 복제·전송의 허락을 받은 사실을 증명하는 계약서 사본
                        또는 그에 상당하는 자료
                      </Typography>
                      <Typography variant="body2">
                        - 그 저작물 등의 저작재산권의 보호기간이 끝난 경우 그 사실을 확인할 수 있는 자료
                      </Typography>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="rights_defamation4-panel-content"
                  id="rights_defamation4-panel-header"
                >
                  <Typography component="span">신고 처리 과정</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack gap={1} sx={{ pt: 2, pb: 2 }}>
                    <Typography variant="subtitle2">
                      1. 권리 침해 신고(게시중단 요청)에 따른 게시중단(임시조치) 조치 시 게시물 작성자에게는 권리 침해
                      신고(게시중단 요청) 사유와 함께 요청자가 관련 당사자(개인, 단체 구분 없이)로 안내됩니다.
                    </Typography>

                    <Typography variant="subtitle2">
                      2. 작성자는 이의신청을 할 수 있으며 이때 권리 침해 신고(게시중단 요청) 요청자에게 관련 내용이
                      통보됩니다.
                    </Typography>

                    <Typography variant="subtitle2">
                      3. 이의신청 검토가 완료되면 게시중단(임시조치) 조치 30일 뒤 복원됩니다.
                    </Typography>

                    <Stack>
                      <Typography variant="subtitle2">
                        4. 복원된 게시물은 다시 권리 침해 신고(게시중단 요청) 및 게시중단(임시조치) 될 수 없습니다.
                      </Typography>
                      <Typography variant="body2">
                        ※ 추가로 게시물 조치가 필요한 경우 방송미디어통신심의위원회로 심의를 신청할 수 있습니다.
                      </Typography>
                    </Stack>

                    <Typography variant="subtitle2">
                      5. 방송미디어통신심의위원회의 심의 결과에 따라 게시물은 다시 조치될 수 있습니다.
                    </Typography>
                    <Stack>
                      <Typography variant="subtitle2">
                        6. 자세한 심의 과정은 방송미디어통신심의위원회의 관련 부서로 문의하세요.
                      </Typography>
                      <Typography variant="body2">
                        <Anchor href="http://www.kocsc.or.kr/mainPage.do" className="link">
                          방송미디어통신심의위원회 바로가기
                        </Anchor>
                      </Typography>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
              <Accordion>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="rights_defamation5-panel-content"
                  id="rights_defamation5-panel-header"
                >
                  <Typography component="span">검토 결과 조회 방법</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack gap={1} sx={{ pt: 2, pb: 2 }}>
                    <Stack>
                      <Typography variant="subtitle2">
                        접수한 권리 침해 신고(게시중단 요청) 접수 현황과 처리 결과는 마이허브 - 신고이력에서 확인할 수
                        있습니다.
                      </Typography>
                      <Typography variant="body2">
                        <Anchor href="/hub/reports" className="link">
                          신고이력 바로가기
                        </Anchor>
                      </Typography>
                    </Stack>

                    <Stack>
                      <Typography variant="subtitle2">※ 참고해 주세요!</Typography>
                      <Typography variant="body2">
                        게시중단(임시조치) 상태에서는 게시물의 내용 수정이 불가합니다.
                      </Typography>
                      <Typography variant="body2">
                        최근 3개월 간의 권리 침해 신고(게시중단 요청)/소명(재게시) 요청 상태를 조회할 수 있습니다.
                      </Typography>
                      <Typography variant="body2">
                        3개월이 지나 조회가 되지 않으면 처리결과 안내를 받았던 이메일을 확인해 주세요.
                      </Typography>
                    </Stack>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </>
          ) : null}

          {reportCategory === 'rights_trademark' ? (
            <Typography variant="body2">상표가 상업적 목적으로 무단 사용된 경우 접수할 수 있습니다.</Typography>
          ) : null}

          {reportCategory === 'rights_counterfeit' ? (
            <Typography variant="body2">
              권리자의 권리를 무단으로 활용한 가품 판매 또는 위조상품 관련 내용인 경우 접수할 수 있습니다.
            </Typography>
          ) : null}

          {reportCategory === 'rights_design_patent_utility' ? (
            <Typography variant="body2">
              디자인권, 특허권, 실용신안권 등 해당 권리가 무단으로 사용된 경우 접수할 수 있습니다.
            </Typography>
          ) : null}
        </div>
      </>
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
        {renderReportCategorySelect()}
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
            <div className="paper">
              <Typography variant="body2">
                권리 침해 신고에 필요한 서류는{' '}
                <Anchor href="/권리보호센터_위임장_단체.docx" className="link">
                  단체 위임장
                </Anchor>
                과{' '}
                <Anchor href="/권리보호센터_위임장_개인.docx" className="link">
                  개인 위임장
                </Anchor>
                으로 미리 확인하실 수 있습니다.
              </Typography>
              <Typography variant="body2">
                공개된 데브허브 서비스의 게시물로 인해 명예를 훼손 당한 경우 그 게시물을 임시로 게재 중단해 줄 것을
                요청하실 수 있습니다.
              </Typography>
            </div>
            {renderCommonFields()}
            {renderReportCategoryGuide()}
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
