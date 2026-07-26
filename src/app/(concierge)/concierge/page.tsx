import { Metadata } from 'next';
import { Stack, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { originTitle, Seo } from '@/lib/seo';
import Anchor from '@/components/Anchor';
import Container from './menu';
import styles from '@/app/concierge.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();

  return Seo({
    pageTitles: `컨시어지 - ${originTitle}`,
    pageTitle: `컨시어지`,
    pageDescription: `데브허브 고객센터`,
    pageImg: `https://velhub.xyz/og-etc.webp?ts=${timestamp}`,
    pagePath: '/concierge',
  });
}

const guideItems = [
  {
    href: '/concierge/faqs',
    title: '자주하는 질문',
    description: '계정, 사이트 운영, 결제, 정산 등 자주 묻는 내용을 확인합니다.',
    icon: <HelpOutlineRoundedIcon />,
  },
  {
    href: '/concierge/guideline',
    title: '가이드라인',
    description: '사이트, 게시판, 게시물, 댓글에 적용되는 운영 기준을 확인합니다.',
    icon: <MenuBookOutlinedIcon />,
  },
];

const supportItems = [
  {
    href: '/concierge/help',
    title: '신고센터',
    description: '불법정보, 불법촬영물, 개인정보 노출을 신고합니다.',
    icon: <CampaignOutlinedIcon />,
  },
  {
    href: '/concierge/rights',
    title: '권리보호센터',
    description: '명예훼손, 초상권, 사생활 등 권리침해를 신고합니다.',
    icon: <ShieldOutlinedIcon />,
  },
  {
    href: '/concierge/explains',
    title: '소명센터',
    description: '삭제 또는 이용 제한 처분에 대해 소명합니다.',
    icon: <RateReviewOutlinedIcon />,
  },
];

type ConciergeCardProps = {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

function ConciergeCard({ href, title, description, icon }: ConciergeCardProps) {
  return (
    <Anchor href={href} className={`paper ${styles['concierge-card']}`}>
      <span className={styles['concierge-card-icon']} aria-hidden="true">
        {icon}
      </span>
      <Stack className={styles['concierge-card-copy']} gap={1}>
        <Typography component="h3" variant="subtitle2">
          {title}
        </Typography>
        <Typography variant="body2">{description}</Typography>
      </Stack>
      <ArrowForwardRoundedIcon className={styles['concierge-card-arrow']} aria-hidden="true" />
    </Anchor>
  );
}

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['concierge-home']}`}>
          <section className={styles['concierge-intro']}>
            <Typography component="h1" variant="h6">
              무엇을 도와드릴까요?
            </Typography>
            <Typography variant="body2">
              서비스 이용 안내를 확인하거나 신고 및 소명 절차를 진행할 수 있습니다.
            </Typography>
          </section>

          <section className={styles['concierge-section']}>
            <Typography component="h2" variant="h6">
              이용 안내
            </Typography>
            <div className={`${styles['concierge-card-grid']} ${styles['guide-cards']}`}>
              {guideItems.map((item) => (
                <ConciergeCard key={item.href} {...item} />
              ))}
            </div>
          </section>

          <section className={styles['concierge-section']}>
            <Typography component="h2" variant="h6">
              신고 및 소명
            </Typography>
            <div className={`${styles['concierge-card-grid']} ${styles['support-cards']}`}>
              {supportItems.map((item) => (
                <ConciergeCard key={item.href} {...item} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </Container>
  );
}
