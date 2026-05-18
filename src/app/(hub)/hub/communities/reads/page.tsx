import Container from '../tab';
import ReadsItems from '../../shared/readsItems';

export default function Page() {
  return (
    <main>
      <div className="container">
        <Container>
          <ReadsItems siteType="community" />
        </Container>
      </div>
    </main>
  );
}
