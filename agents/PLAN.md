# PLAN.md

> 마지막 갱신: 2026-11-11 / 작성: Claude
> 기준 브랜치: main / 이 작업은 아직 미커밋 상태

## 4. 현재 상태

- 지금 작업 중인 단계: 7단계 (배포 준비, 클로이) / 화면 확인 대기
- 테스트 상태: tsc(Next·Worker)·prettier·lint 통과(경고만) / Worker 로컬 테스트 통과(권한·토큰·실시간·삭제·용량 넘으면 옮기기) / Next 함수 실DB 테스트 통과(멤버 수, 이름, 필터 3종, 옮기기·합치기·30일 제외) / 클로이 동작 확인 완료, 테마·창 밖 닫기 수정 후 화면 미확인
- 미커밋 변경 요약: 12번 표 참고

### 작업: 커뮤니티 단체 채팅

규칙
- 커뮤니티 사이트만. 사이트당 단체 채팅방 1개. 1:1 채팅, 이미지·파일 업로드, 메시지 검색, 접속 기록 없음
- 개설: 운영자만, 가입 승인 멤버 수 기준 이상일 때 (개발 중 2명, 확인 후 100명. 설정값 하나)
- 사용: 가입 승인 멤버만 읽기·쓰기. 비회원·승인 대기·차단·강퇴는 버튼 안 보임
- 버튼: 오른쪽 아래. 개설 전 + 기준 미달이면 숨김 / 개설 전 + 기준 이상이면 운영자에게만 보이고 누르면 "커뮤니티 단체 채팅방을 오픈하시겠어요?" 취소 / 개설 → 개설 후 바로 채팅창
- 화면: 상대는 왼쪽(아바타 + 별명, 없으면 활동명), 나는 오른쪽(프로필 없음)
- 필터: 서비스 전체 금칙어 + 사이트 금칙어 + 욕설(새 테이블) 3종. 걸리면 저장 안 하고 내 화면에서만 "워딩 프로파일러에 의해 숨김 처리되었습니다"
- 삭제: 운영자·커뮤니티 매니저는 모든 메시지, 멤버는 본인 메시지만. Cloudflare(및 옮겨진 경우 Supabase)에서 지움
- 메시지 최대 1,000자. 30일 지나면 삭제
- 용량: 채팅방(Durable Object) 1GB 기준 90% 넘으면 오래된 메시지를 Supabase로 옮겨 10%까지 줄임. 같은 id는 합침

구조
- Cloudflare Worker + Durable Object(SQLite) 사이트당 1개, 실시간 수신은 웹소켓
- 보내기: 화면 → Next.js API(권한·필터) → Durable Object 저장·전송
- 접속: Next.js가 짧은 접속 토큰 발급 → Worker가 확인
- 코드 위치: `workers/chat/` (wrangler는 `npx wrangler`)
- 환경변수: Next(`COMMUNITY_CHAT_SECRET`, `NEXT_PUBLIC_COMMUNITY_CHAT_WORKER_URL`), Worker(시크릿 `COMMUNITY_CHAT_SECRET`, vars `VELHUB_ORIGIN`, `STORAGE_LIMIT_BYTES`). 로컬 Worker는 `workers/chat/.dev.vars`
- 개설 기준 인원: `COMMUNITY_CHAT_MIN_MEMBERS` (communityChat.ts) 현재 2 → 확인 후 100
- 주의: `.gitignore`에 `.dev.vars`, `.wrangler` 추가 필요 (권한 막혀 클로이가 추가)

## 단계

- [x] 1. DB: `profanity_words`, `community_chat_rooms`, `community_chat_messages`(옮겨진 메시지)
- [x] 2. 욕설 목록 추천 → 클로이 확인 후 넣기
- [x] 3. 서버 라이브러리: 접속 토큰, 3종 필터, 개설 조건
- [x] 4. Next.js API: 상태·개설, 토큰, 보내기·삭제, 이전 메시지, Worker → Supabase 옮기기
- [x] 5. Worker(`workers/chat/`): Durable Object, 웹소켓, 용량 점검·30일 삭제
- [x] 6. 화면: 오른쪽 아래 버튼 + 채팅창
- [ ] 7. 배포 준비: wrangler 로그인·시크릿, Vercel 환경변수 (클로이)
- [ ] 8. 확인: tsc·lint·prettier, 실제 동작

## 5. 완료한 것

## 12. 변경한 파일

(커밋 로그가 없으므로 이 목록이 변경 이력 역할)
| 파일 | 변경 내용 | 상태 (완료 / 작업 중 / 임시) |
|---|---|---|
| supabase/migrations/20261111190000_community_chat.sql | 욕설 테이블, 채팅방, 옮겨진 메시지 | 완료 (적용됨) |
| profanity_words 데이터 | 욕설 40개 | 완료 |
| src/lib/wordingProfiler.server.ts | 욕설 포함 채팅 검사 `hasChatWordingViolation` | 완료 |
| src/lib/service/community/communityChat.ts | 새 파일. 권한, 멤버 수, 토큰, Worker 호출, 작성자 | 완료 |
| src/app/api/site/[siteName]/chat/route.ts, messages/route.ts, messages/[messageId]/route.ts | 새 파일. 상태·개설, 이전 메시지·보내기, 지우기 | 완료 |
| src/app/api/community-chat/archive/route.ts | 새 파일. Worker → Supabase 옮기기, 30일 지난 것 삭제 | 완료 |
| workers/chat/ (wrangler.jsonc, tsconfig.json, src/index.ts, worker-configuration.d.ts, .dev.vars) | 새 폴더. Durable Object 채팅방 | 완료 |
| tsconfig.json | workers 제외 | 완료 |
| src/app/(site)/[siteName]/communityChat.tsx, src/app/communityChat.module.sass, layout.tsx | 새 파일. 오른쪽 아래 버튼 + 채팅창, 커뮤니티일 때만. 라이트/다크 테마 따라감, 창 밖 누르면 닫힘 | 완료 |

## 13. 인수인계 메모 (전환 시에만 작성)

- 다음 AI에게 한 줄 요약:
- 이어서 할 첫 행동:
- 시작 전 확인할 것: 이 문서를 읽고 `git status`와 `git diff`로 실제 변경을 확인한 뒤, 문서와 코드가 일치하는지 요약해서 보여줄 것
- 임시 코드 / 디버깅용 코드 위치: (작업 끝나기 전에 제거해야 할 것)
