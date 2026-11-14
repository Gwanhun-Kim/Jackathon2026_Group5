// 판결 페이지: 경기 화면이 남긴 fightData(두 선수) + fightResult(승자, 공방 기록)를 읽어 보여준다
import { logicFromCharacter, toFighter, simulateMany } from '../sim/sim.js';
import { MOVES } from '../sim/moves.js';

const app = document.querySelector('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };

const data = read('fightData');
const fight = read('fightResult');
const fighters = data?.fighters?.slice(0, 2);

if (!fighters || fighters.length < 2) {
  app.innerHTML = `<p class="eyebrow">NO MATCH</p><h1 tabindex="-1">아직 경기 기록이 없어요</h1><p class="lead">선수 두 명을 골라 경기를 시작해 주세요.</p><div class="actions"><a class="primary" href="./index.html">선수 고르러 가기</a></div>`;
} else {
  render();
}

function render() {
  const names = fighters.map((c) => c.name || '이름없음');

  // 100판 승률 (화면 경기와 같은 계산 로직)
  const sims = fighters.map((c) => { const p = { defense: 1, stamina: 1, ability: null, ...logicFromCharacter(c) }; return { ...p, ...toFighter(p) }; });
  const { wins } = simulateMany(sims[0], sims[1], 100);
  const favorite = wins[0] === wins[1] ? null : wins[0] > wins[1] ? 0 : 1;

  // 이번 경기 (기록이 없으면 100판 우세 쪽)
  const winner = fight?.winner === 0 || fight?.winner === 1 ? fight.winner : (favorite ?? 0);
  const ex = Array.isArray(fight?.exchanges) ? fight.exchanges : [];
  const landed = [0, 0], damage = [0, 0], blocked = [0, 0];
  let finish = null;
  const hp = [100, 100];
  for (const e of ex) for (const s of e.strikes || []) {
    const def = 1 - e.attacker;
    const dealt = Math.min(s.dmg || 0, hp[def]); // 남은 체력 이상은 세지 않음
    hp[def] -= dealt;
    damage[e.attacker] += dealt;
    if (s.result === 'hit') landed[e.attacker]++;
    if (s.result === 'block') blocked[1 - e.attacker]++;
    if (s.ko) finish = { ...s, attacker: e.attacker };
  }
  const finishLabel = finish ? `${finish.specialKO ? '필살 ' : ''}${MOVES[finish.move]?.label ?? finish.move} KO` : '판정';
  const upset = favorite !== null && favorite !== winner;
  const headline = upset ? `이변! ${names[winner]}의 승리` : `${names[winner]}의 승리`;
  const lead = favorite === null
    ? '100번 싸워도 50 대 50. 진짜 접전입니다.'
    : `100번 붙으면 ${names[favorite]}이(가) ${wins[favorite]}번 이깁니다. ${upset ? '이번 경기는 나머지 그 몇 번이었네요.' : '이번에도 예상대로였어요.'}`;

  const face = (c) => {
    const url = c.appearance?.face;
    return url
      ? `<div class="face" style="background-image:url('${esc(url)}')" role="img" aria-label="${esc(c.name)} 얼굴"></div>`
      : `<div class="face" aria-hidden="true">${esc((c.name || '?').slice(0, 1))}</div>`;
  };
  const card = (i) => `<div class="fighter ${i === winner ? 'win' : ''}">${face(fighters[i])}<div class="name">${esc(names[i])}</div><div class="tag">${i === winner ? 'WINNER' : ''}</div></div>`;
  const row = (label, a, b) => `<div class="row"><b>${a}</b><span>${label}</span><b>${b}</b></div>`;
  const colors = ['#ff3b30', '#0a84ff'];

  document.title = `${names[winner]} 승 · 누가 이김?`;
  app.innerHTML = `
    <p class="eyebrow">THE VERDICT · ${esc(finishLabel)}</p>
    <h1 tabindex="-1">${esc(headline)}</h1>
    <p class="lead">${esc(lead)}</p>
    <div class="faceoff">${card(0)}<div class="vs">VS</div>${card(1)}</div>
    <section class="card">
      <h2>이번 경기</h2>
      ${row('적중', landed[0], landed[1])}
      ${row('준 피해', damage[0], damage[1])}
      ${row('막아낸 공격', blocked[0], blocked[1])}
      ${row('결정타', finish && finish.attacker === 0 ? esc(finishLabel) : '–', finish && finish.attacker === 1 ? esc(finishLabel) : '–')}
    </section>
    <section class="card">
      <h2>100번 붙으면</h2>
      <div class="rate-label"><span style="color:${colors[0]}">${esc(names[0])} ${wins[0]}승</span><span style="color:${colors[1]}">${wins[1]}승 ${esc(names[1])}</span></div>
      <div class="rate"><i style="width:${wins[0]}%;background:${colors[0]}"></i><i style="width:${wins[1]}%;background:${colors[1]}"></i></div>
      <p class="note" style="margin-top:4px;text-align:left">스탯과 체격으로 같은 경기를 100번 계산한 결과예요.</p>
    </section>
    <div class="actions">
      <a class="primary" href="./fight/index.html?auto">한 판 더 <span aria-hidden="true">↻</span></a>
      <a class="primary ghost" href="./index.html" style="background:transparent;border:1px solid var(--line);justify-content:center">다른 선수로 대결</a>
    </div>
    <p class="note">재미로 보는 결과이며, 선수 스탯은 AI 추정치입니다.</p>`;
  app.querySelector('h1').focus({ preventScroll: true });
}
