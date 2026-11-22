# PLAN.md

> 마지막 갱신: 2026-11-22 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 목표: 세션 탈취 피해 줄이기 (재확인)

### 재확인 조건

- 접속한 적 없는 지역: 한국은 광역 단위(서울, 경기도, 부산, 경상남도 등), 해외는 국가 단위(한국에서 해외로 나가는 것도 국가 이동)
- 접속한 적 없는 기기, OS, 브라우저
- 개인 설정(/settings) 접근: 통과하면 1시간 유지
- 지역, 기기 재확인 중에는 화면과 서버 API 모두 막음. /settings는 설정 API 막음

### 확인 방법

- 비밀번호가 있는 계정(비밀번호 존재 여부로 판단, 소셜 여부로 판단 금지): 비밀번호
- TOTP를 설정한 계정: TOTP도
- 둘 다 없는 계정: 이메일 6자리 + 보안 비밀번호 6자리
- 5회 틀리면 모든 기기 강제 로그아웃. 다시 로그인해도 보안 비밀번호 재설정 기회 없음(소셜 서비스 로그인이 살아 있을 수 있어서)

### 보안 비밀번호

- 이메일 가입: 선택, 소셜 가입(네이버 포함): 필수
- 숫자 6칸, 한 칸에 한 숫자
- 두 번 입력해서 맞아야 함, 같은 숫자 반복(000000 등)과 연속 번호(123456, 654321 등) 막음
- 소셜 가입 화면에 강한 경고: 개인 설정 열람용, 잊으면 안 되는 이유, 분실 시 복구 불가. 확인란 체크해야 진행
- 복구 수단 없음
- 되돌릴 수 없는 형태로 저장. 기존 계정은 110857로 일괄 등록
- 개인 설정에 보안 비밀번호 설정, 변경 섹션 추가

### 기타

- 개인정보처리방침에 접속 지역, 기기 정보 수집 추가

## 단계

1. [x] DB: 보안 비밀번호 저장 칸, 접속한 지역/기기 기록, 재확인 상태, 틀린 횟수 (마이그레이션)
2. [x] 보안 비밀번호 공통 규칙, 저장/비교 (서버)
3. [x] 6칸 숫자 입력 컴포넌트, 소셜 가입 경고 + 확인란
4. [x] 소셜 가입(필수), 이메일 가입(선택)에 보안 비밀번호 입력
5. [x] 개인 설정 보안 비밀번호 설정/변경 섹션
6. [x] 접속 지역(Vercel 위치 정보), 기기(브라우저, OS) 판별과 기록
7. [x] 재확인 화면: 비밀번호 / TOTP / 이메일 번호 + 보안 비밀번호, 5회 실패 시 모든 기기 로그아웃
8. [x] 서버 API 차단: 지역/기기 재확인 중 전체, /settings 1시간
9. [x] 기존 계정 110857 일괄 등록
10. [x] 개인정보처리방침 수집 항목 추가
11. [x] typecheck, lint, prettier

## 4. 현재 상태

- 지금 작업 중인 단계: 완료 (화면 확인 대기)
- 테스트 상태: typecheck, lint, prettier 통과. 화면 테스트 안 함
- 미커밋 변경 요약: `git status --short` 결과 기준으로 파일별 한 줄 설명

## 5. 완료한 것

- [x] 마이그레이션 적용 완료 (`supabase/migrations/20261122100000_security_check.sql`): stigmas.security_pin_hash, stigma_access_contexts
- [x] 기존 계정 36개 보안 비밀번호 110857 등록 (`scripts/fill-security-pin.mjs` 실행 완료)
- [x] 개인정보처리방침 글(posts 9362e62c...) 마크다운, HTML 둘 다 수정 완료

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)

| 파일                                                                                           | 변경 내용                                                                         | 상태 (완료 / 작업 중 / 임시) |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------- |
| src/lib/auth/securityPin.ts, securityPin.server.ts                                             | 보안 비밀번호 규칙, 저장값                                                        | 완료                         |
| src/lib/auth/accessContext.ts                                                                  | 접속 지역(광역/국가), 기기(브라우저, OS, 기기 유형) 판별                          | 완료                         |
| src/lib/auth/securityCheck.server.ts                                                           | 재확인 상태(Redis), 접속 기록, 이메일 번호, 실패 횟수, 전체 로그아웃              | 완료                         |
| src/lib/auth/totpRecovery.server.ts                                                            | 받는 이메일 함수 export                                                           | 완료                         |
| src/lib/session/server.ts                                                                      | 세션 정보에 토큰 발급 시각, 비밀번호 로그인 시각 추가                             | 완료                         |
| src/proxy.ts                                                                                   | API 차단(쓰기 요청은 지역/기기, 설정 API는 1시간 확인), 전체 로그아웃된 세션 정리 | 완료                         |
| src/app/api/auth/security-check/route.ts                                                       | 확인 방법 조회, 이메일 번호 발송, 확인                                            | 완료                         |
| src/app/api/auth/security-pin/route.ts                                                         | 보안 비밀번호 조회, 설정/변경                                                     | 완료                         |
| src/components/auth/SecurityPinInput.tsx, SecurityPinFields.tsx, SecurityCheck.tsx             | 6칸 입력, 경고+확인란, 재확인 화면                                                | 완료                         |
| src/app/layout.tsx, (settings)/layout.tsx                                                      | 재확인 화면 연결                                                                  | 완료                         |
| (settings)/settings/securityPin.tsx, page.tsx                                                  | 보안 비밀번호 섹션                                                                | 완료                         |
| (auth)/auth/social-sign-up/opt.tsx, sign-up/email.tsx, api/auth/social, api/auth/email/sign-up | 가입 시 보안 비밀번호 (소셜 필수, 이메일 선택)                                    | 완료                         |
| src/lib/users/accountWithdrawal.server.ts                                                      | 탈퇴 시 보안 비밀번호, 접속 기록 삭제                                             | 완료                         |
| supabase/migrations/20261122100000_security_check.sql, scripts/fill-security-pin.mjs           | DB, 기존 계정 등록                                                                | 완료 (적용됨)                |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
