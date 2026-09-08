import { redirect } from 'next/navigation';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const selection = Array.isArray(params.selection) ? params.selection[0] : params.selection;
  const query = selection ? `?selection=${encodeURIComponent(selection)}` : '';

  redirect(`/hub/purchase/memberships${query}`);
}
