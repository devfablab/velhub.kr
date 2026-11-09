# 코드 컨벤션

## 약자, 약어 등 줄여서 쓰기 금지

e.g.) e -> event/error, res -> response, req -> request... 등등. (언급된 것만 주의하란 의미 아님.)

## 사용 중지된 props, member 사용 금지.

- 항상 package.json 에 기입된 패키지 버전을 숙지하고 코딩해야 합니다. (특히 mui)

## lint/type 에러 검출에 warning은 수정하지 않고 프리패스.

## 서비스명 유의사항

- 국문명 `데브허브`, 영문명 `velhub` 입니다. 영문 앞에 소문자.
- 관리앱은 `velman`입니다. 역시 앞 소문자.

## sass 파일 위치

- `src/app`입니다. 이는 고정입니다.
- e.g.) `src/app/hub.module.sass`

## 팝업 (모바일 + PC 세트)

1. VhiDialog 케이스에 사용하는 액션 버튼: 'button medium 역할'

- 역할은 close, submit, danger. 액션에 버튼이 하나만 존재할 때는 해당 버튼에 submit 또는 danger 사용. (조건에 따라서 하나만 있을 수도 있꼬 여러개 있을 수도 있음. 이때는 className 에서 분기해야 함.)
- submit 클래스를 가지는 버튼이 한 액션에 여러개 버튼이 있을 수 없음. danger + submit 이거나 action + submit 이어야 함. (action: 옵션 버튼, submit: 메인 버튼)

2. vh-dialog vh-alert-dialog 케이스에 사용하는 액션 버튼: 역할에 따라 달라짐.

- submit: 클래스 없음, 닫기: cancel-button, 경고/위험: danger-button. 액션에 버튼이 하나만 존재할 때는 해당 버튼에 클래스를 빼거나 danger-button 사용. (조건에 따라서 하나만 있을 수도 있꼬 여러개 있을 수도 있음. 이때는 className 에서 분기해야 함.)
- 클래스가 없는 클래스를 가진 버튼이 한 액션에 여러개 버튼이 있을 수 없음. danger-button + 클래스 없거나 action-button + 클래스 없어야 함. (action-button: 옵션 버튼, 클래스 없음: 메인 버튼)

3. 모바일 공통: small 사용 못함. medium 사용. 'button medium 역할'.

- 역할은 close, submit, danger. 액션에 버튼이 하나만 존재할 때는 해당 버튼에 submit 또는 danger 사용. (조건에 따라서 하나만 있을 수도 있꼬 여러개 있을 수도 있음. 이때는 className 에서 분기해야 함.)
- submit 클래스를 가지는 버튼이 한 액션에 여러개 버튼이 있을 수 없음. danger + submit 이거나 action + submit 이어야 함. (action: 옵션 버튼, submit: 메인 버튼)

## 상태 표시

1. 상태 표시는 2가지 방식이 있음.

- `<ScreenState />`
- `<p className="alert 상태">`

2. <ScreenState /> 케이스

- 사용법은 src/components/service/ScreenState.tsx 참조.

3. <p className="alert 상태"> 케이스

```
<p className="alert error">
  <ErrorOutlineRoundedIcon />
  <span>{메시지}</span>
</p>
```

```
<p className="alert info">
  <InfoOutlineRoundedIcon />
  <span>{메시지}</span>
</p>
```

```
<p className="alert warning">
  <WarningAmberRoundedIcon />
  <span>{메시지}</span>
</p>
```

## 폴더명 및 파일명 케이스 스타일

1. app 하위

- 폴더: kebab-case
- 파일: camelCase

2. api

- 폴더: kebab-case
- 파일: 해당사항 없음 (route.ts만 존재하므로)

3. sass 파일

- camelCase.module.sass (`global.sass`는 논외)

4. components 하위

- 폴더: kebab-case
- 파일: PascalCase

4. lib 하위

- 폴더/파일: camelCase

> 파일은 가끔 camelCase.목적.ts 쓸 때도 있음. 목적: server or client

## 기타

- `input type="file"` 사용시에는 `<VisuallyHiddenInput />`를 사용해야 함.
- `<Typography>`에 사용할 수 있는 건 `variant`, `component` 둘 뿐이고 `component`는 `variant`가 h6일 때만 별도로 몇단계인지 사용할 수 있음. `variant`는 h6, subtitle2, body2만 사용 가능하고 아무 프롭스도 하지 않는 순수 `<Typography>` 형태로만 사용할 수 없음.
- MUI 폼에서 label 프롭스 쓸 수 없음. TextField에서 label 대신 placeholder 사용하고 Select에서는 label 대신 기본값으로 사용. (`<Label />` 태그를 쓰지 말라는 의미 아님 주의.)
- MUI 컴포넌트는 size를 small 로 반드시 지정해야 함.
- 링크는 무조건 `<Anchor>` 사용.
- `<Avatar />는 src, alt가 반드시 존재해야 하며 이미지 값이 없는 경우 '/broken-image.jpg' 사용. alt에는 별명을 넣고, 별명이 없다면 활동명이 들어가게 처리.

## 추가 설명

- 클로이가 말하는 `사이트`: `커뮤니티`, `블로그`를 뜻함.
- 활동명: 데브허브 서비스에서 사용하는 유저 이름. 가입시 필수로 입력 받음. (null일 수 없음을 뜻함)
- 별명: 사이트에서 사용하는 유저 이름. 별명은 필수 입력값이 아니므로 없을 수 있음.
- 팝업: 모바일 + PC 세트로 사용하는 드로워 및 다이얼로그를 뜻함.
- 커뮤니티 용어에 대해: 2가지가 있습니다. 사이트의 `커뮤니티` 그리고 블로그의 `커뮤니티`. 블로그의 커뮤니티는 사이트 커뮤니티와 구분하기 위해서 클로이가 설명할 때는 `블로그 커뮤니티`라고 명명합니다. 그냥 `커뮤니티`인 경우에는 사이트의 `커뮤니티`이고, `블로그 커뮤니티`는 블로그 내에 있는 커뮤니티입니다.
