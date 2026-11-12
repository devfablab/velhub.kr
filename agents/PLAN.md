# PLAN.md

> 마지막 갱신: 2026-11-12 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 작업: 크론 9개 점검에서 나온 버그 수정
- 단계
  1. `charge-due`: 멤버십·블로그 구독 갱신 결제 추가 (expire-past-due에도 블로그 구독 추가) (payment_type `membership`, 운영자 몫 분배 없음, 실패 알림 기존 코드 사용)
  2. `charge-due`: 결제 성공 후 저장 실패/운영자 정보 없음에도 다음 결제일을 넘겨 중복 결제 방지, 루프 중단 제거
  3. `publishing`: 숨김(is_closed) 글 제외, 상태 변경 먼저 하고 바뀐 글에만 알림
  4. 문의 결과 메일: 암호화된 이메일 복호화 (retention + 비크론 4곳)
  5. `reports/rights/expire`: 블로그 커뮤니티 글·댓글 포함
  6. `users/unkick`: 에러 문구
  7. typecheck, lint, prettier
- 지금 작업 중인 단계: 완료
- 테스트 상태: typecheck, lint, prettier 통과. publishing·rights/expire 로컬 실행 정상 (publishing 실행으로 qa-blog-revenue 예약 글 2개 공개됨). charge-due·expire-past-due는 실제 결제가 일어나서 실행 안 함
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
| `src/app/api/payments/portone/subscriptions/charge-due/route.ts` | 멤버십·블로그 구독 갱신 결제, 결제 후 저장 실패해도 다음 결제일 갱신, 루프 중단 제거 | 완료 |
| `src/app/api/payments/portone/subscriptions/expire-past-due/route.ts` | 블로그 구독 포함 | 완료 |
| `src/app/api/users/publishing/route.ts` | 숨김 글 제외, 상태 변경 후 바뀐 글만 알림 | 완료 |
| `src/app/api/concierge/inquiries/retention/route.ts` 외 문의 4곳 | 메일 보낼 때 이메일 복호화 | 완료 |
| `src/app/api/reports/rights/expire/route.ts` | 블로그 커뮤니티 글·댓글 포함 | 완료 |
| `src/app/api/users/unkick/route.ts` | 에러 문구 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
