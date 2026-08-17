import { redirect } from 'next/navigation';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  redirect(`/${siteName}/manage/payments/subscriptions`);
}
