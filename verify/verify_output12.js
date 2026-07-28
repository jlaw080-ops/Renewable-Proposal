// verify/verify_output12.js — 검토계산(Output1/2) 엔진 동일성 검증
// 사용: node verify/verify_output12.js <ROOT>   (ROOT = data/ 가 있는 기준 경로, 기본 ".")
const fs = require("fs"); const path = require("path");
const ROOT = process.argv[2] || ".";
const win = {}; const store = {};
const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  new Function("window", "localStorage", "self", "exports", "module", "require", src)
    .call(win, win, ls, undefined, undefined, undefined, undefined);
}
["data/신재생에너지계수라이브러리.js", "data/지역계수라이브러리.js",
 "data/건축물종류별단위에너지사용량라이브러리.js", "data/의무비율라이브러리.js"].forEach(load);
globalThis.window = win;
globalThis.fetch = () => Promise.reject(new Error("fetch disabled — window fallback 강제")); // libraryLoader 방법 B 유도
(async () => {
  // libraryLoader console.log 가로채기 (로드 중 로그 제거)
  const originalLog = console.log;
  console.log = () => {};

  const { runCalculation, loadLibraries } = await import("../engine/index.js");
  await loadLibraries();

  // console.log 복원
  console.log = originalLog;

  const input1 = JSON.parse(fs.readFileSync("public/fixtures/Input1-사업정보.json", "utf8"));
  const input2 = JSON.parse(fs.readFileSync("public/fixtures/Input2-시나리오정보.json", "utf8"));
  const { output1, output2 } = await runCalculation(input1, input2, "가");
  console.log(JSON.stringify({ output1, output2 }, null, 2));
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
