export const guidelineReportCategories = [
  'hate',
  'spam',
  'youth_harmful',
  'illegal_info',
  'obscene',
  'violence',
  'child_youth_protection',
  'offensive',
] as const;

export type GuidelineReportCategory = (typeof guidelineReportCategories)[number];

export type ReportTargetType = 'site' | 'board' | 'post' | 'comment';

export type GuidelineReportItem = {
  value: GuidelineReportCategory;
  title: string;
  descriptions: string[];
};

const postGuidelineReportItems: GuidelineReportItem[] = [
  {
    value: 'hate',
    title: '혐오/차별적/생명경시/욕설 표현입니다.',
    descriptions: [
      '직·간접적인 욕설을 사용하여 타인에게 모욕감을 주는 내용',
      '생명을 경시하거나 비하하는 내용',
      '계층/지역/종교/성별 등을 혐오하거나 비하하는 표현',
      '신체/외모/취향 등을 경멸하는 표현',
      '특정 개인이나 집단을 대상으로 한 지속적인 괴롭힘, 학대 및 사이버 불링(Cyberbullying) 표현',
    ],
  },
  {
    value: 'spam',
    title: '스팸홍보/도배입니다.',
    descriptions: [
      '사행성 오락이나 도박을 홍보하거나 권장하는 내용 등의 부적절한 스팸 홍보 행위',
      '동일하거나 유사한 내용 반복 게시',
      '조회수를 올리기 위해 제목, 썸네일, 설명란에 본문과 무관한 허위 정보를 기재하여 이용자를 기만하는 내용',
    ],
  },
  {
    value: 'youth_harmful',
    title: '청소년에게 유해한 내용입니다.',
    descriptions: [
      '가출/왕따/학교폭력/자살 등 청소년에게 부정적인 영향을 조성하는 내용',
      '자해를 조장하거나 거식증 등 신체 건강을 심각하게 해치는 행위를 유도하는 내용',
    ],
  },
  {
    value: 'illegal_info',
    title: '불법정보를 포함하고 있습니다.',
    descriptions: [
      '불법 행위, 불법 링크에 대한 정보 제공',
      '불법 상품을 판매하거나 유도하는 내용',
      '심각한 신체적 부상을 초래할 수 있는 위험한 도전(챌린지)이나 무기 제작, 해킹 등 범죄를 유도하는 내용',
    ],
  },
  {
    value: 'obscene',
    title: '음란물입니다.',
    descriptions: [
      '성적 수치심을 일으키는 내용',
      '아동이나 청소년을 성 대상으로 한 표현',
      '과도하거나 의도적인 신체 노출',
      '음란한 행위와 관련된 부적절한 내용',
    ],
  },
  {
    value: 'violence',
    title: '폭력적이거나 잔혹한 내용입니다.',
    descriptions: [
      '실제 폭력 상황, 유혈 사태, 심각한 부상 또는 사체의 모습을 여과 없이 노출하여 혐오감을 주는 내용',
      '동물 학대 등 생명에게 잔혹한 행위를 가하는 내용',
    ],
  },
  {
    value: 'child_youth_protection',
    title: '아동 및 청소년 보호 위반입니다.',
    descriptions: ['미성년자가 참여하는 위험한 행위나 청소년의 정서적·신체적 학대를 유도하거나 방치하는 내용'],
  },
  {
    value: 'offensive',
    title: '불쾌한 표현이 있습니다.',
    descriptions: [
      '상기 항목에 명시되지 않았으나, 상식적인 사회 통념상 타인에게 심한 혐오감, 공포심, 불쾌감을 유발하는 내용',
    ],
  },
];

