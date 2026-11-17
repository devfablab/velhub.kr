# PLAN.md

> 마지막 갱신: 2026-11-17 / 작성: Claude
> 기준 브랜치: (브랜치명) / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 마이허브 좋아요, 저장, 읽은 글 화면 오류 수정 완료
- 테스트 상태: 타입 체크, 린트, 프리티어 통과
- 미커밋 변경 요약: `git status --short` 결과 기준으로 파일별 한 줄 설명

## 5. 완료한 것

- [x] 통계 대시보드 인기글 순위를 블로그와 커뮤니티 공통으로 변경, 커뮤니티는 게시판 열 추가 (수정한 파일: `src/app/api/manage/stats/dashboard/route.ts`, `src/app/(site)/[siteName]/manage/stats/dashboard/opt.tsx`)
- [x] 블로그 인기글 순위 메뉴를 100개씩 페이지로 나눔 (수정한 파일: `src/app/api/manage/stats/hot-post/route.ts`, `src/app/(site)/[siteName]/manage/stats/hot-post/opt.tsx`)
- [x] 커뮤니티 인기글 순위 메뉴 추가, 게시판 선택과 선택 게시판 표시 (수정한 파일: `src/app/api/manage/stats/hot-post/route.ts`, `src/app/(site)/[siteName]/manage/stats/hot-post/opt.tsx`, `src/app/(site)/[siteName]/manage/menu.tsx`, `src/lib/site/manageMenu.ts`)

- [x] 마이허브 좋아요, 저장, 읽은 글 화면이 받은 자료 모양과 맞지 않아 열리지 않던 문제 수정 (수정한 파일: `src/app/(hub)/hub/shared/likedItems.tsx`, `savedItems.tsx`, `readsItems.tsx`, `src/components/Anchor.tsx`)

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `src/app/api/manage/stats/dashboard/route.ts` | 인기글 순위를 사이트 종류와 상관없이 응답 | 완료 |
| `src/app/(site)/[siteName]/manage/stats/dashboard/opt.tsx` | 인기글 표를 공통으로, 커뮤니티는 게시판 열 표시 | 완료 |
| `src/app/api/manage/stats/hot-post/route.ts` | 100개 제한 대신 100개씩 페이지로 응답 | 완료 |
| `src/app/(site)/[siteName]/manage/stats/hot-post/opt.tsx` | 100개 넘으면 페이지 버튼 표시, 커뮤니티 게시판 선택 | 완료 |
| `src/app/(site)/[siteName]/manage/menu.tsx` | 커뮤니티 통계 메뉴에 인기글 순위 추가 | 완료 |
| `src/lib/site/manageMenu.ts` | 커뮤니티 통계 메뉴에 인기글 순위 추가 | 완료 |
| `src/app/(hub)/hub/shared/likedItems.tsx` | 좋아요 목록을 API 응답 모양(post 안의 글 정보)에 맞춤 | 완료 |
| `src/app/(hub)/hub/shared/savedItems.tsx` | 저장한 글 목록을 API 응답 모양에 맞춤 | 완료 |
| `src/app/(hub)/hub/shared/readsItems.tsx` | 읽은 글 목록을 API 응답 모양에 맞춤 | 완료 |
| `src/components/Anchor.tsx` | 줄인 변수 이름을 풀어 씀 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: 없음
