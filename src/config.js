// 'mock': 서버 전송 없는 테스트 / 'live': 실제 POST 요청
export const API_CONFIG = {
  mode: 'mock',
  baseUrl: '', // 예: 'http://localhost:8000'. 빈 문자열은 현재 호스트.
  matchesPath: '/api/matches',
  timeoutMs: 12000,
  mockDelayMs: 800,
  mockFailFirst: false, // 오류 → 재시도 UI 확인용. 실제 모드에는 영향 없음.
};
