import { API_CONFIG } from './config.js';
export function createMatchClient(config = API_CONFIG, fetcher = globalThis.fetch) {
  let pending = false;
  let mockAttempts = 0;
  return async function createMatch(selection, validIds) {
    if (pending) throw new Error('이미 전송 중입니다.');
    const { playerCharacterId, opponentCharacterId } = selection;
    if (!validIds.includes(playerCharacterId) || !validIds.includes(opponentCharacterId)) {
      throw new Error('내 선수와 상대 선수를 모두 선택해 주세요.');
    }
    // 스탯이나 화면 상태를 보내지 않고 계약의 두 ID만 구성합니다.
    const payload = { playerCharacterId, opponentCharacterId };
    pending = true;
    try {
      if (config.mode === 'mock') {
        await new Promise(resolve => setTimeout(resolve, config.mockDelayMs));
        if (config.mockFailFirst && mockAttempts++ === 0) throw new Error('테스트 오류입니다. 같은 선택으로 다시 전송해 주세요.');
        return { matchId: `mock-${crypto.randomUUID()}`, mode:'mock' };
      }
      if (config.mode !== 'live') throw new Error('API 모드 설정을 확인해 주세요.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetcher(`${config.baseUrl.replace(/\/$/, '')}${config.matchesPath}`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify(payload), signal:controller.signal,
        });
        if (!response.ok) throw new Error(`서버 오류 (${response.status}). 선택을 유지했습니다. 다시 시도해 주세요.`);
        let body;
        try { body = await response.json(); } catch { throw new Error('서버 응답이 올바른 JSON이 아닙니다.'); }
        if (typeof body.matchId !== 'string' || !body.matchId.trim()) throw new Error('서버 응답에 유효한 대결 ID가 없습니다.');
        return { matchId:body.matchId, mode:'live' };
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('서버 응답 시간이 초과됐습니다. 연결을 확인하고 다시 시도해 주세요.');
        if (error instanceof TypeError) throw new Error('서버에 연결하지 못했습니다. 네트워크와 백엔드 주소를 확인해 주세요.');
        throw error;
      } finally { clearTimeout(timeout); }
    } finally { pending = false; }
  };
}
export const createMatch = createMatchClient();
