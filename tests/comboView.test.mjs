import { test } from "node:test";
import assert from "node:assert/strict";
import { SORT_KEYS, sortCombos, energySources, filterCombos, comboSummary } from "../lib/comboView.js";

const mk = (rank, score, 초기비용, 운영순익, 의무, 충족, 면적, 형식들) => ({
  rank, score, 면적이용률: 면적,
  items: 형식들.map((f, i) => ({ 설비: { 형식: f, 세부형식: `${f}-세부${i}` }, 용량: 100 * (i + 1) })),
  targets: { 초기비용, 운영순익, 법적규제: { 의무설치비율: 의무, 의무설치비율_충족: 충족 } },
});

const A = mk(1, 0.92, 4.2e8, 3.8e6, 15.1, true, 62, ["태양광"]);
const B = mk(2, 0.88, 6.1e8, 5.2e6, 18.4, true, 71, ["태양광", "지열"]);
const C = mk(3, 0.81, 9.8e8, 2.1e6, 12.2, false, 45, ["연료전지"]);
const LIST = [A, B, C];

test("SORT_KEYS: 각 항목이 key·label·get·dir 보유", () => {
  assert.ok(SORT_KEYS.length >= 5);
  for (const s of SORT_KEYS) {
    assert.equal(typeof s.key, "string");
    assert.equal(typeof s.label, "string");
    assert.equal(typeof s.get, "function");
    assert.ok(s.dir === "asc" || s.dir === "desc", s.key);
  }
});

test("SORT_KEYS: 초기비용은 오름차순 기본, 점수는 내림차순 기본", () => {
  assert.equal(SORT_KEYS.find(s => s.key === "초기비용").dir, "asc");
  assert.equal(SORT_KEYS.find(s => s.key === "score").dir, "desc");
});

test("sortCombos: 원본 불변 + 새 배열 반환", () => {
  const out = sortCombos(LIST, "초기비용", "asc");
  assert.notEqual(out, LIST);
  assert.deepEqual(LIST.map(c => c.rank), [1, 2, 3]);
  assert.deepEqual(out.map(c => c.rank), [1, 2, 3]);
});

test("sortCombos: 연간순익 내림차순", () => {
  assert.deepEqual(sortCombos(LIST, "운영순익", "desc").map(c => c.rank), [2, 1, 3]);
});

test("sortCombos: 초기비용 내림차순", () => {
  assert.deepEqual(sortCombos(LIST, "초기비용", "desc").map(c => c.rank), [3, 2, 1]);
});

test("sortCombos: null 값은 방향과 무관하게 뒤로", () => {
  const D = mk(4, 0.5, 1e8, 1e6, null, false, null, ["태양광"]);
  assert.equal(sortCombos([...LIST, D], "의무비율", "desc").at(-1).rank, 4);
  assert.equal(sortCombos([...LIST, D], "의무비율", "asc").at(-1).rank, 4);
});

test("energySources: 등장 순서·중복 제거", () => {
  assert.deepEqual(energySources(LIST), ["태양광", "지열", "연료전지"]);
  assert.deepEqual(energySources([]), []);
});

test("filterCombos: 의무충족만", () => {
  assert.deepEqual(filterCombos(LIST, { 의무충족만: true }).map(c => c.rank), [1, 2]);
});

test("filterCombos: 에너지원 OR 포함", () => {
  assert.deepEqual(filterCombos(LIST, { sources: ["지열"] }).map(c => c.rank), [2]);
  assert.deepEqual(filterCombos(LIST, { sources: ["지열", "연료전지"] }).map(c => c.rank), [2, 3]);
});

test("filterCombos: sources 비면 에너지원 조건 무시, 조건 조합은 AND", () => {
  assert.equal(filterCombos(LIST, { sources: [] }).length, 3);
  assert.deepEqual(filterCombos(LIST, { 의무충족만: true, sources: ["연료전지"] }).map(c => c.rank), []);
});

test("filterCombos: 원본 불변", () => {
  const out = filterCombos(LIST, { 의무충족만: true });
  assert.notEqual(out, LIST);
  assert.equal(LIST.length, 3);
});

test("comboSummary: 2개까지 나열, 초과는 외 N개", () => {
  assert.equal(comboSummary(A), "태양광-세부0 100kW");
  assert.equal(comboSummary(B), "태양광-세부0 100kW · 지열-세부1 200kW");
  const E = mk(5, 0.7, 1e8, 1e6, 10, false, 30, ["태양광", "지열", "연료전지"]);
  assert.equal(comboSummary(E), "태양광-세부0 100kW · 지열-세부1 200kW 외 1개");
});

test("comboSummary: items 없으면 대시", () => {
  assert.equal(comboSummary({ items: [] }), "-");
  assert.equal(comboSummary({}), "-");
});
