// 싸움 계산 (승패를 정하는 모든 규칙). 순수 JS, 브라우저·Node 모두 동작.
// fight/index.html의 simulateFight를 그대로 옮겨 왔다. 화면 경기와 100판 승률이 같은 로직을 쓴다.
// 연출(카메라, 애니메이션, 자막)은 fight/에서 다룬다. 승패에 영향을 주는 수정은 여기서만 한다.
import { bodyOf, bodyDamageFactor, bodyHitBonus } from './body.js';
import { MOVES } from './moves.js';

// ---------- 스타일 (승패에 쓰는 값만. 표시명·거리는 fight/의 STYLES) ----------
// aggr = 얼마나 자주 들어가는지, combo = 콤보 길이, counter = 반격 확률, moves = 기술 비율
export const STYLE_LOGIC = {
  infighter: { aggr: 0.75, combo: 0.7, counter: 0.3, moves: { jab: 1, cross: 2, hook: 4, upper: 3, body: 3, kick: 0.5, round: 0.3 } },
  outboxer:  { aggr: 0.45, combo: 0.3, counter: 0.5, moves: { jab: 5, cross: 3, hook: 1, upper: 0.5, body: 1, kick: 1, round: 1 } },
  counter:   { aggr: 0.3,  combo: 0.4, counter: 0.9, moves: { jab: 2, cross: 4, hook: 2, upper: 2, body: 1, kick: 0.5, round: 0.5 } },
  kickboxer: { aggr: 0.55, combo: 0.5, counter: 0.4, moves: { jab: 2, cross: 2, hook: 1, upper: 0.5, body: 1, kick: 3, round: 3 } },
};
export const STYLE_DEFAULT_MOVE = { infighter: 'hook', outboxer: 'jab', counter: 'cross', kickboxer: 'round' };

// appearance.style이 없을 때(프리셋 등) 가장 높은 스탯으로 스타일 결정.
// character/app.js의 appearanceOf와 같은 규칙 (동점이면 PRIORITY 순)
const STYLE_PRIORITY = ['power', 'attackSpeed', 'reach', 'moveSpeed', 'defense', 'toughness', 'stamina'];
const STYLE_BY_STAT = { power: 'infighter', toughness: 'infighter', attackSpeed: 'infighter', reach: 'outboxer', moveSpeed: 'outboxer', stamina: 'outboxer', defense: 'counter' };
export function styleFromStats(st) {
  const top = STYLE_PRIORITY.slice().sort((a, b) => ((st[b] || 0) - (st[a] || 0)) || (STYLE_PRIORITY.indexOf(a) - STYLE_PRIORITY.indexOf(b)))[0];
  return STYLE_BY_STAT[top];
}

// 경기 길이: 공방 수 상한 (약 25초)
export const MAX_EXCHANGES = 12;

// 1~10점을 계산용 배율로 (1점 0.75배 ~ 10점 1.35배)
export function statScale(v) {
  const n = Math.min(10, Math.max(1, Number(v) || 5));
  return 0.75 + (n - 1) / 9 * 0.6;
}

// ---------- 선수 만들기 ----------
/**
 * 캐릭터(characters.json 형식: stats 7개 + specialAbility + appearance) → 계산용 값.
 * fight/의 fromCharacter가 화면용 값과 함께 이 값을 펼쳐 쓴다.
 */
export function logicFromCharacter(c) {
  const st = c.stats || {};
  const ap = c.appearance || {};
  // appearance.style이 없으면 infighter (fight/ 기존 동작과 동일). 스탯 기반으로 바꾸려면 styleFromStats(st)
  const style = STYLE_LOGIC[ap.style] ? ap.style : 'infighter';
  const special = MOVES[ap.signatureMove] ? ap.signatureMove : STYLE_DEFAULT_MOVE[style];
  return {
    style,
    special,
    height: Number(ap.heightCm) || 175,
    weight: ap.weightKg || null,
    reachCm: ap.reachCm || null,
    power: statScale(st.power),
    speed: statScale(((Number(st.attackSpeed) || 5) + (Number(st.moveSpeed) || 5)) / 2),
    chin: statScale(st.toughness),
    defense: statScale(st.defense),
    stamina: statScale(st.stamina),
    ability: c.specialAbility ? { id: c.specialAbility.id, name: c.specialAbility.name } : null,
  };
}

