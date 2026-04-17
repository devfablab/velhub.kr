import { Box, Container, Stack, Typography } from '@mui/material';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { planId } = await context.params;

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h5" component="h1">
            요금제 기능 추가
          </Typography>

          <Opt planId={planId} />
        </Stack>
      </Box>
    </Container>
  );
}
