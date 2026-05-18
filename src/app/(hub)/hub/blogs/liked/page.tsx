import Container from '../tab';
import LikedItems from '../../shared/likedItems';

export default function Page() {
  return (
    <main>
      <div className="container">
        <Container>
          <LikedItems siteType="blog" />
        </Container>
      </div>
    </main>
  );
}
