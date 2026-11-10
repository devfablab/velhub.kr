# PLAN.md

> 마지막 갱신: 2026-11-11 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 완료
- 테스트 상태: tsc·prettier 통과, lint 오류는 기존 코드(private opt.tsx set-state-in-effect)뿐 / 화면 미확인
- 미커밋 변경 요약: 12번 표 참고

### 작업: `<Avatar>` src·alt 컨벤션 맞추기

규칙 (CONVENTIONS.md): src·alt 필수, 이미지 없으면 `/broken-image.jpg`, alt는 별명 → 없으면 활동명

전수 조사: `<Avatar>` 62곳 중 16곳 위반

1. 비로그인 프로필 7곳 (`src={undefined} alt=""`): 클로이 확인 결과 비로그인은 src null/undefined가 맞음 → 변경 안 함. 댓글 비로그인 안내도 같은 형태로 맞춤
2. 허브 글 목록 `postListItem.tsx`: 작성자 이름 없을 때 src 없음 → 항상 기본 이미지
3. 멤버 관리 `members/entirety/opt.tsx`: 없는 파일 `/default-avatar.png` → `/broken-image.jpg`
4. 비공개 글 `private/[postId]/opt.tsx` 2곳: alt 빈 값 → 작성자 이름
5. 블로그 커뮤니티 배지 미리보기 2곳: alt 빈 값 → "본문 미리보기", "댓글 미리보기" (화면 표시 이름과 동일)
6. 댓글 입력 `CommentForm`, `CommentList` 작성 요건 안내: alt 빈 값 → 본인 이름(댓글 API 두 곳에 `mySelfName` 추가)

## 5. 완료한 것

- [x] 전수 조사
- [x] 2~6

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| src/app/(hub)/hub/shared/postListItem.tsx | 기본 이미지·alt | 완료 |
| src/app/(site)/[siteName]/manage/members/entirety/opt.tsx | 기본 이미지 경로 | 완료 |
| src/app/(site)/[siteName]/private/[postId]/opt.tsx | alt 작성자 이름 | 완료 |
| src/app/(site)/[siteName]/manage/community-on-blog/badge/opt.tsx | alt 미리보기 이름 | 완료 |
| api/boards/.../comments/route.ts, api/site/.../community-on-blog/.../comments/route.ts | 응답에 mySelfName | 완료 |
| src/components/comments/CommentForm.tsx, CommentItem.tsx, CommentList.tsx | 입력칸 Avatar alt 본인 이름, 비로그인 안내 src undefined | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