/** 스타일·주특기 → 공격성, 콤보, 반격, 기술 비율. fight/의 buildPlayer가 펼쳐 쓴다 */
export function toFighter(p) {
  const st = STYLE_LOGIC[p.style] || STYLE_LOGIC.infighter;
  const moves = { ...st.moves };
  moves[p.special] = (moves[p.special] || 0) + 3;
  return { aggr: st.aggr, combo: st.combo, counter: st.counter, moves };
}

/** 화면 없이 계산만 할 때 (승률표, 판결 카드): 캐릭터 → 계산용 선수 */
export function makeFighter(c) {
  const p = { defense: 1, stamina: 1, ability: null, name: c.name, ...logicFromCharacter(c) };
  return { ...p, ...toFighter(p) };
}

// ---------- 난수 ----------
/** 시드 고정 난수 (mulberry32). seed가 같으면 같은 경기 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedMove(moves, rng) {
  let total = 0;
  for (const k in moves) total += moves[k];
  let r = rng() * total;
  for (const k in moves) {
    r -= moves[k];
    if (r <= 0) return k;
  }
  return 'jab';
}

// 주특기가 맞았을 때 한 방에 끝낼 확률. 상대 체력이 절반 아래일 때만, 낮을수록 올라감
export function specialKoChance(att, def, defHp) {
  if (defHp > 50) return 0;
  let base = 0.06 * att.power / def.chin;
  if (att.special === 'jab') base *= 0.5;
  return Math.min(0.9, base * (1 + 3 * (1 - defHp / 100)));
}

// 선수 체격 (키·몸무게·리치)
function playerBody(p) {
  return bodyOf({ heightCm: p.height, weightKg: p.weight, reachCm: p.reachCm });
}

// ---------- 한 판 ----------
/**
 * 한 판 계산. 결과 형식:
 * { winner: 0|1, exchanges: [{ attacker: 0|1, counter, strikes: [{ move, result: 'hit'|'block'|'slip',
 *   dmg, ko, special, specialKO, ability }] }] }
 * @param {object} A 계산용 선수 (fight/의 PLAYERS[i] 또는 makeFighter 결과)
 * @param {object} B
 * @param {() => number} [rng] 난수. 생략하면 Math.random (화면 기존 동작과 같음)
 */
