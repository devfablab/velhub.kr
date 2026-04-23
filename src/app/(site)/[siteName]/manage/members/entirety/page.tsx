import Opt from './opt';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName } = await params;

  return <Opt siteName={siteName} />;
}
