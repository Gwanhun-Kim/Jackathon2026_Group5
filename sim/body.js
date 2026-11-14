// 체격 보정: 1~10점 스탯(기술 수준)과 별개로 몸무게·리치 차이를 승패에 반영한다.
// 경기 화면(fight/index.html)과 승률 계산(sim/sim.js)이 같은 공식을 쓰도록 여기 한 곳에만 둔다.

const DEFAULT_WEIGHT = 70;
const DEFAULT_HEIGHT = 175;

/**
 * appearance(heightCm, weightKg, reachCm)에서 체격 값을 꺼낸다. 없으면 기본값.
 * 리치가 없으면 키로 대신한다.
 * @param {{ heightCm?: number, weightKg?: number, reachCm?: number } | undefined} ap
 */
export function bodyOf(ap) {
  const a = ap || {};
  const height = Number(a.heightCm) || DEFAULT_HEIGHT;
  return {
    weight: Number(a.weightKg) || DEFAULT_WEIGHT,
    reach: Number(a.reachCm) || height,
  };
}

/** 몸무게 차이 → 데미지 배율. 무거운 쪽이 더 세게 때리고 덜 아프다 (0.6 ~ 1.6) */
export function bodyDamageFactor(attBody, defBody) {
  const ratio = Math.sqrt(attBody.weight / defBody.weight);
  return Math.min(1.6, Math.max(0.6, ratio));
}

/** 리치 차이 → 명중률 보정. 10cm 길면 +1.5%p */
export function bodyHitBonus(attBody, defBody) {
  return (attBody.reach - defBody.reach) / 100 * 0.15;
}
