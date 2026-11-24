# PLAN.md

> 마지막 갱신: 2026-11-24 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 접속 기록 (설정 화면)
- 테스트 상태: 로컬 측정만 함 (라운지 첫 화면 4~5초 → 0.3초 안팎)
- 미커밋 변경 요약: 공개 데이터 Redis 저장본, DB 변경 번호 장치, 라운지 적용

## 방식

- 누가 봐도 같은 데이터만 저장해 두고 재사용 (`src/lib/publicCache.ts`의 `readPublicCache`, `readPublicResponse`)
  - 1차: 서버 메모리, 2차: Upstash Redis(일본), 없으면 DB
  - 매번 서울 DB에서 변경 번호만 확인 (Redis는 일본이라 가벼운 조회는 메모리가 핵심)
- DB 트리거가 글, 사이트, 게시판, 프로필, 별명, 카테고리, 연재, 블로그 설정, 블로그 링크, 블로그 커뮤니티, 광고, 커뮤니티 설정이 바뀔 때 `public_cache_versions` 번호를 올림
  - 태그: `posts`, `sites`, `people`, `site:{사이트 주소}`
- 로컬 측정은 서울 DB까지 왕복 시간이 커서 실서버 속도와 다름. 실서버 비교는 클로이가 함
  - 조회수, 좋아요 수, 회원 수, 글 수 같은 숫자만 바뀔 때는 올리지 않음
- 읽을 때 저장본의 번호와 DB 번호가 다르면 DB에서 새로 읽음 (velman, 예약 발행, SQL 직접 수정도 반영)
- 저장본마다 최대 보관 시간을 둠 (라운지 글 목록 60초, 사이트 순위 300초)
- 로그인한 사람마다 다른 데이터는 저장하지 않음
- 대기 화면 없이 서버 시간만 줄임

## 5. 완료한 것

- [x] `public_cache_versions` 테이블과 트리거 (linked DB 적용 완료)
- [x] `src/lib/publicCache.ts`
- [x] 라운지 API 3개 저장본 적용 (`api/home/new-sites`, `api/home/category-sites`, `api/home/posts` 검색 제외)
- [x] 라운지 화면 3개가 서버 자신에게 보내던 요청을 직접 호출로 변경 (`(lounge)/page.tsx`, `lounge/blog/page.tsx`, `lounge/community/page.tsx`)

- [x] 사이트 정보(공통 검사가 매 화면 하던 조회) 저장본 (`src/lib/site/siteState.server.ts`)
- [x] 블로그 홈 데이터 직접 호출과 저장본 (`(site)/[siteName]/page.tsx`)
- [x] 공개 블로그의 블로그 프로필, 블로그 링크 저장본 (`api/info/general/site/[siteName]`, `api/manage/design/blog/links`)
- [x] 헤더 API의 방문 수 세기를 응답 뒤로 (`api/header/site`)

- [x] 링크 미리보기 저장본 1시간 (`api/link-preview`)
- [x] 글 내용 API: 권한 확인 뒤 조회 15개를 동시에 시작 (응답 동일 확인, `api/boards/[boardName]/[contentId]/route.ts`)
- [x] 글 화면: 사이트 조회와 글 내용 조회 동시 시작, 읽은 글 기록은 응답 뒤로
- [x] 버그: 조회수 중복 방지 쿠키가 브라우저에 안 가서 새로고침마다 조회수가 오르던 것 → 조회수 올리기를 브라우저에서 호출 (`[contentId]/opt.tsx`, `board/content/opt.tsx`)

