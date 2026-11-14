// 싸움 계산. 순수 JS, 의존성 없음. 브라우저·Node 모두 동작.
// 입력: characters.json의 캐릭터 객체 (stats 1~10, specialAbility)
// 출력: index.html 재생 코드가 읽는 형식 { winner, exchanges[] } + 추가 필드
import { MOVES, MOVE_KEYS } from './moves.js';

/**
 * @typedef {import('./moves.js').Move} Move
 * @typedef {{ stamina: number, power: number, attackSpeed: number, toughness: number,
 *             moveSpeed: number, reach: number, defense: number }} Stats
 * @typedef {{ id: string, name: string, stats: Stats,
 *             specialAbility?: { id: string, name: string } }} Character
 * @typedef {{ move: Move, result: 'hit'|'block'|'slip', dmg: number, ko: boolean,
 *             special: boolean, specialKO: boolean, ability?: string, hp: [number, number] }} Strike
 * @typedef {{ attacker: 0|1, counter: boolean, strikes: Strike[] }} Exchange
 * @typedef {{ winner: 0|1, exchanges: Exchange[], method: 'KO'|'TKO', seed: number,
 *             signature: [Move, Move],
 *             scorecard: { landed: [number, number], thrown: [number, number] } }} FightResult
 */

// ---------- 조정값 (밸런스는 여기만 만지면 된다) ----------
const T = {
  maxExchanges: 16,      // 이 안에 KO가 안 나면 체력 우세 쪽 TKO
  hitBase: 0.5,          // 기본 명중률
  speedEdge: 0.18,       // 공격속도 vs 이동속도 차이가 명중률에 주는 영향
  blockBase: 0.14,       // 기본 가드율
  blockPerDefense: 0.4,  // 방어 스탯에 따른 가드율 증가
  guardBase: 0.5,        // 가드 시 피해 경감률 (기본)
  guardPerDefense: 0.4,  // 방어 스탯에 따른 경감률 증가
  dmgScale: 1.45,        // 전체 피해 배율 (경기 길이 조절)
  signatureBonus: 3,     // 주특기 기술 사용 가중치 보너스
};

// ---------- 유틸 ----------
/** 시드 고정 난수 (mulberry32) */
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n = (v) => (Math.min(10, Math.max(1, v)) - 1) / 9; // 스탯 1~10 → 0~1
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- 선수 성향 ----------
/** 스탯에서 기술 사용 가중치 */
function moveWeights(s) {
  return {
    jab:   1 + 2 * n(s.reach) + 1.5 * n(s.attackSpeed),
    cross: 1 + 1.2 * n(s.power),
    hook:  0.6 + 3 * n(s.power) + 1 * (1 - n(s.reach)),
    upper: 0.4 + 2.2 * n(s.power) * (1 - n(s.reach)),
    body:  0.8 + 1.2 * n(s.stamina),
    kick:  0.4 + 2 * n(s.reach) + 0.6 * n(s.moveSpeed),
    round: 0.2 + 2.4 * n(s.reach) * n(s.power),
  };
}

/** 주특기 기술: 스탯 조합 점수가 가장 높은 기술 (잽 제외) */
export function signatureMove(character) {
  const s = character.stats;
  const score = {
    cross: s.attackSpeed + s.power + 1,
    hook:  s.power + s.toughness,
    upper: s.power * 2 - s.reach,
    body:  s.stamina + s.defense,
    kick:  s.reach + s.moveSpeed * 1.2,
    round: s.reach + s.power,
  };
  return /** @type {Move} */ (Object.keys(score).reduce((a, b) => (score[b] > score[a] ? b : a)));
}

function pickMove(weights, rng) {
  let total = 0;
  for (const k of MOVE_KEYS) total += weights[k];
  let r = rng() * total;
  for (const k of MOVE_KEYS) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'jab';
}

/** 계산용 선수 상태 */
function makeFighter(character) {
  const s = character.stats;
  const sig = signatureMove(character);
  const weights = moveWeights(s);
  weights[sig] += T.signatureBonus;
  const stMax = 60 + s.stamina * 4;
  return {
    c: character,
    s,
    ability: character.specialAbility?.id ?? null,
    sig,
    weights,
    hp: 100,
    st: stMax,
    stMax,
    paceOn: false,     // 박태환 페이스 유지 발동 중
    cooldown: 0,       // 손흥민·김연경 쿨다운 (공방 수)
    pushed: false,     // 하승진에게 밀려남 (다음 공방 불리)
    initiative: 1 + 0.6 * n(s.moveSpeed) + 0.4 * n(s.reach) + 0.3 * n(s.attackSpeed),
  };
}

