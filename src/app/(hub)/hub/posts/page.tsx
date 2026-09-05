import { Metadata } from 'next';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/hub.module.sass';

export const metadata: Metadata = {
  title: '내가 쓴 글 - 마이허브 - 데브허브',
  description: '내가 작성한 글 목록',
};

export default function PostsPage() {
  return (
    <Container pageTitle="내가 쓴 글" pageBack="/hub">
      <div className="container">
        <div className={`content ${styles.content} ${styles['hub-content']}`}>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