- [x] 게시판 목록 화면: 사이트와 게시판 조회를 한 번에, 인기글은 맨 처음에 시작 (`[boardName]/page.tsx`)
- [x] 게시판 목록 API: 사이트 확인 뒤 작성자 찾기, 로그인 확인, 블로그 설정, 게시판 조회를 동시에 시작 (`api/boards/[boardName]/route.ts`)
- [x] 카테고리, 태그 화면: 사이트와 카테고리(태그) 조회를 한 번에, 카테고리는 로그인 확인을 글 목록과 동시에
- [x] 연재 화면: 연재 확인 뒤 구독 설정, 구독 상태, 후원 상태, 글, 로그인 확인을 동시에 (`s/[seriesName]/page.tsx`)
- [x] 작가, 독자 서재 화면: 서버 자기 요청을 직접 호출로, 작가 서재 API는 팔로우와 기능 확인, 팔로우 수를 동시에
- [x] 바뀌기 전후 응답 비교 완료 (게시판 API 5건, 연재, 카테고리, 태그 화면 9건, 서재 API 5건 모두 같음)
- [x] 사이트 공통 틀: 성인 여부 확인이 본인인증 상태와 사이트 메뉴를 서버 자기 요청으로 한 번 더 받던 것 → 이미 받은 결과로 계산 (`(site)/[siteName]/layout.tsx`, `src/lib/service/detectAdult.server.ts`)
- [x] 사이트 공통 틀: 블로그, 커뮤니티 전용 조회가 헤더 응답을 기다리던 것 → 저장된 사이트 정보로 종류를 먼저 알고 바로 시작
- [x] 사이트 메뉴 API: 페이지 제목 조회와 커뮤니티 로그인 확인을 다른 조회와 동시에 (`api/site/public`)
- [x] 블로그 커뮤니티 요약: 구독 확인을 로그인 확인에 바로 이어 붙여 다른 조회와 동시에 (`blogCommunity/access.ts`)
- [x] 글 화면 메타데이터: 사이트 조회와 글 조회(게시판 포함)를 동시에 (`src/lib/seoSite.ts`)
- [x] 바뀌기 전후 비교 완료 (사이트 화면 6건, 메뉴 API 3건, 커뮤니티 요약 4건, 글 메타데이터 8건 모두 같음)
- [x] 4단계: 서버 자기 요청을 직접 호출로 (`fetchApiRoute`, `getHubApiData`가 `src/lib/service/site/siteApiRoutes.ts`의 목록을 거쳐 직접 호출, 목록에 없거나 GET이 아니면 예전처럼 HTTP)
  - 마이허브 틀과 홈, 블로그, 커뮤니티, 포스트, 알림, 신고관리, 구입내역 4곳
  - 컨시어지 틀, 문의 목록, 상세, 문의하기, 관리자 문의 목록, 상세, 신고센터, 권리보호센터
  - 작가 정산, 작가, 독자 설정, 작가 멤버십, 라운지 틀, 라운지 검색, 팀 블로그 정보
  - 마이허브 홈: 계정, 가입 사이트, 초대, 가입 신청 동시에 / 블로그, 커뮤니티 허브: 가입 사이트와 목록 동시에 / 팀 블로그 정보: 블로그 정보와 즐겨찾기 동시에
  - 설정 화면(`/settings`)은 제외: 프록시가 설정 API에만 하는 본인 확인을 건너뛰게 되므로 HTTP 그대로
- [x] 공개 화면 전후 비교 같음 (라운지, 검색 2건, 컨시어지, 팀 블로그 정보), 로그인 화면은 확인 못 함
- [x] DB 색인 44개 추가 (글, 회원, 게시판, 연재, 결제, 구독 등 자주 찾는 칸, linked DB 적용 완료, `20261123150000_read_indexes.sql`)
- [x] 새 사이트: 사이트마다 첫 글 날짜를 DB에서 한 번에 계산 (`lounge_site_first_published_at`)
- [x] 버그: 새 사이트 계산이 전체 글을 오래된 순으로 최대 1만 개만 읽어서, 글이 1만 개를 넘으면 새로 연 사이트가 목록에 못 들어가던 것
- [x] 주제별, 떠오르는 사이트: 좋아요, 즐겨찾기, 새 가입자를 DB에서 한 번에 모아 받음 (`lounge_site_rising_entries`, `20261123160000_lounge_site_stats.sql`)
- [x] 전후 비교 같음 (새 사이트 API 2건, 주제별 사이트 API, 모먼트 화면)
- [x] 모먼트 인기글, 많이 읽은 글: 좋아요, 조회수를 DB에서 한 번에 모아 받음 (`lounge_post_score_entries`, `20261123170000_lounge_post_scores.sql`, 예전 조회와 합계, 날짜 형식 같음 확인)

## 접속 기록 (2026-11-24)

- 같은 자리에서 본인 확인 창이 반복해서 떠서, 판정된 나라와 지역을 남겨 보기 위함
- 남기는 때: 지역, 기기, 운영체제, 브라우저 중 하나라도 직전 기록과 다를 때, 새로 로그인했을 때
- 남기는 것: 일시, IP, 판정 나라, 한국이면 지역, 기기
- 사람마다 최근 100건까지 보관, 넘으면 오래된 것부터 지움
- 설정 화면에서 접속 기록 칸을 처음 펼칠 때 불러오고, 닫았다 다시 열어도 다시 불러오지 않음

