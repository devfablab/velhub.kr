# PLAN.md

> 마지막 갱신: 2026-11-11 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 완료 (화면 확인 대기)
- 테스트 상태: tsc·lint·prettier 통과 / 화면 미확인
- 미커밋 변경 요약: 12번 표 참고

### 작업: 라운지 홈에 가입한 커뮤니티·블로그 목록

- 위치: `src/app/(lounge)/page.tsx`의 AuthSection 바로 아래
- 항목: 세로형 (사이트 아바타 + 운영자/매니저 Chip + 사이트명), 목록은 가로 스크롤 (스크롤바 모양은 blog-ad-items와 같음)
- Chip: 운영자 → "운영자", 매니저(종류 상관없이) → "매니저", 그 외 → 없음
- 순서: 운영자 → 매니저 → 그 외, 같은 그룹 안에서는 최근 가입한 순
- 목록 끝에 "마이허브 이동하기" 링크
- 가입한 사이트가 없거나 비로그인이면 목록과 링크 모두 안 나옴
- 제외: 가입 승인 전, 활동 정지·강제 탈퇴·가입 불가·탈퇴, 폐쇄된 사이트

## 5. 완료한 것

- [x] 가입 사이트 API (`src/app/api/home/joined-sites/route.ts`)
- [x] 목록 컴포넌트 (`src/app/(lounge)/lounge/joinedSites.tsx`)
- [x] 홈 연결·스타일

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| src/app/api/home/joined-sites/route.ts | 새 파일. 가입한 사이트 목록 (정렬 포함) | 완료 |
| src/app/(lounge)/lounge/joinedSites.tsx | 새 파일. 가로 목록 + 마이허브 링크 | 완료 |
| src/app/(lounge)/page.tsx | 가입 사이트 불러와서 AuthSection 아래 표시 | 완료 |
| src/app/page.module.sass | joined-sites, joined-site, joined-site-more 스타일 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
