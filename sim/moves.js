// 기술 정의 (승패 계산용): 표시명, 기본 피해, 맞는 곳, 큰 반응 여부
// 화면용 정보(애니메이션 클립, 닿는 부위 뼈, 재생 속도)는 fight/index.html의 MOVES에 둔다.
// 기술을 추가하려면: 여기에 한 줄 + fight/index.html의 FILES·MOVES에 클립 연결.
export const MOVES = {
  jab:   { label: '잽',      dmg: 5,  target: 'head' },
  cross: { label: '크로스',   dmg: 8,  target: 'head' },
  hook:  { label: '훅',      dmg: 11, target: 'head', heavy: true },
  upper: { label: '어퍼컷',   dmg: 12, target: 'head', heavy: true },
  body:  { label: '바디샷',   dmg: 7,  target: 'body' },
  kick:  { label: '미들킥',   dmg: 14, target: 'body', heavy: true },
  round: { label: '돌려차기', dmg: 15, target: 'head', heavy: true },
};
