'use client';

import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Checkbox, FormControl, FormControlLabel, Stack, TextField, Typography, styled } from '@mui/material';
import type { PartnershipFormInfo } from '@/lib/partnerships';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import styles from '@/app/concierge.module.sass';

const acceptedFileTypes = '.pdf,.jpg,.jpeg,.png,.zip';
type FieldErrors = Partial<Record<'categoryId' | 'subject' | 'content' | 'organizationName' | 'proposerName' | 'proposerPhone' | 'proposerEmail' | 'homepageUrl' | 'personalInfoAgreed' | 'noticeAgreed' | 'attachment', string>>;

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

function FilePicker({
  title,
  file,
  inputRef,
  onChange,
  onRemove,
}: {
  title: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">{title}</Typography>
      <VisuallyHiddenInput ref={inputRef} type="file" accept={acceptedFileTypes} onChange={onChange} />
      {file ? (
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="body2">{file.name}</Typography>
          <button type="button" className="button small danger" onClick={onRemove}>
            파일 삭제
          </button>
        </Stack>
      ) : (
        <button type="button" className="button small action" onClick={() => inputRef.current?.click()}>
          파일 선택
        </button>
      )}
      <Typography variant="caption" color="text.secondary">
        PDF, JPG, PNG, ZIP / 25MB 이하 / 파일 1개
      </Typography>
    </Stack>
  );
}

