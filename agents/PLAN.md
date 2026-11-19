# PLAN.md

> 마지막 갱신: 2026-11-19 / 작성: Claude
> 기준 브랜치: (브랜치명) / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 웹 접근성 작업 (5단계 색 대비, 6단계 키보드 확인은 클로이가 직접)
  0. [x] 목록 만들기: jsx-a11y 전체 규칙 임시 실행 + 코드 읽기, 묶음별 목록 (코드 수정 없음) → 클로이 검토 후 범위 확정
  1. [ ] 공통 컴포넌트: 팝업, 헤더와 메뉴, Anchor와 ScreenState, 공통 입력칸
  2. [ ] MUI 공통 처리: Pagination 한국어 읽기 문구, label 없는 TextField와 Select 이름
  3. [ ] 라운지 slick 숨은 복제 슬라이드 포커스
  4. [ ] 화면 묶음별: (auth) → (lounge) → (hub) → (library) → (new), (settings) → (concierge) → (site)

- 지금 작업 중인 단계: 모먼트 ONE픽 (마이허브 라운지 노출 선택값을 모먼트에 반영)
  1. [x] 데이터 함수: ONE픽 사이트(최신 글 순), ONE픽 포스팅(좋아요 순), 페이지 나눔 (`src/lib/service/lounge/loungeMoments.ts`)
  2. [x] 크리에이터 모먼트: ONE픽 사이트, ONE픽 포스팅 slick을 '새로 문 연 공간' 위에 / 오너 모먼트: ONE픽 사이트 slick을 '새로 문 연 사이트' 위에, 제목 옆 '전체 보기' 링크
  3. [x] 모먼트 메뉴: 전체보기 페이지에서만 '오너 모먼트' 옆에 '전체보기' 표시
  4. [x] 전체보기 페이지 `/lounge/moments/all?type=&page=`: 목록형, 하단 페이지 번호
  5. [x] 스타일, 타입 체크, 린트, 프리티어
- 테스트 상태: 타입 체크, 린트, 프리티어 통과
- 미커밋 변경 요약: `git status --short` 결과 기준으로 파일별 한 줄 설명

## 5. 완료한 것

- [x] 통계 대시보드 인기글 순위를 블로그와 커뮤니티 공통으로 변경, 커뮤니티는 게시판 열 추가 (수정한 파일: `src/app/api/manage/stats/dashboard/route.ts`, `src/app/(site)/[siteName]/manage/stats/dashboard/opt.tsx`)
- [x] 블로그 인기글 순위 메뉴를 100개씩 페이지로 나눔 (수정한 파일: `src/app/api/manage/stats/hot-post/route.ts`, `src/app/(site)/[siteName]/manage/stats/hot-post/opt.tsx`)
- [x] 커뮤니티 인기글 순위 메뉴 추가, 게시판 선택과 선택 게시판 표시 (수정한 파일: `src/app/api/manage/stats/hot-post/route.ts`, `src/app/(site)/[siteName]/manage/stats/hot-post/opt.tsx`, `src/app/(site)/[siteName]/manage/menu.tsx`, `src/lib/site/manageMenu.ts`)

