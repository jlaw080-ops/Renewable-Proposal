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
  const engine = await import("../engine/index.js");
  const { runCalculation, loadLibraries } = engine;
  await loadLibraries();

  // fixture 파일에서 스키마 로드
  let input1Raw = JSON.parse(fs.readFileSync("public/fixtures/Input1-사업정보.json", "utf8"));
  let input2Raw = JSON.parse(fs.readFileSync("public/fixtures/Input2-시나리오정보.json", "utf8"));

  // fixture이 스키마 정의 형식인 경우, 최소 테스트 데이터 생성
  const input1 = (input1Raw.프로젝트정보 !== undefined) ? {
    사업형태: "민간", 사업연도: "2025", 대지위치: "서울특별시",
    대지면적: 10000, 건축면적: 5000, 연면적: 20000,
    건폐율: 50, 용적률: 200,
    용도별연면적목록: [
      { 용도: "공동주택", 연면적: 15000 },
      { 용도: "판매 및 영업시설", 연면적: 5000 }
    ]
  } : input1Raw;

  const input2 = (input2Raw.scenarios === undefined) ? {
    scenarios: [{ name: "ALT1", systems: [{ 에너지원: "태양광", 형식: "태양광-고정식", 적용용량: 50 }] }]
  } : input2Raw;

  const { output1, output2 } = await runCalculation(input1, input2, "가");
  console.log(JSON.stringify({ output1, output2 }, null, 2));
})().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
