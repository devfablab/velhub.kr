/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  inquiryInformationRequestLabels,
  inquiryResolutionLabels,
  inquiryStatusLabels,
  inquiryTypeLabels,
  type InquiryInformationRequestType,
  type InquiryResolutionCode,
  type InquiryStatus,
  type InquiryType,
} from '@/lib/concierge/inquiries';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import InquiryDetails from '@/components/concierge/InquiryDetails';
import styles from '@/app/concierge.module.sass';

type Inquiry = {
  inquiry_type: InquiryType;
  status: InquiryStatus;
  title: string | null;
  content: string;
  resolution_code: InquiryResolutionCode | null;
  resolution_summary: string | null;
  payment_control_requested_at: string | null;
  payment_control_selected_at: string | null;
  pg_cancellation_unavailable_at: string | null;
  manual_refund_ready_at: string | null;
  inquiry_subtype: string | null;
  inquiry_orders: { payment_id: string }[];
  inquiry_bug_details: Parameters<typeof InquiryDetails>[0]['bugDetails'];
  inquiry_payment_details: Parameters<typeof InquiryDetails>[0]['paymentDetails'];
  evidenceUrl: string | null;
  created_at: string;
  information_request_type: InquiryInformationRequestType | null;
  information_requested_at: string | null;
  information_due_at: string | null;
  inquiry_messages: {
    id: string;
    sender_type: 'requester' | 'admin';
    message_type: 'message' | 'information_request' | 'information_response' | 'system';
    message: string;
    created_at: string;
  }[];
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

export default function Opt() {
  const { inquiryId } = useParams<{ inquiryId: string }>();
  const searchParams = useSearchParams();
  const certificateInputRef = useRef<HTMLInputElement | null>(null);
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingControl, setSavingControl] = useState(false);
  const [paymentControlMode, setPaymentControlMode] = useState('');
  const [holderType, setHolderType] = useState('account_holder');
  const [holderName, setHolderName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [savingResponse, setSavingResponse] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [isWithdrawConfirmOpen, setIsWithdrawConfirmOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  async function load() {
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}`, { cache: 'no-store' });
    const result = (await response.json().catch(() => null)) as { inquiry?: Inquiry; error?: string } | null;
    if (!response.ok || !result?.inquiry) {
      setError(result?.error ?? '문의를 불러오지 못했습니다.');
      return;
    }
    setInquiry(result.inquiry);
  }

  useEffect(() => {
    void load();
  }, [inquiryId]);

  async function upload() {
    if (!file) return;
    setError('');
    setSuccess('');
    setUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const isFamilyCertificate = inquiry?.information_request_type === 'family_relation_certificate';
    const endpoint = isFamilyCertificate ? 'family-relation-certificate' : 'evidence';
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '파일을 제출하지 못했습니다.');
    else {
      setSuccess(isFamilyCertificate ? '가족관계증명서 PDF를 제출했습니다.' : '증빙 파일을 제출했습니다.');
      setFile(null);
      if (certificateInputRef.current) certificateInputRef.current.value = '';
      await load();
    }
    setUploading(false);
  }

  async function saveResponse() {
    setSavingResponse(true);
    setError('');
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: responseMessage }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '추가 정보 답변을 제출하지 못했습니다.');
    else {
      setResponseMessage('');
      setSuccess('추가 정보 답변을 제출했습니다.');
      await load();
    }
    setSavingResponse(false);
  }

  async function withdrawInquiry() {
    setWithdrawing(true);
    setError('');
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/withdraw`, { method: 'POST' });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '문의를 철회하지 못했습니다.');
    else {
      setIsWithdrawConfirmOpen(false);
      await load();
    }
    setWithdrawing(false);
  }

  function closeWithdrawConfirm() {
    if (withdrawing) return;
    setIsWithdrawConfirmOpen(false);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    if (
      selectedFile &&
      inquiry?.information_request_type !== 'family_relation_certificate' &&
      selectedFile.size > 1024 * 1024
    ) {
      setFile(null);
      setError('첨부 파일은 1MB 이하만 가능합니다.');
      event.target.value = '';
      return;
    }
    setError('');
    setFile(selectedFile);
  }

  function removeFile() {
    setFile(null);
    if (certificateInputRef.current) certificateInputRef.current.value = '';
  }

  async function savePaymentControl() {
    if (paymentControlMode !== 'blocked_until_adult' && paymentControlMode !== 'guardian_auth_required') {
      setError('향후 결제 방침을 선택해 주세요.');
      return;
    }
    setSavingControl(true);
    setError('');
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/payment-minor-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: paymentControlMode }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '결제 방침을 저장하지 못했습니다.');
    else {
      setSuccess('향후 결제 방침을 저장했습니다.');
      await load();
    }
    setSavingControl(false);
  }

  async function saveRefundAccount() {
    const response = await fetch(`/api/concierge/contact/inquiries/${inquiryId}/refund-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holderType, holderName, bankCode, accountNumber }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(result?.error ?? '반환 계좌를 저장하지 못했습니다.');
    else {
      setSuccess('예외 반환 계좌를 저장했습니다.');
      await load();
    }
  }

  if (error && !inquiry)
    return (
      <p className="alert error">
        <ErrorOutlineRoundedIcon />
        <span>{error}</span>
      </p>
    );
  if (!inquiry) return null;
  const canUpload =
    (inquiry.status === 'info_requested' &&
      (inquiry.information_request_type === 'family_relation_certificate' ||
        inquiry.information_request_type === 'evidence')) ||
    (inquiry.status === 'received' &&
      !inquiry.evidenceUrl &&
      ['bug_report', 'payment_refund_error'].includes(inquiry.inquiry_type));
  const latestRequest = [...inquiry.inquiry_messages]
    .filter((message) => message.message_type === 'information_request')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  return (
    <div className={styles.inquiry}>
      <div className="paper">
        {inquiry.title ? (
          <h2>
            <Chip label={inquiryTypeLabels[inquiry.inquiry_type]} size="small" /> {inquiry.title}
          </h2>
        ) : (
          <div>
            <Chip label={inquiryTypeLabels[inquiry.inquiry_type]} size="small" />
          </div>
        )}
        <Stack>
          <Typography variant="subtitle2">상태</Typography>
          <Typography variant="body2">{inquiryStatusLabels[inquiry.status]}</Typography>
        </Stack>
        <Stack>
          <Typography variant="subtitle2">문의 날짜와 시간</Typography>
          <Typography variant="body2">{formatDateTimeDetail(inquiry.created_at)}</Typography>
        </Stack>
        <InquiryDetails
          inquiryType={inquiry.inquiry_type}
          inquirySubtype={inquiry.inquiry_subtype}
          content={inquiry.content}
          bugDetails={inquiry.inquiry_bug_details}
          paymentDetails={inquiry.inquiry_payment_details}
          paymentId={inquiry.inquiry_orders?.[0]?.payment_id}
          evidenceUrl={inquiry.evidenceUrl}
        />
        {inquiry.resolution_code ? (
          <Stack>
            <Typography variant="subtitle2">결과</Typography>
            <Typography variant="body2">{inquiryResolutionLabels[inquiry.resolution_code]}</Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">
              {inquiry.resolution_summary}
            </Typography>
          </Stack>
        ) : null}
      </div>
      {inquiry.inquiry_messages.length ? (
        <div className="paper">
          <h2>요청 / 답변 내역</h2>
          <Stack gap={2}>
            {[...inquiry.inquiry_messages]
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map((message) => (
                <Stack key={message.id} gap={0.5}>
                  <Typography variant="subtitle2">
                    {message.sender_type === 'admin' ? '관리자' : '나'} / {formatDateTimeDetail(message.created_at)}
                  </Typography>
                  <Typography variant="body2" whiteSpace="pre-wrap">
                    {message.message}
                  </Typography>
                </Stack>
              ))}
          </Stack>
        </div>
      ) : null}
      {inquiry.status === 'info_requested' && latestRequest ? (
        <div className="paper">
          <h2>추가 정보 제출</h2>
          <Stack>
            <Typography variant="subtitle2">
              {inquiry.information_request_type
                ? inquiryInformationRequestLabels[inquiry.information_request_type]
                : '요청받은 정보'}
            </Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">
              {latestRequest.message}
            </Typography>
          </Stack>
          <Stack>
            {inquiry.information_due_at ? (
              <Stack>
                <Typography variant="subtitle2">제출 기한</Typography>
                <Typography variant="body2">{formatDateTimeDetail(inquiry.information_due_at)}</Typography>
              </Stack>
            ) : null}
          </Stack>
          {inquiry.information_request_type === 'text_response' ? (
            <>
              <Typography variant="subtitle2">추가 정보 답변</Typography>
              <TextField
                required
                multiline
                minRows={5}
                fullWidth
                size="small"
                value={responseMessage}
                onChange={(event) => setResponseMessage(event.target.value)}
                slotProps={{ htmlInput: { maxLength: 10000 } }}
              />
              <button
                type="button"
                className="button medium submit"
                disabled={!responseMessage.trim() || savingResponse}
                onClick={() => void saveResponse()}
              >
                {savingResponse ? '제출 중' : '답변 제출'}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {canUpload ? (
        <div className="paper">
          <h2>
            {inquiry.information_request_type === 'family_relation_certificate'
              ? '가족관계증명서 제출'
              : '증빙 파일 제출'}
          </h2>
          {searchParams.get('attachment') === 'failed' ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>문의는 접수됐지만 첨부 파일을 저장하지 못했습니다. 이 화면에서 다시 제출해 주세요.</span>
            </p>
          ) : null}
          {inquiry.information_request_type === 'family_relation_certificate' ? (
            <>
              <Typography variant="body2">
                대한민국 법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서 발급받은 가족관계증명서 PDF를 제출해
                주세요.
              </Typography>
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>3개월이 지난 가족관계증명서 제출은 반려사유가 됩니다.</span>
              </p>
            </>
          ) : (
            <Typography variant="body2">PDF, JPG, PNG 또는 WEBP 파일을 1MB 이하로 제출해 주세요.</Typography>
          )}

          <VisuallyHiddenInput
            ref={certificateInputRef}
            type="file"
            accept={
              inquiry.information_request_type === 'family_relation_certificate'
                ? 'application/pdf,.pdf'
                : 'application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp'
            }
            onChange={chooseFile}
          />
          <Stack direction="row" gap={1} alignItems="center">
            <button type="button" className="button small action" onClick={() => certificateInputRef.current?.click()}>
              파일 선택
            </button>
            {file ? (
              <button type="button" className="button small danger" onClick={removeFile}>
                파일 삭제
              </button>
            ) : null}
          </Stack>
          {file ? <Typography variant="body2">{file.name}</Typography> : null}
          <Box>
            <button
              type="button"
              className="button medium submit"
              disabled={!file || uploading}
              onClick={() => void upload()}
            >
              {uploading ? '제출 중' : '제출'}
            </button>
          </Box>
        </div>
      ) : null}
      {inquiry.information_request_type === 'payment_control' && !inquiry.payment_control_selected_at ? (
        <div className="paper">
          <h2>향후 결제 / 구매 / 후원 방침</h2>
          <Typography variant="body2">청약취소 처리 후 만 19세가 되기 전까지 적용할 방침을 선택해 주세요.</Typography>
          <RadioGroup value={paymentControlMode} onChange={(event) => setPaymentControlMode(event.target.value)}>
            <FormControlLabel
              value="blocked_until_adult"
              control={<Radio />}
              label="이 계정에서 만 19세가 될 때까지 결제 / 구매 / 후원을 허용하지 않습니다."
              disabled={savingControl}
            />
            <FormControlLabel
              value="guardian_auth_required"
              control={<Radio />}
              label="이후 결제마다 법정대리인 본인인증 후 허용합니다."
              disabled={savingControl}
            />
          </RadioGroup>
          <Box>
            <button
              type="button"
              className="button medium submit"
              disabled={!paymentControlMode || savingControl}
              onClick={() => void savePaymentControl()}
            >
              {savingControl ? '저장 중' : '방침 저장'}
            </button>
          </Box>
        </div>
      ) : null}
      {inquiry.information_request_type === 'refund_account' && !inquiry.manual_refund_ready_at ? (
        <div className="paper">
          <h2>반환 계좌 입력</h2>
          <Typography variant="body2">
            원결제수단 취소가 불가능하여 계정주 본인, 부 또는 모 명의 계좌로 전액을 반환합니다.
          </Typography>
          <Typography variant="subtitle2">계좌 명의자</Typography>
          <TextField
            select
            fullWidth
            size="small"
            value={holderType}
            onChange={(event) => setHolderType(event.target.value)}
          >
            <MenuItem value="account_holder">계정주 본인</MenuItem>
            <MenuItem value="father">부</MenuItem>
            <MenuItem value="mother">모</MenuItem>
          </TextField>
          <Typography variant="subtitle2">예금주명</Typography>
          <TextField
            fullWidth
            size="small"
            value={holderName}
            onChange={(event) => setHolderName(event.target.value)}
          />
          <Typography variant="subtitle2">은행 코드</Typography>
          <TextField fullWidth size="small" value={bankCode} onChange={(event) => setBankCode(event.target.value)} />
          <Typography variant="subtitle2">계좌번호</Typography>
          <TextField
            fullWidth
            size="small"
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
          />
          <button type="button" className="button medium submit" onClick={() => void saveRefundAccount()}>
            반환 계좌 저장
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{error}</span>
        </p>
      ) : null}
      {success ? (
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>{success}</span>
        </p>
      ) : null}
      <Stack direction="row" justifyContent="flex-end" gap={2}>
        <Anchor href="/concierge/contact/inquiries" className="button medium close">
          뒤로가기
        </Anchor>
        {inquiry.status !== 'closed' ? (
          <button
            type="button"
            className="button medium danger"
            disabled={withdrawing}
            onClick={() => setIsWithdrawConfirmOpen(true)}
          >
            {withdrawing ? '철회 중' : '문의 철회'}
          </button>
        ) : null}
      </Stack>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isWithdrawConfirmOpen}
          onClose={closeWithdrawConfirm}
          className="VhiDrawer-bottom"
        >
          <h2>문의 철회</h2>
          <button
            type="button"
            className="close-button"
            onClick={closeWithdrawConfirm}
            disabled={withdrawing}
            aria-label="문의 철회 팝업 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Typography variant="subtitle2">
              이 문의를 철회하시겠어요? 철회한 문의는 다시 처리할 수 없습니다.
            </Typography>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={closeWithdrawConfirm}
                disabled={withdrawing}
              >
                취소
              </button>
              <button
                type="button"
                className="button medium danger"
                onClick={() => void withdrawInquiry()}
                disabled={withdrawing}
              >
                {withdrawing ? '철회 중' : '문의 철회'}
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isWithdrawConfirmOpen}
          onClose={closeWithdrawConfirm}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>문의 철회</DialogTitle>
          <button
            type="button"
            className="close-button"
            onClick={closeWithdrawConfirm}
            disabled={withdrawing}
            aria-label="문의 철회 팝업 닫기"
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Typography variant="subtitle2">
              이 문의를 철회하시겠어요? 철회한 문의는 다시 처리할 수 없습니다.
            </Typography>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={closeWithdrawConfirm} disabled={withdrawing}>
              취소
            </button>
            <button
              type="button"
              className="button medium danger"
              onClick={() => void withdrawInquiry()}
              disabled={withdrawing}
            >
              {withdrawing ? '철회 중' : '문의 철회'}
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