- [x] 1. 표 `stigma_access_logs` 추가, linked DB 적용
- [x] 2. `securityCheck.server.ts`에서 기록 남기기
- [x] 3. `/settings`에 접속 기록 표시 (`api/auth/access-logs`, 설정 본인 확인 대상 목록에 추가)

## 남은 단계


## 12. 변경한 파일

| 파일 | 변경 내용 | 상태 |
|---|---|---|
| `supabase/migrations/20261123110000_public_cache_versions.sql` | 변경 번호 테이블, 트리거 | 완료 |
| `src/lib/publicCache.ts` | 저장본 읽기, 쓰기 | 완료 |
| `src/app/api/home/new-sites/route.ts`, `category-sites/route.ts`, `posts/route.ts` | 저장본 적용 | 완료 |
| `src/app/(lounge)/page.tsx`, `lounge/blog/page.tsx`, `lounge/community/page.tsx` | 직접 호출 | 완료 |
| `supabase/migrations/20261123120000_public_cache_site_tables.sql`, `20261123130000_public_cache_site_key_tags.sql`, `20261123140000_public_cache_blog_links.sql` | 트리거 추가, 사이트 주소 태그 | 완료 |
| `src/lib/site/siteState.server.ts` | 사이트 정보 저장본 | 완료 |
| `src/app/(site)/[siteName]/page.tsx` | 블로그 홈 직접 호출, 저장본 | 완료 |
| `src/app/api/info/general/site/[siteName]/route.ts`, `api/manage/design/blog/links/route.ts` | 공개 블로그일 때 저장본 | 완료 |
| `src/app/api/header/site/route.ts` | 방문 수 세기를 응답 뒤로 | 완료 |
| `src/app/api/link-preview/route.ts` | 저장본 | 완료 |
| `src/app/api/boards/[boardName]/[contentId]/route.ts` | 조회 동시 시작 | 완료 |
| `src/app/(site)/[siteName]/[boardName]/[contentId]/page.tsx`, `opt.tsx`, `board/content/page.tsx`, `board/content/opt.tsx` | 동시 시작, 조회수 브라우저 호출 | 완료 |
| `src/app/(site)/[siteName]/[boardName]/page.tsx`, `src/app/api/boards/[boardName]/route.ts` | 조회 합치기, 동시 시작 | 완료 |
| `src/app/(site)/[siteName]/c/[categoryName]/page.tsx`, `t/[hashtag]/page.tsx`, `s/[seriesName]/page.tsx` | 조회 합치기, 동시 시작 | 완료 |
| `src/app/(site)/[siteName]/layout.tsx`, `src/lib/service/detectAdult.server.ts` | 중복 요청 제거, 사이트 종류 먼저 확인 | 완료 |
| `src/app/api/site/public/route.ts`, `src/lib/service/site/blog/blogCommunity/access.ts`, `src/lib/seoSite.ts` | 동시 시작 | 완료 |
| `supabase/migrations/20261123150000_read_indexes.sql`, `20261123160000_lounge_site_stats.sql` | 색인, 라운지 집계 함수 | 완료 |
| `src/lib/service/lounge/loungeMoments.ts` | 새 사이트, 떠오르는 사이트, 인기글, 많이 읽은 글 집계를 DB 함수로 | 완료 |
| `supabase/migrations/20261123170000_lounge_post_scores.sql` | 글 점수 집계 함수 | 완료 |
| `src/lib/service/site/siteApiRoutes.ts`, `src/lib/service/hub/getData.ts` | 직접 호출 목록 추가, `fetchApiRoute` | 완료 |
| `(hub)`, `(concierge)`, `(library)/creator/page.tsx`, `creator/settings`, `user/settings`, `(new)/memberships/creator`, `(lounge)/layout.tsx`, `lounge/search`, `[siteName]/info-blog` | 서버 자기 요청을 직접 호출로 | 완료 |
| `supabase/migrations/20261124100000_stigma_access_logs.sql` | 접속 기록 표 | 완료 |
| `src/lib/auth/securityCheck.server.ts` | 접속 기록 남기기 | 완료 |
| `src/app/(settings)/settings/accessLogs.tsx`, `page.tsx`, `src/app/api/auth/access-logs/route.ts`, `src/proxy.ts` | 설정 화면에 접속 기록 표시 | 완료 |
| `src/app/(library)/creator/[handleName]/page.tsx`, `user/[handleName]/page.tsx`, `user/[handleName]/following/page.tsx`, `src/app/api/creator/[handleName]/route.ts` | 직접 호출, 동시 시작 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치:
