// 7명(기본 6 + 커스텀 예시 1)의 캐릭터 이미지를 images/*.svg 로 내보내고,
// 3·4번 역할이 바로 쓸 수 있는 data/characters_7.json 을 만든다.
//   node tools/export-images.js
const fs = require("fs");
const path = require("path");
const Art = require("../art.js");

const root = path.join(__dirname, "..");
// 원본은 저장소 맨 위의 characters.json (① 담당). 없으면 data/characters.json
const SRC = fs.existsSync(path.join(root, "..", "characters.json"))
  ? path.join(root, "..", "characters.json")
  : path.join(root, "data", "characters.json");
const base = JSON.parse(fs.readFileSync(SRC, "utf8"));

const example = {
  id: "custom",
  name: "철벽 복서",
  custom: true,
  stats: { stamina: 7, power: 6, attackSpeed: 6, toughness: 9, moveSpeed: 5, reach: 6, defense: 10 },
  look: { sport: "boxing", color: "#e11d48", accent: "#111827", hair: "headband" },
};
const ngannou = base.characters.find((c) => c.id === "ngannou");
if (ngannou && ngannou.specialAbility) example.specialAbility = JSON.parse(JSON.stringify(ngannou.specialAbility));
example.appearance = { color: "#e11d48", heightCm: 186, build: "muscle", style: "counter" };

// 얼굴 사진: images/faces/{id}.jpg -> SVG 안에 넣을 data URL
const faceDir = path.join(root, "images", "faces");
const FACES = {};
const FACE_FILE = {};
for (const c of base.characters) {
  for (const [ext, mime] of [["png", "image/png"], ["jpg", "image/jpeg"]]) {
    const fp = path.join(faceDir, `${c.id}.${ext}`);
    if (!fs.existsSync(fp)) continue;
    FACES[c.id] = `data:${mime};base64,` + fs.readFileSync(fp).toString("base64");
    FACE_FILE[c.id] = `${c.id}.${ext}`;
    break;
  }
}
const CREDITS = fs.existsSync(path.join(faceDir, "credits.json")) ? JSON.parse(fs.readFileSync(path.join(faceDir, "credits.json"), "utf8")) : { faces: {} };

const all = base.characters.map((c) => Object.assign({}, c, { look: Object.assign(Art.lookFor(c), FACES[c.id] ? { face: FACES[c.id] } : {}) })).concat([example]);

fs.mkdirSync(path.join(root, "images"), { recursive: true });
for (const c of all) {
  fs.writeFileSync(path.join(root, "images", `${c.id}.svg`), Art.render(c));
}

const out = Object.assign({}, base, {
  description: "기본 6명 + 커스텀 1명 (커스텀은 예시값, 실제로는 index.html에서 만든 캐릭터로 교체)",
  budget: 49,
  characters: all.map((c) => {
    const o = Object.assign({}, c, { image: `images/${c.id}.png` });
    if (FACES[c.id]) {
      // JSON에는 base64 대신 파일 경로를 넣는다 (fight/ 기준 경로는 appearance.face)
      o.look = Object.assign({}, c.look, { face: `images/faces/${FACE_FILE[c.id]}` });
      o.appearance = Object.assign({}, c.appearance || {}, { face: `../character/images/faces/${FACE_FILE[c.id]}` });
    }
    return o;
  }),
});
fs.writeFileSync(path.join(root, "data", "characters_7.json"), JSON.stringify(out, null, 2));

// 확인용 한 장짜리 시트
const cards = all
  .map((c) => `<figure><div>${Art.render(c)}</div><figcaption>${c.name}</figcaption></figure>`)
  .join("");
fs.writeFileSync(
  path.join(root, "tools", "sheet.html"),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#f3f4f6;font-family:'Malgun Gothic',sans-serif;display:flex;flex-wrap:wrap;gap:8px;padding:8px}figure{margin:0;background:#fff;border-radius:10px;padding:4px;text-align:center}figcaption{font-weight:700;padding-bottom:6px}</style>${cards}`
);
console.log("exported", all.map((c) => c.id).join(", "));

// 브라우저에서 파일을 더블클릭해 열어도(file://) 동작하도록 데이터를 JS로도 저장
fs.writeFileSync(
  path.join(root, "data", "characters.js"),
  "// 자동 생성: node tools/export-images.js (원본: ../characters.json)\nwindow.CHARACTER_DATA = " + JSON.stringify(base, null, 2) + ";\n"
);

// 얼굴 사진을 file:// 에서도 쓰고 PNG로도 내보낼 수 있게 data URL로 저장
fs.writeFileSync(
  path.join(root, "data", "faces.js"),
  "// 자동 생성: node tools/export-images.js (원본: images/faces/*)\n" +
    "window.FACE_DATA = " + JSON.stringify(FACES) + ";\n" +
    "window.FACE_CREDITS = " + JSON.stringify(CREDITS.faces || {}) + ";\n" +
    "window.FACE_NOTE = " + JSON.stringify(CREDITS.note || "") + ";\n" +
    "window.FACE_FILES = " + JSON.stringify(FACE_FILE) + ";\n"
);
