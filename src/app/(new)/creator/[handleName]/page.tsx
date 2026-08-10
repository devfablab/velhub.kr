import Opt from './opt';

type Props = { params: Promise<{ handleName: string }> };

export default async function Page({ params }: Props) {
  const { handleName } = await params;
  return <Opt handleName={handleName} />;
}
