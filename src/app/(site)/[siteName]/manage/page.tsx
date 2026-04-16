import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName } = await params;

  redirect(`/${siteName}/manage/general`);
}
