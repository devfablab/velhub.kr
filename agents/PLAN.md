# PLAN.md

> 마지막 갱신: 2026-11-08 / 작성: Claude
> 기준 브랜치: main (velhub.kr), velman 작업 디렉터리 / 이 작업은 아직 미커밋 상태

## 목표

velman `신고 내역`이 모든 신고 유형(가이드라인 / 법률 / 권리침해)과 모든 대상(사이트 / 게시판 / 게시물 / 댓글 / 블로그 커뮤니티 글·댓글)에서 끝까지 동작하게 한다. 레거시(velhub `/concierge/reports`)는 참고만 하고, 레거시 버그와 미완성 부분도 함께 바로잡는다.

## 감사 결과 (velman 기준 누락 / 버그)

1. 소명 요청서 작성 없음 → 소명 흐름이 시작되지 않음
2. 소명 최종 처리(복구 / 삭제 유지) 없음
3. 제출된 소명 의견서·첨부자료 열람 없음
4. 법률 위반 신고가 소명 없이 바로 `처리 완료` 가능 (레거시는 법률 위반 콘텐츠 신고는 소명 요청서 작성으로만 처리)
5. 가이드라인 신고 `처리 완료` 3일 제한 없음 (레거시: 접수 3일 후)
6. 권리침해 신고 `이상 없음` 30일 제한 없음 (레거시: 30일 지나면 불가)
7. 사이트 / 게시판 신고에 메모 보내기 없음 (목록에 횟수만 표시)
8. 권리침해 사이트 / 게시판 신고의 사이트 차단 / 차단 해제 없음
9. 신고자별 신고 내역 보기 없음
10. 신고 유형 / 대상 필터 없음
11. 대상이 없는 신고(`target_type` null, URL만 있는 신고)는 처리 수단이 전혀 없음 (레거시도 동일)
12. 레거시 `사이트 폐쇄`는 버튼만 있고 실제로 아무것도 하지 않음
13. 소명 요청서 도착 / 소명 결과를 작성자에게 알리는 알림 없음 (레거시도 없음)
14. 권리침해 30일 자동 만료 API(`/api/reports/rights/expire`)를 호출하는 크론 설정이 저장소에 없음, 블로그 커뮤니티 대상은 만료 대상에서 빠져 있음

## 판단 기준

- 기능 정의: 코드(`getReportAppealCategory`), FAQ(DB `faqs`), 컨시어지 권리침해 안내 페이지(`concierge/rights`)
- velman vs 레거시: git 이력. 레거시 처리 규칙은 2026-07-22~23 작성 후 로직 변경 없음(이후는 import 경로·팝업 UX만). velman 처리 규칙은 2026-09-18 `4bb8389`(메시지 ".")에서 레거시를 옮기며 생김
- velman이 나중에 의도해서 바꾼 것(유지): 신고자 실명+이메일 표시, `reportLabels.ts` 라벨, R2 서명 URL 첨부, `is_sms` 표시, 상세 페이지 구조
- 옮기면서 빠진 것(복원): 위 감사 결과 1~10

## 정책 문서 대비 어디에도 구현 안 된 것

- 권리침해: 임시조치 시 작성자에게 사유·요청자 안내, 이의신청 시 요청자에게 안내, 이의신청 검토 후 "임시조치 30일 뒤 복원", 복원된 게시물 재임시조치 불가
- 사이트 이용 제한에 대한 소명(FAQ: 소명 실패 시 해제 요청 불가)

## 4. 현재 상태

- 지금 작업 중인 단계: 1단계(velman 신고 내역 복원 + 버그 수정) 완료, 클로이 테스트 대기. 다음은 2단계(정책 문서 대비 미구현)
- 테스트 상태: velman·velhub typecheck / lint / prettier 통과, velman 라우트 컴파일 확인, 처리 규칙을 현재 DB 신고 15건 + 가상 13케이스에 대입해 확인. 관리자 로그인이 필요한 실제 처리 흐름은 미실행
- 미커밋 변경 요약: 아래 12번 표. 이전 작업분 velhub `TableList.tsx`, `aside.module.sass`, `[siteName]/page.tsx`도 미커밋

