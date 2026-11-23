# PLAN.md

> 마지막 갱신: 2026-11-23 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 블로그 글 AI 활용 표시 완료, 클로이 확인 대기
- 테스트 상태: 미실행
- 미커밋 변경 요약: 블로그 글 작성, 수정 화면에 AI 활용 항목 추가, 글 목록과 글 화면에 AI 칩 표시

## 5. 완료한 것

- [x] posts.ai_usage 컬럼 추가 (linked DB 적용 완료)
- [x] AI 활용 값, 문구 모음 (`src/lib/service/site/blog/aiUsage.ts`)
- [x] AI 활용 입력 항목, 칩 컴포넌트 (`src/components/service/blog/BlogPostAiUsageField.tsx`, `AiUsageChip.tsx`)
- [x] 관리 메뉴 콘텐츠 관리 글 작성, 수정에 필수 항목으로 추가, 저장 API 반영
- [x] 글 화면 제목 아래 칩
- [x] 목록 제목 위 칩: 라운지, 블로그 홈, 게시판, 태그, 카테고리, 연재, 작가 서재, 사용자 서재, 팔로잉 피드, 마이허브 좋아요/저장/읽은 글

## 12. 변경한 파일

| 파일                                                                                                                                                         | 변경 내용            | 상태 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ---- |
| `src/lib/service/site/blog/aiUsage.ts`                                                                                                                       | AI 활용 값, 라벨     | 완료 |
| `src/components/service/blog/BlogPostAiUsageField.tsx`                                                                                                       | 라디오 항목          | 완료 |
| `src/components/service/blog/AiUsageChip.tsx`                                                                                                                | 칩                   | 완료 |
| `manage/contents/posts/new/opt.tsx`, `[contentId]/edit/opt.tsx`                                                                                              | 항목 추가, 필수 검사 | 완료 |
| `api/manage/contents/blog-posts/new`, `api/boards/[boardName]/new`, `[contentId]/edit`, `[contentId]`                                                        | 저장, 조회           | 완료 |
| `[boardName]/[contentId]/opt.tsx`                                                                                                                            | 글 화면 칩           | 완료 |
| `lounge/list.tsx`, `lounge/slick.tsx`, `(lounge)/page.tsx`, `api/home/posts`, `loungeMoments.ts`                                                             | 라운지 칩            | 완료 |
| `getPostList.ts`, `blog.tsx`, `api/site/[siteName]/blog-home`, `[boardName]/opt.tsx`, `t/[hashtag]`, `c/[categoryName]`, `s/[seriesName]`                    | 블로그 목록 칩       | 완료 |
| `api/creator/[handleName]`, `api/user/[handleName]`, `creatorFollowing.ts`, `creator/[handleName]/opt.tsx`, `timelinePosts.tsx`, `user/[handleName]/opt.tsx` | 서재, 팔로잉 칩      | 완료 |
| `hub/postDisplay.ts`, `hub/shared/postListItem.tsx`, `likedItems.tsx`, `savedItems.tsx`, `readsItems.tsx`                                                    | 마이허브 칩          | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치:
