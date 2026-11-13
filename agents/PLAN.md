# PLAN.md

> 마지막 갱신: 2026-11-13 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 작업: 약관 정리에서 나온 코드 수정 (후원 14세 체크, 결제 실패 구독 재시도, 결제 고지문)
- 단계: 1. 후원 나이 체크 14세 2. 유예 중 구독 하루 한 번 재시도 3. 결제 고지문 구독 실패 문구 4. typecheck, lint, prettier
- 지금 작업 중인 단계: 완료
- 테스트 상태: typecheck, lint, prettier 통과. 실제 결제 재시도 실행은 미확인 (실결제 발생)
- 미커밋 변경 요약: `git status --short` 결과 기준으로 파일별 한 줄 설명

## 5. 완료한 것

- [x] 1~4단계

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

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
