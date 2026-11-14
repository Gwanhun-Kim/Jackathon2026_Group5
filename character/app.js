/* 캐릭터 로스터 — 기본 6명 + 커스텀 1명 만들기 / 이미지·JSON 내보내기 */
(async function () {
  "use strict";
  const Art = window.CharacterArt;
  // 저장소 맨 위 characters.json(① 담당)을 직접 읽는다. 파일을 더블클릭해 열었을 땐(file://) 내장 사본 사용
  async function loadData() {
    if (location.protocol.startsWith("http")) {
      try {
        const r = await fetch("../characters.json", { cache: "no-store" });
        if (r.ok) return await r.json();
      } catch (e) { /* fall back */ }
    }
    return window.CHARACTER_DATA;
  }
  const DATA = await loadData();
  const ORDER = Art.STAT_ORDER;
  const MIN = DATA.scale.min, MAX = DATA.scale.max;
  const STORE_KEY = "jeck.customCharacter.v1";

  // 기본 선수들의 스탯 합 = 커스텀이 나눠 쓸 포인트 (현재 모두 49)
  const sum = (st) => ORDER.reduce((a, k) => a + (st[k] || 0), 0);
  const BUDGET = Math.round(DATA.characters.reduce((a, c) => a + sum(c.stats), 0) / DATA.characters.length);

  const NAMES = { stamina: "체력", power: "파워", attackSpeed: "공격 속도", toughness: "맷집", moveSpeed: "이동 속도", reach: "사거리", defense: "방어" };
  const PRIORITY = ["power", "attackSpeed", "reach", "moveSpeed", "defense", "toughness", "stamina"];
  const PREFIX = { power: "한방", attackSpeed: "속사포", reach: "롱리치", moveSpeed: "번개발", defense: "철벽", toughness: "강철몸", stamina: "무한체력" };
  const SUFFIX = { power: "파괴자", attackSpeed: "연타왕", reach: "저격수", moveSpeed: "스피드스터", defense: "수문장", toughness: "탱커", stamina: "마라토너" };
  const COLORS = ["#e11d48", "#f97316", "#facc15", "#16a34a", "#0284c7", "#1d4ed8", "#7c3aed", "#1f2937", "#f8fafc"];
  const ACCENT_FOR = { "#facc15": "#1f2937", "#f8fafc": "#e11d48", "#1f2937": "#facc15" };

  // ③·④(fight/)가 읽는 appearance: 스탯과 겉모습에서 자동 계산
  const STYLE_BY_STAT = { power: "infighter", toughness: "infighter", attackSpeed: "infighter", reach: "outboxer", moveSpeed: "outboxer", stamina: "outboxer", defense: "counter" };
  function appearanceOf(c) {
    const st = c.stats;
    const nv = (v) => (v - 1) / 9;
    const bulk = nv(st.toughness) * 0.55 + nv(st.power) * 0.45;
    const top = PRIORITY.slice().sort((a, b) => (st[b] - st[a]) || (PRIORITY.indexOf(a) - PRIORITY.indexOf(b)))[0];
    return {
      color: c.look.color === "#f8fafc" ? c.look.accent : c.look.color,
      heightCm: Math.round(165 + nv(st.reach) * 35),
      build: bulk < 0.3 ? "slim" : bulk < 0.62 ? "normal" : st.power >= st.toughness ? "muscle" : "chubby",
      style: c.look.sport === "mma" ? "kickboxer" : STYLE_BY_STAT[top],
      ...(c.look.face ? { face: c.look.face } : {}),
    };
  }
  const FACES = window.FACE_DATA || {};
  const CREDITS = window.FACE_CREDITS || {};

  // 올린 사진 -> 위쪽 가운데 기준 정사각형 256px JPEG (data URL)
  function readFace(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("이미지 파일만 넣을 수 있어요"));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) * 0.2;
        const cv = document.createElement("canvas");
        cv.width = cv.height = 256;
        cv.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
        URL.revokeObjectURL(url);
        resolve(cv.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이 형식은 읽을 수 없어요 (JPG·PNG로 넣어주세요)")); };
      img.src = url;
    });
  }

  const ABILITIES = DATA.characters.filter((c) => c.specialAbility).map((c) => ({ from: c, ability: c.specialAbility }));

  // ---------- helpers
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function titleOf(stats) {
    const ranked = PRIORITY.slice().sort((a, b) => (stats[b] - stats[a]) || (PRIORITY.indexOf(a) - PRIORITY.indexOf(b)));
    return `${PREFIX[ranked[0]]} ${SUFFIX[ranked[1]]}`;
  }

  function nearest(stats) {
    let best = null;
    for (const c of DATA.characters) {
      const d = Math.sqrt(ORDER.reduce((a, k) => a + (stats[k] - c.stats[k]) ** 2, 0));
      if (!best || d < best.d) best = { c, d };
    }
    const pct = Math.max(0, Math.round(100 * (1 - best.d / 18)));
    return { character: best.c, pct };
  }

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- roster
  const base = DATA.characters.map((c) => {
    const look = Art.lookFor(c);
    if (FACES[c.id]) look.face = FACES[c.id];
    return Object.assign({}, c, { look });
  });
  let custom = store.get();
  if (custom && custom.stats && custom.look && !custom.appearance) custom.appearance = appearanceOf(custom);
  let selectedId = null;

  function roster() { return custom ? base.concat([custom]) : base.slice(); }

  function miniBars(stats) {
    return `<div class="bars">${ORDER.map((k) => `<div class="bar"><span>${Art.STAT_SHORT[k]}</span><i><b style="width:${stats[k] * 10}%"></b></i><em>${stats[k]}</em></div>`).join("")}</div>`;
  }

  function renderRoster() {
    const el = $("roster");
    const cards = roster().map((c) => `
      <button class="card${c.id === selectedId ? " selected" : ""}" type="button" data-id="${esc(c.id)}" aria-pressed="${c.id === selectedId}">
        ${c.custom ? '<span class="tag">MY</span>' : ""}
        <div class="art">${Art.render(c)}</div>
        <div><div class="name">${esc(c.name)}</div><div class="meta">${Art.SPORTS[c.look.sport].label} · ${titleOf(c.stats)}</div></div>
        ${miniBars(c.stats)}
      </button>`);
    if (!custom) {
      cards.push(`<button class="card empty" type="button" id="emptySlot"><span class="plus">＋</span><strong>7번째 캐릭터</strong><span>스탯을 직접 나눠<br>나만의 캐릭터 만들기</span></button>`);
    }
    el.innerHTML = cards.join("");
    $("rosterCount").textContent = `${roster().length} / 7`;
    el.querySelectorAll(".card[data-id]").forEach((b) => b.addEventListener("click", () => select(b.dataset.id)));
    const empty = $("emptySlot");
    if (empty) empty.addEventListener("click", () => { $("builder").scrollIntoView({ behavior: "smooth" }); $("name").focus({ preventScroll: true }); });
  }

  function statList(stats) {
    return ORDER.map((k) => `<li><span>${NAMES[k]}</span><i><b style="width:${stats[k] * 10}%"></b></i><em>${stats[k]}</em><small>${esc(DATA.statDefinitions[k] || "")}</small></li>`).join("");
  }

  function select(id) {
    selectedId = id;
    const c = roster().find((x) => x.id === id);
    if (!c) return;
    $("detail").hidden = false;
    $("detailArt").innerHTML = Art.render(c);
    $("detailSport").textContent = `${Art.SPORTS[c.look.sport].label}${c.custom ? " · 커스텀" : ""} · 총 ${sum(c.stats)}점`;
    $("detailName").textContent = c.name;
    $("detailTitle").textContent = titleOf(c.stats);
    $("detailRadar").innerHTML = Art.radar(c.stats, c.look.color === "#f8fafc" ? c.look.accent : c.look.color);
    $("detailStats").innerHTML = statList(c.stats);
    const ab = c.specialAbility;
    $("detailAbility").hidden = !ab;
    if (ab) $("detailAbility").innerHTML = `<b>특수 능력 · ${esc(ab.name)}</b>${esc(ab.description || "")}`;
    $("detailEdit").hidden = !c.custom;
    renderRoster();
    $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ---------- image / json export
  function svgToPng(svg, scale) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = 290 * scale; cv.height = 320 * scale;
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  async function downloadPng(c) {
    const blob = await svgToPng(Art.render(c), 3);
    download(blob, `${c.id}.png`);
  }

  function exportJson() {
    const list = roster().map((c) => {
      const o = { id: c.id, name: c.name, stats: c.stats, title: titleOf(c.stats), look: Object.assign({}, c.look), image: `images/${c.id}.png` };
      if (c.specialAbility) o.specialAbility = c.specialAbility;
      if (c.appearance) o.appearance = Object.assign({}, c.appearance);
      if (!c.custom && FACES[c.id]) {
        o.look.face = `images/faces/${c.id}.jpg`;
        o.appearance = Object.assign({}, o.appearance, { face: `../character/images/faces/${c.id}.jpg` });
      }
      if (c.custom) o.custom = true;
      return o;
    });
    const out = Object.assign({}, DATA, { description: DATA.description + " + 커스텀", budget: BUDGET, characters: list });
    download(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), "characters_7.json");
    toast(custom ? "7명 JSON을 내려받았어요" : "아직 커스텀이 없어 6명만 담았어요");
  }

  // ---------- builder
  const draft = { name: "", abilityId: null, abilityTouched: false, stats: {}, look: { sport: "boxing", color: COLORS[0], accent: "#111827", hair: "headband" } };

  function setStats(st) { ORDER.forEach((k) => (draft.stats[k] = st[k])); }
  function remaining() { return BUDGET - sum(draft.stats); }

  function buildControls() {
    const tpl = $("template");
    tpl.innerHTML = `<option value="balanced">균형형 (전부 ${Math.floor(BUDGET / 7)})</option>` +
      base.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} 스탯에서 시작</option>`).join("");
    tpl.addEventListener("change", () => applyTemplate(tpl.value));

    $("sports").innerHTML = Object.entries(Art.SPORTS).map(([k, v]) => `<button type="button" class="chip" data-sport="${k}" aria-pressed="false">${v.label}</button>`).join("");
    $("sports").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
      draft.look.sport = b.dataset.sport;
      draft.look.hair = Art.SPORTS[b.dataset.sport].hair;
      syncControls();
    }));

    $("colors").innerHTML = COLORS.map((c) => `<button type="button" class="swatch" data-color="${c}" style="background:${c}" aria-label="색 ${c}" aria-pressed="false"></button>`).join("");
    $("colors").querySelectorAll(".swatch").forEach((b) => b.addEventListener("click", () => {
      draft.look.color = b.dataset.color;
      draft.look.accent = ACCENT_FOR[b.dataset.color] || (b.dataset.color === "#1d4ed8" || b.dataset.color === "#7c3aed" ? "#facc15" : "#111827");
      syncControls();
    }));

    $("hair").innerHTML = Object.entries(Art.HAIRS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
    $("hair").addEventListener("change", (e) => { draft.look.hair = e.target.value; syncControls(); });

    $("ability").innerHTML = ABILITIES.map((a) => `<option value="${esc(a.ability.id)}">${esc(a.ability.name)} (${esc(a.from.name)})</option>`).join("");
    $("ability").addEventListener("change", (e) => { draft.abilityId = e.target.value; draft.abilityTouched = true; syncControls(); });
    $("abilityField").hidden = ABILITIES.length === 0;

    $("faceFile").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        draft.look.face = await readFace(file);
        syncControls();
        toast("얼굴 사진을 넣었어요");
      } catch (err) { toast(err.message); }
    });
    $("faceClear").addEventListener("click", () => { delete draft.look.face; syncControls(); });

    $("name").addEventListener("input", (e) => { draft.name = e.target.value; syncControls(); });

    $("sliders").innerHTML = ORDER.map((k) => `
      <div class="slider" data-key="${k}">
        <label for="sl_${k}">${NAMES[k]}</label>
        <button type="button" class="step" data-d="-1" aria-label="${NAMES[k]} 1 내리기">−</button>
        <input type="range" id="sl_${k}" min="${MIN}" max="${MAX}" step="1">
        <button type="button" class="step" data-d="1" aria-label="${NAMES[k]} 1 올리기">＋</button>
        <output id="out_${k}"></output>
        <small>${esc(DATA.statDefinitions[k] || "")}</small>
      </div>`).join("");
    $("sliders").querySelectorAll(".slider").forEach((row) => {
      const k = row.dataset.key;
      row.querySelector("input").addEventListener("input", (e) => change(k, +e.target.value));
      row.querySelectorAll(".step").forEach((b) => b.addEventListener("click", () => change(k, draft.stats[k] + +b.dataset.d)));
    });

    $("random").addEventListener("click", randomize);
    $("reset").addEventListener("click", () => { $("template").value = "balanced"; applyTemplate("balanced"); });
    $("save").addEventListener("click", save);
  }

  // 포인트 예산을 넘지 않게: 올릴 때는 남은 포인트만큼만 올라간다
  function change(k, v) {
    v = Math.max(MIN, Math.min(MAX, v));
    const cur = draft.stats[k];
    if (v > cur) v = Math.min(v, cur + Math.max(0, remaining()));
    if (v !== cur) draft.stats[k] = v;
    syncControls();
  }

  function applyTemplate(id) {
    if (id === "balanced") {
      const st = {};
      ORDER.forEach((k) => (st[k] = Math.floor(BUDGET / 7)));
      let left = BUDGET - sum(st);
      for (let i = 0; left > 0; i = (i + 1) % 7, left--) st[ORDER[i]]++;
      setStats(st);
    } else {
      const c = base.find((x) => x.id === id);
      setStats(c.stats);
      Object.assign(draft.look, { sport: "boxing", hair: "headband" });
    }
    syncControls();
  }

  function randomize() {
    const st = {};
    ORDER.forEach((k) => (st[k] = MIN));
    let left = BUDGET - MIN * 7;
    while (left > 0) {
      const k = ORDER[Math.floor(Math.random() * 7)];
      if (st[k] < MAX) { st[k]++; left--; }
    }
    setStats(st);
    const sports = Object.keys(Art.SPORTS);
    draft.look.sport = sports[Math.floor(Math.random() * sports.length)];  // 올린 얼굴 사진은 그대로 둔다
    draft.look.hair = Art.SPORTS[draft.look.sport].hair;
    draft.look.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    draft.look.accent = ACCENT_FOR[draft.look.color] || "#111827";
    syncControls();
  }

  function draftCharacter() {
    const c = { id: "custom", name: draft.name.trim() || "이름 없는 도전자", custom: true, stats: Object.assign({}, draft.stats), look: Object.assign({}, draft.look) };
    const ab = ABILITIES.find((a) => a.ability.id === draft.abilityId);
    if (ab) c.specialAbility = JSON.parse(JSON.stringify(ab.ability));
    c.appearance = appearanceOf(c);
    return c;
  }

  function syncControls() {
    const left = remaining();
    ORDER.forEach((k) => {
      const v = draft.stats[k];
      $("sl_" + k).value = v;
      $("out_" + k).textContent = v;
      const row = $("sliders").querySelector(`[data-key="${k}"]`);
      row.querySelector('[data-d="-1"]').disabled = v <= MIN;
      row.querySelector('[data-d="1"]').disabled = v >= MAX || left <= 0;
    });
    $("sports").querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sport === draft.look.sport)));
    $("colors").querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === draft.look.color)));
    $("hair").value = draft.look.hair;
    $("hair").disabled = !!draft.look.face;
    $("faceThumb").hidden = !draft.look.face;
    if (draft.look.face) $("faceThumb").src = draft.look.face;
    $("faceClear").hidden = !draft.look.face;
    $("faceLabel").textContent = draft.look.face ? "다른 사진으로 바꾸기" : "사진 올리기";
    if (document.activeElement !== $("name")) $("name").value = draft.name;

    const p = $("points");
    p.textContent = left === 0 ? `${BUDGET}점 모두 배분 완료` : `남은 포인트 ${left}`;
    p.className = "points " + (left === 0 ? "ok" : "left");

    if (!draft.abilityTouched && ABILITIES.length) {
      const nearC = nearest(draft.stats).character;
      draft.abilityId = (nearC.specialAbility || ABILITIES[0].ability).id;
    }
    if ($("ability").value !== draft.abilityId && draft.abilityId) $("ability").value = draft.abilityId;
    const sel = ABILITIES.find((a) => a.ability.id === draft.abilityId);
    $("abilityDesc").textContent = sel ? sel.ability.description || "" : "";

    const c = draftCharacter();
    $("previewArt").innerHTML = Art.render(c);
    $("previewTitle").textContent = titleOf(c.stats);
    const near = nearest(c.stats);
    $("previewRadar").innerHTML = Art.radar(c.stats, c.look.color === "#f8fafc" ? c.look.accent : c.look.color, { compare: near.character.stats });
    $("similar").innerHTML = `가장 닮은 선수: <b>${esc(near.character.name)}</b> (${near.pct}%) <span aria-hidden="true">· 점선</span>`;

    const ok = left === 0 && draft.name.trim().length > 0;
    $("save").disabled = !ok;
    $("hint").textContent = left > 0 ? `포인트 ${left}점을 더 나눠야 저장할 수 있어요.` : !draft.name.trim() ? "이름을 입력하면 저장할 수 있어요." : "";
  }

  function save() {
    custom = draftCharacter();
    const persisted = store.set(custom);
    selectedId = null;
    renderRoster();
    select("custom");
    if (!persisted && custom.look.face) { /* 사진 때문에 저장 공간이 부족할 수 있음 */ }
    toast(persisted ? `${custom.name} 저장 완료! 로스터 7번째 자리에 들어갔어요` : `${custom.name} 추가됨 (이 브라우저에선 새로고침하면 사라져요)`);
  }

  function loadDraft(c) {
    draft.name = c.name;
    draft.abilityId = c.specialAbility ? c.specialAbility.id : null;
    draft.abilityTouched = !!c.specialAbility;
    setStats(c.stats);
    draft.look = Object.assign({}, c.look);
    syncControls();
  }

  // ---------- 얼굴 사진 출처 (CC 라이선스 표기)
  const credits = Object.entries(CREDITS);
  if (credits.length) {
    $("credits").innerHTML = "선수 얼굴 사진 출처 (Wikimedia Commons): " + credits.map(([id, c]) => {
      const who = (base.find((b) => b.id === id) || {}).name || id;
      return `<a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(who)}</a> © ${esc(c.author)}, ${esc(c.license)}`;
    }).join(" · ") + ". 얼굴 부분만 잘라 사용함.";
  }

  // ---------- wire up
  $("budgetText").textContent = BUDGET;
  $("exportJson").addEventListener("click", exportJson);
  $("exportAllPng").addEventListener("click", async () => {
    for (const c of roster()) { await downloadPng(c); await new Promise((r) => setTimeout(r, 250)); }
    toast(`${roster().length}명 이미지를 내려받았어요`);
  });
  $("detailPng").addEventListener("click", () => {
    const c = roster().find((x) => x.id === selectedId);
    if (c) downloadPng(c).then(() => toast(`${c.name} 이미지를 내려받았어요`));
  });
  $("detailEdit").addEventListener("click", () => { if (custom) { loadDraft(custom); $("builder").scrollIntoView({ behavior: "smooth" }); } });

  buildControls();
  if (custom) loadDraft(custom);
  else applyTemplate("balanced");
  renderRoster();

  // 다른 역할(③ 싸움 계산, ④ 렌더링)에서 쓸 수 있게 노출
  window.Roster = { list: roster, budget: BUDGET, titleOf, render: Art.render, storageKey: STORE_KEY };
})();
