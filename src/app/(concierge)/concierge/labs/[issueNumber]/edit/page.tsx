import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getGitHubIssue } from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Container from '../../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

type Props = {
  params: Promise<{ issueNumber: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { issueNumber } = await params;
  return {
    title: `#${issueNumber} 제안 수정 - 기능 연구소 - 데브허브`,
    description: '데브허브 기능 연구소 제안 수정',
  };
}

export default async function Page({ params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    notFound();
  }

  const current = await getCurrentStigma();
  if (!current?.userId) {
    redirect('/auth/sign-in');
  }

  const db = getSupabaseAdmin();
  const { data: dbIssue, error: dbError } = await db
    .from('concierge_labs_issues')
    .select('*')
    .eq('github_issue_number', issueNumber)
    .maybeSingle();

  if (dbError || !dbIssue) {
    notFound();
  }

  const isAuthor = current.userId === dbIssue.user_id;
  const isAdmin = current.role === 'admin';

  if (!isAuthor && !isAdmin) {
    redirect(`/concierge/labs/${issueNumber}`);
  }

  let gitHubIssue;
  try {
    gitHubIssue = await getGitHubIssue({ issueNumber });
  } catch (err) {
    console.error('Failed to get GitHub issue:', err);
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>기능 연구소 제안 수정</h1>
          <Opt issueNumber={issueNumber} initialDbIssue={dbIssue} initialGitHubIssue={gitHubIssue} />
        </div>
      </div>
    </Container>
  );
}
