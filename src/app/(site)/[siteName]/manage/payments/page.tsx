import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  await params;

  redirect('/hub/memberships/plan');
}
