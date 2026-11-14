// 밸런스 점검: node sim/balance.mjs
// 6명 전체 대진을 100판씩 돌려 승률표를 출력한다.
import { readFileSync } from 'node:fs';
import { simulateMany, simulate, signatureMove } from './sim.js';
import { toRenderInput } from './adapter.js';

const data = JSON.parse(readFileSync(new URL('../characters.json', import.meta.url), 'utf8'));
const C = data.characters;
const N = Number(process.argv[2] ?? 100);

console.log('선수별 주특기·외형');
for (const c of C) {
  const r = toRenderInput(c, 0);
  console.log(`  ${c.name.padEnd(4, '　')} 주특기 ${signatureMove(c).padEnd(5)} ${r.style.padEnd(9)} ${r.build.padEnd(6)} ${r.height}cm`);
}

console.log(`\n대진별 승률 (${N}판, 행 기준 승수)`);
const total = Object.fromEntries(C.map((c) => [c.id, 0]));
const header = '        ' + C.map((c) => c.name.padStart(4, '　')).join(' ');
console.log(header);
for (const a of C) {
  const row = C.map((b) => {
    if (a === b) return '   —';
    const { wins } = simulateMany(a, b, N);
    total[a.id] += wins[0];
    return String(wins[0]).padStart(4);
  });
  console.log(`${a.name.padEnd(4, '　')}  ${row.join('  ')}`);
}

console.log('\n전체 승률');
for (const c of [...C].sort((x, y) => total[y.id] - total[x.id])) {
  console.log(`  ${c.name.padEnd(4, '　')} ${((total[c.id] / (N * (C.length - 1))) * 100).toFixed(1)}%`);
}

// 경기 길이 점검
let ex = 0, tko = 0;
for (let i = 0; i < 300; i++) {
  const r = simulate(C[i % 6], C[(i + 1) % 6], i);
  ex += r.exchanges.length;
  if (r.method === 'TKO') tko++;
}
console.log(`\n평균 공방 수 ${(ex / 300).toFixed(1)}, 시간 초과 TKO 비율 ${((tko / 300) * 100).toFixed(0)}%`);
