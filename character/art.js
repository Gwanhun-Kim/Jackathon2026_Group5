/*
 * CharacterArt — 스탯으로 캐릭터 이미지를 그리는 SVG 생성기
 *
 *   CharacterArt.render(character)  -> SVG 문자열 (260x320, 투명 배경)
 *   CharacterArt.radar(stats, color) -> 스탯 레이더 차트 SVG 문자열
 *
 * 스탯이 체형과 효과를 결정한다.
 *   reach(사거리)            키, 다리 길이, 뻗은 팔 길이
 *   toughness+power(맷집·파워) 몸통 폭, 팔다리 두께
 *   moveSpeed(이동 속도)      다리가 가늘어지고, 9 이상이면 발밑에 속도선
 *   power 9+                 뻗은 주먹에 폭발 이펙트
 *   attackSpeed 8+           팔 주변 잔상선
 *   defense 8+               가드 쪽 육각 실드
 *   stamina 9+               몸 주위 에너지 오라
 *
 * 브라우저(<script src="art.js">)와 Node(require) 둘 다에서 동작한다.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CharacterArt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SKIN = "#efc7a1";
  const INK = "#1f2328";
  const HAIR = "#2a211b";

  const SPORTS = {
    boxing: { label: "복싱", hair: "headband" },
    baseball: { label: "야구", hair: "cap" },
    soccer: { label: "축구", hair: "short" },
    volleyball: { label: "배구", hair: "ponytail" },
    basketball: { label: "농구", hair: "short" },
    swimming: { label: "수영", hair: "swimcap" },
    mma: { label: "격투기", hair: "bald" },
  };

  const HAIRS = {
    short: "짧은 머리",
    ponytail: "포니테일",
    bald: "민머리",
    cap: "야구 모자",
    swimcap: "수모 + 수경",
    headband: "헤드밴드",
  };

  // 기본 6명의 겉모습 (종목 소품과 색으로만 구분, 실존 인물 얼굴 묘사 없음)
  const LOOKS = {
    ohtani: { sport: "baseball", color: "#1d4ed8", accent: "#ef4444", hair: "cap" },
    ngannou: { sport: "mma", color: "#1f2937", accent: "#f59e0b", hair: "bald" },
    son: { sport: "soccer", color: "#f8fafc", accent: "#1e3a8a", hair: "short" },
    kim: { sport: "volleyball", color: "#dc2626", accent: "#facc15", hair: "ponytail" },
    ha: { sport: "basketball", color: "#7c3aed", accent: "#f97316", hair: "short" },
    park: { sport: "swimming", color: "#0284c7", accent: "#facc15", hair: "swimcap" },
  };

  const DEFAULT_LOOK = { sport: "boxing", color: "#e11d48", accent: "#111827", hair: "headband" };

  function lookFor(c) {
    return Object.assign({}, DEFAULT_LOOK, LOOKS[c.id] || {}, c.look || {});
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const n = (v) => Math.max(0, Math.min(1, ((v || 1) - 1) / 9));
  const f = (v) => Math.round(v * 10) / 10;

  function shade(hex, amt) {
    const h = hex.replace("#", "");
    const num = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
    let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    const k = amt < 0 ? 0 : 255, t = Math.abs(amt);
    r = Math.round(r + (k - r) * t); g = Math.round(g + (k - g) * t); b = Math.round(b + (k - b) * t);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // 외곽선이 있는 굵은 팔다리
  function limb(x1, y1, x2, y2, w, color, out) {
    out.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${INK}" stroke-width="${f(w + 6)}" stroke-linecap="round"/>`);
    out.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round"/>`);
  }

  function chain(pts, widths, color, out) {
    for (let i = 0; i < pts.length - 1; i++)
      out.push(`<line x1="${f(pts[i].x)}" y1="${f(pts[i].y)}" x2="${f(pts[i + 1].x)}" y2="${f(pts[i + 1].y)}" stroke="${INK}" stroke-width="${f(widths[i] + 6)}" stroke-linecap="round"/>`);
    for (let i = 0; i < pts.length - 1; i++)
      out.push(`<line x1="${f(pts[i].x)}" y1="${f(pts[i].y)}" x2="${f(pts[i + 1].x)}" y2="${f(pts[i + 1].y)}" stroke="${color}" stroke-width="${f(widths[i])}" stroke-linecap="round"/>`);
  }

  function star(cx, cy, r1, r2, pts) {
    const p = [];
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = (Math.PI * i) / pts - Math.PI / 2;
      p.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
    }
    return p.join(" ");
  }

  function hexagon(cx, cy, r) {
    const p = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      p.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`);
    }
    return p.join(" ");
  }

  function ball(kind, x, y, r, out) {
    if (kind === "soccer") {
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="3"/>`);
      out.push(`<polygon points="${star(x, y, r * 0.42, r * 0.42, 5).split(" ").filter((_, i) => i % 2 === 0).join(" ")}" fill="${INK}"/>`);
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        out.push(`<line x1="${f(x + r * 0.42 * Math.cos(a))}" y1="${f(y + r * 0.42 * Math.sin(a))}" x2="${f(x + r * Math.cos(a))}" y2="${f(y + r * Math.sin(a))}" stroke="${INK}" stroke-width="2"/>`);
      }
    } else if (kind === "basketball") {
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#f97316" stroke="${INK}" stroke-width="3"/>`);
      out.push(`<line x1="${f(x - r)}" y1="${f(y)}" x2="${f(x + r)}" y2="${f(y)}" stroke="${INK}" stroke-width="2"/>`);
      out.push(`<line x1="${f(x)}" y1="${f(y - r)}" x2="${f(x)}" y2="${f(y + r)}" stroke="${INK}" stroke-width="2"/>`);
      out.push(`<path d="M${f(x - r * 0.7)},${f(y - r * 0.7)} Q${f(x - r * 0.2)},${f(y)} ${f(x - r * 0.7)},${f(y + r * 0.7)}" fill="none" stroke="${INK}" stroke-width="2"/>`);
      out.push(`<path d="M${f(x + r * 0.7)},${f(y - r * 0.7)} Q${f(x + r * 0.2)},${f(y)} ${f(x + r * 0.7)},${f(y + r * 0.7)}" fill="none" stroke="${INK}" stroke-width="2"/>`);
    } else if (kind === "volleyball") {
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="#fde047" stroke="${INK}" stroke-width="3"/>`);
      out.push(`<path d="M${f(x)},${f(y)} Q${f(x + r * 0.2)},${f(y - r * 0.8)} ${f(x + r * 0.75)},${f(y - r * 0.65)}" fill="none" stroke="#1d4ed8" stroke-width="3"/>`);
      out.push(`<path d="M${f(x)},${f(y)} Q${f(x - r * 0.9)},${f(y - r * 0.1)} ${f(x - r * 0.8)},${f(y + r * 0.55)}" fill="none" stroke="#1d4ed8" stroke-width="3"/>`);
      out.push(`<path d="M${f(x)},${f(y)} Q${f(x + r * 0.6)},${f(y + r * 0.5)} ${f(x + r * 0.2)},${f(y + r * 0.97)}" fill="none" stroke="#1d4ed8" stroke-width="3"/>`);
    }
  }

  function render(character, opts) {
    opts = opts || {};
    const s = character.stats || {};
    const look = lookFor(character);
    const W = 290, H = 320;

    const reach = n(s.reach);
    const bulk = n(s.toughness) * 0.55 + n(s.power) * 0.45;
    const speed = n(s.moveSpeed);
    const shirtless = look.sport === "mma" || look.sport === "swimming";
    const gloves = look.sport === "boxing" || look.sport === "mma";

    // ---- 골격 치수
    const cx = 104;
    const groundY = 300;
    const legLen = lerp(60, 84, reach);
    const torsoH = lerp(58, 76, reach);
    const hipY = groundY - 8 - legLen;
    const shoulderY = hipY - torsoH;
    const headR = 24;
    const headCY = shoulderY - headR - 7;
    const topW = lerp(46, 80, bulk);
    const waistW = lerp(36, 62, bulk);
    const armW = lerp(11, 21, bulk);
    const legW = lerp(15, 26, bulk) - speed * 3;
    const armLen = lerp(58, 98, reach);
    const fistR = gloves ? lerp(13, 16, bulk) + (look.sport === "boxing" ? 3 : 0) : lerp(9, 12, bulk);
    const ow = n(s.toughness) > 0.85 ? 3.5 : 3;

    const Ls = { x: cx - topW / 2 + armW * 0.45, y: shoulderY + armW * 0.45 };
    const Rs = { x: cx + topW / 2 - armW * 0.45, y: shoulderY + armW * 0.45 };
    const Lh = { x: cx - waistW / 2 + legW * 0.55, y: hipY + 4 };
    const Rh = { x: cx + waistW / 2 - legW * 0.55, y: hipY + 4 };
    const Lk = { x: Lh.x - 11, y: hipY + legLen * 0.5 };
    const Rk = { x: Rh.x + 10, y: hipY + legLen * 0.5 };
    const Lf = { x: Lh.x - 17, y: groundY - 7 };
    const Rf = { x: Rh.x + 17, y: groundY - 7 };
    // 왼팔: 턱 앞 가드 / 오른팔: 옆으로 뻗은 스트레이트
    const Le = { x: Ls.x - 14, y: shoulderY + 34 };
    const Lfist = { x: cx - headR + 2, y: headCY + headR + 2 };
    const Re = { x: Rs.x + armLen * 0.5, y: Rs.y - 3 };
    const Rfist = { x: Rs.x + armLen, y: Rs.y - 8 };

    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${opts.width || W}" height="${opts.height || H}">`);
    if (opts.background) out.push(`<rect width="${W}" height="${H}" fill="${opts.background}"/>`);

    // ---- 바닥 그림자 & 뒤쪽 이펙트
    out.push(`<ellipse cx="${cx + 8}" cy="${groundY}" rx="${f(lerp(62, 84, bulk))}" ry="9" fill="${INK}" opacity="0.14"/>`);
    if ((s.stamina || 0) >= 9) {
      out.push(`<ellipse cx="${cx}" cy="${f((headCY - headR + groundY) / 2)}" rx="${f(topW / 2 + 34)}" ry="${f((groundY - headCY + headR) / 2 + 10)}" fill="#34d399" opacity="0.13"/>`);
      out.push(`<ellipse cx="${cx}" cy="${f((headCY - headR + groundY) / 2)}" rx="${f(topW / 2 + 34)}" ry="${f((groundY - headCY + headR) / 2 + 10)}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="6 7" opacity="0.7"/>`);
    }
    if ((s.moveSpeed || 0) >= 9) {
      for (let i = 0; i < 3; i++) {
        const y = groundY - 12 - i * 16;
        out.push(`<line x1="${f(Lf.x - 54 + i * 6)}" y1="${y}" x2="${f(Lf.x - 18 + i * 4)}" y2="${y}" stroke="${look.accent}" stroke-width="4" stroke-linecap="round" opacity="0.75"/>`);
      }
    }
    if (look.sport === "baseball") {
      // 등에 멘 배트
      out.push(`<line x1="${f(cx - 46)}" y1="${f(shoulderY - 26)}" x2="${f(cx + 26)}" y2="${f(hipY + 6)}" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>`);
      out.push(`<line x1="${f(cx - 46)}" y1="${f(shoulderY - 26)}" x2="${f(cx + 26)}" y2="${f(hipY + 6)}" stroke="#c98b4f" stroke-width="8" stroke-linecap="round"/>`);
    }
    if (look.hair === "ponytail") {
      out.push(`<ellipse cx="${cx - headR + 2}" cy="${f(headCY + 4)}" rx="10" ry="17" fill="${HAIR}" stroke="${INK}" stroke-width="${ow}" transform="rotate(20 ${cx - headR + 2} ${f(headCY + 4)})"/>`);
    }

    // ---- 다리 & 신발
    const legColor = SKIN;
    chain([Lh, Lk, Lf], [legW, legW * 0.88], legColor, out);
    chain([Rh, Rk, Rf], [legW, legW * 0.88], legColor, out);
    if (look.sport === "basketball" || look.sport === "soccer" || look.sport === "volleyball") {
      // 양말
      for (const [k, ft] of [[Lk, Lf], [Rk, Rf]]) {
        const sx = lerp(k.x, ft.x, 0.45), sy = lerp(k.y, ft.y, 0.45);
        limb(sx, sy, ft.x, ft.y, legW * 0.9, look.sport === "soccer" ? look.accent : "#ffffff", out);
      }
    }
    const shoe = look.sport === "swimming" ? SKIN : INK;
    for (const ft of [Lf, Rf]) {
      const dir = ft === Lf ? -1 : 1;
      out.push(`<ellipse cx="${f(ft.x + dir * 6)}" cy="${f(ft.y + 2)}" rx="${f(lerp(13, 16, bulk))}" ry="7.5" fill="${shoe}" stroke="${INK}" stroke-width="${ow}"/>`);
      if (look.sport !== "swimming") out.push(`<line x1="${f(ft.x + dir * 6 - 7)}" y1="${f(ft.y + 1)}" x2="${f(ft.x + dir * 6 + 7)}" y2="${f(ft.y + 1)}" stroke="${look.accent}" stroke-width="2.5" stroke-linecap="round"/>`);
    }

    // ---- 반바지
    const shorts = look.sport === "mma" ? look.accent : look.sport === "swimming" ? look.color : shade(look.color, look.color === "#f8fafc" ? -0.75 : -0.25);
    const shortLen = look.sport === "swimming" ? 14 : 24;
    out.push(`<path d="M${f(cx - waistW / 2 - 3)},${f(hipY - 10)} L${f(cx + waistW / 2 + 3)},${f(hipY - 10)} L${f(Rh.x + legW * 0.75 + 3)},${f(hipY + shortLen)} L${f(cx + 3)},${f(hipY + shortLen - 6)} L${f(cx - 3)},${f(hipY + shortLen - 6)} L${f(Lh.x - legW * 0.75 - 4)},${f(hipY + shortLen)} Z" fill="${shorts}" stroke="${INK}" stroke-width="${ow}" stroke-linejoin="round"/>`);
    if (look.sport === "mma" || look.sport === "boxing") {
      out.push(`<rect x="${f(cx - waistW / 2 - 3)}" y="${f(hipY - 12)}" width="${f(waistW + 6)}" height="7" rx="2" fill="${look.sport === "mma" ? "#ffffff" : look.accent}" stroke="${INK}" stroke-width="2"/>`);
    }

    // ---- 몸통
    const torsoFill = shirtless ? SKIN : look.color;
    out.push(`<path d="M${f(cx - topW / 2)},${f(shoulderY + 4)} Q${f(cx)},${f(shoulderY - 6)} ${f(cx + topW / 2)},${f(shoulderY + 4)} L${f(cx + waistW / 2)},${f(hipY - 6)} L${f(cx - waistW / 2)},${f(hipY - 6)} Z" fill="${torsoFill}" stroke="${INK}" stroke-width="${ow}" stroke-linejoin="round"/>`);
    if (shirtless) {
      // 근육 선 (파워가 높을수록 진하게)
      const op = f(0.25 + n(s.power) * 0.5);
      out.push(`<path d="M${f(cx - topW * 0.3)},${f(shoulderY + 22)} Q${f(cx - topW * 0.12)},${f(shoulderY + 30)} ${f(cx)},${f(shoulderY + 22)} Q${f(cx + topW * 0.12)},${f(shoulderY + 30)} ${f(cx + topW * 0.3)},${f(shoulderY + 22)}" fill="none" stroke="${INK}" stroke-width="2" opacity="${op}"/>`);
      out.push(`<line x1="${cx}" y1="${f(shoulderY + 32)}" x2="${cx}" y2="${f(hipY - 14)}" stroke="${INK}" stroke-width="2" opacity="${op}"/>`);
      for (let i = 0; i < 2; i++) {
        const y = lerp(shoulderY + 40, hipY - 14, (i + 1) / 3);
        out.push(`<line x1="${f(cx - waistW * 0.22)}" y1="${f(y)}" x2="${f(cx + waistW * 0.22)}" y2="${f(y)}" stroke="${INK}" stroke-width="2" opacity="${op}"/>`);
      }
    } else {
      // 유니폼 장식: V넥 + 옆선
      out.push(`<path d="M${f(cx - 10)},${f(shoulderY - 1)} L${cx},${f(shoulderY + 12)} L${f(cx + 10)},${f(shoulderY - 1)}" fill="none" stroke="${look.accent}" stroke-width="4" stroke-linejoin="round"/>`);
      out.push(`<line x1="${f(cx + topW / 2 - 5)}" y1="${f(shoulderY + 10)}" x2="${f(cx + waistW / 2 - 4)}" y2="${f(hipY - 10)}" stroke="${look.accent}" stroke-width="4"/>`);
      out.push(`<line x1="${f(cx - topW / 2 + 5)}" y1="${f(shoulderY + 10)}" x2="${f(cx - waistW / 2 + 4)}" y2="${f(hipY - 10)}" stroke="${look.accent}" stroke-width="4"/>`);
    }

    // ---- 목 & 머리
    out.push(`<rect x="${f(cx - 8)}" y="${f(headCY + headR - 6)}" width="16" height="${f(shoulderY - headCY - headR + 8)}" fill="${SKIN}" stroke="${INK}" stroke-width="${ow}"/>`);
    out.push(`<circle cx="${cx}" cy="${f(headCY)}" r="${headR}" fill="${SKIN}" stroke="${INK}" stroke-width="${ow}"/>`);

    // 머리 모양
    const top = headCY - headR;
    if (look.hair === "short" || look.hair === "ponytail" || look.hair === "headband") {
      out.push(`<path d="M${f(cx - headR - 1)},${f(headCY + 2)} Q${f(cx - headR - 2)},${f(top - 8)} ${cx},${f(top - 5)} Q${f(cx + headR + 4)},${f(top - 6)} ${f(cx + headR + 1)},${f(headCY - 4)} Q${f(cx + 6)},${f(top + 10)} ${f(cx - 8)},${f(top + 8)} Q${f(cx - headR + 6)},${f(top + 12)} ${f(cx - headR - 1)},${f(headCY + 2)} Z" fill="${HAIR}" stroke="${INK}" stroke-width="${ow}" stroke-linejoin="round"/>`);
    }
    if (look.hair === "headband") {
      out.push(`<path d="M${f(cx - headR + 1)},${f(top + 13)} Q${cx},${f(top + 6)} ${f(cx + headR - 1)},${f(top + 13)}" fill="none" stroke="${look.accent}" stroke-width="7"/>`);
      out.push(`<path d="M${f(cx - headR + 2)},${f(top + 13)} l-14,6 m14,-6 l-12,12" stroke="${look.accent}" stroke-width="5" stroke-linecap="round"/>`);
    }
    if (look.hair === "cap") {
      out.push(`<path d="M${f(cx - headR - 1)},${f(headCY - 2)} Q${f(cx - headR)},${f(top - 10)} ${cx},${f(top - 9)} Q${f(cx + headR)},${f(top - 10)} ${f(cx + headR + 1)},${f(headCY - 2)} Z" fill="${look.color}" stroke="${INK}" stroke-width="${ow}" stroke-linejoin="round"/>`);
      out.push(`<path d="M${f(cx + headR - 6)},${f(headCY - 3)} Q${f(cx + headR + 18)},${f(headCY - 6)} ${f(cx + headR + 22)},${f(headCY + 1)} L${f(cx + headR - 2)},${f(headCY + 1)} Z" fill="${look.color}" stroke="${INK}" stroke-width="${ow}" stroke-linejoin="round"/>`);
      out.push(`<circle cx="${cx}" cy="${f(top - 8)}" r="3" fill="${look.accent}" stroke="${INK}" stroke-width="1.5"/>`);
    }
    if (look.hair === "swimcap") {
      out.push(`<path d="M${f(cx - headR - 1)},${f(headCY + 1)} Q${f(cx - headR)},${f(top - 9)} ${cx},${f(top - 8)} Q${f(cx + headR)},${f(top - 9)} ${f(cx + headR + 1)},${f(headCY + 1)} Z" fill="${look.accent}" stroke="${INK}" stroke-width="${ow}" stroke-linejoin="round"/>`);
      out.push(`<line x1="${f(cx - headR)}" y1="${f(headCY - 7)}" x2="${f(cx + headR)}" y2="${f(headCY - 7)}" stroke="${INK}" stroke-width="3"/>`);
      for (const dx of [-3, 15]) out.push(`<ellipse cx="${f(cx + dx)}" cy="${f(headCY - 7)}" rx="7" ry="5.5" fill="#7dd3fc" stroke="${INK}" stroke-width="2.5"/>`);
    }
    if (look.hair === "bald") {
      out.push(`<path d="M${f(cx - 10)},${f(top + 7)} Q${f(cx - 2)},${f(top + 2)} ${f(cx + 6)},${f(top + 5)}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`);
    }

    // 얼굴 (오른쪽을 보는 결연한 표정)
    const brow = 2.5 + n(s.power) * 2;
    out.push(`<line x1="${f(cx - 3)}" y1="${f(headCY + 1)}" x2="${f(cx + 6)}" y2="${f(headCY + 4)}" stroke="${INK}" stroke-width="${f(brow)}" stroke-linecap="round"/>`);
    out.push(`<line x1="${f(cx + 13)}" y1="${f(headCY + 4)}" x2="${f(cx + 21)}" y2="${f(headCY + 1)}" stroke="${INK}" stroke-width="${f(brow)}" stroke-linecap="round"/>`);
    out.push(`<circle cx="${f(cx + 3)}" cy="${f(headCY + 8)}" r="2.6" fill="${INK}"/>`);
    out.push(`<circle cx="${f(cx + 16)}" cy="${f(headCY + 8)}" r="2.6" fill="${INK}"/>`);
    if ((s.stamina || 0) >= 8) out.push(`<path d="M${f(cx + 4)},${f(headCY + 15)} Q${f(cx + 10)},${f(headCY + 20)} ${f(cx + 16)},${f(headCY + 15)}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`);
    else out.push(`<line x1="${f(cx + 5)}" y1="${f(headCY + 16)}" x2="${f(cx + 15)}" y2="${f(headCY + 16)}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`);

    // ---- 오른팔 (스트레이트) + 이펙트
    if ((s.power || 0) >= 9) {
      out.push(`<polygon points="${star(Rfist.x + 6, Rfist.y, fistR + 22, fistR + 6, 9)}" fill="#fb923c" opacity="0.9"/>`);
      out.push(`<polygon points="${star(Rfist.x + 6, Rfist.y, fistR + 12, fistR + 2, 9)}" fill="#fde047"/>`);
    }
    if ((s.attackSpeed || 0) >= 8) {
      for (const dy of [-16, 0, 16]) {
        out.push(`<line x1="${f(Re.x - 18)}" y1="${f(Rfist.y + dy - (dy === 0 ? 20 : 0))}" x2="${f(Rfist.x - fistR - 8)}" y2="${f(Rfist.y + dy - (dy === 0 ? 20 : 0))}" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>`);
      }
    }
    // 어깨 (삼각근)
    for (const sh of [Ls, Rs]) out.push(`<circle cx="${f(sh.x)}" cy="${f(sh.y)}" r="${f(armW * 0.78)}" fill="${shirtless ? SKIN : look.color}" stroke="${INK}" stroke-width="${ow}"/>`);
    chain([Rs, Re, Rfist], [armW, armW * 0.9], SKIN, out);

    // ---- 왼팔 (가드)
    chain([Ls, Le, Lfist], [armW, armW * 0.9], SKIN, out);

    // 주먹 / 글러브
    for (const fp of [Lfist, Rfist]) {
      if (gloves) {
        const gc = look.sport === "boxing" ? look.color : "#111827";
        out.push(`<circle cx="${f(fp.x)}" cy="${f(fp.y)}" r="${f(fistR)}" fill="${gc}" stroke="${INK}" stroke-width="${ow}"/>`);
        out.push(`<path d="M${f(fp.x - fistR * 0.55)},${f(fp.y - fistR * 0.45)} Q${f(fp.x - fistR * 0.1)},${f(fp.y - fistR * 0.8)} ${f(fp.x + fistR * 0.35)},${f(fp.y - fistR * 0.6)}" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.55"/>`);
        const band = look.sport === "boxing" ? "#ffffff" : look.accent;
        out.push(`<line x1="${f(fp.x - fistR * 0.95)}" y1="${f(fp.y + fistR * 0.35)}" x2="${f(fp.x - fistR * 0.95)}" y2="${f(fp.y - fistR * 0.35)}" stroke="${band}" stroke-width="4" stroke-linecap="round"/>`);
      } else {
        out.push(`<circle cx="${f(fp.x)}" cy="${f(fp.y)}" r="${f(fistR)}" fill="${SKIN}" stroke="${INK}" stroke-width="${ow}"/>`);
        out.push(`<path d="M${f(fp.x - fistR * 0.2)},${f(fp.y - fistR * 0.7)} L${f(fp.x - fistR * 0.2)},${f(fp.y + fistR * 0.5)}" stroke="${INK}" stroke-width="1.6" opacity="0.5"/>`);
      }
    }

    // ---- 방어 실드
    if ((s.defense || 0) >= 8) {
      const hx = Le.x - 14, hy = shoulderY + 12, hr = 34;
      out.push(`<polygon points="${hexagon(hx, hy, hr)}" fill="#60a5fa" opacity="0.22"/>`);
      out.push(`<polygon points="${hexagon(hx, hy, hr)}" fill="none" stroke="#2563eb" stroke-width="3" opacity="0.75"/>`);
      out.push(`<polygon points="${hexagon(hx, hy, hr * 0.55)}" fill="none" stroke="#2563eb" stroke-width="2" opacity="0.5"/>`);
    }

    // ---- 종목 공
    if (look.sport === "soccer") ball("soccer", Lf.x - 26, groundY - 15, 15, out);
    if (look.sport === "basketball") ball("basketball", Lf.x - 26, groundY - 17, 17, out);
    if (look.sport === "volleyball") ball("volleyball", cx + 64, Math.max(30, headCY - headR - 12), 16, out);

    out.push(`</svg>`);
    return out.join("");
  }

  const STAT_ORDER = ["stamina", "power", "attackSpeed", "toughness", "moveSpeed", "reach", "defense"];
  const STAT_SHORT = { stamina: "체력", power: "파워", attackSpeed: "공속", toughness: "맷집", moveSpeed: "이속", reach: "사거리", defense: "방어" };

  function radar(stats, color, opts) {
    opts = opts || {};
    const S = 200, c = S / 2, R = 66;
    const k = STAT_ORDER.length;
    const pt = (i, v) => {
      const a = (Math.PI * 2 * i) / k - Math.PI / 2;
      return [c + R * (v / 10) * Math.cos(a), c + R * (v / 10) * Math.sin(a)];
    };
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" class="radar">`];
    for (const lv of [2, 4, 6, 8, 10]) {
      out.push(`<polygon points="${STAT_ORDER.map((_, i) => pt(i, lv).map(f).join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-opacity="${lv === 10 ? 0.3 : 0.12}"/>`);
    }
    STAT_ORDER.forEach((key, i) => {
      const [x, y] = pt(i, 10);
      out.push(`<line x1="${c}" y1="${c}" x2="${f(x)}" y2="${f(y)}" stroke="currentColor" stroke-opacity="0.12"/>`);
      const [lx, ly] = pt(i, 13.4);
      out.push(`<text x="${f(lx)}" y="${f(ly)}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="currentColor" opacity="0.75">${STAT_SHORT[key]}</text>`);
    });
    if (opts.compare) {
      out.push(`<polygon points="${STAT_ORDER.map((key, i) => pt(i, opts.compare[key] || 0).map(f).join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" stroke-width="1.5"/>`);
    }
    out.push(`<polygon points="${STAT_ORDER.map((key, i) => pt(i, stats[key] || 0).map(f).join(",")).join(" ")}" fill="${color}" fill-opacity="0.28" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`);
    out.push(`</svg>`);
    return out.join("");
  }

  return { render, radar, lookFor, SPORTS, HAIRS, LOOKS, STAT_ORDER, STAT_SHORT };
});
