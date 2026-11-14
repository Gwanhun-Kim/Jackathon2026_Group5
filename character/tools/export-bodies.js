// 선택 화면용 그림: 소품 없이 몸통 + 선수 얼굴 사진만 → images/body/{id}.svg
//   node character/tools/export-bodies.js
const fs = require("fs");
const path = require("path");
const Art = require("../art.js");

const root = path.join(__dirname, "..");
const base = JSON.parse(fs.readFileSync(path.join(root, "..", "characters.json"), "utf8"));
const outDir = path.join(root, "images", "body");
fs.mkdirSync(outDir, { recursive: true });

for (const c of base.characters) {
  const look = Art.lookFor(c);
  for (const [ext, mime] of [["png", "image/png"], ["jpg", "image/jpeg"]]) {
    const fp = path.join(root, "images", "faces", `${c.id}.${ext}`);
    if (fs.existsSync(fp)) { look.face = `data:${mime};base64,` + fs.readFileSync(fp).toString("base64"); break; }
  }
  fs.writeFileSync(path.join(outDir, `${c.id}.svg`), Art.render(Object.assign({}, c, { look }), { props: false }));
}
console.log("exported", base.characters.map((c) => c.id).join(", "));
