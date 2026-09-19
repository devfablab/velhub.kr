import { NextRequest } from 'next/server';
import { getPartnershipProposal } from '@/lib/partnerships/server';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { proposal, error } = await getPartnershipProposal(proposalId);
  if (proposal) return Response.json(proposal);
  return Response.json({ error: error ?? '제휴 제안을 불러오지 못했습니다.' }, { status: 404 });
}
