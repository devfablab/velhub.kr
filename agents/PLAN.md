# PLAN.md

> 마지막 갱신: 2026-11-15 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 새 작업: 사이트 헤더 글 검색(PC 검색창, 모바일 검색 아이콘)에 최근 검색어 (Autocomplete freeSolo + loading)
  1. DB 테이블 site_search_histories (사이트별, 회원별 최근 검색어, 최대 10개)
  2. API /api/search-histories/[siteName] (불러오기, 저장)
  3. 공통 검색 입력 SiteSearchAutocomplete, BlogSearch / CommunitySearch에 적용
  4. 비로그인은 브라우저(localStorage)에 저장, 로그인은 DB. 실제 검색(제출, 목록 선택)할 때만 저장
  5. typecheck, lint, prettier
  6. 라운지 검색에도 같은 방식 적용 (사이트 칸 비우면 라운지)
- 지금 작업 중인 단계: 1~6 완료. 로그인 상태에서 실제 저장, 불러오기는 화면 확인 전
- 테스트 상태: typecheck, lint, prettier 통과. 비로그인 API 응답 확인
- 미커밋 변경 요약: `git status --short` 결과 기준으로 파일별 한 줄 설명

## 5. 완료한 것

- [x] 사이트 헤더 검색 최근 검색어 (수정한 파일: 아래 12번)

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `supabase/migrations/20261115100000_site_search_histories.sql` (새 파일) | 최근 검색어 테이블 (회원, 사이트, 검색어, 검색 시각). 원격 DB에 적용하고 적용 기록 추가 | 완료 |
| `src/app/api/search-histories/[siteName]/route.ts` (새 파일) | 최근 검색어 불러오기(GET), 저장(POST, 최대 10개 유지). 비로그인은 빈 목록, 저장은 401 | 완료 |
| `src/components/header-groups/site/SiteSearchAutocomplete.tsx` (새 파일) | Autocomplete(freeSolo, loading) 검색 폼. 사이트, 라운지 공통. 비로그인은 localStorage, 로그인은 DB. 제출하거나 목록에서 고를 때만 저장 | 완료 |
| `src/components/header-groups/site/BlogSearch.tsx`, `CommunitySearch.tsx` | 공통 검색 폼 사용 | 완료 |
| `src/app/header.module.sass` | 최근 검색어 항목 스타일 | 완료 |
| `supabase/migrations/20261115110000_site_search_histories_lounge.sql` (새 파일) | site_id 비움 허용(라운지), 중복 막는 인덱스를 NULLS NOT DISTINCT로. 원격 적용, 기록 추가 | 완료 |
| `src/lib/searchHistories.server.ts` (새 파일) | 최근 검색어 불러오기, 저장 공통 함수 | 완료 |
| `src/app/api/search-histories/route.ts` (새 파일) | 라운지 최근 검색어 API | 완료 |
| `src/components/header-groups/lounge/Search.tsx` | 공통 검색 폼 사용 (2글자 이상, 검색 결과 화면에서만 취소) | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
