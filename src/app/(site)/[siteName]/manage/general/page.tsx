import { Box, Container, Stack, Typography } from '@mui/material';
import SiteManageBreadcrumb from '../breadcrumb';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            설정
          </Typography>

          <SiteManageBreadcrumb siteName={siteName} current="general" />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
