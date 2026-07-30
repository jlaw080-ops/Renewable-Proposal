// 전수 검증: 6 페르소나 × 5 건물유형 = 30건 실제 엔진 구동
const fs = require("fs"); const path = require("path");
const ROOT = process.argv[2] || ".";
const win = {}; const store = {};
const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k,v)=>{store[k]=String(v);}, removeItem: k=>{delete store[k];} };
function load(rel){ const src=fs.readFileSync(path.join(ROOT,rel),"utf8");
  new Function("window","localStorage","self","exports","module","require",src).call(win,win,ls,undefined,undefined,undefined,undefined); }
[ "data/지역계수라이브러리.js","data/건축물종류별단위에너지사용량라이브러리.js","data/설비최적화라이브러리.js",
  "data/건물적합도라이브러리.js","data/제약가중치라이브러리.js","data/경관계수라이브러리.js",
  "settings/settingsStore.js","vendor/javascript-lp-solver.js","optimize/targetCalculator.js","optimize/optimizer.js",
].forEach(load);
const 원본설비 = win.LIB_설비최적화.slice();
const 단위맵 = Object.fromEntries(win.LIB_단위에너지사용량.map(r=>[r["건축물 종류"], r["단위에너지사용량"]]));

// ── 건물유형 가정 프로젝트 ─────────────────────────────
const 유형들 = [
  { 라벨:"공동주택",   적합키:"공동주택",        연면적:60000, 지역:"경기", 단위:단위맵["공동주택"],        건축면적:3000, power:null },
  { 라벨:"사무실",     적합키:"사무실·업무시설", 연면적:40000, 지역:"서울", 단위:단위맵["업무시설(상업)"],  건축면적:2000, power:null },
  { 라벨:"상가",       적합키:"상가",            연면적:25000, 지역:"부산", 단위:단위맵["판매 및 영업시설"],건축면적:2000, power:null },
  { 라벨:"주상복합",   적합키:"주상복합",        연면적:50000, 지역:"인천", 단위:280 /*혼합 가정*/,        건축면적:2500, power:null },
  { 라벨:"데이터센터", 적합키:"데이터센터",      연면적:20000, 지역:"세종", 단위:단위맵["방송통신시설"],    건축면적:4000, power:{비율:8} },
];
function 면적세트(건축면적){
  return { 면적:{옥상:건축면적*0.8, 외피:건축면적*4, 대지:건축면적*2, 기계실:null},
    면적범위:{ 옥상:{min:건축면적*0.3,max:건축면적*0.8}, 외피:{min:건축면적*1,max:건축면적*4},
      대지:{min:건축면적*0.5,max:건축면적*2}, 기계실:null } };
}

// ── 페르소나: 요구도 벡터 + 트위스트(후보 배제 필터) ───
const V=(a,b,c,d,e,f,g,h)=>({초기비용:a,운영비:b,인센티브:c,디자인:d,시공성:e,의무근접:f,법규제약:g,건물적합:h});
const 페르소나 = [
  { id:"P1 경제성",   요구도:V("매우높음","높음","낮음","낮음","보통","매우높음","보통","보통"),
    배제:s=>s.형식==="연료전지" },
  { id:"P2 인센티브", 요구도:V("낮음","보통","매우높음","보통","보통","낮음","보통","높음"),
    배제:()=>false },
  { id:"P3 미관",     요구도:V("보통","보통","보통","매우높음","보통","보통","높음","보통"),
    배제:s=>["고정식(수직)BAPV","BIPV"].includes(s.세부형식) },
  { id:"P4 시공",     요구도:V("보통","보통","낮음","보통","매우높음","높음","높음","보통"),
    배제:s=>s.세부형식==="수직밀폐형"||["PAFC(발전용)","SOFC(발전용)"].includes(s.세부형식) },
  { id:"P5 자립",     요구도:V("낮음","매우높음","보통","보통","낮음","높음","보통","높음"),
    배제:()=>false },
  { id:"P6 균형",     요구도:V("보통","보통","보통","보통","보통","보통","보통","보통"),
    배제:()=>false },
];

function 조합라벨(f){ return f.items.map(it=>it.설비.세부형식+(it.고정?`×${it.기수}기`:` ${Math.round(it.용량)}kW`)).join(" + "); }

유형들.forEach(t=>{
  const 소요량 = t.연면적 * win.LIB_지역계수[t.지역].value * t.단위;
  const A = 면적세트(t.건축면적);
  console.log(`\n\n######## ${t.라벨} (${t.적합키}) ########`);
  console.log(`연면적 ${t.연면적.toLocaleString()} × 지역 ${win.LIB_지역계수[t.지역].value} × 단위 ${t.단위} = 소요량 ${Math.round(소요량).toLocaleString()} kWh/yr · 의무 14%`);
  페르소나.forEach(p=>{
    win.LIB_설비최적화 = 원본설비.filter(s=>!p.배제(s));
    const ctx = {
      건물유형: t.적합키, 지자체: t.지역,
      연간단위에너지소요량: 소요량, 의무설치비율기준: 14, 지열의무: null,
      연간예상전력소비량: t.power ? 소요량 : 0,
      전력생산비율기준: t.power ? t.power.비율 : 0,
      면적: A.면적, 면적범위: A.면적범위, 요구도: p.요구도,
    };
    let r; try { r = win.Optimizer.optimize(ctx); } catch(e){ console.log(`  ${p.id}: ERROR ${e.message}`); win.LIB_설비최적화=원본설비; return; }
    win.LIB_설비최적화 = 원본설비;
    if(!r.ranked.length){ console.log(`  ${p.id}: (실행가능 조합 없음 — 스킵)`); return; }
    const f = r.ranked[0];
    const 비율 = f.targets.법적규제.의무설치비율;
    const 초기 = f.targets.초기비용/1e8;
    console.log(`  ${p.id.padEnd(11)} [${비율.toFixed(2)}%] ${조합라벨(f)}  (초기 ${초기.toFixed(1)}억 · score ${f.score.toFixed(3)} · 실행가능 ${r.실행가능건수})`);
  });
});
