import type { Metadata } from 'next';
import Image from 'next/image';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import BookmarkAddedRoundedIcon from '@mui/icons-material/BookmarkAddedRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CommentRoundedIcon from '@mui/icons-material/CommentRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LocalLibraryRoundedIcon from '@mui/icons-material/LocalLibraryRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import QuestionAnswerRoundedIcon from '@mui/icons-material/QuestionAnswerRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SubscriptionsRoundedIcon from '@mui/icons-material/SubscriptionsRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded';
import { originTitle, Seo } from '@/lib/seo';
import Anchor from '@/components/Anchor';
import DownloadMenu from './downloadMenu';
import Opt from './opt';
import WritingTabs from './writingTabs';
import styles from '@/app/about.module.sass';

type CardItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  isMembership?: boolean;
  image?: string;
};

const guideUrl = (slug: string) => `/luvelhub/b/${slug}`;

const spaceItems: CardItem[] = [
  {
    title: '혼자 쓰고 싶어요',
    description: '1인 블로그에서 내 이름으로 글을 쓰고 독자와 가깝게 만나요.',
    icon: <PersonOutlineRoundedIcon />,
    href: guideUrl('499128886917'),
  },
  {
    title: '함께 쓰고 싶어요',
    description: '팀 블로그에서 회사, 스터디, 동아리처럼 여럿이 함께 글을 써요.',
    icon: <GroupsRoundedIcon />,
    href: guideUrl('499128886917'),
  },
  {
    title: '함께 모이고 싶어요',
    description: '커뮤니티에서 관심사가 같은 사람들과 글과 댓글로 이야기해요.',
    icon: <ForumRoundedIcon />,
    href: guideUrl('3220865270'),
  },
  {
    title: '읽고 싶어요',
    description: '라운지에서 여러 블로그와 커뮤니티의 글을 둘러보고 구독해요.',
    icon: <ExploreRoundedIcon />,
    href: guideUrl('3220865272'),
  },
];

const comparisonRows: { label: string; single: string | boolean; team: string | boolean }[] = [
  { label: '글을 쓰는 사람', single: '나', team: '운영자, 매니저, 멤버' },
  { label: '팀원 초대와 역할', single: false, team: true },
  { label: '팀원 소개', single: false, team: true },
  { label: '블로그 구독과 후원', single: true, team: false },
  { label: '연재 구독', single: true, team: true },
  { label: '공지사항', single: true, team: false },
  { label: '공동 집필', single: true, team: false },
  { label: '블로그 안의 작은 커뮤니티', single: true, team: false },
];

const featureItems: CardItem[] = [
  {
    title: '블로그 안의 작은 커뮤니티',
    description:
      '내 블로그 구독자끼리 이야기 나누는 공간을 열어요. 오래 구독한 독자에게는 기간에 따라 멤버십팬 배지가 붙어요.',
    icon: <Diversity3RoundedIcon />,
    href: guideUrl('144323707883'),
    image: '/about/small-community.webp',
  },
  {
    title: '공동 집필',
    description:
      '다른 블로거와 한 편의 글을 함께 써요. 번갈아 고치고 바뀐 곳을 비교하다가, 공개하면 두 블로그에 함께 올라가요.',
    icon: <HistoryEduRoundedIcon />,
    href: guideUrl('027297406268'),
    image: '/about/co-writing.webp',
  },
  {
    title: '워딩 프로파일러',
    description: '혐오 표현과 차단 단어를 자동으로 걸러요. 띄어쓰기나 기호를 섞어 써도 찾아내요.',
    icon: <ShieldRoundedIcon />,
    href: guideUrl('591214657884'),
    image: '/about/wording-profiler.webp',
  },
  {
    title: '연재 구독과 포스팅 소장',
    description: '연재를 통째로 구독하거나, 읽고 싶은 글만 한 편씩 소장해요. 소장한 글은 계속 볼 수 있어요.',
    icon: <AutoStoriesRoundedIcon />,
    href: guideUrl('019769758768'),
    image: '/about/series.webp',
  },
  {
    title: '라운지의 모먼트',
    description:
      '새로 문을 연 사이트, 요즘 뜨는 글과 사이트가 모이는 곳이에요. 내 사이트와 연재글을 직접 올릴 수도 있어요.',
    icon: <AutoAwesomeRoundedIcon />,
    href: guideUrl('783455240890'),
    isMembership: true,
    image: '/about/moment.webp',
  },
  {
    title: '커뮤니티 단체 채팅',
    description: '커뮤니티 멤버끼리 실시간으로 이야기해요.',
    icon: <QuestionAnswerRoundedIcon />,
    href: guideUrl('665512024956'),
    image: '/about/group-chat.webp',
  },
];

