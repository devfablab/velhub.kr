'use client';

import { FormEvent, useState } from 'react';
import { Chip, Stack, TextField, Typography } from '@mui/material';
import type { PartnershipProposalDetail } from '@/lib/partnerships';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';

export default function Opt({
  proposalId,
  initialProposal,
  initialError,
}: {
  proposalId: string;
  initialProposal: PartnershipProposalDetail | null;
  initialError: string | null;
}) {
  const [proposal, setProposal] = useState(initialProposal);
  const [content, setContent] = useState('');
  const [contentError, setContentError] = useState('');
  const [errorDialog, setErrorDialog] = useState<{ title: string | null; messages: string[] } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    try {
      const response = await fetch(`/api/concierge/partnerships/${proposalId}`, { cache: 'no-store' });
      const result = (await response.json().catch(() => null)) as (PartnershipProposalDetail & { error?: string }) | null;
      if (!response.ok || !result) return false;
      setProposal(result);
      return true;
    } catch {
      return false;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const message = content.trim();
    if (!message) {
      const validationMessage = '추가 내용을 입력해 주세요.';
      setContentError(validationMessage);
      setErrorDialog({ title: '추가 내용 확인', messages: [validationMessage] });
      return;
    }
    setContentError('');
    setErrorDialog(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/concierge/partnerships/${proposalId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || !result) {
        if (response.status >= 500 || !result?.error) {
          setErrorDialog({ title: null, messages: ['처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'] });
        } else {
          setContentError(result.error);
          setErrorDialog({ title: '추가 내용 확인', messages: [result.error] });
        }
        return;
      }
      setContent('');
      if (!(await load())) {
        setErrorDialog({
          title: '추가 내용 등록 완료',
          messages: ['추가 내용은 등록되었습니다. 화면을 새로 불러오지 못했습니다. 새로고침 후 확인해 주세요.'],
        });
      }
    } catch {
      setErrorDialog({ title: null, messages: ['인터넷 연결을 확인한 뒤 다시 시도해 주세요.'] });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!proposal) return <ScreenState kind="error">{initialError ?? '제휴 제안을 불러오지 못했습니다.'}</ScreenState>;

  return (
    <Stack gap={3}>
      <div className="paper">
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="subtitle2">{proposal.subject}</Typography>
            <Typography variant="body2">{formatDateTimeDetail(proposal.created_at)}</Typography>
            <div>
              <Chip label={proposal.category_label} />
            </div>
          </Stack>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{proposal.content}</Typography>
        </Stack>
      </div>
      {proposal.response_channel === 'email' ? (
        <ScreenState>답변은 이메일을 확인하세요.</ScreenState>
      ) : (
        <Stack gap={2}>
          {proposal.messages.map((message) => (
            <div className="paper" key={message.id}>
              <Stack gap={1}>
                <Typography variant="subtitle2">
                  {message.author_type === 'admin' ? '관리자 답변' : '추가 내용'}
                </Typography>
                <Typography variant="body2">{formatDateTimeDetail(message.created_at)}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
              </Stack>
            </div>
          ))}
          <form onSubmit={(event) => void submit(event)} className="paper">
            <Stack gap={2}>
              <Typography variant="subtitle2">추가 내용 작성</Typography>
              <TextField
                required
                multiline
                minRows={6}
                aria-label="추가 내용"
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setContentError('');
                }}
                disabled={isSubmitting}
                error={Boolean(contentError)}
                helperText={contentError}
              />
              <Stack direction="row" justifyContent="flex-end" gap={2}>
                <Anchor href="/concierge/partnerships" className="button medium cancel">
                  목록
                </Anchor>
                <button type="submit" className="button medium submit" disabled={isSubmitting || !content.trim()}>
                  추가 내용 보내기
                </button>
              </Stack>
            </Stack>
          </form>
        </Stack>
      )}
      <FormErrorDialog
        open={Boolean(errorDialog)}
        title={errorDialog?.title ?? null}
        messages={errorDialog?.messages ?? []}
        onClose={() => setErrorDialog(null)}
      />
    </Stack>
  );
}
