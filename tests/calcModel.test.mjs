import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calc규모등급, EMPTY_SYSTEM, newScenario, EMPTY_INPUT2,
  nextAltNo, canCalculate, buildEngineInput2, fmtNum,
} from "../lib/calcModel.js";
import { 세대수_OPTIONS } from "../lib/formOptions.js";

test("세대수_OPTIONS는 legacy 4구간과 일치한다", () => {
  assert.deepEqual(세대수_OPTIONS, [
    "1000세대 이상", "300세대 이상~1000세대 미만", "30세대 이상~300세대 미만", "30세대 미만",
  ]);
});

test("비주거 포함 시 연면적 합계 기준으로 규모등급을 판정한다", () => {
  const rows = [{ 용도: "공동주택", 연면적: 15000 }, { 용도: "판매 및 영업시설", 연면적: 5000 }];
  assert.equal(calc규모등급(rows), "나");                                    // 합계 20000
  assert.equal(calc규모등급([{ 용도: "업무시설(상업)", 연면적: 100000 }]), "가");
  assert.equal(calc규모등급([{ 용도: "업무시설(상업)", 연면적: 3000 }]), "다");
  assert.equal(calc규모등급([{ 용도: "업무시설(상업)", 연면적: 2999 }]), "라");
});

test("주거(공동주택만)는 세대수 기준으로 판정한다", () => {
  assert.equal(calc규모등급([{ 용도: "공동주택", 연면적: 50000, 세대수: "1000세대 이상" }]), "가");
  assert.equal(calc규모등급([{ 용도: "공동주택", 연면적: 50000, 세대수: "300세대 이상~1000세대 미만" }]), "나");
  assert.equal(calc규모등급([{ 용도: "공동주택", 연면적: 50000, 세대수: "30세대 이상~300세대 미만" }]), "다");
  assert.equal(calc규모등급([{ 용도: "공동주택", 연면적: 50000, 세대수: "30세대 미만" }]), "라");
  assert.equal(calc규모등급([{ 용도: "공동주택", 연면적: 50000 }]), "");     // 세대수 미선택
});

test("연면적이 빈 문자열이어도 숫자 변환해 판정한다", () => {
  assert.equal(calc규모등급([{ 용도: "업무시설(상업)", 연면적: "" }]), "라"); // 0
  assert.equal(calc규모등급([{ 용도: "업무시설(상업)", 연면적: "10000" }]), "나");
});

test("newScenario·EMPTY_INPUT2·nextAltNo", () => {
  assert.deepEqual(newScenario(1), { id: "ALT-1", systems: [{ ...EMPTY_SYSTEM }] });
  assert.deepEqual(EMPTY_INPUT2, { scenarios: [newScenario(1)] });
  assert.equal(nextAltNo([{ id: "ALT-1" }, { id: "ALT-3" }]), 4);           // 중간 삭제 후 중복 방지
  assert.equal(nextAltNo([]), 1);
});

test("canCalculate는 필수값 누락을 알려준다", () => {
  const ok = canCalculate({
    사업형태: "민간", 사업연도: "2025", 대지위치: "서울특별시",
    용도별연면적목록: [{ 용도: "공동주택", 연면적: 15000 }],
  });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.missing, []);

  const bad = canCalculate({ 사업형태: "", 사업연도: "2025", 대지위치: "", 용도별연면적목록: [{ 용도: "", 연면적: "" }] });
  assert.equal(bad.ok, false);
  assert.ok(bad.missing.includes("사업형태"));
  assert.ok(bad.missing.includes("대지위치"));
  assert.ok(bad.missing.includes("용도별 연면적"));
});

test("buildEngineInput2는 적용용량을 숫자로 변환하고 원본을 바꾸지 않는다", () => {
  const scenarios = [{ id: "ALT-1", systems: [
    { 에너지원: "태양광", 형식: "태양광-고정식", 적용용량: "50", 단위에너지생산량: 1358, 원별보정계수: 0.95 },
    { 에너지원: "", 형식: "", 적용용량: "", 단위에너지생산량: 0, 원별보정계수: 0 },
  ] }];
  const built = buildEngineInput2(scenarios);
  assert.equal(built.scenarios[0].systems[0].적용용량, 50);
  assert.equal(built.scenarios[0].systems[1].적용용량, 0);
  assert.equal(scenarios[0].systems[0].적용용량, "50");                      // 불변
});

test("fmtNum", () => {
  assert.equal(fmtNum(5492250), "5,492,250");
  assert.equal(fmtNum(null), "-");
  assert.equal(fmtNum(undefined), "-");
  assert.equal(fmtNum(NaN), "-");
});