const blogItems: CardItem[] = [
  {
    title: '내 도메인으로',
    description:
      '내가 가진 도메인으로 블로그를 운영하고, 검색엔진과 Google Analytics를 연결해요. 공유할 때 보이는 이미지는 글마다 자동으로 만들어져요.',
    icon: <LanguageRoundedIcon />,
    href: guideUrl('307667976683'),
    isMembership: true,
  },
  {
    title: '댓글 방식 고르기',
    description:
      '데브허브 댓글, Disqus, Giscus 중에서 골라요. 개발 블로그라면 Giscus로 GitHub Discussions를 댓글로 쓸 수 있어요.',
    icon: <CommentRoundedIcon />,
    href: guideUrl('490771741965'),
  },
  {
    title: '공지사항',
    description: '독자에게 알릴 소식을 따로 모아 둬요.',
    icon: <CampaignRoundedIcon />,
    href: guideUrl('608078058650'),
  },
  {
    title: '팀원 소개',
    description: '팀 블로그는 팀원마다 학력, 수상, 프로젝트, 경력을 보여줄 수 있어요.',
    icon: <BadgeRoundedIcon />,
    href: guideUrl('324830673893'),
  },
  {
    title: '광고와 상품',
    description: '블로그에 광고를 붙이고, 연재글에 소개하고 싶은 상품을 걸어요.',
    icon: <StorefrontRoundedIcon />,
    href: guideUrl('885483395006'),
  },
];

const communityItems: CardItem[] = [
  {
    title: '가입 받기',
    description: '오픈가입이나 초대가입, 가입 신청 기간과 가입 질문까지 정해요.',
    icon: <HowToRegRoundedIcon />,
  },
  {
    title: '글쓰기 조건',
    description: '새 멤버가 언제부터 글과 댓글을 쓸 수 있는지 정해요.',
    icon: <RuleRoundedIcon />,
  },
  {
    title: '멤버 등급',
    description: '활동에 따라 자동으로 올라가는 등급을 만들어요.',
    icon: <MilitaryTechRoundedIcon />,
  },
  {
    title: '매니저',
    description: '커뮤니티 전체부터 게시판 하나까지 나눠 맡겨요.',
    icon: <ManageAccountsRoundedIcon />,
  },
  {
    title: '비공개 게시판',
    description: '멤버와 운영진이 1:1로 이야기하는 문의 창구를 둬요.',
    icon: <LockRoundedIcon />,
  },
  {
    title: '꾸미기와 통계',
    description: '홈 화면과 메뉴, 디스코드나 카카오톡 같은 외부 링크를 정하고 접속자와 가입자 흐름을 봐요.',
    icon: <InsightsRoundedIcon />,
  },
];

const revenueItems: CardItem[] = [
  {
    title: '구독',
    description: '블로그나 연재를 매월 구독해요.',
    icon: <SubscriptionsRoundedIcon />,
    href: guideUrl('019769758768'),
  },
  {
    title: '소장',
    description: '읽고 싶은 글만 한 편씩 사서 계속 봐요.',
    icon: <BookmarkAddedRoundedIcon />,
    href: guideUrl('019769758768'),
  },
  {
    title: '후원',
    description: '블로그, 연재, 글을 응원하며 후원하고 후원 댓글을 남겨요.',
    icon: <VolunteerActivismRoundedIcon />,
  },
];

const safetyItems: CardItem[] = [
  {
    title: '워딩 프로파일러',
    description: '혐오 표현이 들어간 글, 댓글, 채팅을 자동으로 걸러요. 운영자는 막을 단어를 더할 수 있어요.',
    icon: <ShieldRoundedIcon />,
    href: guideUrl('591214657884'),
  },
  {
    title: '신고와 권리보호',
    description: '문제가 있는 콘텐츠는 신고센터로, 내 권리를 침해한 글은 권리보호센터로 알려주세요.',
    icon: <FlagRoundedIcon />,
  },
  { title: '소명', description: '내 콘텐츠가 신고로 제한됐다면 소명 의견을 낼 수 있어요.', icon: <GavelRoundedIcon /> },
  {
    title: '본인 확인과 결제 보호',
    description: '결제나 커뮤니티 개설처럼 필요한 순간에만 본인인증을 하고, 미성년 회원의 결제를 보호해요.',
    icon: <VerifiedUserRoundedIcon />,
  },
];