const boardGuidelineReportItems: GuidelineReportItem[] = [
  {
    value: 'hate',
    title: '혐오/차별적/생명경시/욕설 표현을 포함한 게시판입니다.',
    descriptions: [
      '게시판명, 설명, 공지, 운영 방식 등에 직·간접적인 욕설이나 모욕적 표현이 포함된 경우',
      '생명을 경시하거나 비하하는 방향으로 게시판이 운영되는 경우',
      '계층/지역/종교/성별 등을 혐오하거나 비하하는 게시판인 경우',
      '신체/외모/취향 등을 경멸하거나 조롱하는 목적의 게시판인 경우',
      '특정 개인이나 집단을 대상으로 한 지속적인 괴롭힘, 학대 및 사이버 불링을 유도하거나 방치하는 게시판인 경우',
    ],
  },
  {
    value: 'spam',
    title: '스팸홍보/도배 목적의 게시판입니다.',
    descriptions: [
      '사행성 오락이나 도박을 홍보하거나 권장하는 등 부적절한 스팸 홍보 목적으로 운영되는 경우',
      '동일하거나 유사한 내용의 반복 게시를 유도하거나 방치하는 경우',
      '조회수나 유입을 올리기 위해 게시판명, 설명, 공지 등에 실제 운영 내용과 무관한 허위 정보를 기재하여 이용자를 기만하는 경우',
    ],
  },
  {
    value: 'youth_harmful',
    title: '청소년에게 유해한 게시판입니다.',
    descriptions: [
      '가출/왕따/학교폭력/자살 등 청소년에게 부정적인 영향을 조성하는 내용을 다루거나 유도하는 경우',
      '자해를 조장하거나 거식증 등 신체 건강을 심각하게 해치는 행위를 유도하는 경우',
      '청소년이 쉽게 접근 가능한 형태로 유해한 활동을 조장하거나 방치하는 경우',
    ],
  },
  {
    value: 'illegal_info',
    title: '불법정보를 포함한 게시판입니다.',
    descriptions: [
      '불법 행위, 불법 링크, 불법 자료에 대한 정보를 제공하거나 공유하는 경우',
      '불법 상품의 판매, 거래, 구매를 유도하는 경우',
      '심각한 신체적 부상을 초래할 수 있는 위험한 도전, 무기 제작, 해킹 등 범죄를 유도하거나 관련 정보를 공유하는 경우',
    ],
  },
  {
    value: 'obscene',
    title: '음란물을 다루는 게시판입니다.',
    descriptions: [
      '성적 수치심을 일으키는 내용을 게시하거나 공유하도록 운영되는 경우',
      '아동이나 청소년을 성 대상으로 한 표현을 포함하거나 유도하는 경우',
      '과도하거나 의도적인 신체 노출을 포함한 내용을 다루는 경우',
      '음란한 행위와 관련된 부적절한 내용을 게시하거나 공유하도록 운영되는 경우',
    ],
  },
  {
    value: 'violence',
    title: '폭력적이거나 잔혹한 내용을 다루는 게시판입니다.',
    descriptions: [
      '실제 폭력 상황, 유혈 사태, 심각한 부상 또는 사체의 모습을 여과 없이 노출하는 내용을 다루는 경우',
      '동물 학대 등 생명에게 잔혹한 행위를 가하는 내용을 게시하거나 공유하도록 운영되는 경우',
    ],
  },
  {
    value: 'child_youth_protection',
    title: '아동 및 청소년 보호를 위반한 게시판입니다.',
    descriptions: [
      '미성년자가 참여하는 위험한 행위를 유도하거나 공유하는 경우',
      '청소년의 정서적·신체적 학대를 유도하거나 방치하는 경우',
      '아동·청소년 보호 기준에 반하는 내용을 다루거나 운영하는 경우',
    ],
  },
  {
    value: 'offensive',
    title: '불쾌한 표현이 있는 게시판입니다.',
    descriptions: [
      '상기 항목에 명시되지 않았으나, 게시판명, 설명, 공지, 운영 방식 등이 사회 통념상 타인에게 심한 혐오감, 공포심, 불쾌감을 유발하는 경우',
    ],
  },
];

