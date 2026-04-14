import Opt from './opt';

type PageProps = {
  params: Promise<{
    siteName: string;
    token: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName, token } = await params;

  return <Opt siteName={siteName} token={token} />;
}