/** 스태미나에 따른 성능 (0.7 ~ 1.0) */
const fatigue = (f) => 0.7 + 0.3 * Math.min(1, f.st / (f.stMax * 0.5));

function regen(f) {
  let amount = 4 + f.s.stamina * 0.8;
  if (f.ability === 'pace_control') {
    if (f.st <= f.stMax * 0.3) f.paceOn = true;
    if (f.st >= f.stMax * 0.6) f.paceOn = false;
    if (f.paceOn) amount *= 1.5;
  }
  f.st = Math.min(f.stMax, f.st + amount);
}

// ---------- 한 판 ----------
/**
 * 한 판 계산.
 * @param {Character} a
 * @param {Character} b
 * @param {number} [seed]
 * @returns {FightResult}
 */
export function simulate(a, b, seed = Math.floor(Math.random() * 2 ** 31)) {
  const rng = makeRng(seed);
  const F = [makeFighter(a), makeFighter(b)];
  /** @type {Exchange[]} */
  const exchanges = [];
  const landed = [0, 0];
  const thrown = [0, 0];
  let forced = null;     // 다음 공방 공격자 (반격)
  let kimBoost = false;  // 김연경 블로킹 후 반격 발동

  const hpNow = () => /** @type {[number, number]} */ ([F[0].hp, F[1].hp]);

  for (let round = 0; round < T.maxExchanges; round++) {
    let atk;
    let counter = false;
    if (forced !== null) {
      atk = forced;
      counter = true;
      forced = null;
    } else {
      atk = rng() < F[0].initiative / (F[0].initiative + F[1].initiative) ? 0 : 1;
    }
    const att = F[atk];
    const def = F[1 - atk];
    const boosted = counter && kimBoost && att.ability === 'block_counter';
    kimBoost = false;

    // 콤보 길이
    let len = 1;
    if (!att.pushed) {
      if (rng() < 0.25 + 0.45 * n(att.s.attackSpeed)) len++;
      if (rng() < 0.2) len++;
    }

    // 손흥민 돌파: 먼저 들어가는 공방의 첫 타
    const breakthrough = att.ability === 'breakthrough' && !counter && att.cooldown === 0;
    if (breakthrough) att.cooldown = 2;
    if (boosted) att.cooldown = 2;

    /** @type {Strike[]} */
    const strikes = [];
    let ended = false;
    for (let i = 0; i < len; i++) {
      const move = i === 0 && len > 1 && rng() < 0.5 ? 'jab' : pickMove(att.weights, rng);
      const mv = MOVES[move];
      thrown[atk]++;

      // 명중 / 가드 / 회피 확률
      let hit = T.hitBase + T.speedEdge * (n(att.s.attackSpeed) - n(def.s.moveSpeed));
      if (move === 'jab' || mv.kick) hit += 0.15 * (n(att.s.reach) - n(def.s.reach));
      if (att.ability === 'windup') hit -= 0.08;   // 준비 ×1.3 → 읽히기 쉬움
      if (boosted) hit += 0.15;                     // 준비 ×0.7
      if (att.pushed) hit -= 0.1;                   // 밀려난 상태
      hit = clamp(hit * fatigue(att), 0.15, 0.85);
      const block = T.blockBase + T.blockPerDefense * n(def.s.defense);

      const r = rng();
      /** @type {'hit'|'block'|'slip'} */
      const result = r < hit ? 'hit' : r < hit + block ? 'block' : 'slip';

      // 피해
      let dmg = mv.dmg * (0.6 + 0.8 * n(att.s.power)) / (0.6 + 0.8 * n(def.s.toughness));
      dmg *= (0.85 + rng() * 0.3) * fatigue(att) * T.dmgScale;
      /** @type {string|undefined} */
      let ability;
      if (att.ability === 'windup') { dmg *= 1.35; ability = 'windup'; }
      if (breakthrough && i === 0) { dmg *= 1.2; ability = 'breakthrough'; }
      if (boosted) ability = 'block_counter';

      if (result === 'block') {
        let reduce = T.guardBase + T.guardPerDefense * n(def.s.defense);
        if (att.ability === 'guard_break') { reduce *= 0.6; ability = 'guard_break'; }
        dmg = Math.max(1, dmg * (1 - reduce));
      } else if (result === 'slip') {
        dmg = 0;
      }
      dmg = Math.round(dmg);

      // 주특기 한 방 KO
      const special = result === 'hit' && move === att.sig;
      let specialKO = false;
      if (special) {
        const left = def.hp - dmg;
        if (left > 0 && left <= 35) {
          const chance = clamp(0.1 * (0.5 + n(att.s.power)) / (0.5 + n(def.s.toughness)) * (1 + 2 * (1 - left / 35)), 0, 0.6);
          if (rng() < chance) { specialKO = true; dmg = def.hp; }
        }
      }

      def.hp = Math.max(0, def.hp - dmg);
      att.st = Math.max(0, att.st - mv.cost);
      if (result === 'hit') landed[atk]++;

      // 하승진 접근 저지: 명중시키면 상대가 밀려남
      if (result === 'hit' && att.ability === 'keep_out') { def.pushed = true; ability = 'keep_out'; }

      const ko = def.hp <= 0;
      /** @type {Strike} */
      const strike = { move, result, dmg, ko, special, specialKO, hp: hpNow() };
      if (ability) strike.ability = ability;
      strikes.push(strike);

      if (ko) { ended = true; break; }
      if (result === 'slip') {
        if (rng() < 0.2 + 0.4 * n(def.s.attackSpeed)) forced = 1 - atk;
        break;
      }
      if (result === 'block' && def.ability === 'block_counter' && def.cooldown === 0 && rng() < 0.6) {
        forced = 1 - atk;
        kimBoost = true;
        break;
      }
    }

    exchanges.push({ attacker: /** @type {0|1} */ (atk), counter, strikes });
    att.pushed = false;
    if (ended) {
      return { winner: /** @type {0|1} */ (atk), exchanges, method: 'KO', seed, signature: [F[0].sig, F[1].sig], scorecard: { landed: /** @type {[number, number]} */ (landed), thrown: /** @type {[number, number]} */ (thrown) } };
    }
    for (const f of F) {
      regen(f);
      if (f.cooldown > 0) f.cooldown--;
    }
  }

  // 시간 안에 KO가 안 나면 체력 우세 쪽이 주특기로 마무리 (렌더러는 KO로 끝나야 함)
  const w = F[0].hp >= F[1].hp ? 0 : 1;
  const hp = hpNow();
  hp[1 - w] = 0;
  exchanges.push({
    attacker: /** @type {0|1} */ (w),
    counter: false,
    strikes: [{ move: F[w].sig, result: 'hit', dmg: F[1 - w].hp, ko: true, special: true, specialKO: true, hp }],
  });
  landed[w]++;
  thrown[w]++;
  return { winner: /** @type {0|1} */ (w), exchanges, method: 'TKO', seed, signature: [F[0].sig, F[1].sig], scorecard: { landed: /** @type {[number, number]} */ (landed), thrown: /** @type {[number, number]} */ (thrown) } };
}

