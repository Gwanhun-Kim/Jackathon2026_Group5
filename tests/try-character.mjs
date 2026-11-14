// 실제 Claude API로 캐릭터 생성 한 번 해보기 (비용 발생: 1회 소액)
// 실행: node --env-file=.env tests/try-character.mjs [이미지 경로] [이름]
//   .env 에 ANTHROPIC_API_KEY=... 한 줄 (git에 올라가지 않음)
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { createCharacter } from '../server/character-ai.mjs';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY가 없습니다. .env에 넣고 --env-file=.env 로 실행하세요.');
  process.exit(1);
}

const path = process.argv[2] ?? 'character/images/faces/son.jpg';
const name = process.argv[3];
const mediaType = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(path).toLowerCase()];
const image = readFileSync(path).toString('base64');
// 예시 스탯 (합계 49)
const stats = { stamina: 7, power: 6, attackSpeed: 8, toughness: 6, moveSpeed: 9, reach: 6, defense: 7 };

console.log(`이미지: ${path}  스탯 합계: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);
const t = Date.now();
const character = await createCharacter({ image, mediaType, stats, name });
console.log(`응답 ${((Date.now() - t) / 1000).toFixed(1)}초\n`);
console.log(JSON.stringify(character, null, 2));
