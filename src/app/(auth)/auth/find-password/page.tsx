import { Metadata } from 'next';
import Opt from './opt';

export const metadata: Metadata = {
  title: '비밀번호 찾기 - 데브허브',
  description: '비밀번호 찾기 페이지',
};

export default function Page() {
  return <Opt />;
}
