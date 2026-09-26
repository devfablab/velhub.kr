import { redirect } from 'next/navigation';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;

  redirect(`/${siteName}/manage/contents/posts`);
}
