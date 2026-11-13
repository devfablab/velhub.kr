# PLAN.md

> 마지막 갱신: 2026-11-13 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 작업: 오픈그래프 이미지 자동 생성 (피그마 시안: 포스팅 776-112, 사이트 일반 778-151, 카테고리/연재 783-17)
- 규칙
  - 직접 올린 이미지(글 썸네일, 카테고리·연재 이미지, 사이트 오픈그래프)가 있으면 그것, 없을 때 자동 생성 이미지
  - 그 항목을 직접 저장(생성·수정)할 때만 만듦. 사이트·작성자 정보 변경으로 기존 이미지 일괄 교체 안 함
  - 블로그: 메인, 카테고리, 연재, 글 / 커뮤니티: 메인, 연재
  - 폰트: 기존 가변 폰트에서 들어갈 글자만 뽑아 굵기 고정 (`subset-font`)
- 단계
  1. DB: posts, board_categories, board_series, rhizomes에 `auto_og_image` 컬럼 추가
  2. 생성 모듈: 시안 3종 렌더링 + R2(og-image) 업로드 + 이전 파일 삭제
  3. 저장 API 연결: 사이트 개설·사이트 정보 수정, 카테고리 생성·수정, 연재 생성·수정, 글 작성·수정
  4. 메타데이터(`src/lib/seoSite.ts`)에 자동 생성 이미지 반영
  5. 기본 이미지 정리: `og.webp`, `og-etc.webp` 1200×630, 클로이가 만든 `og-blog.png`, `og-community.png` → 1200×630 webp
  6. 로컬 테스트: 시안과 비교
  7. typecheck, lint, prettier
- 지금 작업 중인 단계: 완료 (클로이 확인 대기)
- 테스트 상태: typecheck, lint, prettier 통과. 로컬에서 qa-blog-revenue 메인·카테고리·연재·글 이미지 생성, R2 업로드, 페이지 og:image 반영 확인. 긴 제목·설명 말줄임, 배지, 로고·사이트 아바타·작성자 아바타 경우 확인. 실제 저장 화면(로그인 필요)을 통한 생성은 미확인
- 미커밋 변경 요약: 아래 12번 참고

## 5. 완료한 것

- [x] 1단계
- [x] 2단계
- [x] 3단계
- [x] 4단계
- [x] 5단계
- [x] 6단계
- [x] 7단계

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | `subset-font`, `@types/subset-font` 추가 | 완료 |
| `supabase/migrations/20261113100000_auto_og_image.sql` | `auto_og_image` 컬럼 4개 (적용함) | 완료 |
| `src/lib/site/autoOgImage.server.ts` | 시안 3종 생성·업로드 (새 파일) | 완료 |
| `src/app/api/site/blog/new`, `community/new` | 사이트 개설 후 생성 | 완료 |
| `src/app/api/info/general/site/[siteName]/edit/route.ts` | 사이트명·설명·로고·아바타·오픈그래프 변경 시 생성 | 완료 |
| `src/app/api/boards/[boardName]/category/new`, `[categoryName]/edit` | 카테고리 저장 시 생성 | 완료 |
| `src/app/api/boards/[boardName]/series/new`, `[seriesName]/edit` | 연재 저장 시 생성 | 완료 |
| `src/app/api/boards/[boardName]/new`, `[contentId]/edit` | 블로그 글 저장 시 생성 (임시저장 제외) | 완료 |
| `next.config.ts` | `subset-font`, `harfbuzzjs` 외부 패키지 지정, 폰트 파일을 배포 번들에 포함 | 완료 |
| `public/og.webp`, `public/og-etc.webp` | 1280→1200×630 | 완료 |
| `public/og-blog.webp`, `public/og-community.webp` | 클로이 png로 1200×630 webp 생성 (새 파일) | 완료 |
| `src/lib/seoSite.ts` | 자동 생성 이미지 사용, 카테고리·연재 이미지 실제 크기 전달 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
