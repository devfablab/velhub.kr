import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import Link from '@mui/material/Link';

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

type PlanRow = {
  id: string;
  category_key: string;
  category_label: string;
  plan_key: string;
  plan_label: string;
  price: number | string;
  product_type: 'service' | 'custom';
};

type FeatureRow = {
  id: string;
  is_editor_image: boolean;
  is_member: boolean;
  is_board_attachment: boolean;
  count_subpage: number | string;
  count_board: number | string;
  count_user: number | string;
  plan_id: string;
} | null;

function formatPrice(value: number | string) {
  const priceNumber = typeof value === 'number' ? value : Number(value ?? 0);
  return `${priceNumber.toLocaleString()} 원`;
}

function formatProductType(value: 'service' | 'custom') {
  return value === 'service' ? '서비스' : '커스텀';
}

function formatBoolean(value: boolean) {
  return value ? '가능' : '불가';
}

export default async function Page(context: RouteContext) {
  const { planId } = await context.params;

  const headerList = await headers();
  const host = headerList.get('host');
  const protocol = headerList.get('x-forwarded-proto') || 'http';
  const baseUrl = `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/plans/${planId}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
  }).catch(() => null);

  if (!response || !response.ok) {
    notFound();
  }

  const result = (await response.json()) as {
    plan: PlanRow;
    feature: FeatureRow;
  };

  const plan = result.plan;
  const feature = result.feature;

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            요금제 보기
          </Typography>

          <Stack direction="row" spacing={1.5}>
            <Button
              component={Link}
              href={`/concierge/admin/plans/${plan.id}/edit`}
              underline="none"
              variant="outlined"
            >
              요금제 수정
            </Button>

            {feature ? (
              <Button
                component={Link}
                href={`/concierge/admin/plans/${plan.id}/feature/edit`}
                underline="none"
                variant="outlined"
              >
                기능 수정
              </Button>
            ) : (
              <Button
                component={Link}
                href={`/concierge/admin/plans/${plan.id}/feature/new`}
                underline="none"
                variant="contained"
              >
                기능 추가
              </Button>
            )}
          </Stack>

          <Paper elevation={0} sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack spacing={0.5}>
                <Typography>요금제 카테고리 영문명</Typography>
                <Typography>{plan.category_key}</Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography>요금제 카테고리 한글명</Typography>
                <Typography>{plan.category_label}</Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography>요금제 영문명</Typography>
                <Typography>{plan.plan_key}</Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography>요금제 한글명</Typography>
                <Typography>{plan.plan_label}</Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography>가격</Typography>
                <Typography>{formatPrice(plan.price)}</Typography>
              </Stack>

              <Stack spacing={0.5}>
                <Typography>상품 종류</Typography>
                <Typography>{formatProductType(plan.product_type)}</Typography>
              </Stack>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 3 }}>
            {feature ? (
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography>에디터에 이미지 삽입 가능</Typography>
                  <Typography>{formatBoolean(feature.is_editor_image)}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography>멤버 추가 가능</Typography>
                  <Typography>{formatBoolean(feature.is_member)}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography>게시판에 파일첨부 가능</Typography>
                  <Typography>{formatBoolean(feature.is_board_attachment)}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography>추가 가능한 페이지수</Typography>
                  <Typography>{String(feature.count_subpage)}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography>추가 가능한 게시판수</Typography>
                  <Typography>{String(feature.count_board)}</Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography>추가 가능한 회원수</Typography>
                  <Typography>{String(feature.count_user)}</Typography>
                </Stack>
              </Stack>
            ) : (
              <Typography>기능 등록이 필요합니다</Typography>
            )}
          </Paper>
        </Stack>
      </Box>
    </Container>
  );
}