## 5. 완료한 것

- [x] velman / 레거시 / 사용자 소명 흐름 감사
- [x] DB: `report_legals`, `report_rights`에 블로그 커뮤니티 대상 제약 추가 (원격 적용 + 이력 기록 완료)
- [x] velman 처리 규칙 통합(`getReportActions`): 목록·상세·모든 처리 API가 같은 규칙 사용
- [x] velman 소명 요청서 작성 / 의견서 열람(첨부 서명 URL) / 최종 처리(복구·삭제 유지) + 신고자 결과 알림
- [x] velman 메모 보내기(운영자 알림), 사이트 차단·해제(법률·권리침해 사이트·게시판 신고, 메모 3회 이상)
- [x] velman 필터(유형·대상·URL 신고), 신고자별 신고 내역
- [x] 버그: velman 신고자 조회(`stigmas.user_id` → `id`), 알림 보낸 사람 이름 조회, 신고 결과 알림 문구, "벨허브" 오기, 소명 성공 후 소명센터에서 항목 사라짐

## 2단계 (남은 것)

- 권리침해 정책: 임시조치 시 작성자 안내(사유·요청자), 이의신청 시 요청자 안내, 이의신청 검토 후 "임시조치 30일 뒤 복원", 복원된 게시물 재임시조치 불가
- 소명 요청서 도착 / 소명 결과 작성자 알림 (알림 타입 추가 필요)
- 권리침해 30일 자동 만료 크론 설정 + 블로그 커뮤니티 대상 포함
- 사이트 이용 제한 소명
- 레거시 velhub `/concierge/reports`·문의 내역 메뉴 정리 여부

## 12. 변경한 파일

| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| `velhub supabase/migrations/20261108090000_report_blog_community_targets.sql` | 법률·권리침해 신고 블로그 커뮤니티 대상 제약 | 완료 (적용됨, 작업 종료 시 삭제) |
| `velhub src/app/api/notifications/route.ts` | 보낸 사람 이름 조회 수정, 신고 결과 문구 대상별 분기, 데브허브 표기 | 완료 |
| `velhub src/lib/reports/appealCenterServer.ts` | 소명 내역이 있으면 복구 후에도 목록 유지 | 완료 |
| `velman src/lib/reportAppeals.ts` (신규) | 소명 라벨·의견서 항목·처리 규칙 | 완료 |
| `velman src/lib/reportServer.ts` (신규) | 신고 조회·콘텐츠 삭제/복구·알림 공통 로직 | 완료 |
| `velman src/lib/types.ts` | 목록 행에 처리 가능 여부·신고자 ID | 완료 |
| `velman src/app/api/reports/route.ts` | 신고자 조회 수정, 필터, 처리 가능 여부 | 완료 |
| `velman src/app/api/reports/[reportType]/[reportId]/route.ts` | 상세에 소명·메모·사이트·규칙 추가, 처리 규칙 적용 | 완료 |
| `velman src/app/api/reports/[reportType]/[reportId]/appeal/route.ts` (신규) | 소명 요청서 / 최종 처리 | 완료 |
| `velman src/app/api/reports/[reportType]/[reportId]/messages/route.ts` (신규) | 메모 보내기 | 완료 |
| `velman src/app/api/reports/[reportType]/[reportId]/site/route.ts` (신규) | 사이트 차단·해제 | 완료 |
| `velman src/app/reports/page.tsx` | 필터, 신고자 내역, 규칙 기반 버튼 | 완료 |
| `velman src/app/reports/[reportType]/[reportId]/page.tsx` | 소명·메모·사이트 처리 화면 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
