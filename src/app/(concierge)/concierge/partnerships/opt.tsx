'use client';

import { Stack, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import type { PartnershipProposalRow } from '@/lib/partnerships';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';

const cellSx = { whiteSpace: 'nowrap' } as const;

export default function Opt({
  initialProposals,
  initialError,
}: {
  initialProposals: PartnershipProposalRow[];
  initialError: string | null;
}) {
  return (
    <Stack gap={2}>
      {initialError ? <ScreenState kind="error">{initialError}</ScreenState> : null}
      {!initialError && initialProposals.length === 0 ? <ScreenState>제휴 제안 내역이 없습니다.</ScreenState> : null}
      {initialProposals.length ? (
        <Stack className="paper" gap={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={cellSx}>제휴 희망 영역</TableCell>
                <TableCell sx={cellSx}>제목</TableCell>
                <TableCell sx={cellSx}>답변 상태</TableCell>
                <TableCell sx={cellSx}>접수일</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {initialProposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell sx={cellSx}>{proposal.category_label}</TableCell>
                  <TableCell sx={cellSx}>
                    <Anchor href={`/concierge/partnerships/${proposal.id}`} className="link">
                      {proposal.subject}
                    </Anchor>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    {proposal.response_channel === 'email'
                      ? proposal.email_response_status === 'answered'
                        ? '이메일 답변함'
                        : '이메일 미답변'
                      : proposal.has_new_answer
                        ? '신규 답변'
                        : '답변 확인'}
                  </TableCell>
                  <TableCell sx={cellSx}>{new Date(proposal.created_at).toLocaleDateString('ko-KR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Stack direction="row" justifyContent="flex-end" gap={2}>
            <Anchor href="/concierge/partnerships/new" className="button medium action">
              제휴 제안하기
            </Anchor>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
