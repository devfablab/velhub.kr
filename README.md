# 데브허브 (velhub) velhub.xyz

- 프로젝트는 velhub와 velman으로 이루어져 있음. (Velhub, Velman 아님. velhub, velman. 모두 소문자임에 유의)

## 필수 적용 사항

- 작업 완료시 `.prettierrc.json`, `tsconfig.json`를 가지고 코드 검증해야 함.
- `input type="file"` 사용시에는 `<VisuallyHiddenInput />`를 사용해야 함.
- `<Typography>`에 사용할 수 있는 건 `variant`, `component` 둘 뿐이고 `component`는 `variant`가 h6일 때만 별도로 몇단계인지 사용할 수 있음. `variant`는 h6, subtitle2, body2만 사용 가능하고 아무 프롭스도 하지 않는 순수 `<Typography>` 형태로만 사용할 수 없음.
- 액션에 의해서 추가 데이터를 불러오거나 입력하는 케이스, 버튼 눌렀을 때 팝업이 뜨는 케이스에서 데이터가 있는 경우 이 두 케이스를 제외하고 화면 로드하자마자 떠야하는 기본 데이터는 화면이 뜬 이후에 불러오면 안되고 이미 서버에서 모두 불러온 뒤에 렌더링할 때 뿌려줘야 함. (연결된 컴포넌트 포함)
- supabase 관련 작업은 `pnpm supabase`가 아닌 supabase CLI 사용해야 함.
- TextField 에는 inputProps 사용할 수 없음.
- 빌드는 하면 안됨.
- 기본으로 사용하는 포트는 3006번임. 그리고 대개 3006번 서버는 떠 있는 상태임. 강제로 종료시키려는 시도를 해서는 안됨.
