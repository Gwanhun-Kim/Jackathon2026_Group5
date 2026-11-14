// 캐릭터 생성 API 테스트 (가짜 Claude client, 네트워크·비용 없음)
// 실행: node tests/character-api.test.mjs
import assert from 'node:assert/strict';
import { createCharacter, validateInput, parseOutput, InputError, AiError } from '../server/character-ai.mjs';
import handler from '../api/character.mjs';

// 1×1 투명 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const STATS = { stamina: 7, power: 9, attackSpeed: 5, toughness: 7, moveSpeed: 6, reach: 10, defense: 5 }; // 합 49

function fakeClient(text, stop_reason = 'end_turn') {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (params) => { calls.push(params); return { stop_reason, content: [{ type: 'text', text }] }; } } },
  };
}

function fakeRes() {
  return {
    statusCode: 0, body: null, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log('ok', name);
}

await test('data URL을 받아 형식을 읽는다', () => {
  const v = validateInput({ image: `data:image/png;base64,${PNG}`, stats: STATS });
  assert.equal(v.mediaType, 'image/png');
  assert.equal(v.image, PNG);
});

await test('스탯 합계 49 초과는 거부', () => {
  assert.throws(() => validateInput({ image: PNG, stats: { ...STATS, power: 10 } }), InputError);
});

await test('스탯 범위·누락 거부', () => {
  assert.throws(() => validateInput({ image: PNG, stats: { ...STATS, reach: 11 } }), InputError);
  const { defense, ...missing } = STATS;
  assert.throws(() => validateInput({ image: PNG, stats: missing }), InputError);
});

await test('잘못된 이미지 거부', () => {
  assert.throws(() => validateInput({ image: 'not base64!!', stats: STATS }), InputError);
  assert.throws(() => validateInput({ image: `data:image/gif;base64,${PNG}`, stats: STATS }), InputError);
});

await test('AI 응답의 잘못된 값은 기본값으로', () => {
  const out = parseOutput('{"name":"","title":"야근의 신","intro":"소개","style":"wrestler","signatureMove":"elbow"}', { name: null });
  assert.equal(out.name, '이름없음');
  assert.equal(out.style, 'infighter');
  assert.equal(out.signatureMove, 'hook');
});

await test('JSON 앞뒤 문장이 있어도 꺼낸다', () => {
  const out = parseOutput('결과입니다:\n{"name":"철벽","style":"counter","signatureMove":"cross"}\n끝', { name: null });
  assert.equal(out.style, 'counter');
});

await test('createCharacter: 요청 형식과 결과', async () => {
  const client = fakeClient('{"name":"야근전사","title":"야근의 신","intro":"새벽 3시에도 훅은 살아있다","style":"outboxer","signatureMove":"round"}');
  const c = await createCharacter({ image: PNG, stats: STATS, name: '지호' }, { client });
  assert.equal(c.name, '지호'); // 사용자가 준 이름 우선
  assert.deepEqual(c.appearance, { style: 'outboxer', signatureMove: 'round' });
  assert.deepEqual(c.stats, STATS);
  assert.ok(c.id.startsWith('user-'));
  const p = client.calls[0];
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.messages[0].content[0].type, 'image');
});

await test('거절(refusal)은 AiError', async () => {
  await assert.rejects(createCharacter({ image: PNG, stats: STATS }, { client: fakeClient('', 'refusal') }), AiError);
});

await test('handler: GET은 405, 잘못된 입력은 400', async () => {
  let res = fakeRes();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
  res = fakeRes();
  await handler({ method: 'POST', body: { image: PNG, stats: { ...STATS, power: 10 } } }, res);
  assert.equal(res.statusCode, 400);
});

console.log(`\n${passed}개 통과`);
