import { redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  redirect(`/${siteName}/manage/community-on-blog/posts`);
}