export function simulateFight(A, B, rng = Math.random) {
  const rand = (a, b) => a + rng() * (b - a);
  const P = [A, B];
  const bodies = [playerBody(A), playerBody(B)];
  const hp = [100, 100];
  const exchanges = [];
  let forced = null;
  for (let n = 0; n < MAX_EXCHANGES; n++) {
    let atk;
    let counter = false;
    if (forced !== null) {
      atk = forced;
      counter = true;
      forced = null;
    } else {
      atk = rng() < A.aggr / (A.aggr + B.aggr) ? 0 : 1;
    }
    const att = P[atk];
    const def = P[1 - atk];
    const abl = att.ability ? att.ability.id : null;
    const defAbl = def.ability ? def.ability.id : null;
    // 돌파 공격: 거리를 좁히며 시작하는 공격이 가끔 강해짐
    const breakthrough = abl === 'breakthrough' && !counter && rng() < 0.35;
    let len = 1;
    if (rng() < att.combo) len++;
    if (rng() < 0.3) len++;
    const strikes = [];
    for (let i = 0; i < len; i++) {
      const move = i === 0 && len > 1 && rng() < 0.6 ? 'jab' : weightedMove(att.moves, rng);
      // 후반에는 체력(stamina)이 낮은 쪽이 덜 맞힌다
      const tired = Math.max(0, n - 5) * 0.02 * (1.35 - att.stamina);
      let hitChance = 0.5 + (att.speed - def.speed) * 0.4 - tired;
      // 리치가 길면 조금 더 잘 맞힌다
      hitChance += bodyHitBonus(bodies[atk], bodies[1 - atk]);
      if (counter && abl === 'block_counter') hitChance += 0.2;
      if (abl === 'pace_control' && hp[atk] <= 30) hitChance += 0.1;
      const blockChance = 0.3 + (def.defense - 1) * 0.3;
      const r = rng();
      let result = 'slip';
      if (r < hitChance) result = 'hit';
      else if (r < hitChance + blockChance) result = 'block';
      let dmg = 0;
      let ability = null;
      // 몸무게가 무거울수록 세게 때리고 덜 아프다
      if (result === 'hit') dmg = Math.round(MOVES[move].dmg * att.power / def.chin * bodyDamageFactor(bodies[atk], bodies[1 - atk]) * rand(0.8, 1.25) * 1.15);
      if (result === 'block') dmg = 1;
      // 특수능력 효과
      if (abl === 'windup' && result === 'hit') {
        dmg = Math.round(dmg * 1.35);
        ability = 'windup';
      }
      if (abl === 'guard_break' && result === 'block') {
        dmg = 4;
        ability = 'guard_break';
      }
      if (breakthrough && i === 0 && result === 'hit') {
        dmg = Math.round(dmg * 1.2);
        ability = 'breakthrough';
      }
      if (counter && i === 0 && abl === 'block_counter') ability = 'block_counter';
      if (abl === 'keep_out' && result === 'hit') ability = 'keep_out';
      if (abl === 'pace_control' && hp[atk] <= 30 && result === 'hit') ability = 'pace_control';
      const special = result === 'hit' && move === att.special;
      let specialKO = false;
      if (special && rng() < specialKoChance(att, def, hp[1 - atk])) {
        specialKO = true;
        dmg = Math.max(dmg, hp[1 - atk]);
      }
      hp[1 - atk] -= dmg;
      const ko = hp[1 - atk] <= 0;
      strikes.push({ move, result, dmg, ko, special, specialKO, ability });
      if (ko) {
        exchanges.push({ attacker: atk, counter, strikes });
        return { exchanges, winner: atk };
      }
      if (result === 'slip') {
        if (rng() < def.counter) forced = 1 - atk;
        break;
      }
      // 블로킹 후 반격: 막자마자 바로 반격
      if (result === 'block' && defAbl === 'block_counter' && rng() < 0.7) {
        forced = 1 - atk;
        break;
      }
    }
    exchanges.push({ attacker: atk, counter, strikes });
  }
  // 시간 안에 안 끝나면 체력이 많은 쪽이 주특기로 마무리
  const atk = hp[0] >= hp[1] ? 0 : 1;
  exchanges.push({ attacker: atk, counter: false, strikes: [{ move: P[atk].special, result: 'hit', dmg: 100, ko: true, special: true, specialKO: true }] });
  return { exchanges, winner: atk };
}

// ---------- 여러 판 ----------
/** n판 승수. seed가 같으면 같은 결과 */
export function simulateMany(A, B, count = 100, seed = 1) {
  const rng = makeRng(seed);
  const wins = [0, 0];
  for (let i = 0; i < count; i++) wins[simulateFight(A, B, rng).winner]++;
  return { wins };
}

/**
 * 판결용: n판 승률 + 화면에 재생할 대표 한 판.
 * 대표 판은 승률이 높은 쪽이 이긴 판 (승률 차 10% 미만이면 접전으로 보고 아무 판).
 * @returns {{ wins: [number, number], favorite: 0|1|null, fight: { winner: 0|1, exchanges: any[] } }}
 */
export function simulateMatch(A, B, count = 100, seed = Math.floor(Math.random() * 2 ** 31)) {
  const { wins } = simulateMany(A, B, count, seed);
  const favorite = Math.abs(wins[0] - wins[1]) / count < 0.1 ? null : wins[0] > wins[1] ? 0 : 1;
  const rng = makeRng(seed + 1);
  let fight = simulateFight(A, B, rng);
  for (let i = 0; favorite !== null && fight.winner !== favorite && i < 200; i++) fight = simulateFight(A, B, rng);
  return { wins, favorite, fight };
}
