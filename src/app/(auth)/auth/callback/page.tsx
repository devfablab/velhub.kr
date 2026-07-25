import { Metadata } from 'next';
import Opt from './opt';

export const metadata: Metadata = {
  title: '인증 - 데브허브',
  description: '인증 페이지',
};

export default function Page() {
  return <Opt />;
}