// ---------- 여러 판 ----------
/**
 * n판 승수.
 * @returns {{ wins: [number, number], ko: [number, number] }}
 */
export function simulateMany(a, b, count = 100, baseSeed = 1) {
  const wins = [0, 0];
  const ko = [0, 0];
  for (let i = 0; i < count; i++) {
    const r = simulate(a, b, baseSeed + i);
    wins[r.winner]++;
    if (r.method === 'KO') ko[r.winner]++;
  }
  return { wins: /** @type {[number, number]} */ (wins), ko: /** @type {[number, number]} */ (ko) };
}

/**
 * 화면용: 100판 승률 + 재생할 대표 한 판.
 * 대표 판은 승률이 높은 쪽이 이긴 판 중 하나 (접전이면 아무 판).
 * @returns {{ wins: [number, number], ko: [number, number], favorite: 0|1|null, fight: FightResult }}
 */
export function simulateMatch(a, b, count = 100, baseSeed = Math.floor(Math.random() * 2 ** 31)) {
  const { wins, ko } = simulateMany(a, b, count, baseSeed);
  const gap = Math.abs(wins[0] - wins[1]) / count;
  const favorite = gap < 0.1 ? null : wins[0] > wins[1] ? 0 : 1;
  let fight = simulate(a, b, baseSeed);
  if (favorite !== null) {
    for (let i = 0; i < count && fight.winner !== favorite; i++) fight = simulate(a, b, baseSeed + i);
  }
  return { wins, ko, favorite, fight };
}
