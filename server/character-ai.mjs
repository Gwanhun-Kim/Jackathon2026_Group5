// 캐릭터 이미지 + 스탯 → Claude가 캐릭터 설정(이름, 칭호, 소개, 스타일, 주특기)을 만든다.
// Claude는 이미지를 "분석"만 한다. 얼굴 이미지 자체는 클라이언트가 가진 PNG를 그대로 붙인다.
// 화면·문구 스타일은 나중에 조정: 프롬프트(SYSTEM_PROMPT)와 출력 필드(OUTPUT_FIELDS)만 고치면 된다.
import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5-5';

// sim/sim.js가 읽는 값과 같아야 한다 (appearance.style, appearance.signatureMove)
export const STYLES = ['infighter', 'outboxer', 'counter', 'kickboxer'];
export const MOVES = ['jab', 'cross', 'hook', 'upper', 'body', 'kick', 'round'];
export const STAT_KEYS = ['stamina', 'power', 'attackSpeed', 'toughness', 'moveSpeed', 'reach', 'defense'];
export const STAT_BUDGET = 49;            // 프리셋 6명 스탯 합계와 같음
const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 400×530 PNG는 보통 수백 KB

/** 입력이 잘못됐을 때 (HTTP 400) */
export class InputError extends Error {}
/** Claude가 요청을 거절했거나 응답을 해석할 수 없을 때 (HTTP 502) */
export class AiError extends Error {}

const SYSTEM_PROMPT = `너는 "그래서 누가 이김?" 서비스의 격투 캐릭터 작가다.
사용자가 자기 사진과 스탯을 주면, 그 사람을 맨손 격투 게임 캐릭터로 만든다.
- 사진에서 보이는 분위기(표정, 옷차림, 자세)를 재치 있게 살린다. 외모를 비하하거나 인종·나이·성별·체형을 놀리지 않는다.
- 사진 속 인물이 누구인지 추측하거나 실명을 쓰지 않는다.
- 스탯이 높은 항목이 캐릭터의 개성이 되게 한다.
- 반드시 아래 형식의 JSON 객체 하나만 출력한다. 설명 문장, 코드 블록 표시를 붙이지 않는다.
{
  "name": "캐릭터 이름 (사용자가 이름을 주면 그대로, 없으면 2~6자 별명)",
  "title": "짧은 칭호 (예: 야근의 신, 2~10자)",
  "intro": "한 줄 소개 (20~45자, 한국어)",
  "style": "infighter | outboxer | counter | kickboxer 중 하나",
  "signatureMove": "jab | cross | hook | upper | body | kick | round 중 하나"
}
스타일 기준: 파워·맷집·공격속도가 높으면 infighter, 사거리·이동속도·체력이 높으면 outboxer, 방어가 높으면 counter, 발차기 동작이 인상적이면 kickboxer.`;

/** 입력 검증. 이미지(base64 또는 data URL)와 스탯 7개를 받는다 */
export function validateInput(body) {
  if (!body || typeof body !== 'object') throw new InputError('JSON 본문이 필요합니다.');
  let { image, mediaType, stats, name } = body;

  if (typeof image !== 'string' || !image) throw new InputError('image(base64 또는 data URL)가 필요합니다.');
  const m = image.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) { mediaType = m[1]; image = m[2]; }
  mediaType = mediaType || 'image/png';
  if (!MEDIA_TYPES.includes(mediaType)) throw new InputError(`지원하지 않는 이미지 형식입니다: ${mediaType}`);
  image = image.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(image)) throw new InputError('image가 올바른 base64가 아닙니다.');
  if (image.length * 0.75 > MAX_IMAGE_BYTES) throw new InputError('이미지가 너무 큽니다 (3MB 이하).');

  if (!stats || typeof stats !== 'object') throw new InputError('stats가 필요합니다.');
  const clean = {};
  for (const k of STAT_KEYS) {
    const v = stats[k];
    if (!Number.isInteger(v) || v < 1 || v > 10) throw new InputError(`stats.${k}는 1~10 정수여야 합니다.`);
    clean[k] = v;
  }
  const sum = STAT_KEYS.reduce((a, k) => a + clean[k], 0);
  if (sum > STAT_BUDGET) throw new InputError(`스탯 합계는 ${STAT_BUDGET} 이하여야 합니다 (현재 ${sum}).`);

  if (name != null && (typeof name !== 'string' || name.length > 20)) throw new InputError('name은 20자 이하 문자열이어야 합니다.');
  return { image, mediaType, stats: clean, name: name?.trim() || null };
}

/** Claude 응답 텍스트에서 JSON을 꺼내 검증. 이상한 값은 기본값으로 */
export function parseOutput(text, input) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('AI 응답에서 JSON을 찾지 못했습니다.');
  let out;
  try { out = JSON.parse(text.slice(start, end + 1)); }
  catch { throw new AiError('AI 응답 JSON을 해석하지 못했습니다.'); }

  const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
  return {
    name: input.name || str(out.name, 20) || '이름없음',
    title: str(out.title, 20) || '',
    intro: str(out.intro, 80) || '',
    style: STYLES.includes(out.style) ? out.style : 'infighter',
    signatureMove: MOVES.includes(out.signatureMove) ? out.signatureMove : 'hook',
  };
}

let defaultClient = null;
function getClient() {
  // ANTHROPIC_API_KEY 환경변수를 읽는다 (Vercel 프로젝트 설정에 등록)
  defaultClient ??= new Anthropic();
  return defaultClient;
}

/**
 * 캐릭터 생성.
 * @param {unknown} body  { image, mediaType?, stats, name? }
 * @param {{ client?: Anthropic }} [opts]  테스트에서 가짜 client 주입용
 * @returns {Promise<object>} characters.json과 같은 형식의 캐릭터 (얼굴 이미지는 클라이언트가 붙임)
 */
export async function createCharacter(body, { client = getClient() } = {}) {
  const input = validateInput(body);

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' }, // 짧은 창작 작업이라 빠르게
    // 안전 분류기가 거절하면 같은 요청을 다른 모델로 다시 시도
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.image } },
        { type: 'text', text: `스탯 (1~10): ${JSON.stringify(input.stats)}\n이름: ${input.name ?? '(없음, 지어줘)'}` },
      ],
    }],
  });

  if (response.stop_reason === 'refusal') throw new AiError('AI가 이 이미지로 캐릭터 만들기를 거절했습니다. 다른 사진을 써 주세요.');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const ai = parseOutput(text, input);

  return {
    id: `user-${Date.now().toString(36)}`,
    name: ai.name,
    title: ai.title,
    intro: ai.intro,
    custom: true,
    stats: input.stats,
    appearance: { style: ai.style, signatureMove: ai.signatureMove },
  };
}