export default function Opt({ formInfo }: { formInfo: PartnershipFormInfo }) {
  const router = useRouter();
  const proposalFileInputRef = useRef<HTMLInputElement | null>(null);
  const introductionFileInputRef = useRef<HTMLInputElement | null>(null);
  const [categoryId, setCategoryId] = useState(formInfo.categories[0]?.id ?? '');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [proposerName, setProposerName] = useState('');
  const [proposerPhone, setProposerPhone] = useState('');
  const [proposerEmail, setProposerEmail] = useState(formInfo.paymentEmail);
  const [homepageUrl, setHomepageUrl] = useState('');
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [introductionFile, setIntroductionFile] = useState<File | null>(null);
  const [personalInfoAgreed, setPersonalInfoAgreed] = useState(false);
  const [noticeAgreed, setNoticeAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmissionLocked, setIsSubmissionLocked] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] } | null>(null);

  const selectFile = (setter: (file: File | null) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && (file.size > 25 * 1024 * 1024 || !['pdf', 'jpg', 'jpeg', 'png', 'zip'].includes(file.name.split('.').pop()?.toLowerCase() ?? ''))) {
      const message = file.size > 25 * 1024 * 1024 ? '첨부 파일은 각각 25MB 이하만 첨부할 수 있습니다.' : '첨부 파일은 PDF, JPG, PNG, ZIP 형식만 가능합니다.';
      setFieldErrors((current) => ({ ...current, attachment: message }));
      setErrorDialog({ title: '첨부 파일 확인', messages: [message] });
      event.target.value = '';
      return;
    }
    setter(file);
    setFieldErrors((current) => ({ ...current, attachment: '' }));
    event.target.value = '';
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const nextFieldErrors: FieldErrors = {
      categoryId: !categoryId ? '제휴 희망 영역을 선택해 주세요.' : '',
      organizationName: !organizationName.trim() ? '회사 또는 기관명을 입력해 주세요.' : '',
      proposerName: !proposerName.trim() ? '제안자명을 입력해 주세요.' : '',
      proposerPhone: !proposerPhone.trim() ? '전화번호를 입력해 주세요.' : '',
      proposerEmail: !proposerEmail.trim() ? '이메일 주소를 입력해 주세요.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposerEmail.trim()) ? '이메일 주소를 확인해 주세요.' : '',
      homepageUrl: homepageUrl && !/^https?:\/\//i.test(homepageUrl.trim()) ? 'http 또는 https 주소를 입력해 주세요.' : '',
      subject: !subject.trim() ? '제목을 입력해 주세요.' : subject.trim().length > 200 ? '제목은 200자 이하로 입력해 주세요.' : '',
      content: !content.trim() ? '내용을 입력해 주세요.' : '',
      personalInfoAgreed: !personalInfoAgreed ? '개인정보 수집 및 이용에 동의해 주세요.' : '',
      noticeAgreed: !noticeAgreed ? '제휴 제안 유의사항을 확인해 주세요.' : '',
    };
    const messages = Object.values(nextFieldErrors).filter((message): message is string => Boolean(message));
    setFieldErrors(nextFieldErrors);
    if (messages.length) {
      setErrorDialog({ title: '제휴 제안 내용 확인', messages });
      return;
    }
    setIsSubmitting(true);
    setIsSubmissionLocked(true);
    const data = new FormData();
    data.set('categoryId', categoryId);
    data.set('subject', subject);
    data.set('content', content);
    data.set('organizationName', organizationName);
    data.set('proposerName', proposerName);
    data.set('proposerPhone', proposerPhone);
    data.set('proposerEmail', proposerEmail);
    data.set('homepageUrl', homepageUrl);
    data.set('personalInfoAgreed', String(personalInfoAgreed));
    data.set('noticeAgreed', String(noticeAgreed));
    if (proposalFile) data.set('proposalFile', proposalFile);
    if (introductionFile) data.set('introductionFile', introductionFile);
    try {
      const response = await fetch('/api/concierge/partnerships', { method: 'POST', body: data });
      const result = (await response.json().catch(() => null)) as {
        responseChannel?: 'portal' | 'email';
        error?: string;
        errors?: string[];
        fieldErrors?: FieldErrors;
        attachmentUnavailable?: boolean;
      } | null;
      if (!response.ok || !result) {
        if (response.status >= 500 || !result?.error) {
          setErrorDialog({ title: null, messages: ['처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'] });
        } else if (result.attachmentUnavailable) {
          setFieldErrors({ attachment: result.error });
          setErrorDialog({ title: '첨부파일 등록 불가', messages: result.error.split('\n').filter(Boolean) });
        } else {
          setFieldErrors(result.fieldErrors ?? {});
          setErrorDialog({ title: '제휴 제안 내용 확인', messages: [...new Set([...(result.errors ?? []), result.error].filter(Boolean))] });
        }
        setIsSubmissionLocked(false);
        return;
      }
      router.push(result.responseChannel === 'email' ? '/concierge/partnerships/done' : '/concierge/partnerships');
    } catch {
      setErrorDialog({ title: null, messages: ['인터넷 연결을 확인한 뒤 다시 시도해 주세요.'] });
      setIsSubmissionLocked(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)}>
      <Stack className="paper" gap={2}>
        <div className={styles['form-group']}>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">제휴 희망 영역 *</Typography>
            <FormControl required fullWidth size="small">
              <Select
                aria-label="제휴 희망 영역"
                displayEmpty
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setFieldErrors((current) => ({ ...current, categoryId: '' }));
                }}
              >
                <MenuItem value="" disabled>
                  제휴 희망 영역을 선택해 주세요
                </MenuItem>
                {formInfo.categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.category_label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {fieldErrors.categoryId ? <p className="alert popup-error">{fieldErrors.categoryId}</p> : null}
          </Stack>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">회사/기관명 *</Typography>
            <TextField
              required
              aria-label="회사/기관명"
              value={organizationName}
              onChange={(event) => {
                setOrganizationName(event.target.value);
                setFieldErrors((current) => ({ ...current, organizationName: '' }));
              }}
              size="small"
              error={Boolean(fieldErrors.organizationName)}
              helperText={fieldErrors.organizationName}
            />
          </Stack>
        </div>
        <div className={styles['form-group']}>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">제안자명 *</Typography>
            <TextField
              required
              aria-label="제안자명"
              value={proposerName}
              onChange={(event) => {
                setProposerName(event.target.value);
                setFieldErrors((current) => ({ ...current, proposerName: '' }));
              }}
              size="small"
              error={Boolean(fieldErrors.proposerName)}
              helperText={fieldErrors.proposerName}
            />
          </Stack>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">전화번호 *</Typography>
            <TextField
              required
              type="tel"
              aria-label="전화번호"
              value={proposerPhone}
              onChange={(event) => {
                setProposerPhone(event.target.value);
                setFieldErrors((current) => ({ ...current, proposerPhone: '' }));
              }}
              slotProps={{ htmlInput: { inputMode: 'tel', autoComplete: 'tel' } }}
              size="small"
              error={Boolean(fieldErrors.proposerPhone)}
              helperText={fieldErrors.proposerPhone}
            />
          </Stack>
        </div>
        <div className={styles['form-group']}>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">이메일 주소 *</Typography>
            {formInfo.isLoggedIn && formInfo.paymentEmail ? (
              <Typography variant="body2">{formInfo.paymentEmail}</Typography>
            ) : (
              <TextField
                required
                type="email"
                aria-label="이메일 주소"
                value={proposerEmail}
                onChange={(event) => {
                  setProposerEmail(event.target.value);
                  setFieldErrors((current) => ({ ...current, proposerEmail: '' }));
                }}
                slotProps={{ htmlInput: { inputMode: 'email', autoComplete: 'email' } }}
                size="small"
                error={Boolean(fieldErrors.proposerEmail)}
                helperText={fieldErrors.proposerEmail}
              />
            )}
            {fieldErrors.proposerEmail ? <p className="alert popup-error">{fieldErrors.proposerEmail}</p> : null}
          </Stack>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">홈페이지 주소</Typography>
            <TextField
              aria-label="홈페이지 주소"
              type="url"
              value={homepageUrl}
              onChange={(event) => {
                setHomepageUrl(event.target.value);
                setFieldErrors((current) => ({ ...current, homepageUrl: '' }));
              }}
              size="small"
              error={Boolean(fieldErrors.homepageUrl)}
              helperText={fieldErrors.homepageUrl}
            />
          </Stack>
        </div>

        <Stack gap={0.5}>
          <Typography variant="subtitle2">제목 *</Typography>
          <TextField
            required
            aria-label="제목"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setFieldErrors((current) => ({ ...current, subject: '' }));
            }}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            size="small"
            error={Boolean(fieldErrors.subject)}
            helperText={fieldErrors.subject}
          />
        </Stack>
        <Stack gap={0.5}>
          <Typography variant="subtitle2">내용 *</Typography>
          <TextField
            required
            aria-label="내용"
            placeholder={'1. 제안 배경\n2. 세부 제안 내용\n3. 제휴 기대 효과'}
            multiline
            minRows={8}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setFieldErrors((current) => ({ ...current, content: '' }));
            }}
            size="small"
            error={Boolean(fieldErrors.content)}
            helperText={fieldErrors.content || '제안자의 권리 보호를 위해 특허출원되지 않은 기술은 핵심 기술에 대한 상세한 설명을 제외하고 작성해 주십시오.'}
          />
        </Stack>

        {formInfo.attachmentAvailable ? (
          <div className={styles['form-group']}>
            <FilePicker
              title="제안서 파일 첨부"
              file={proposalFile}
              inputRef={proposalFileInputRef}
              onChange={selectFile(setProposalFile)}
              onRemove={() => setProposalFile(null)}
            />
            <FilePicker
              title="회사(기관) 소개서 파일 첨부"
              file={introductionFile}
              inputRef={introductionFileInputRef}
              onChange={selectFile(setIntroductionFile)}
              onRemove={() => setIntroductionFile(null)}
            />
          </div>
        ) : null}
        {fieldErrors.attachment ? <p className="alert popup-error">{fieldErrors.attachment}</p> : null}
        <Stack gap={2}>
          <Stack>
            <div>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={personalInfoAgreed}
                    onChange={(event) => {
                      setPersonalInfoAgreed(event.target.checked);
                      setFieldErrors((current) => ({ ...current, personalInfoAgreed: '' }));
                    }}
                  />
                }
                label="개인정보 수집 및 이용에 동의합니다. (필수)"
              />
            </div>
            <div className="paper">
              <Typography variant="body2">
                데브허브 운영사 데브런닷스튜디오는 제휴를 희망하는 기업 및 개인을 대상으로 아래와 같이 개인정보를
                수집하고 있습니다.
              </Typography>
              <Stack>
                <Typography variant="body2">
                  1. 수집 개인정보 항목 : 회사명, 제안자명, 이메일 주소, 전화번호, 홈페이지 주소(제안에 필요한 경우)
                </Typography>
                <Typography variant="body2">
                  2. 개인정보의 수집 및 이용 목적 : 제휴 신청에 따른 본인 확인 및 원활한 의사소통 경로 확보, 제휴 제안
                  내용 확인
                </Typography>
                <Typography variant="body2">
                  3. 개인정보의 보유 및 이용 기간 : 제휴 제안 마지막 답변 시점으로부터 1개월간 보관 후 파기합니다.
                </Typography>
                <Typography variant="body2">
                  4. 동의 거부권리 안내 추가 : 위와 같은 개인정보 수집 동의를 거부할 수 있습니다. 다만 동의를 거부하는
                  경우 제휴 제안 신청이 제한될 수 있습니다.
                </Typography>
              </Stack>
              <Typography variant="body2">그 밖의 사항은 개인정보처리방침을 준수합니다.</Typography>
            </div>
          </Stack>
          <Stack>
            <div>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={noticeAgreed}
                    onChange={(event) => {
                      setNoticeAgreed(event.target.checked);
                      setFieldErrors((current) => ({ ...current, noticeAgreed: '' }));
                    }}
                  />
                }
                label="제휴 제안 유의사항을 확인했습니다. (필수)"
              />
            </div>
            <div className="paper">
              <Typography variant="body2">
                데브허브는 보내주신 제휴 제안을 검토한 후, 협업 또는 사업 진행이 가능하다고 판단되는 경우 제안자에게
                연락드립니다.
              </Typography>
              <Typography variant="body2">
                제안 내용은 데브허브가 이미 내부적으로 검토·진행 중인 내용, 제3자로부터 먼저 제안받은 내용과 유사하거나
                동일할 수 있습니다. 또한 당시의 서비스 방향, 운영 정책, 제휴 조건 등 여러 사정에 따라 제휴가 진행되지
                않을 수 있습니다.
              </Typography>
              <Typography variant="body2">
                제안 내용은 데브허브가 이미 내부적으로 검토·진행 중인 내용, 제3자로부터 먼저 제안받은 내용과 유사하거나
                동일할 수 있습니다. 또한 당시의 서비스 방향, 운영 정책, 제휴 조건 등 여러 사정에 따라 제휴가 진행되지
                않을 수 있습니다.
              </Typography>
              <Typography variant="body2">
                제안서와 첨부 자료에는 영업비밀, 기밀사항 또는 별도 보호가 필요한 사업 아이디어를 포함하지 않도록 유의해
                주세요. 특허, 디자인, 저작권 등 지식재산권의 공개 또는 공유가 필요한 제안은 출원 등 제안자의 권리 보호에
                필요한 조치를 마친 뒤 접수해 주세요.
              </Typography>
              <Typography variant="body2">
                등록하신 제휴 제안 내용과 관련 자료는 제휴 검토 및 답변을 위한 목적으로만 이용합니다. 제휴 제안 및 답변
                내역의 개인정보는 마지막 답변 시점부터 1개월간 보관한 뒤 파기합니다. 제안자가 추가 내용 요청에 30일 이내
                응답하지 않는 경우에도 해당 제안은 종료 처리 및 파기될 수 있습니다.
              </Typography>
            </div>
          </Stack>
        </Stack>
        {(fieldErrors.personalInfoAgreed || fieldErrors.noticeAgreed) ? (
          <p className="alert popup-error">{fieldErrors.personalInfoAgreed || fieldErrors.noticeAgreed}</p>
        ) : null}
        {!formInfo.attachmentAvailable ? (
          <Typography color="warning.main" sx={{ whiteSpace: 'pre-line' }}>
            현재 첨부파일이 포함된 제휴 제안은 일시적으로 접수할 수 없습니다.{`\n`}
            {formInfo.attachmentUnavailableNotice}
          </Typography>
        ) : null}
        <Stack direction="row" justifyContent="flex-end" gap={2} sx={{ mt: 2 }}>
          <Anchor href="/concierge/partnerships" className="button medium cancel">
            취소
          </Anchor>
          <button type="submit" className="button medium submit" disabled={isSubmitting || isSubmissionLocked}>
            제휴 제안 보내기
          </button>
        </Stack>
      </Stack>
      <FormErrorDialog
        open={Boolean(errorDialog)}
        title={errorDialog?.title ?? null}
        messages={errorDialog?.messages ?? []}
        onClose={() => setErrorDialog(null)}
      />
    </form>
  );
}
