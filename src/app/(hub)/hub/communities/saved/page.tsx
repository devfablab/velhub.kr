import Container from '../tab';
import SavedItems from '../../shared/savedItems';

export default function Page() {
  return (
    <main>
      <div className="container">
        <Container>
          <SavedItems siteType="community" />
        </Container>
      </div>
    </main>
  );
}
