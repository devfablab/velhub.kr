import { Metadata } from 'next';
import Opt from './opt';

export const metadata: Metadata = {
  title: '데브허브 시작하기',
  description: '데브허브 시작하기',
};

export default function Page() {
  return <Opt />;
}
