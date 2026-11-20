# PLAN.md

> 마지막 갱신: 2026-11-21 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 목표

- 별명: 글자, 숫자, 이모지, ( ) [ ] { } _ - , 띄어쓰기 한 칸 허용 (연속 띄어쓰기는 자동으로 한 칸)
- 활동명: 같은 규칙 + 중복 금지(대소문자 구분 없이), 중복 확인 버튼은 TextField 안쪽(별명과 동일)
- 회원가입 활동명은 필수, 이메일 앞부분이나 소셜 이름이 미리 채워진 상태

## 단계

1. [x] 공통 규칙 파일 (`src/lib/users/displayName.ts`)
2. [x] 활동명 비교용 컬럼 마이그레이션 + 기존 계정 채우기 스크립트
3. [x] 활동명 저장하는 곳마다 비교용 값 저장, 중복이면 거절
4. [x] 활동명 중복 확인 API
5. [x] 활동명 화면(설정, 이메일 가입, 소셜 가입)에 중복 확인 버튼
6. [x] 별명 검사하는 화면, API 전부 새 규칙 적용
7. [x] typecheck, lint, prettier

## 4. 현재 상태

- 지금 작업 중인 단계: 7 (마이그레이션 적용, 기존 계정 채우기 스크립트 실행은 클로이 확인 후)
- 테스트 상태: typecheck 통과, prettier 완료, lint 새 오류 없음 (남은 오류는 기존 것)
- 미커밋 변경 요약: 아래 12번 참고

## 5. 완료한 것

- [x] 공통 규칙 파일 (수정한 파일: `src/lib/users/displayName.ts`)
- [x] 비교용 컬럼 마이그레이션, 채우기 스크립트 (`supabase/migrations/20261121100000_stigma_user_name_lookup_hash.sql`, `scripts/fill-user-name-lookup-hash.mjs`)
- [x] 활동명 저장 경로에 비교값 저장, 중복 거절 (이메일 가입, 소셜 가입, 네이버 로그인, 설정 저장, 탈퇴)
- [x] 활동명 중복 확인 API (`src/app/api/auth/activity-name/route.ts`), 공통 확인 로직 (`src/lib/users/useActivityNameCheck.ts`)
- [x] 활동명 화면 3곳 중복 확인 버튼 (설정, 이메일 가입, 소셜 가입), 가입 활동명 필수 + 미리 채움
- [x] 별명 화면 5곳, API 6곳 새 규칙
- [x] 사이트명 검사는 길이만 보도록 분리 (`new/blog`, `new/community`, `info/general/site/[siteName]/edit`)

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| src/lib/users/displayName.ts | 별명, 활동명 공통 규칙 | 완료 |
| src/lib/users/activityName.server.ts | 활동명 비교값, 중복 검사 | 완료 |
| src/lib/users/useActivityNameCheck.ts | 활동명 중복 확인 화면 로직 | 완료 |
| src/app/api/auth/activity-name/route.ts | 활동명 중복 확인 API | 완료 |
| supabase/migrations/20261121100000_stigma_user_name_lookup_hash.sql | stigmas.user_name_lookup_hash 컬럼, 인덱스 | 완료 (미적용) |
| scripts/fill-user-name-lookup-hash.mjs | 기존 계정 비교값 채우기 (1회용) | 완료 (미실행) |
| src/lib/auth/emailSignUp.ts, socialSignUp.ts | 활동명 규칙, 가입 기본값 | 완료 |
| src/app/api/auth/email/sign-up, social, naver/callback, info/general/user | 비교값 저장, 중복 거절 | 완료 |
| src/lib/users/accountWithdrawal.server.ts | 탈퇴 시 비교값 비움 | 완료 |
| (settings)/settings/info.tsx, (auth)/auth/sign-up/email.tsx, social-sign-up/opt.tsx | 활동명 중복 확인 버튼 | 완료 |
| join/opt.tsx, info-blog/opt.tsx, invite-blog/[token]/opt.tsx, InviteAcceptance.tsx, community/UserInfo.tsx | 별명 새 규칙 | 완료 |
| api: check-nickname, team-blog/edit/nickname, users/[siteName]/[userId], join/invite/[token], team/members/invite/[token], members/join | 별명 새 규칙 | 완료 |
| (new)/new/blog, (new)/new/community, api/info/general/site/[siteName]/edit | 사이트명 길이 검사 분리 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
