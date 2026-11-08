# PLAN.md

> 마지막 갱신: 2026-11-08 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 목표

목록처럼 작게 여러 장 보여주는 이미지만 `next/image`로 바꿔 전송량을 줄인다. 레이아웃 그룹 단위로 하나씩 처리한다.

## 원칙

- 업로드(데이터): 모든 이미지 업로드는 width·height를 받아 DB에 저장하고, 1MB를 넘지 않게 강제한다
- 화면(표시): 같은 필드라도 화면마다 판단. `<Image>`가 나은 곳만 width·height를 넣어 변환하고 나머지는 `<img>` 유지
- `<Image>`가 나은 곳: 원본보다 훨씬 작게 보여주는 곳(목록 썸네일, 작은 미리보기), 표시 폭을 `sizes`로 적을 수 있는 곳
- `<img>` 유지: 원본과 비슷한 크기로 보여주는 곳, 외부 이미지(YouTube), `blob:` 미리보기, 이메일 HTML, CSS background
- 크기 정보가 없는 예전 데이터는 `<img>`로 대체 표시
- 비용: Vercel Pro 변환 1,000건당 $0.05, R2 무료 플랜

## 이미지 종류별 크기 저장 현황

- ① 저장됨: 게시물 썸네일(`posts.thumbnail_width/height`), 게시물 이미지(`posts.images` JSON), 투표 이미지(`posts.poll` JSON), 비공개 게시판 이미지(`private_post_images`)
- ② 업로드 때 고정 크기로 줄임(상수 사용): 사이트 아바타 72×72, 프로모션 358×170, 사이트 OG 1280×630, 관리자·등급 아이콘 25×25
- ③ 저장 안 됨 → 업로드에서 width·height 저장 + DB 컬럼 추가 + 기존 데이터 채우기: 사이트 로고, 시리즈·카테고리 썸네일, OG 이미지(`rhizomes.og_image`, `pages.og_image`), 블로그 커뮤니티 글 이미지, 블로그 공지 이미지, 블로그 광고 썸네일, 구독 뱃지, 사용자 아바타, 커뮤니티 답변 이미지, 작가·사용자 커버, 커뮤니티 링크 이미지
- 1MB 제한 누락(서버): 사용자 아바타 5MB, 커뮤니티 답변 5MB(클라이언트 문구 포함), 카테고리·시리즈 썸네일, 관리자·등급 아이콘, 블로그·커뮤니티 개설 아바타 — 크기 검사 없음

## 순서

0. (concierge) 소명센터 `explains/opt.tsx`, `explains/guidelines/opt.tsx` 화면 + `appeals/content` API 크기 전달 (레거시 `concierge/reports/opt.tsx` 제외)
1. 업로드 정비: ③ 크기 저장, 1MB 제한
2. (lounge) `lounge/list.tsx`, `slick.tsx`(CSS 배경, 별도 판단)
3. (hub) `HubPostListItem.tsx`, `ownedDonationPosts.tsx`, 사이트 로고 5곳
4. (library) `creator/[handleName]/timelinePosts.tsx`
5. (site) 91곳 — 게시판 목록, 블로그 홈, 커뮤니티 홈, 블로그 커뮤니티 목록, 연재·카테고리 목록 등으로 나눠서
6. components 12곳

## 4. 현재 상태

- 지금 작업 중인 단계: 4. (library) 완료. 다음은 5. (site)
- 테스트 상태: typecheck / lint / prettier 통과, 소명센터 두 페이지 200, `/_next/image`로 R2(posts.dist.velhub.xyz) 이미지 변환 확인(61KB → 96px 1KB, 384px 9KB)
- 미커밋 변경 요약: 아래 12번 표

## 5. 완료한 것

