// POST /api/character  (Vercel 서버 함수)
// 요청: { image: "data:image/png;base64,..." 또는 base64, mediaType?, stats: {7개, 1~10, 합계 ≤ 49}, name? }
// 응답 200: { character: { id, name, title, intro, custom, stats, appearance: { style, signatureMove } } }
// 응답 4xx/5xx: { error: "메시지" }
import Anthropic from '@anthropic-ai/sdk';
import { createCharacter, InputError, AiError } from '../server/character-ai.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST만 지원합니다.' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const character = await createCharacter(body);
    return res.status(200).json({ character });
  } catch (error) {
    if (error instanceof InputError || error instanceof SyntaxError) return res.status(400).json({ error: error.message });
    if (error instanceof AiError) return res.status(502).json({ error: error.message });
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' });
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY 확인 필요');
      return res.status(500).json({ error: '서버 설정 오류입니다.' });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('Claude API 오류', error.status, error.message);
      return res.status(502).json({ error: 'AI 서버 오류입니다. 다시 시도해 주세요.' });
    }
    console.error(error);
    return res.status(500).json({ error: '알 수 없는 오류입니다.' });
  }
}
