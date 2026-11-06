# PLAN.md

> 마지막 갱신: 2026-11-07 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 작업 목표: `/[siteName]/manage/design/blog/menu` 메뉴 목록을 블로그 서비스 화면 메뉴(NavMenu/DrawerMenu)와 일치시키기
- 단계
  1. [x] API(`shared/menu` GET)에 `hasShopping` 추가, 블로그 커뮤니티 조건을 서비스와 동일하게(`getBlogCommunityContext().canUse`) 변경
  2. [x] `opt.tsx`에 쇼핑 고정 항목 추가 (게시판/페이지 목록 다음, 블로그 커뮤니티 앞. 메뉴 2개 이상일 때만 — 기존 고정 항목과 동일 조건)
  3. [x] typecheck / lint / prettier
- 지금 작업 중인 단계: 완료 (클로이 확인 대기)
- 테스트 상태: 변경 파일 lint/prettier 통과, tsc는 기존 무관 에러 1건(`src/app/(site)/[siteName]/page.tsx` communityAvatarUrl)만 존재. 브라우저 확인 미실행
- 미커밋 변경 요약: route.ts(hasShopping, 블로그 커뮤니티 조건), opt.tsx(쇼핑 항목), PLAN.md

## 5. 완료한 것

- [x] 서비스 메뉴와 관리 메뉴 차이 분석 (쇼핑 누락, 블로그 커뮤니티 조건 차이 — 팀 블로그 처리)
- [x] API 수정 (수정한 파일: `src/app/api/manage/design/shared/menu/route.ts`)
- [x] 관리 화면 쇼핑 항목 추가 (수정한 파일: `src/app/(site)/[siteName]/manage/design/blog/menu/opt.tsx`)

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `src/app/api/manage/design/shared/menu/route.ts` | site_type 조회, hasShopping 응답 추가, hasBlogCommunity를 canUse 기준으로 변경 | 완료 |
| `src/app/(site)/[siteName]/manage/design/blog/menu/opt.tsx` | 쇼핑 고정 항목 표시 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
