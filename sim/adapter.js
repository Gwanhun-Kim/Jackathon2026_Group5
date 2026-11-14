// 캐릭터(characters.json) → 렌더러 입력(index.html의 INPUTS 형식) 변환
import { signatureMove } from './sim.js';

const n = (v) => (Math.min(10, Math.max(1, v)) - 1) / 9;
const COLORS = ['#ff3b30', '#0a84ff'];

/** 스탯으로 파이팅 스타일 결정 (index.html STYLES 키) */
function styleOf(s) {
  const score = {
    outboxer: s.reach + s.moveSpeed,
    infighter: s.power + s.toughness,
    counter: s.defense + s.attackSpeed,
    kickboxer: s.reach + s.power - 1,
  };
  return /** @type {keyof typeof score} */ (Object.keys(score).reduce((a, b) => (score[b] > score[a] ? b : a)));
}

/** 스탯으로 체격 결정 (index.html BUILDS 키) */
function buildOf(s) {
  if (s.toughness >= 9 && s.moveSpeed <= 5) return 'chubby';
  if (s.moveSpeed >= 9) return 'slim';
  if ((s.power + s.toughness) / 2 >= 8) return 'muscle';
  return 'normal';
}

/**
 * @param {import('./sim.js').Character & { color?: string, stance?: 'orthodox'|'southpaw' }} character
 * @param {0|1} index  화면 왼쪽(0) / 오른쪽(1). 색 기본값에 쓴다
 */
export function toRenderInput(character, index) {
  const s = character.stats;
  return {
    name: character.name,
    color: character.color ?? COLORS[index],
    stance: character.stance ?? 'orthodox',
    height: Math.round(165 + n(s.reach) * 30),        // 165~195cm
    build: buildOf(s),
    reach: +(0.92 + n(s.reach) * 0.2).toFixed(2),     // 팔 길이 배율 0.92~1.12
    style: styleOf(s),
    special: signatureMove(character),
    speed: +(0.85 + n(s.attackSpeed) * 0.35).toFixed(2), // 동작 재생 속도 0.85~1.2
    power: +(0.8 + n(s.power) * 0.5).toFixed(2),         // 표시용 0.8~1.3
    chin: +(0.8 + n(s.toughness) * 0.5).toFixed(2),      // 표시·피격 반응용 0.8~1.3
  };
}
