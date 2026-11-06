# AGENTS.md

## 프로젝트 개요

Next.js 15 + TypeScript 쇼핑몰 프론트엔드. API 서버는 별도 저장소.

## 대답 조건

한국어로 대답해 주세요.

## 개발환경

- Next.js
- Vercel (Production Hosting. Github push시 자동으로 deploy됨)
- Supabase (Auth, DB)
- Cloudflare R2 (File Storage)

## 명령어

- 설치: `pnpm install`
- 개발 서버: `PORT=3006 pnpm dev`
- 타입 체크: `pnpm typecheck`
- 프리티어: `npx prettier --write`
- 린트: `pnpm lint --fix`
- 작업 완료 전 typecheck, lint, prettier를 모두 통과시킬 것

## 구조

- `agents/`: AI 에이전트가 작업 시작시 반드시 확인해야 하는 문서
- `supabase/`: Supabase CLI 관련 기본 세팅 및 마이그레이션
- `src/app/(...)`: Next.js 레이아웃 그룹. (특정 페이지에서만 사용하는 컴포넌트는 /src/components에서 관리 안하고 해당 폴더에 직접 컴포넌트 파일 생성해서 사용해야 함.)
- `src/app/api/`: API 폴더. route.ts 파일만 가능.
- `src/components/`: 내부 공통 컴포넌트. tsx 파일만 가능.
- `src/lib`: 내부 라이브러리. ts 파일만 가능.

## 코드 컨벤션

- `agents/CONVENTIONS.md` 반드시 확인.

## Git 규칙

- 깃은 커밋하거나 푸시하지 마세요. 클로이가 직접 합니다.

## 경계 (먼저 물어볼 것)

- 폴더 추가, 폴더 삭제, 파일 추가, 파일 삭제시.
- 폴더/파일 수정할 때는 묻지 않아도 됨.

## 작업 방식

- 작업 전에 `agents/**`를 모두 확인하고 숙지 후 작업해야 합니다.
- 작업시 `PLAN.md`를 기록하고 아무리 간단한 작업이라고 해도 단계를 나눠서 단계가 끝날 때마다 끝난 단계는 여러 파일에 걸친 작업은 PLAN.md를 만들고 단계마다 갱신할 것.
- 작업 시작시에 PLAN.md 기본 골격이 들어가 있습니다. 이 골격은 반드시 유지되어야 하며 골격대로 플랜이 적용되어야 합니다.
- 세션 시작 시 PLAN.md를 읽고 `git status`, `git diff`로 실제 상태를 확인한 뒤, 이해한 내용을 요약해서 확인받고 코딩할 것
- PLAN.md와 실제 코드가 다르면 코드를 기준으로 보고, 차이를 사용자에게 알릴 것
- 세션 종료나 모델 전환 전에 13번 인수인계 메모를 쓸 것
- 클로이가 잘 된다라고 하거나 끝났다고 하거나 종료했다고 하는 등 종료를 선언하면 다음 작업을 위해 기존 `PLAN.md`는 지우고 `PLAN.default.md`를 duplicated 하고 duplicated한 파일을 `PLAN.md`파일로 이름 변경합니다.
- Supabase는 CLI가 설치되어 있습니다. 웬만하면 디비 작업은 Supabase CLI를 사용하세요.
- 브라우저는 ego lite만 사용합니다. 브라우저 테스트가 필요한 상황에서는 클로이가 ego-browser 사용하라고 지시를 내릴겁니다. 그 외에는 브라우징 스킬 사용하지 마세요. AI Agent 스스로 꼭 필요하다 싶으면 사전에 이러이러한 사유로 필요하니 사용 허가해달라고 물어보세요. 물어보지 않고 허용할거냐 바로 물어보면 리젝합니다.
