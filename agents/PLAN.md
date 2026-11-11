# PLAN.md

> 마지막 갱신: 2026-11-11 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 완료 (화면 확인 대기)
- 테스트 상태: tsc·prettier 통과, lint 오류는 기존 코드(posts/opt.tsx 468행 set-state-in-effect)뿐 / 해시태그 규칙 검사 스크립트 통과 / 화면 미확인
- 미커밋 변경 요약: 12번 표 참고

### 작업: 블로그 해시태그

규칙
- 블로그 단위 해시태그. 글당 최대 10개, 한 개 27자, 문자(모든 언어)·숫자·-·_만, 띄어쓰기 불가
- 대소문자 구분 없이 하나로 봄. 관리에서 중복 추가·수정 시 "이미 등록된 해시태그입니다" / 대소문자만 다르면 "이미 'React'로 등록되어 있는 해시태그입니다.\n기존 해시태그를 수정하여 사용해 주세요"
- 글쓰기에서 대소문자만 다른 기존 해시태그를 입력하면 기존 해시태그로 연결
- 관리(추가·수정·삭제)는 운영자·매니저만. 글을 쓰는 팀 멤버는 입력·추천만
- 쓰는 글이 있으면 삭제 버튼 흐리게, 누르면 "이 해시태그를 사용하는 글이 존재합니다." 팝업
- 수정하면 쓰는 글 모두에 바로 반영 (글은 해시태그 id를 저장)
- 글 보기: Chip, 누르면 `/[siteName]/t/[해시태그]` 글 목록
- 글 SEO keywords 메타 태그 = 해시태그 "tag1, tag2"

참고: posts.hashtags(text, 기존 컬럼)는 손대지 않음. 새 컬럼 posts.hashtag_ids(uuid[]) 사용

## 5. 완료한 것

- [x] DB (`blog_hashtags`, `posts.hashtag_ids`) 적용
- [x] 관리 API, 글 저장 API 3곳, 글 조회 API
- [x] 해시태그 관리 팝업, 글쓰기·수정 입력칸
- [x] 글 보기 Chip, 해시태그 글 목록 페이지, SEO keywords

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| supabase/migrations/20261111170000_blog_hashtags.sql | 해시태그 테이블, posts.hashtag_ids | 완료 (적용됨) |
| src/lib/service/blog/blogHashtags.ts | 새 파일. 검사·생성·조회 | 완료 |
| src/app/api/manage/blog-hashtags/route.ts | 새 파일. 목록·추가·수정·삭제 | 완료 |
| src/app/api/boards/[boardName]/new/route.ts, [contentId]/edit/route.ts, manage/contents/blog-posts/new/route.ts | 블로그일 때 blogHashtags 저장 | 완료 |
| src/app/api/boards/[boardName]/[contentId]/route.ts | blog_hashtags 응답 | 완료 |
| manage/contents/posts/hashtagSettingsDialog.tsx, hashtagInput.tsx | 새 파일. 관리 팝업, 입력칸 | 완료 |
| manage/contents/posts/opt.tsx, new/opt.tsx, [contentId]/edit/opt.tsx | 관리 버튼, 입력칸 연결 | 완료 |
| src/app/(site)/[siteName]/[boardName]/[contentId]/opt.tsx, src/app/board.module.sass | 글 보기 Chip | 완료 |
| src/app/(site)/[siteName]/t/[hashtag]/page.tsx | 새 파일. 해시태그 글 목록 | 완료 |
| src/lib/board/getPostList.ts | hashtagId 조건 | 완료 |
| src/lib/seoSite.ts | 글 keywords 메타 | 완료 |
| hashtagSettingsDialog.tsx, spellCheckSettingsDialog.tsx + 두 API의 PUT | 바로 저장 → 팝업 안에서만 바뀌고 "저장" 버튼으로 한 번에 저장, 저장 중 닫기 막음, 닫으면 버림 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
