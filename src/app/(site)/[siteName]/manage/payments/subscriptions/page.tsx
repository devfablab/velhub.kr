import Stack from '@mui/material/Stack';
import Container from '../../menu';
import BoardSubscriptions from './board';
import SeriesSubscriptions from './series';

export default function Page() {
  return (
    <Container pageTitle="구독 관리">
      <Stack spacing={3}>
        <BoardSubscriptions />
        <SeriesSubscriptions />
      </Stack>
    </Container>
  );
}
