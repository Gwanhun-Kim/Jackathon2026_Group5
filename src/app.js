import { SERVICE_TITLE, STAT_LABELS, INSTRUCTIONS, loadCharacters } from './data.js';
const app = document.querySelector('#app');
const characters = await loadCharacters();
const state = { screen:'start', browsing:0, selected:null };
document.title = SERVICE_TITLE;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = '<span aria-hidden="true">↗</span>';
function figure(c) {
  const silhouette = `<div class="silhouette silhouette-${c.id}" aria-hidden="true"><i class="head"></i><i class="body"></i><i class="arm left"></i><i class="arm right"></i><i class="leg left"></i><i class="leg right"></i></div>`;
  if (c.id === 'custom') return '<div class="create-figure" aria-hidden="true">+</div>';
  return `<div class="figure">${silhouette}${c.image ? `<img src="${escape(c.image)}" alt="${escape(c.name)}" class="athlete-image">` : ''}</div>`;
}
function wireImages() { app.querySelectorAll('.athlete-image').forEach(img => { const ready=()=>img.previousElementSibling.hidden=true; img.addEventListener('load',ready); img.addEventListener('error',()=>img.remove()); if(img.complete) { if(img.naturalWidth) ready(); else img.remove(); } }); }
function header() { return `<header><button class="brand" data-screen="start" aria-label="${escape(SERVICE_TITLE)} 시작 화면">${escape(SERVICE_TITLE)}<span class="brand-mark">↗</span></button><nav aria-label="진행 단계"><span ${state.screen==='start'?'aria-current="step"':''}>시작</span><b>/</b><span ${state.screen==='guide'?'aria-current="step"':''}>사용 방법</span><b>/</b><span ${state.screen==='select'?'aria-current="step"':''}>선수 선택</span></nav></header>`; }
function startScreen() { return `<main class="landing screen"><div class="hero-copy"><p class="eyebrow">SPORTS CROSSOVER</p><h1 tabindex="-1">${escape(SERVICE_TITLE)}</h1><p class="intro">종목을 넘어,<br>나만의 최강 선수를 만드세요.</p><button class="primary" data-screen="guide">시작하기 ${arrow}</button></div><div class="hero-arena" aria-hidden="true"><div class="arena-orbit"></div><span class="arena-word">WHO<br>WINS?</span><div class="hero-person">${figure(characters[0])}</div><div class="podium"></div><span class="arena-label">종목은 달라도, 무대는 하나.</span></div><footer class="landing-footer"><span>야구 · 격투기 · 축구 · 배구 · 농구 · 수영</span><span>당신의 선택으로 시작되는 대결</span></footer></main>`; }
function guideScreen() { return `<main class="guide screen"><button class="back" data-screen="start">← 시작으로</button><div class="guide-layout"><div><p class="eyebrow">HOW TO PLAY</p><h1 tabindex="-1">이렇게<br>시작하세요<span class="accent">.</span></h1><p class="muted">최강의 조합, 첫 번째 선택부터.</p></div><div class="instructions">${INSTRUCTIONS.map((s,i)=>`<div class="instruction"><span class="step-number">0${i+1}</span><p>${s}</p></div>`).join('')}<button class="primary" data-screen="select">선수 선택하기 ${arrow}</button></div></div></main>`; }
function selectScreen() { return `<main class="selection screen"><div class="selection-top"><button class="back" data-screen="guide">← 사용 방법</button><p class="selection-status" role="status" id="selection-status"></p></div><div class="selection-title"><div><p class="eyebrow">CHOOSE YOUR ATHLETE</p><h1 tabindex="-1">당신의 선수는?</h1></div><span class="muted">종목을 넘는 대결의 시작</span></div><div class="selection-layout"><section class="showroom" aria-label="선수 전시 공간"><div class="carousel" aria-roledescription="캐러셀"><div class="light-column"></div>${characters.map((c,i)=>`<button class="character" data-index="${i}" aria-label="${c.id==='custom'?'직접 생성':escape(c.name)} 탐색">${figure(c)}<span class="figure-name">${escape(c.name)}</span></button>`).join('')}<div class="podium"></div><button class="round previous" aria-label="이전 선수">←</button><button class="round next" aria-label="다음 선수">→</button></div><div class="center-action"><p id="browsing-name" class="browsing-name"></p><button id="choose" class="primary"></button><p class="navigation-help">← → 방향키 또는 좌우로 스와이프</p></div><div class="roster" aria-label="선수 바로 탐색">${characters.map((c,i)=>`<button data-index="${i}">${c.id==='custom'?'+ 직접 생성':escape(c.name)}</button>`).join('')}</div></section><aside id="details" aria-label="탐색 중인 선수 정보"></aside></div></main><dialog aria-labelledby="modal-title"><span class="modal-plus" aria-hidden="true">+</span><h2 id="modal-title">캐릭터 생성 기능은 준비 중이에요.</h2><p>나만의 선수를 만드는 기능을 준비하고 있어요.</p><button class="primary" id="close-modal">닫기</button></dialog>`; }
function render(focus=true) {
  app.innerHTML = header() + ({start:startScreen,guide:guideScreen,select:selectScreen}[state.screen])();
  app.querySelectorAll('[data-screen]').forEach(button=>button.onclick=()=>{state.screen=button.dataset.screen;render();window.scrollTo(0,0);});
  wireImages();
  if(state.screen==='select') setupSelection();
  if(focus) app.querySelector('h1').focus({preventScroll:true});
}
function browse(index) { state.browsing=Math.max(0,Math.min(characters.length-1,index)); updateSelection(); }
function updateSelection() {
  const c=characters[state.browsing], custom=c.id==='custom';
  app.querySelectorAll('.character').forEach((el,i)=>{ const offset=i-state.browsing; el.style.setProperty('--offset',offset); el.style.setProperty('--distance',Math.abs(offset)); el.classList.toggle('active',offset===0); el.style.zIndex=10-Math.abs(offset); el.inert=Math.abs(offset)>1; el.setAttribute('aria-current',String(offset===0)); });
  app.querySelectorAll('.roster button').forEach((el,i)=>{el.setAttribute('aria-current',String(i===state.browsing));el.classList.toggle('chosen',characters[i].id===state.selected?.id);});
  app.querySelector('.previous').disabled=state.browsing===0; app.querySelector('.next').disabled=state.browsing===characters.length-1;
  app.querySelector('#browsing-name').textContent=c.name;
  app.querySelector('#choose').innerHTML=custom?`직접 생성하기 ${arrow}`:state.selected?.id===c.id?'선택 완료 ✓':`이 선수 선택 ${arrow}`;
  app.querySelector('#selection-status').textContent=state.selected?`${state.selected.name} 선택 완료`:'아직 선택한 선수가 없어요';
  app.querySelector('#details').innerHTML=custom?`<p class="eyebrow">CREATE YOUR OWN</p><h2>나만의 선수</h2><p class="custom-description">상상한 선수를 직접 만들어보세요.</p><div class="custom-line">새로운 가능성을 더할 자리<span>+</span></div>`:`<div class="detail-heading"><div><p class="eyebrow">${escape(c.sport)} · 맨손</p><h2>${escape(c.name)}</h2></div><span class="view-label">탐색 중</span></div><div class="stats-heading"><h3>기본 능력치</h3><span>1–10</span></div><div class="stats">${STAT_LABELS.map(([key,label,hint])=>{ const value=c.stats?.[key]; const valid=Number.isFinite(value)&&value>=1&&value<=10; return `<div class="stat"><div class="stat-label">${label}${hint?`<small>${hint}</small>`:''}</div>${valid?`<meter min="0" max="10" value="${value}" aria-label="${label} ${value}/10" style="--value:${value*10}%">${value}/10</meter><strong>${value}</strong>`:'<span class="pending">데이터 준비 중</span>'}</div>`;}).join('')}</div><section class="ability"><p class="eyebrow">특수 효과</p><h3>${escape(c.specialAbility?.name??'데이터 준비 중')}</h3><p>${escape(c.specialAbility?.description??'데이터 준비 중')}</p></section>`;
}
function setupSelection() {
  app.querySelectorAll('[data-index]').forEach(button=>button.onclick=()=>browse(Number(button.dataset.index)));
  app.querySelector('.previous').onclick=()=>browse(state.browsing-1); app.querySelector('.next').onclick=()=>browse(state.browsing+1);
  const dialog=app.querySelector('dialog');
  app.querySelector('#choose').onclick=()=>{const c=characters[state.browsing];if(c.id==='custom')dialog.showModal();else{state.selected=c;updateSelection();}};
  app.querySelector('#close-modal').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>app.querySelector('#choose').focus());
  let start=null; const carousel=app.querySelector('.carousel');
  carousel.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});
  carousel.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){browse(state.browsing+(dx<0?1:-1));carousel.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();},{once:true,capture:true});}});
  carousel.addEventListener('pointercancel',()=>start=null);
  updateSelection();
}
document.addEventListener('keydown',e=>{if(state.screen!=='select'||app.querySelector('dialog')?.open||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();browse(state.browsing+(e.key==='ArrowRight'?1:-1));}});
render(false);
