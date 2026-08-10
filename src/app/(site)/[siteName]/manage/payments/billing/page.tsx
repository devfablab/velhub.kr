import { redirect } from 'next/navigation';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  await context.params;
  redirect('/hub/memberships/plan');
}