- [x] 마이허브 좋아요, 저장, 읽은 글 화면이 받은 자료 모양과 맞지 않아 열리지 않던 문제 수정 (수정한 파일: `src/app/(hub)/hub/shared/likedItems.tsx`, `savedItems.tsx`, `readsItems.tsx`, `src/components/Anchor.tsx`)
- [x] 블로그 허브 홈의 즐겨찾는 블로그는 목록만, 편집은 읽은글 다음 메뉴로 분리 (수정한 파일: `src/app/(hub)/hub/blogs/page.tsx`, `tab.tsx`, `favoriteBlogs.tsx`, 추가: `favoriteBlogList.tsx`, `favorites/page.tsx`)
- [x] 모먼트 ONE픽: 크리에이터 모먼트에 ONE픽 사이트(최신 글 순)와 ONE픽 포스팅(좋아요 순), 오너 모먼트에 ONE픽 사이트, 전체보기 페이지와 페이지 번호 (수정한 파일: `src/lib/service/lounge/loungeMoments.ts`, `src/app/(lounge)/lounge/moments/MomentsContent.tsx`, `MomentSubMenu.tsx`, `src/app/page.module.sass`, 추가: `src/app/(lounge)/lounge/moments/all/page.tsx`, `all/opt.tsx`)
- [x] 즐겨찾기 폴더 관리: 기본 폴더(is_default, 맨 위 폴더), 폴더 순서, 끌어서 이동, 빼기와 폴더 삭제 5초 취소, 미결제는 폴더 구분 없이 전체 표시 (DB: `supabase/migrations/20261119100000_favorite_folder_default.sql` 적용 완료)

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
| `src/app/(hub)/hub/blogs/page.tsx` | 즐겨찾는 블로그를 보기 전용 목록으로 표시 | 완료 |
| `src/app/(hub)/hub/blogs/tab.tsx` | 읽은글 다음에 즐겨찾는 블로그 편집 메뉴 추가 | 완료 |
| `src/app/(hub)/hub/blogs/favoriteBlogs.tsx` | 편집 화면용, 비어 있을 때 안내 표시 | 완료 |
| `src/app/(hub)/hub/blogs/favoriteBlogList.tsx` | 새 파일, 홈용 보기 전용 목록 | 완료 |
| `src/app/(hub)/hub/blogs/favorites/page.tsx` | 새 파일, 즐겨찾는 블로그 편집 페이지 | 완료 |
| `src/app/(hub)/hub/blogs/favoriteBlogCard.tsx` | 새 파일, 즐겨찾는 블로그 카드 공통 | 완료 |
| `src/app/(hub)/hub/blogs/favoriteBlogs.tsx` | 편집 화면 재작성: 폴더별 끌어서 이동, 빼기, 5초 취소 | 완료 |
| `src/app/(hub)/hub/blogs/favoriteBlogList.tsx` | 결제 여부에 따라 폴더별 또는 전체 목록, 열 때마다 새로 불러옴 | 완료 |
| `src/app/(hub)/hub/blogs/folderModals.tsx` | 폴더 추가(기본 폴더 지정), 이름 변경, 삭제(옮길 폴더 선택), 순서 팝업 | 완료 |
| `src/app/hub.module.sass` | 끌기 손잡이, 폴더 순서 목록 스타일 | 완료 |
| `src/app/api/hub/blog-favorites/route.ts` | 목록에 폴더와 결제 여부 포함, 즐겨찾기 빼기 추가 | 완료 |
| `src/app/api/hub/blog-favorites/move/route.ts` | 결제한 사람만, 폴더 확인 후 이동과 순서 저장 | 완료 |
| `src/app/api/hub/favorite-folders/route.ts` | 폴더 추가(기본 폴더 지정), 폴더 순서 저장 | 완료 |
| `src/app/api/hub/favorite-folders/[folderId]/route.ts` | 이름 변경, 옮길 폴더 지정 후 삭제, 마지막 폴더 삭제 막음 | 완료 |
| `src/app/api/site/blog/[siteName]/favorites/route.ts` | 즐겨찾기 추가 때 기본 폴더 없으면 만들고 맨 위에 넣음 | 완료 |
| `src/lib/service/hubFavoriteFolder.server.ts` | 기본 폴더 보장, 폴더 순서 저장, 기본 폴더로 옮기던 동작 제거 | 완료 |
| `src/lib/service/hubFavoriteFolder.shared.ts` | 즐겨찾기 타입, 정렬 함수, 저장 대기 함수 | 완료 |
| `src/app/(hub)/hub/blogs/folderModals.tsx` | 폴더 이름 입력칸과 기본 폴더 체크박스를 MUI로 | 완료 |
| `src/app/(hub)/hub/lounge/opt.tsx` | 안내 버튼을 ScreenState action 안으로 | 완료 |
| `next.config.ts` | sass prependData 들여쓰기 제거 (새 sass 오류) | 완료 |
| `src/lib/service/lounge/loungeMoments.ts` | 글 카드 만드는 부분 함수로 분리, ONE픽 사이트와 포스팅 함수 추가 | 완료 |
| `src/app/(lounge)/lounge/moments/MomentsContent.tsx` | ONE픽 slick 섹션과 전체 보기 링크 | 완료 |
| `src/app/(lounge)/lounge/moments/MomentSubMenu.tsx` | 전체보기 페이지에서만 전체보기 탭 표시 | 완료 |
| `src/app/(lounge)/lounge/moments/all/page.tsx` | 새 파일, 전체보기 페이지 | 완료 |
| `src/app/(lounge)/lounge/moments/all/opt.tsx` | 새 파일, ONE픽 사이트 목록과 페이지 번호 | 완료 |
| `src/app/page.module.sass` | 전체 보기 링크, 페이지 번호 위치 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: 없음
