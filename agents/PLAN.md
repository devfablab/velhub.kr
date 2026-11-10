# PLAN.md

> 마지막 갱신: 2026-11-11 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 완료 (화면 확인 대기)
- 테스트 상태: tsc·lint·prettier 통과 (opt.tsx window.location 경고는 기존 코드) / 20건 유지 DB 테스트 통과(롤백) / 화면 미확인
- 미커밋 변경 요약: 12번 표 참고

### 작업: 사이트 정보 수정내역 20건 기록

- 기존: `sites.log` 한 칸에 마지막 수정만 기록, 고급 설정은 여러 항목을 ", "로 합쳐 한 줄
- 변경: 새 테이블 `site_change_logs`에 수정 항목 1개당 1줄, 사이트별 최근 20건만 남김(DB 트리거)
- 기존 `sites.log` 6건은 새 테이블로 옮김. 기록이 없는 사이트는 "사이트 개설"(사이트 생성일) 표시
- `sites.updated_at`, `sites.updated_by`는 다른 화면에서 쓰므로 계속 갱신. `sites.log`는 더 이상 쓰지 않음(컬럼은 남겨둠)

## 5. 완료한 것

- [x] DB 마이그레이션 적용 (`supabase/migrations/20261111130000_site_change_logs.sql`)
- [x] 일반 설정 저장 시 1줄 기록
- [x] 고급 설정 저장 시 바뀐 항목마다 1줄 기록 (구글 애널리틱스·서치 콘솔도 따로)
- [x] 일반 설정 화면에 최근 20건 표시

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| supabase/migrations/20261111130000_site_change_logs.sql | 새 테이블, 20건 유지 트리거, 기존 기록 이전 | 완료 (적용됨) |
| src/app/api/info/general/site/[siteName]/route.ts | 수정내역 20건 + 수정자 이름 응답 (`logs`) | 완료 |
| src/app/api/info/general/site/[siteName]/edit/route.ts | 수정내역 테이블에 1줄 추가 | 완료 |
| src/app/api/info/advanced/site/[siteName]/edit/route.ts | 바뀐 항목마다 1줄 추가 | 완료 |
| src/app/(site)/[siteName]/manage/settings/general/opt.tsx | 수정내역 표 여러 줄 표시 | 완료 |
| src/app/(site)/[siteName]/manage/settings/advanced/opt.tsx, advanced edit/route.ts | 멤버 목록 공개여부(안 쓰는 값) 저장·기록 제거, null 유지 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
