# PLAN.md

> 마지막 갱신: 2026-11-14 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 새 작업: 서비스 소개 페이지 (1. 기획 → 2. 디자인 → 3. 코드). 1. 기획 완료 (`agents/about-plan.md`), 2. 디자인: PC, 모바일 완료. 첫 화면과 특장점 카드 6개에 그림(도형 그림, 원본은 피그마 about/라이브러리 > illustrations). 3. 코드: 1차 완료 (`/about`, 별도 레이아웃, 헤더 바닥글 없음, 반응형, 다크 모드). 화면 확인 남음
- 아래는 직전 작업(속도 개선) 기록, 미커밋

- 작업: 사이트 화면 대기 시간 줄이기 (서버가 자기 자신에게 HTTP로 요청하는 구조 정리)
- 배경: 실서버(velhub.xyz) 로그아웃 기준 첫 응답 0.7~1초, 콜드 스타트 시 8초. 사이트 화면 하나에 proxy 2~4번 + 레이아웃 18번 + 화면 2~3번 내부 HTTP 요청, 내부 요청마다 proxy가 다시 돌고 세션 확인(redis)과 DB 조회 반복
- 단계:
  1. proxy의 내부 HTTP 요청(사이트 상태, 회원 상태, 소셜 가입 확인)을 함수 직접 호출로 바꾸기
  2. 세션 확인 함수(getSessionClaims, getCurrentStigma, verifySession)를 한 화면 안에서 한 번만 돌게 하기
  3. 사이트 레이아웃의 내부 HTTP 요청 18개를 함수 직접 호출로 바꾸기
  4. 화면별(page.tsx) 내부 HTTP 요청을 함수 직접 호출로 바꾸기
  5. 로컬 측정, typecheck, lint, prettier
- 지금 작업 중인 단계: 1~4 완료, 로그인 상태 화면 확인 남음
- 테스트 상태: typecheck, lint, prettier 통과. 로그아웃 상태로 블로그(홈, /b, 글, /c, /t, 공지, 소개)와 커뮤니티(홈, 전체글, 게시판, 글) 열림과 데이터 확인. 로그인, 관리 화면, 결제 결과 화면은 미확인
- 대기 화면(loading.tsx)은 넣지 않음 (클로이 의도)

## 5. 완료한 것