const activityItems: CardItem[] = [
  {
    title: '마이허브',
    description: '참여한 사이트, 좋아요, 저장한 글, 읽은 글, 즐겨찾는 블로그, 구입내역을 모아 봐요.',
    icon: <DashboardRoundedIcon />,
    href: guideUrl('626399929845'),
  },
  {
    title: '작가의 서재, 독자의 서재',
    description: '여러 사이트에 쓴 내 글을 한곳에 모으고, 좋아하는 작가를 팔로우해요.',
    icon: <LocalLibraryRoundedIcon />,
    href: guideUrl('626399929845'),
    isMembership: true,
  },
  {
    title: '모먼트에 알리기',
    description: '내 사이트와 연재글을 라운지에 올려 더 많은 사람에게 보여줘요.',
    icon: <RocketLaunchRoundedIcon />,
    href: guideUrl('783455240890'),
    isMembership: true,
  },
];

const togetherItems: CardItem[] = [
  {
    title: '기능 연구소',
    description: '바라는 기능을 제안하고, 진행 상태를 지켜봐요.',
    icon: <ScienceRoundedIcon />,
    href: guideUrl('943950942788'),
  },
  {
    title: '컨시어지',
    description: '자주하는 질문, 문의, 채널톡 상담으로 언제든 물어보세요.',
    icon: <SupportAgentRoundedIcon />,
    href: guideUrl('921362837890'),
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();
  return Seo({
    pageTitles: `처음 오셨나요? - ${originTitle}`,
    pageTitle: '처음 오셨나요?',
    pageDescription:
      '혼자 쓰는 1인 블로그부터 함께 쓰는 팀 블로그, 관심사를 나누는 커뮤니티까지. 나에게 맞는 공간을 만들어 보세요.',
    pageImg: `https://velhub.xyz/og-about.webp?ts=${timestamp}`,
    pagePath: '/about',
  });
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className={styles['section-header']} data-reveal>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

function Cards({ items, columns, isLarge }: { items: CardItem[]; columns: string; isLarge?: boolean }) {
  return (
    <ul className={`${styles.cards} ${styles[`cards-${columns}`]}`}>
      {items.map((item, index) => (
        <li
          key={item.title}
          className={`${styles.card} ${isLarge ? styles['card-large'] : ''}`}
          style={{ '--reveal-order': index } as React.CSSProperties}
          data-reveal
        >
          {item.image ? (
            <div className={styles.illustration}>
              <Image src={item.image} alt="" width={1200} height={800} sizes="(max-width: 767px) 100vw, 360px" />
            </div>
          ) : null}
          <span className={styles.tile}>{item.icon}</span>
          <strong>{item.title}</strong>
          {item.isMembership ? <em className={styles.badge}>멤버십 기능</em> : null}
          <p>{item.description}</p>
          {item.href ? (
            <Anchor href={item.href} className={styles.more}>
              자세히 보기 <span aria-hidden="true">→</span>
            </Anchor>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ComparisonValue({ value }: { value: string | boolean }) {
  if (typeof value === 'string') {
    return <>{value}</>;
  }

  return value ? <CheckRoundedIcon aria-label="가능" /> : <span aria-label="해당 없음">-</span>;
}

export default function Page() {
  return (
    <main className={styles.about}>
      <section className={styles.hero}>
        <Image src="/together.webp" alt="" fill preload sizes="100vw" className={styles['hero-background']} />
        <div className={styles.inner}>
          <span className={styles.eyebrow}>처음 오셨나요?</span>
          <h1>
            콘텐츠를 중심으로,
            <br />
            각자의 공간을 만드는 곳
          </h1>
          <p>
            혼자 쓰는 1인 블로그부터 함께 쓰는 팀 블로그, 관심사를 나누는 커뮤니티까지. 나에게 맞는 공간을 만들어
            보세요.
          </p>
          <div className={styles.buttons}>
            <Anchor href="/auth/sign-up" className={styles['button-primary']}>
              시작하기
            </Anchor>
            <Anchor href="/" className={styles['button-outline']}>
              라운지 둘러보기
            </Anchor>
          </div>
          <div className={styles['hero-illustration']}>
            <Image
              src="/about/hero.webp"
              alt=""
              width={2240}
              height={880}
              preload
              sizes="(max-width: 1159px) 100vw, 1120px"
            />
          </div>
        </div>
      </section>

      <Opt />

      <section id="space" className={styles.section}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="어디서 시작할까요"
            title="나에게 맞는 공간을 골라보세요"
            description="하고 싶은 것을 고르면 맞는 공간을 알려드려요."
          />
          <Cards items={spaceItems} columns="four" />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.inner}>
          <SectionHeader eyebrow="블로그 고르기" title="1인 블로그와 팀 블로그, 한눈에 비교해요" />
          <div className={styles.comparison} data-reveal>
            <table>
              <thead>
                <tr>
                  <th scope="col">기능</th>
                  <th scope="col">1인 블로그</th>
                  <th scope="col">팀 블로그</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={row.label} style={{ '--reveal-order': index } as React.CSSProperties}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <ComparisonValue value={row.single} />
                    </td>
                    <td>
                      <ComparisonValue value={row.team} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.footnote} data-reveal>
            <p>1인 블로그로 시작해서 언제든 팀 블로그로 바꿀 수 있어요.</p>
            <Anchor href={guideUrl('499128886917')} className={styles.more}>
              1인 블로그와 팀 블로그 자세히 보기 <span aria-hidden="true">→</span>
            </Anchor>
          </div>
        </div>
      </section>

      <section id="features" className={`${styles.section} ${styles['section-bright']}`}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="데브허브의 특장점"
            title="데브허브라서 할 수 있는 것"
            description="쓰는 사람과 읽는 사람, 모이는 사람 모두를 위해 만든 기능이에요."
          />
          <Cards items={featureItems} columns="three" isLarge />
        </div>
      </section>

      <section id="writing" className={styles.section}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="글쓰기"
            title="쓰는 즐거움"
            description="마크다운과 일반 편집을 오가며 쓰고, 미리보기를 나란히 보며 다듬어요."
          />
          <div data-reveal>
            <WritingTabs />
          </div>
        </div>
      </section>

      <section id="blog" className={`${styles.section} ${styles['section-bright']}`}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="블로그"
            title="블로그를 내 방식대로"
            description="주소부터 댓글, 공지와 팀원 소개까지 내 블로그에 맞게 정해요."
          />
          <Cards items={blogItems} columns="three" />
        </div>
      </section>

      <section id="community" className={styles.section}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="커뮤니티"
            title="커뮤니티를 내 방식대로"
            description="누구를 어떻게 받을지, 누구와 함께 운영할지 운영자가 직접 정해요."
          />
          <Cards items={communityItems} columns="three" />
          <div className={styles.footnote} data-reveal>
            <Anchor href={guideUrl('242218350650')} className={styles.more}>
              커뮤니티 운영 자세히 보기 <span aria-hidden="true">→</span>
            </Anchor>
          </div>
        </div>
      </section>

      <section id="revenue" className={`${styles.section} ${styles['section-bright']}`}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="수익"
            title="창작을 이어가는 방법"
            description="좋아하는 글을 응원하는 방법이 곧 작가가 계속 쓸 수 있는 힘이 돼요."
          />
          <Cards items={revenueItems} columns="three" />
          <div className={styles.footnote} data-reveal>
            <p>작가 신청을 하면 받은 금액을 정산받을 수 있어요. 결제와 환불 내역은 마이허브에서 확인해요.</p>
          </div>
        </div>
      </section>

      <section id="safety" className={styles.section}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="안심"
            title="안심하고 머무는 곳"
            description="누구나 편하게 쓰고 읽을 수 있도록 지켜요."
          />
          <Cards items={safetyItems} columns="four" />
        </div>
      </section>

      <section id="activity" className={`${styles.section} ${styles['section-bright']}`}>
        <div className={styles.inner}>
          <SectionHeader
            eyebrow="내 활동"
            title="내 활동은 한곳에"
            description="여기저기 흩어진 내 글과 활동을 모아 봐요."
          />
          <Cards items={activityItems} columns="three" />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.inner}>
          <SectionHeader eyebrow="함께 만들어요" title="함께 만드는 데브허브" />
          <Cards items={togetherItems} columns="two" />
        </div>
      </section>

      <section className={styles.closing}>
        <div className={styles.inner}>
          <h2>천천히 오래 남는 콘텐츠를 위해</h2>
          <p>
            글을 쓰고 싶은 사람도, 커뮤니티를 만들고 싶은 사람도, 좋아하는 콘텐츠를 오래 읽고 싶은 사람도 편하게 머물 수
            있는 곳을 만들어가고 있어요.
          </p>
          <div className={styles.buttons}>
            <Anchor href="/new/blog" className={styles['button-primary']}>
              블로그 만들기
            </Anchor>
            <Anchor href="/new/community" className={styles['button-primary']}>
              커뮤니티 만들기
            </Anchor>
            <DownloadMenu />
            <Anchor href="/" className={styles['button-outline']}>
              라운지 둘러보기
            </Anchor>
          </div>
        </div>
      </section>
    </main>
  );
}
