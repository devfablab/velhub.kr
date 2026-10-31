import { Metadata } from 'next';
import { LabsCategory, LabsStatus } from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '기능 연구소 - 데브허브',
  description: '데브허브 기능 제안 및 개선 연구소',
};

type Props = {
  searchParams: Promise<{
    page?: string;
    category?: string;
    status?: string;
    search?: string;
    my?: string;
  }>;
};

export type LabsIssueRow = {
  id: string;
  github_issue_number: number;
  user_id: string;
  user_name: string;
  category: LabsCategory;
  status: LabsStatus;
  title: string;
  created_at: string;
  updated_at: string;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const limit = 20;
  const category = params.category || '';
  const status = params.status || '';
  const search = params.search?.trim() || '';
  const isMy = params.my === 'true';

  const current = await getCurrentStigma();
  const db = getSupabaseAdmin();

  let query = db.from('concierge_labs_issues').select('*', { count: 'exact' });

  if (category) {
    query = query.eq('category', category);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.ilike('title', `%${search}%`);
  }

  if (isMy && current?.userId) {
    query = query.eq('user_id', current.userId);
  }

  const offset = (page - 1) * limit;
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <Opt
            initialIssues={(data as LabsIssueRow[]) ?? []}
            initialTotal={total}
            initialPage={page}
            initialTotalPages={totalPages}
            initialCategory={category}
            initialStatus={status}
            initialSearch={search}
            initialIsMy={isMy}
            isLoggedIn={Boolean(current?.userId)}
            initialError={error ? '목록을 불러오지 못했습니다.' : null}
          />
        </div>
      </div>
    </Container>
  );
}
