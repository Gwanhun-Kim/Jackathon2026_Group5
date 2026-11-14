// 기술 정의: "무슨 일이 일어나는가" (계산용)
// 화면용 정보(애니메이션 클립, 맞는 부위 뼈, 재생 속도)는 index.html의 MOVES에 그대로 둔다.
// 기술을 추가하려면: 여기에 한 줄 + index.html MOVES·FILES에 클립 연결.

/**
 * @typedef {'jab'|'cross'|'hook'|'upper'|'body'|'kick'|'round'} Move
 * @typedef {{ label: string, dmg: number, target: 'head'|'body', heavy: boolean, kick: boolean, cost: number }} MoveDef
 */

/** @type {Record<Move, MoveDef>} */
export const MOVES = {
  jab:   { label: '잽',      dmg: 5,  target: 'head', heavy: false, kick: false, cost: 3 },
  cross: { label: '크로스',   dmg: 8,  target: 'head', heavy: false, kick: false, cost: 5 },
  hook:  { label: '훅',      dmg: 11, target: 'head', heavy: true,  kick: false, cost: 7 },
  upper: { label: '어퍼컷',   dmg: 12, target: 'head', heavy: true,  kick: false, cost: 7 },
  body:  { label: '바디샷',   dmg: 7,  target: 'body', heavy: false, kick: false, cost: 5 },
  kick:  { label: '미들킥',   dmg: 14, target: 'body', heavy: true,  kick: true,  cost: 9 },
  round: { label: '돌려차기', dmg: 15, target: 'head', heavy: true,  kick: true,  cost: 10 },
};

export const MOVE_KEYS = /** @type {Move[]} */ (Object.keys(MOVES));
