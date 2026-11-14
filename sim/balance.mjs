// 밸런스 점검: node sim/balance.mjs [판수]
// characters.json 전체 대진을 n판씩 돌려 승률표를 출력한다.
import { readFileSync } from 'node:fs';
import { makeFighter, simulateMany } from './sim.js';

const data = JSON.parse(readFileSync(new URL('../characters.json', import.meta.url), 'utf8'));
const C = data.characters;
const F = Object.fromEntries(C.map((c) => [c.id, makeFighter(c)]));
const N = Number(process.argv[2] ?? 100);
const pad = (s, w) => s + '　'.repeat(Math.max(0, w - s.length));

console.log('선수별 스타일·주특기');
for (const c of C) console.log(`  ${pad(c.name, 4)} ${F[c.id].style.padEnd(9)} ${F[c.id].special}`);

console.log(`\n대진별 승수 (${N}판, 행 기준)`);
console.log('        ' + C.map((c) => pad(c.name, 4)).join(' '));
const total = Object.fromEntries(C.map((c) => [c.id, 0]));
for (const a of C) {
  const row = C.map((b) => {
    if (a === b) return '    —';
    const { wins } = simulateMany(F[a.id], F[b.id], N);
    total[a.id] += wins[0];
    return String(wins[0]).padStart(5);
  });
  console.log(`${pad(a.name, 4)}${row.join('  ')}`);
}

console.log('\n전체 승률');
for (const c of [...C].sort((x, y) => total[y.id] - total[x.id])) {
  console.log(`  ${pad(c.name, 4)} ${((total[c.id] / (N * (C.length - 1))) * 100).toFixed(1)}%`);
}
