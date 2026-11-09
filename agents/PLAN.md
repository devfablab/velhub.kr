# PLAN.md

> 마지막 갱신: 2026-11-09 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태 (이전 이미지 최적화 작업도 미커밋)

## 4. 현재 상태

- 지금 작업 중인 단계: 업로드 정비·페이지 OG·기존 `<Image>` 정리·OG 1200×630 통일 완료, 클로이 확인 대기
- 테스트 상태: typecheck / lint(오류 0) / prettier 통과. 화면 확인 미실행
- 미커밋 변경 요약: 아래 12번 표 (이전 이미지 최적화 작업 파일은 git status 참고)

## 5. 완료한 것

- [x] 사용자 아바타: 업로드 5MB → 1MB(서버·`settings/info.tsx` 문구), `stigmas.avatar_width/height`(적용·이력 기록), 기본정보 저장 API에서 아바타가 바뀌었을 때만 R2 파일 크기 저장(외부 URL이면 null), 소셜·네이버 로그인으로 외부 아바타가 덮어써질 때 크기 null. 기존 업로드 아바타 1개 채움
- [x] 매니저·등급 아이콘: 서버에 1MB 제한 추가 (업로드 시 25×25로 고정 변환되므로 크기 저장 불필요)
- [x] 블로그·커뮤니티 개설 아바타: 서버에 1MB 제한 추가 (72×72 고정 변환이라 크기 저장 불필요)
- [x] 페이지 OG 깨진 데이터: 페이지 `16f67ea7…`의 `og_image` 파일이 R2·다른 버킷·Supabase 어디에도 없어 `og_image`를 null로 정리. 공개 페이지 메타는 사이트 OG를 쓰므로 영향 없음, 관리 화면에서 다시 등록 가능

- [x] 기존 `<Image>`(sizes 없음) 5곳 정리: R2 썸네일 3곳(블로그 홈 블로그 목록, 블로그형 게시판 목록, 연재 상세 블로그형) `OptimizedImage` + 3열 카드 sizes, 가짜 1200×630 제거. `YoutubeThumbnailImage` 2곳(커뮤니티 홈 360px, 게시판 목록 270px)은 직접 올린 썸네일이면 `OptimizedImage`, YouTube 이미지면 `<img>`(화질 단계 넘김 유지). 이제 `next/image` 직접 사용은 `OptimizedImage.tsx`뿐
- [x] OG 표준 1200×630(cover, 가운데) 통일: 업로드 리사이즈 3곳(`site-og` 1280→1200, `og-image` 신규, 게시물 썸네일 신규), SEO 메타 기본 width 1280→1200(`seo.ts`, `seoSite.ts`), 사이트 설정 OG 미리보기 비율·안내 문구, `public/og.webp`·`og-etc.webp` 1280→1200. 화면 기본값 1200×630 복원
- [x] 기존 데이터: 게시물 썸네일 14개(og-images 12, posts 2)·사이트 OG 2개를 1200×630으로 다시 저장(같은 경로 덮어쓰기), 게시물 썸네일 크기 DB 갱신. 원본 백업은 scratchpad `thumb-backup`, `public-og-backup`. Cloudflare 캐시는 만료 전까지 이전 파일이 보일 수 있음

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `src/app/api/attachment/add/avatar/user/route.ts`, `src/app/(settings)/settings/info.tsx` | 아바타 1MB | 완료 |
| `src/app/api/info/general/user/route.ts` | 아바타 크기 저장 | 완료 |
| `src/app/api/auth/social/route.ts`, `src/app/api/auth/naver/callback/route.ts` | 외부 아바타로 바뀔 때 크기 null | 완료 |
| `src/app/api/manage/join/managers/route.ts`, `src/app/api/manage/members/levels/route.ts` | 아이콘 1MB | 완료 |
| `src/app/api/site/blog/new/route.ts`, `src/app/api/site/community/new/route.ts` | 개설 아바타 1MB | 완료 |
| `community.tsx`, `[boardName]/opt.tsx`, `blog.tsx`, `s/[seriesName]/opt.tsx`, `c/[categoryName]/page.tsx` | 기존 `<Image>` sizes·YouTube `<img>` 정리, 썸네일 기본값 1200×630 | 완료 |
| `src/app/api/attachment/add/{site-og,og-image,post}/route.ts`, `src/lib/seo.ts`, `src/lib/seoSite.ts`, `manage/settings/general/opt.tsx`, `public/og.webp`, `public/og-etc.webp` | OG 1200×630 통일 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
