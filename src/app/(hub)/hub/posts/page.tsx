import { Metadata } from 'next';
import Container from '../menu';
import Opt from './opt';

export const metadata: Metadata = {
  title: '내가 쓴 글 - 마이허브 - 데브허브',
  description: '내가 작성한 글 목록',
};

export default function PostsPage() {
  return (
    <Container pageTitle="내가 쓴 글" pageBack="/hub">
      <div className="container">
        <Opt />
      </div>
    </Container>
  );
}
