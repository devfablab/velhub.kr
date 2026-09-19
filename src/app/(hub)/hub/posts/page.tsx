import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Container from '../menu';
import Opt, { PostsResponse } from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '포스트 - 마이허브 - 데브허브',
  description: '내가 작성한 포스트 목록',
};

export default async function PostsPage() {
  let initialData: PostsResponse | null = null;
  let initialError = '';

  try {
    const cookieStore = await cookies();
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || 'http';
    const response = await fetch(`${protocol}://${host}/api/hub/posts?page=1`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });
    const result = (await response.json()) as PostsResponse;
    if (!response.ok) throw new Error(result.message ?? '포스트를 불러오지 못했습니다.');
    initialData = result;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '포스트를 불러오지 못했습니다.';
  }

  return (
    <Container pageTitle="포스트" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <Opt initialData={initialData} initialError={initialError} />
        </div>
      </div>
    </Container>
  );
}
