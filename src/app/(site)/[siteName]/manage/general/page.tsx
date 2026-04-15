import { Box, Container, Stack, Typography } from '@mui/material';
import SiteManageBreadcrumb from '../breadcrumb';
import Opt from './opt';
import StaffTabs from '../../tabs';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;

  return (
    <Container maxWidth="md">
      <Box sx={{ pt: 1, pb: 8 }}>
        <Stack spacing={3}>
          <StaffTabs pageTitle="기본 설정" />

          <SiteManageBreadcrumb siteName={siteName} current="general" />

          <Opt siteName={siteName} />
        </Stack>
      </Box>
    </Container>
  );
}
