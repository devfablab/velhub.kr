import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getGitHubIssue, getGitHubIssueComments, LabsIssueComment } from '@/lib/github/labs';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

type Props = {
  params: Promise<{ issueNumber: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { issueNumber } = await params;
  return {
    title: `#${issueNumber} 제안 상세 - 기능 연구소 - 데브허브`,
    description: '데브허브 기능 연구소 제안 상세 보기',
  };
}

export default async function Page({ params }: Props) {
  const { issueNumber: issueNumberParam } = await params;
  const issueNumber = Number(issueNumberParam);

  if (!issueNumber || Number.isNaN(issueNumber)) {
    notFound();
  }

  const db = getSupabaseAdmin();
  const current = await getCurrentStigma();

  const { data: dbIssue, error: dbError } = await db
    .from('concierge_labs_issues')
    .select('*')
    .eq('github_issue_number', issueNumber)
    .maybeSingle();

  if (dbError || !dbIssue) {
    notFound();
  }

  let gitHubIssue;
  let comments: LabsIssueComment[] = [];
  try {
    const [fetchedIssue, fetchedComments] = await Promise.all([
      getGitHubIssue({ issueNumber }),
      getGitHubIssueComments({ issueNumber }),
    ]);
    gitHubIssue = fetchedIssue;
    comments = fetchedComments;
  } catch (err) {
    console.error('Failed to load GitHub data:', err);
  }

  const isAuthor = Boolean(current?.userId && current.userId === dbIssue.user_id);
  const isAdmin = Boolean(current?.role === 'admin');

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>기능 연구소 제안 상세</h1>
          <Opt
            issueNumber={issueNumber}
            initialDbIssue={dbIssue}
            initialGitHubIssue={gitHubIssue}
            initialComments={comments}
            isAuthor={isAuthor}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </Container>
  );
}
