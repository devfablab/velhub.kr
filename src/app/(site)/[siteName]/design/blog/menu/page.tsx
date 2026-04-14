import { Box, Container, Stack, Typography } from '@mui/material';
import BlogDesignBreadcrumb from '../breadcrumb';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            메뉴 설정
          </Typography>

          <BlogDesignBreadcrumb siteName={siteName} current="menu" />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