const siteGuidelineReportItems: GuidelineReportItem[] = [
  {
    value: 'hate',
    title: '혐오/차별적/생명경시/욕설 표현을 포함한 사이트입니다.',
    descriptions: [
      '사이트명, 소개, 공지, 운영 방향 등에 직·간접적인 욕설이나 모욕적 표현이 포함된 경우',
      '생명을 경시하거나 비하하는 방향으로 사이트가 운영되는 경우',
      '계층/지역/종교/성별 등을 혐오하거나 비하하는 사이트인 경우',
      '신체/외모/취향 등을 경멸하거나 조롱하는 목적의 사이트인 경우',
      '특정 개인이나 집단을 대상으로 한 지속적인 괴롭힘, 학대 및 사이버 불링을 유도하거나 방치하는 사이트인 경우',
    ],
  },
  {
    value: 'spam',
    title: '스팸홍보/도배 목적의 사이트입니다.',
    descriptions: [
      '사행성 오락이나 도박을 홍보하거나 권장하는 등 부적절한 스팸 홍보 목적으로 운영되는 경우',
      '동일하거나 유사한 내용의 반복 게시를 유도하거나 방치하는 경우',
      '조회수나 유입을 올리기 위해 사이트명, 소개, 공지 등에 실제 운영 내용과 무관한 허위 정보를 기재하여 이용자를 기만하는 경우',
    ],
  },
  {
    value: 'youth_harmful',
    title: '청소년에게 유해한 사이트입니다.',
    descriptions: [
      '가출/왕따/학교폭력/자살 등 청소년에게 부정적인 영향을 조성하는 내용을 다루거나 유도하는 경우',
      '자해를 조장하거나 거식증 등 신체 건강을 심각하게 해치는 행위를 유도하는 경우',
      '청소년이 쉽게 접근 가능한 형태로 유해한 활동을 조장하거나 방치하는 경우',
    ],
  },
  {
    value: 'illegal_info',
    title: '불법정보를 포함한 사이트입니다.',
    descriptions: [
      '불법 행위, 불법 링크, 불법 자료에 대한 정보를 제공하거나 공유하는 경우',
      '불법 상품의 판매, 거래, 구매를 유도하는 경우',
      '심각한 신체적 부상을 초래할 수 있는 위험한 도전, 무기 제작, 해킹 등 범죄를 유도하거나 관련 정보를 공유하는 경우',
    ],
  },
  {
    value: 'obscene',
    title: '음란물을 다루는 사이트입니다.',
    descriptions: [
      '성적 수치심을 일으키는 내용을 게시하거나 공유하도록 운영되는 경우',
      '아동이나 청소년을 성 대상으로 한 표현을 포함하거나 유도하는 경우',
      '과도하거나 의도적인 신체 노출을 포함한 내용을 다루는 경우',
      '음란한 행위와 관련된 부적절한 내용을 게시하거나 공유하도록 운영되는 경우',
    ],
  },
  {
    value: 'violence',
    title: '폭력적이거나 잔혹한 내용을 다루는 사이트입니다.',
    descriptions: [
      '실제 폭력 상황, 유혈 사태, 심각한 부상 또는 사체의 모습을 여과 없이 노출하는 내용을 다루는 경우',
      '동물 학대 등 생명에게 잔혹한 행위를 가하는 내용을 게시하거나 공유하도록 운영되는 경우',
    ],
  },
  {
    value: 'child_youth_protection',
    title: '아동 및 청소년 보호를 위반한 사이트입니다.',
    descriptions: [
      '미성년자가 참여하는 위험한 행위를 유도하거나 공유하는 경우',
      '청소년의 정서적·신체적 학대를 유도하거나 방치하는 경우',
      '아동·청소년 보호 기준에 반하는 내용을 다루거나 운영하는 경우',
    ],
  },
  {
    value: 'offensive',
    title: '불쾌한 표현이 있는 사이트입니다.',
    descriptions: [
      '상기 항목에 명시되지 않았으나, 사이트명, 소개, 공지, 운영 방향 등이 사회 통념상 타인에게 심한 혐오감, 공포심, 불쾌감을 유발하는 경우',
    ],
  },
];

export const guidelineReportItemsByTargetType = {
  site: siteGuidelineReportItems,
  board: boardGuidelineReportItems,
  post: postGuidelineReportItems,
  comment: postGuidelineReportItems,
} satisfies Record<ReportTargetType, GuidelineReportItem[]>;

export function isGuidelineReportCategory(value: unknown): value is GuidelineReportCategory {
  return typeof value === 'string' && guidelineReportCategories.includes(value as GuidelineReportCategory);
}

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return value === 'site' || value === 'board' || value === 'post' || value === 'comment';
}
