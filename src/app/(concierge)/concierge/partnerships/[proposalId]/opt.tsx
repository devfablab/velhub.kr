'use client';

import { FormEvent, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Chip, Stack, TextField, Typography } from '@mui/material';
import type { PartnershipProposalDetail } from '@/lib/partnerships';
import Anchor from '@/components/Anchor';
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
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    const response = await fetch(`/api/concierge/partnerships/${proposalId}`, { cache: 'no-store' });
    const result = (await response.json().catch(() => null)) as (PartnershipProposalDetail & { error?: string }) | null;
    if (!response.ok || !result) throw new Error(result?.error ?? '제휴 제안 상세를 불러오지 못했습니다.');
    setProposal(result);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = content.trim();
    if (!message) return;
    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/concierge/partnerships/${proposalId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? '추가 내용을 보내지 못했습니다.');
      setContent('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '추가 내용을 보내지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!proposal) return <ScreenState kind="error">{initialError ?? '제휴 제안을 불러오지 못했습니다.'}</ScreenState>;

  return (
    <Stack gap={3}>
      {error ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="paper">
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="subtitle2">{proposal.subject}</Typography>
            <Typography variant="body2">{new Date(proposal.created_at).toLocaleString('ko-KR')}</Typography>
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
                <Typography variant="body2">{new Date(message.created_at).toLocaleString('ko-KR')}</Typography>
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
                onChange={(event) => setContent(event.target.value)}
                disabled={isSubmitting}
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
    </Stack>
  );
}