- [x] 그룹별 `<img>` 사용처 분류
- [x] 공통 컴포넌트 `src/components/OptimizedImage.tsx` (크기 있음 + R2·허용 도메인 + SVG 아님 → `<Image>`, 아니면 `<img>`), `getHeightBasedSizes`. 라운지·소명센터도 이 컴포넌트로 교체
- [x] 4. (library) 타임라인 갤러리 이미지 `<Image>`(`sizes` 575px 기준, 작가 서재·독자 서재·팔로잉 3곳 데이터에 크기 추가). 커버 미리보기 2곳 `<Image>`(② 1270×270 상수). 커버 업로드 API가 서버에서도 1270×270 WebP로 맞춰 저장(작가·독자)
- [x] 3. (hub) 게시물 썸네일(96×96) `<Image>`. 사이트 로고 5곳(높이 24px) `<Image>` — 로고 크기 저장 추가(③): `rhizomes.profile_logo_width/height` 컬럼, 로고 저장 시 서버가 R2에서 크기 계산(`r2Storage.getImageSize`), 기존 로고 1개 채움(SVG라 화면은 `<img>`). 구매한 포스팅 본문 이미지(`ownedDonationPosts.tsx`)는 게시물 상세와 같은 콜라주라 (site) 그룹에서 함께 판단
- [x] 버그: 초대받은 사이트 목록 아바타를 site-logo 버킷에서 찾던 문제(`pending-invites`)
- [x] 2. (lounge) 목록 썸네일 12곳 `<Image>`(최신·모먼트·검색 `sizes="172px"`, 인기 `(max-width: 767px) 100vw, 342px`). YouTube 기본 썸네일·프로모션 이미지는 `<img>` 유지. 크기 없거나 허용 도메인이 아니면 `<img>` 대체
- [x] 버그: 모먼트 목록이 블로그 썸네일(og-image 버킷)을 post 버킷 주소로 만들던 문제 (썸네일 14개 중 12개 해당)
- [x] 0. (concierge) 투표 이미지(80·240px), 수정 화면 썸네일·이미지(320px)를 `<Image>`로. 크기 정보 없으면 `<img>` 대체. 콘텐츠 보기 본문 썸네일·이미지는 `<img>` 유지

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `src/app/api/concierge/appeals/content/[reportType]/[reportId]/route.ts` | 썸네일 width·height 응답 추가, 투표 이미지 URL을 R2 경로 우선으로 | 완료 |
| `src/app/(concierge)/concierge/explains/opt.tsx` | 4곳 `OptimizedImage`로 변환 | 완료 |
| `src/app/(concierge)/concierge/explains/guidelines/opt.tsx` | 투표 이미지 `<Image>` 변환 | 완료 |
| `src/app/api/home/posts/route.ts` | 갤러리·피드 첫 이미지 width·height, 일반·블로그 썸네일 width·height 응답 | 완료 |
| `src/lib/service/lounge/loungeMoments.ts` | 같은 크기 정보 + 썸네일 버킷 버그 수정 | 완료 |
| `src/app/(lounge)/page.tsx` | 목록 타입에 크기 필드 | 완료 |
| `src/app/(lounge)/lounge/list.tsx` | 12곳 `OptimizedImage`로 변환 | 완료 |
| `src/components/OptimizedImage.tsx` (신규) | `<Image>`/`<img>` 판단 공통 컴포넌트 | 완료 |
| `supabase/migrations/20261108120000_site_logo_size.sql` | `rhizomes.profile_logo_width/height` | 완료 (적용됨, 작업 종료 시 삭제) |
| `src/lib/clients/r2Storage.ts` | `getImageSize` 추가 | 완료 |
| `src/app/api/info/general/site/[siteName]/edit/route.ts` | 로고 저장 시 크기 저장 | 완료 |
| `src/app/api/hub/{blog-favorites,pending-invites,pending-join,user-join-sites}/route.ts` | 로고 크기 응답, pending-invites 아바타 버킷 수정 | 완료 |
| `src/lib/service/hub/postDisplay.ts` | 썸네일·첫 이미지 크기 | 완료 |
| `src/app/(hub)/hub/shared/HubPostListItem.tsx`, 로고 5개 파일 | `OptimizedImage` 변환 | 완료 |
| `src/app/api/creator/[handleName]/route.ts`, `src/app/api/user/[handleName]/route.ts`, `src/lib/service/lounge/creatorFollowing.ts` | 타임라인 갤러리 첫 이미지 크기 | 완료 |
| `src/app/(library)/creator/[handleName]/timelinePosts.tsx` | 갤러리 이미지 `OptimizedImage` | 완료 |
| `src/app/(library)/{creator,user}/[handleName]/opt.tsx` | 커버 미리보기 `OptimizedImage` | 완료 |
| `src/app/api/{creator,user}/profile/cover/route.ts` | 서버에서 1270×270 WebP로 변환 저장 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
