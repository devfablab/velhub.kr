# PLAN.md

> 마지막 갱신: 2026-11-11 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 완료 (화면 확인 대기)
- 테스트 상태: tsc·lint·prettier 통과(slick.tsx 미사용 import 경고는 기존 코드) / 급상승 함수 실제 DB 실행 확인(현재 점수 있는 사이트 커뮤니티 1곳) / 카테고리 설정한 사이트가 없어 주제별 사이트는 빈 목록 / 화면 미확인
- 미커밋 변경 요약: 12번 표 참고

### 작업: 사이트 카테고리 + 주제별 사이트 + 인기 급상승 기준 변경

규칙
- 카테고리: 대분류 25개 / 소분류, DB 고정(관리 화면 없음). 사이트당 소분류 1개(대분류는 소분류에서 따라옴)
- 고급 설정에서 운영자만 변경, 매니저는 보기만. 기본 "선택하세요". 대분류만 고르면 저장 불가, 저장 후 없음으로 되돌리기 불가
- 수정내역에 "카테고리 A > A1 → B > B2" 기록
- 급상승 점수(기간 안): 블로그 = 좋아요 + 즐겨찾기, 커뮤니티 = 새 가입자 수(운영자 제외). 점수 0은 제외
- 순서: 블로그·커뮤니티 각각 순위 → 번갈아 섞기, 한쪽이 끝나면 나머지 이어 붙임. 개수 20
- 인기 급상승 사이트도 같은 기준으로 변경
- 라운지 홈 "주제별 사이트": 가입한 사이트와 새로 오픈했어요 사이. 대분류 탭 → 소분류 → 인기 급상승 카드(Slick). 사이트 없는 카테고리 숨김
- 카드에 블로그/커뮤니티 Chip

단계
1. DB: `site_category_groups`, `site_categories`, `rhizomes.category_id` + 목록 데이터
2. 고급 설정 API·화면: 카테고리 선택, 운영자만 저장, 수정내역
3. 급상승 기준 변경 (`loungeMoments.ts`)
4. 주제별 사이트 API + 라운지 홈 섹션 + 카드 Chip
5. tsc·lint·prettier

## 5. 완료한 것

- [x] 1 (DB 적용됨: 대분류 25, 소분류 281)
- [x] 2
- [x] 3
- [x] 4
- [x] 5

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| supabase/migrations/20261111150000_site_categories.sql | 카테고리 테이블 2개, rhizomes.category_id, 목록 데이터 | 완료 (적용됨) |
| src/lib/service/siteCategories.ts | 새 파일. 카테고리 목록, 운영자 확인, "A > A1" 표시 | 완료 |
| src/app/api/info/advanced/site/[siteName]/route.ts | categoryId, categoryGroups, canEditCategory 응답 | 완료 |
| src/app/api/info/advanced/site/[siteName]/edit/route.ts | 카테고리 저장(운영자만, 해제 불가) + 수정내역 | 완료 |
| src/app/(site)/[siteName]/manage/settings/advanced/opt.tsx | 대분류·소분류 선택칸, 매니저는 비활성 | 완료 |
| src/lib/service/lounge/loungeMoments.ts | 급상승 기준 변경, 번갈아 섞기, getCategoryRisingSites (주제별 사이트는 "라운지에 사이트 노출" 멤버십과 상관없이 모든 공개 사이트 대상, 모먼트 인기 급상승은 기존대로 멤버십 필요) | 완료 |
| src/app/api/home/category-sites/route.ts | 새 파일. 주제별 사이트 API | 완료 |
| src/app/(lounge)/lounge/categorySites.tsx | 새 파일. 대분류 탭(연한 배경) → 소분류 탭(밑줄) → Slick, 가로 스크롤 | 완료 |
| src/app/(lounge)/page.tsx | 주제별 사이트 섹션 연결 | 완료 |
| src/app/(lounge)/lounge/slick.tsx | 급상승 카드에 블로그/커뮤니티 Chip | 완료 |
| src/app/page.module.sass | category-sites, category-tabs/groups/items 스타일 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
