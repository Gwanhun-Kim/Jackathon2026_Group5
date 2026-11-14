# 누가 이김? — 로컬 프론트엔드 프로토타입

순수 HTML / CSS / JavaScript ES modules. 별도 패키지 설치나 빌드 없이 실행합니다.

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

브라우저에서 http://127.0.0.1:5173 접속. JSON을 fetch하므로 index.html을 파일로 직접 열지 마세요.

- `src/data.js`: 서비스 제목 `SERVICE_TITLE`, 사용 방법, 선수 목록, ID별 이미지 경로 `CHARACTER_IMAGES`.
- `characters.json`: 기존 스탯과 특수 효과의 단일 원본. 값은 변경하지 않았습니다. 읽기 실패 시 ‘데이터 준비 중’ 표시.
- `src/app.js`: 시작 / 사용 방법 / 선택 화면과 상태. `state.browsing`은 탐색 위치, `state.selected`는 최종 선택 캐릭터 객체. 새로고침 시 초기화됩니다.
- `src/styles.css`: 반응형 레이아웃, 전시실 애니메이션, 모션 감소 설정.

## 이미지 교체

완성된 맨손 선수 이미지를 `assets/characters/` 등에 넣고 `src/data.js`의 경로를 변경합니다.

```js
export const CHARACTER_IMAGES = {
  ohtani: './assets/characters/ohtani.png',
  ngannou: null, son: null, kim: null, ha: null, park: null
};
```

투명 배경 전신 PNG/WebP를 권장합니다. null 또는 로딩 실패 시 이름이 표시된 실루엣을 사용합니다. 기존 `assets/sports-parts-v1/`은 신체 부품 자산이므로 보존했으며 완성된 선수 이미지로 재사용하지 않습니다.

선택 완료까지의 프로토타입입니다. 직접 생성 버튼은 안내 모달만 엽니다. 이미지 생성 API, 대결, 서버 저장은 연결하지 않았습니다.
