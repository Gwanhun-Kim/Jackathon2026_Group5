import { API_CONFIG } from './config.js';
import { createMatch } from './api.js';
import { SERVICE_TITLE, STAT_LABELS, INSTRUCTIONS, loadCharacters } from './data.js';
const app = document.querySelector('#app');
const characters = await loadCharacters();
const state = { screen:'start', browsing:{player:0, opponent:0}, playerCharacterId:null, opponentCharacterId:null, sending:false, error:'', result:null };
const role = () => state.screen === 'opponent' ? 'opponent' : 'player';
const currentIndex = () => state.browsing[role()];
const nameFor = id => characters.find(c => c.id === id)?.name ?? '';
const isSelection = () => ['player','opponent'].includes(state.screen);
document.title = SERVICE_TITLE;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<span aria-hidden="true">↗</span>';
function figure(c) {
  const silhouette = `<div class="silhouette silhouette-${c.id}" aria-hidden="true"><i class="head"></i><i class="body"></i><i class="arm left"></i><i class="arm right"></i><i class="leg left"></i><i class="leg right"></i></div>`;
  if (c.id === 'custom') return '<div class="create-figure" aria-hidden="true">+</div>';
  return `<div class="figure">${silhouette}${c.image ? `<img src="${escape(c.image)}" alt="${escape(c.name)}" class="athlete-image">` : ''}</div>`;
}
function wireImages() { app.querySelectorAll('.athlete-image').forEach(img => { const ready=()=>img.previousElementSibling.hidden=true; img.addEventListener('load',ready); img.addEventListener('error',()=>img.remove()); if(img.complete) { if(img.naturalWidth) ready(); else img.remove(); } }); }
function header() { return `<header><button class="brand" data-screen="start" aria-label="${escape(SERVICE_TITLE)} 시작 화면">${escape(SERVICE_TITLE)}<span class="brand-mark">↗</span></button><nav aria-label="진행 단계">${[['start','시작'],['guide','사용 방법'],['player','내 선수'],['opponent','상대 선수'],['result','전송 결과']].map(([key,label])=>`<span ${state.screen===key?'aria-current="step"':''}>${label}</span>`).join('<b>/</b>')}</nav></header>${API_CONFIG.mode==='mock'?'<div class="mode-banner">테스트 모드 · 실제 서버로 전송하지 않습니다.</div>':''}`; }
function startScreen() { return `<main class="landing screen"><div class="hero-copy"><p class="eyebrow">SPORTS CROSSOVER</p><h1 tabindex="-1">${escape(SERVICE_TITLE)}</h1><p class="intro">종목을 넘어,<br>나만의 최강 선수를 만드세요.</p><button class="primary" data-screen="guide">시작하기 ${arrow}</button></div><div class="hero-arena" aria-hidden="true"><div class="arena-orbit"></div><span class="arena-word">WHO<br>WINS?</span><div class="hero-person">${figure(characters[0])}</div><div class="podium"></div><span class="arena-label">종목은 달라도, 무대는 하나.</span></div><footer class="landing-footer"><span>야구 · 격투기 · 축구 · 배구 · 농구 · 수영</span><span>당신의 선택으로 시작되는 대결</span></footer></main>`; }
function guideScreen() { return `<main class="guide screen"><button class="back" data-screen="start">← 시작으로</button><div class="guide-layout"><div><p class="eyebrow">HOW TO PLAY</p><h1 tabindex="-1">이렇게<br>시작하세요<span class="accent">.</span></h1><p class="muted">최강의 조합, 첫 번째 선택부터.</p></div><div class="instructions">${INSTRUCTIONS.map((s,i)=>`<div class="instruction"><span class="step-number">0${i+1}</span><p>${s}</p></div>`).join('')}<button class="primary" data-screen="player">선수 선택하기 ${arrow}</button></div></div></main>`; }
function selectScreen() { const opponent = role()==='opponent'; return `<main class="selection screen"><div class="selection-top"><button class="back" data-screen="${opponent?'player':'guide'}">${opponent?'← 내 선수 다시 선택':'← 사용 방법'}</button><p class="selection-status" role="status" id="selection-status"></p></div><div class="selection-title"><div><p class="eyebrow">${opponent?'CHOOSE YOUR OPPONENT':'CHOOSE YOUR ATHLETE'}</p><h1 tabindex="-1">${opponent?'상대 선수를 선택하세요':'내 선수를 선택하세요'}</h1></div><span class="muted">종목을 넘는 대결의 시작</span></div><div class="selection-layout"><section class="showroom" aria-label="선수 전시 공간"><div class="carousel" aria-roledescription="캐러셀"><div class="light-column"></div>${characters.map((c,i)=>`<button class="character" data-index="${i}" aria-label="${c.id==='custom'?'직접 생성':escape(c.name)} 탐색">${figure(c)}<span class="figure-name">${escape(c.name)}</span></button>`).join('')}<div class="podium"></div><button class="round previous" aria-label="이전 선수">←</button><button class="round next" aria-label="다음 선수">→</button></div><div class="center-action"><p id="browsing-name" class="browsing-name"></p><button id="choose" class="primary"></button><div id="request-feedback" aria-live="polite"></div><p class="navigation-help">← → 방향키 또는 좌우로 스와이프</p></div><div class="roster" aria-label="선수 바로 탐색">${characters.map((c,i)=>`<button data-index="${i}">${c.id==='custom'?'+ 직접 생성':escape(c.name)}</button>`).join('')}</div></section><aside id="details" aria-label="선수 상세 정보"></aside></div></main><dialog aria-labelledby="modal-title"><span class="modal-plus" aria-hidden="true">+</span><h2 id="modal-title">캐릭터 생성 기능은 준비 중이에요.</h2><p>나만의 선수를 만드는 기능을 준비하고 있어요.</p><button class="primary" id="close-modal">닫기</button></dialog>`; }
function render(focus=true) {
  document.body.dataset.screen = state.screen;
  app.innerHTML = header() + ({start:startScreen,guide:guideScreen,player:selectScreen,opponent:selectScreen,result:resultScreen}[state.screen])();
  app.querySelectorAll('[data-screen]').forEach(button=>button.onclick=()=>{if(state.sending)return;state.screen=button.dataset.screen;state.error='';render();window.scrollTo(0,0);});
  wireImages();
  if(isSelection()) setupSelection();
  if(focus) app.querySelector('h1').focus({preventScroll:true});
}
function browse(index) { if(state.sending)return; state.error=''; state.browsing[role()]=Math.max(0,Math.min(characters.length-1,index)); updateSelection(); }
function updateSelection() {
  const c=characters[currentIndex()], custom=c.id==='custom';
  app.querySelectorAll('.character').forEach((el,i)=>{ const offset=i-currentIndex(); el.style.setProperty('--offset',offset); el.style.setProperty('--distance',Math.abs(offset)); el.classList.toggle('active',offset===0); el.style.zIndex=10-Math.abs(offset); el.inert=Math.abs(offset)>1; el.setAttribute('aria-current',String(offset===0)); });
  app.querySelectorAll('.roster button').forEach((el,i)=>{el.setAttribute('aria-current',String(i===currentIndex()));el.classList.toggle('chosen',characters[i].id===(role()==='player'?state.playerCharacterId:state.opponentCharacterId));});
  app.querySelector('.previous').disabled=currentIndex()===0; app.querySelector('.next').disabled=currentIndex()===characters.length-1;
  app.querySelector('#browsing-name').textContent=c.name;
  app.querySelector('#choose').innerHTML=custom?`직접 생성하기 ${arrow}`:state.sending?'전송 중…':`${role()==='player'?'이 선수로 선택':'이 상대와 대결'} ${arrow}`;
  app.querySelectorAll('button').forEach(button => {
    if(button.classList.contains('previous')) button.disabled=state.sending||currentIndex()===0;
    else if(button.classList.contains('next')) button.disabled=state.sending||currentIndex()===characters.length-1;
    else button.disabled=state.sending;
  });
  app.querySelector('#request-feedback').innerHTML=state.error?`<p class="request-error" role="alert">${escape(state.error)}</p><button class="retry">다시 전송</button>`:state.sending?'<p class="request-progress" role="status">선택 정보를 전송하고 있어요.</p>':'';
  const retry=app.querySelector('.retry'); if(retry)retry.onclick=submitMatch;
  app.querySelector('#selection-status').textContent=state.playerCharacterId?`내 선수 · ${nameFor(state.playerCharacterId)}`:'내 팀의 첫 번째 선택';
  app.querySelector('#details').innerHTML=custom?`<p class="eyebrow">CREATE YOUR OWN</p><h2>나만의 선수</h2><p class="custom-description">상상한 선수를 직접 만들어보세요.</p><div class="custom-line">새로운 가능성을 더할 자리<span>+</span></div>`:`<div class="detail-heading"><div><p class="eyebrow">${escape(c.sport)} · 맨손</p><h2>${escape(c.name)}</h2></div></div><div class="stats-heading"><h3>기본 능력치</h3><span>1–10</span></div><div class="stats">${STAT_LABELS.map(([key,label,hint])=>{ const value=c.stats?.[key]; const valid=Number.isFinite(value)&&value>=1&&value<=10; return `<div class="stat"><div class="stat-label">${label}${hint?`<small>${hint}</small>`:''}</div>${valid?`<meter min="0" max="10" value="${value}" aria-label="${label} ${value}/10" style="--value:${value*10}%">${value}/10</meter><strong>${value}</strong>`:'<span class="pending">데이터 준비 중</span>'}</div>`;}).join('')}</div><section class="ability"><p class="eyebrow">특수 효과</p><h3>${escape(c.specialAbility?.name??'데이터 준비 중')}</h3><p>${escape(c.specialAbility?.description??'데이터 준비 중')}</p></section>`;
}
function setupSelection() {
  app.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>browse(Number(button.dataset.index)));
  app.querySelector('.previous').onclick=()=>browse(currentIndex()-1); app.querySelector('.next').onclick=()=>browse(currentIndex()+1);
  const dialog=app.querySelector('dialog');
  app.querySelector('#choose').onclick=async()=>{
    if(state.sending)return;
    const c=characters[currentIndex()];
    if(c.id==='custom'){dialog.showModal();return;}
    if(role()==='player'){state.playerCharacterId=c.id;state.screen='opponent';state.error='';state.result=null;render();window.scrollTo(0,0);}
    else {state.opponentCharacterId=c.id;await submitMatch();}
  };
  app.querySelector('#close-modal').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>app.querySelector('#choose').focus());
  let start=null; const carousel=app.querySelector('.carousel');
  carousel.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});
  carousel.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){browse(currentIndex()+(dx<0?1:-1));carousel.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();},{once:true,capture:true});}});
  carousel.addEventListener('pointercancel',()=>start=null);
  updateSelection();
}
document.addEventListener('keydown',e=>{if(!isSelection()||state.sending||app.querySelector('dialog')?.open||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();browse(currentIndex()+(e.key==='ArrowRight'?1:-1));}});
async function submitMatch() {
  if(state.sending)return;
  state.sending=true; state.error=''; updateSelection();
  try {
    const response=await createMatch({playerCharacterId:state.playerCharacterId,opponentCharacterId:state.opponentCharacterId},characters.filter(c=>c.id!=='custom').map(c=>c.id));
    state.result={...response,playerName:nameFor(state.playerCharacterId),opponentName:nameFor(state.opponentCharacterId)};
    state.screen='result';
  } catch(error) {state.error=error.message;}
  finally {state.sending=false; if(state.screen==='result'){render();window.scrollTo(0,0);}else{updateSelection();app.querySelector('.retry')?.focus();}}
}
function resultScreen() {
  const r=state.result;
  return `<main class="result screen"><p class="eyebrow">${r.mode==='mock'?'TEST MATCH':'MATCH CREATED'}</p><h1 tabindex="-1">${r.mode==='mock'?'테스트 선택 완료':'선택 정보 전송 완료'}</h1><p class="matchup">${escape(r.playerName)} <span>VS</span> ${escape(r.opponentName)}</p><p class="result-label">${r.mode==='mock'?'테스트 대결 ID':'서버 대결 ID'}</p><p class="match-id">${escape(r.matchId)}</p><p class="muted">${r.mode==='mock'?'테스트 결과입니다. 실제 서버 전송 및 대결 생성은 수행하지 않았습니다.':'서버에 두 선수의 선택 정보가 전달됐습니다.'}</p><button class="primary" data-screen="opponent">상대 선수 다시 선택 ${arrow}</button><button class="back" data-screen="player">내 선수 다시 선택</button></main>`;
}
render(false);