- [x] 약관 정리 코드 수정, 퀸시 포스팅, /c·/s 목록, 자동 오픈그래프 썸네일 대체

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `src/app/api/payments/portone/donation/start/route.ts` | 블로그·연재 후원 만 14세 체크 추가 | 완료 |
| `src/app/api/payments/portone/donation/post/start/route.ts`, `success/route.ts` | 글 후원 12세 → 14세 | 완료 |
| `src/app/api/payments/portone/subscriptions/charge-due/route.ts` | 유예 중(7일) 구독 하루 한 번 재시도, 유예 시작일·멤버십 실패 알림은 첫 실패 때만 | 완료 |
| `src/components/modals/PaymentTerms.tsx` | 구독 결제 실패 안내 문구 | 완료 |
| `src/components/auth/SignupAgreements.tsx`, `src/components/modals/IdentityAgreement.tsx` | 보유 기간 문구 | 완료 |
| `src/app/api/manage/payments/subscriptions/site/route.ts`, `series/route.ts` | 가격 변경 시 기존 구독자 다음 결제부터 적용 | 완료 |
| `src/lib/payments/blogDonation.ts` | 연재 구독 유효 판정을 블로그 구독과 같은 기준으로 (기간 끝, 결제 실패 유예 포함) | 완료 |
| `src/app/api/boards/[boardName]/[contentId]/route.ts` | 연재 글 열람 시 구독 기간이 끝난 구독자 차단 | 완료 |
| `src/app/api/boards/[boardName]/new/route.ts`, `[contentId]/edit/route.ts` | 새 글 알림을 기간이 남은 연재 구독자에게만 | 완료 |
| (DB) 구독 안내 글 `c735569d-...` | 새 버전 적용 | 완료 |
| (DB) 유료 게시글 구매 안내 글 `8a2b6e25-...` (slug 3220865267) | 새 버전 적용 | 완료 |
| `src/components/modals/PaymentTerms.tsx` | 구매 글 삭제 문구: 삭제할 수 있지만 구매자는 계속 볼 수 있음 | 완료 |
| 멤버십 안내 포스팅 `e7813382-...` (slug 3220865271) | 새 버전으로 포스팅 수정 | 완료 |
| 작가 안내 포스팅 `fc7ac24f-...` (slug 439568896605) | 새로 작성해 포스팅 수정 | 완료 |
| 개인정보처리방침 포스팅 (slug 3220865264) | 작가 신청 수집 항목·목적·보유 기간, 국외 이전에 사업자등록증 추가 | 완료 |
| `src/app/api/payments/portone/memberships/modify/route.ts` | 멤버십 변경(업·다운 모두) 위약금 없이 남은 날수 차액 결제/환불, 결제일 유지. 새 결제 성공 후 기존 멤버십 정리. `preview: true`로 금액 미리보기 | 완료 (실결제 테스트 안 함) |
| `src/app/(hub)/hub/purchase/memberships/opt.tsx` | 변경 확인창에 이번 결제·환불 금액과 다음 결제일·금액 표시, 멤버십 안내 고지문 사용 | 완료 |
| `src/components/modals/PaymentTerms.tsx` | 멤버십 안내 항목 추가 | 완료 |
| `src/app/api/payments/portone/donation/cancel`, `purchase/cancel` | 회원 셀프 환불 통로라 삭제 (클로이 승인) | 완료 |
| 퀸시 포스팅 3개 (slug 3220865272, 3220865263, 3220865270) | 제목 변경, 지금 기능 기준으로 포스팅 수정 | 완료 |
| 퀸시 새 포스팅 18개 | 블로그 글쓰기 화면에서 등록 (1인/팀 블로그 비교 ~ 기능 연구소, 맞춤법 검사기) | 완료 |
| `src/app/(site)/[siteName]/c/[categoryName]/page.tsx` | 카테고리 글 목록 9개씩, /b와 같은 페이지 번호, 글쓰기 버튼 | 완료 |
| `src/app/(site)/[siteName]/s/[seriesName]/page.tsx`, `opt.tsx` | 연재 글 목록 블로그는 9개씩(커뮤니티 10개 유지), /b와 같은 페이지 번호, 블로그 글쓰기 버튼 | 완료 |
| `src/components/buttons/FabNew.tsx` | `withDesktopButton` 옵션 추가 (데스크톱에서 글쓰기 버튼), use client | 완료 |
| `src/app/board.module.sass` | 페이지 번호에 링크(a)도 버튼과 같은 모양 | 완료 |
| `src/lib/board/postThumbnail.ts` (새 파일) | 썸네일이 없으면 자동 생성 오픈그래프 이미지를 쓰는 함수 | 완료 |
| `getPostList.ts`, `api/boards/[boardName]`, `s/[seriesName]/page.tsx`, `api/site/[siteName]/blog-home`, `api/home/posts`, `api/home/moments/recent-creators`, `loungeMoments.ts`, `hub/postDisplay.ts` | 글 목록 썸네일에 자동 생성 이미지 대체 (블로그 목록, 카테고리, 연재, 해시태그, 블로그 홈, 라운지, 모먼트, 마이허브) | 완료 |
| `(site)/[siteName]/page.tsx`, `c/page.tsx`, `s/page.tsx` | 카테고리, 연재 대표 이미지에 자동 생성 이미지 대체 | 완료 |
| `src/proxy.ts` | 사이트 상태, 회원 상태, 소셜 가입 확인을 HTTP 대신 함수 직접 호출, 한 요청 안 중복 조회 제거 | 완료 |
| `src/lib/site/siteState.server.ts` (새 파일) | proxy용 사이트 상태 조회 (광고, 메뉴 등 proxy에 필요 없는 조회 제외) | 완료 |
| `src/lib/session/siteMember.server.ts` (새 파일) | 회원 상태, 소셜 가입 필요 여부 조회 (동의를 다 했으면 소셜 계정 조회 생략) | 완료 |
| `src/app/api/session/member/route.ts`, `social-sign-up/route.ts` | 위 함수 사용 | 완료 |
| `src/lib/session/server.ts`, `utils.ts`, `verifySession.ts` | getSessionClaims, getCurrentStigma, verifySession을 한 화면 안에서 한 번만 실행 (React cache) | 완료 |
| `src/app/(site)/siteApiRoutes.ts` (새 파일) | 사이트 화면이 쓰는 API 85개 목록 (결제 성공, 실패 처리 포함), 같은 서버 안에서 바로 호출. proxy가 /api에 하던 2단계 인증 미완료 차단(403), 인증 서버 장애 시 쓰기 차단(503)을 바로 호출에도 똑같이 적용 | 완료 |
| `src/app/(site)/getSiteApiData.ts` | 목록에 있는 API는 HTTP 대신 바로 호출, 없으면 기존처럼 HTTP | 완료 |
| `src/app/(site)/[siteName]/layout.tsx` | 인기글, 최신글은 커뮤니티일 때만 불러옴(커뮤니티 전용 데이터). 사이트 종류가 필요 없는 데이터는 사이트 정보를 기다리지 않고 처음부터 같이 불러옴 | 완료 |
| `src/lib/board/getPostList.ts`, `src/app/api/boards/all/route.ts` | 글 목록 조회에서 서로 기다릴 필요 없는 DB 조회를 한꺼번에 (차례로 5번 → 3번, 전체 글 API는 4번 → 2번). 결과는 그대로 | 완료 |
| `src/app/(about)/layout.tsx` (새 파일) | 소개 페이지 전용 레이아웃, 헤더 바닥글 없음 | 완료 |
| `src/app/(about)/about/page.tsx` (새 파일) | 소개 페이지 12개 구역 | 완료 |
| `src/app/(about)/about/opt.tsx` (새 파일) | 테마 적용(기존 방식 그대로), 따라오는 목차와 현재 위치 표시, 스크롤 등장 처리 | 완료 |
| `src/app/(about)/about/writingTabs.tsx` (새 파일) | 글쓰기 구역 블로그, 커뮤니티 전환 | 완료 |
| `src/app/about.module.sass` (새 파일) | 소개 페이지 스타일, 반응형, 다크 모드, 움직임(스크롤 등장, 첫 화면 등장, 배경 확대, 카드 마우스 반응, 탭 전환, 비교표 체크, 마지막 버튼 빛, 동작 줄이기 설정 시 끔) | 완료 |
| `public/about/` (새 폴더, 그림 7개) | 첫 화면, 특장점 카드 그림 | 완료 |
| `src/components/footers/Footer.tsx` | 바닥글 "데브허브 소개" 링크를 `/about`으로 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
