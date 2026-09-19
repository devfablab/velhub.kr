export type ManageMenuKind =
  | 'contents'
  | 'design'
  | 'join'
  | 'members'
  | 'settings'
  | 'team'
  | 'payments'
  | 'stats'
  | 'reports';

export type ManageTabMenuItem = {
  href: string;
  label: string;
  startsWith?: boolean;
};

export function getManageTabMenuItems(
  menu: ManageMenuKind | undefined,
  siteName: string,
  siteType: 'blog' | 'community',
): ManageTabMenuItem[] {
  if (menu === 'contents') {
    return [
      { href: `/${siteName}/manage/contents/posts`, label: '글', startsWith: true },
      { href: `/${siteName}/manage/contents/pages`, label: '페이지', startsWith: true },
    ];
  }

  if (menu === 'design') {
    return siteType === 'blog'
      ? [
          { href: `/${siteName}/manage/design/blog/fonts`, label: '기본 서체' },
          { href: `/${siteName}/manage/design/blog/comment`, label: '댓글' },
          { href: `/${siteName}/manage/design/blog/menu`, label: '메뉴' },
          { href: `/${siteName}/manage/design/blog/links`, label: '링크' },
        ]
      : [
          { href: `/${siteName}/manage/design/community/home`, label: '홈 설정' },
          { href: `/${siteName}/manage/design/community/menu`, label: '메뉴 설정' },
          { href: `/${siteName}/manage/design/community/links`, label: '링크' },
        ];
  }

  if (menu === 'join') {
    return [
      { href: `/${siteName}/manage/join/conditions`, label: '가입정보' },
      { href: `/${siteName}/manage/join/approved`, label: '가입신청' },
      { href: `/${siteName}/manage/join/invite`, label: '초대관리' },
      { href: `/${siteName}/manage/join/banned`, label: '가입불가' },
      { href: `/${siteName}/manage/join/managers`, label: '매니저' },
    ];
  }

  if (menu === 'members') {
    return [
      { href: `/${siteName}/manage/members/entirety`, label: '활동멤버' },
      { href: `/${siteName}/manage/members/blocked`, label: '활동정지' },
      { href: `/${siteName}/manage/members/withdrawn`, label: '탈퇴멤버' },
      { href: `/${siteName}/manage/members/levels`, label: '멤버등급' },
    ];
  }

  if (menu === 'payments') {
    return [
      { href: `/${siteName}/manage/payments/donation`, label: '후원' },
      { href: `/${siteName}/manage/payments/subscriptions`, label: '구독' },
    ];
  }

  if (menu === 'settings') {
    return [
      { href: `/${siteName}/manage/settings/general`, label: '기본설정' },
      { href: `/${siteName}/manage/settings/advanced`, label: '추가설정' },
    ];
  }

  if (menu === 'team') return [{ href: `/${siteName}/manage/team/members`, label: '팀원 목록' }];

  if (menu === 'stats') {
    return [
      { href: `/${siteName}/manage/stats/dashboard`, label: '대시보드' },
      ...(siteType === 'blog'
        ? [
            { href: `/${siteName}/manage/stats/hot-post`, label: '인기글 순위' },
            { href: `/${siteName}/manage/stats/repeat-visit`, label: '재방문율' },
          ]
        : [
            { href: `/${siteName}/manage/stats/join`, label: '가입자수' },
            { href: `/${siteName}/manage/stats/inactive-user`, label: '비활동 유저' },
          ]),
    ];
  }

  if (menu === 'reports') {
    return [
      { href: `/${siteName}/manage/reports/boards`, label: '게시판 신고' },
      { href: `/${siteName}/manage/reports/posts`, label: '게시물 신고' },
      { href: `/${siteName}/manage/reports/comments`, label: '댓글 신고' },
    ];
  }

  return [];
}
