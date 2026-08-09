import { test } from "node:test";
import assert from "node:assert/strict";
import { stepStatuses } from "../lib/stepStatus.js";

const 완성input1 = {
  사업형태: "공공기관",
  사업연도: "2026",
  대지위치: "서울특별시",
  연면적: 50000,
  용도별연면적목록: [{ 용도: "업무시설", 연면적: 50000 }],
};

test("빈 프로젝트: 활성 단계만 active, 나머지 todo", () => {
  const s = stepStatuses({ data: {} }, "info");
  assert.deepEqual(s, { info: "active", calc: "todo", optimize: "todo", report: "todo" });
});

test("사업정보 완성 시 info=done (다른 단계 활성 기준)", () => {
  const s = stepStatuses({ data: { input1: 완성input1 } }, "calc");
  assert.equal(s.info, "done");
  assert.equal(s.calc, "active");
});

test("시나리오에 유효 시스템이 있으면 calc=done", () => {
  const data = {
    input1: 완성input1,
    input2: { scenarios: [{ id: "ALT-1", systems: [{ 에너지원: "태양광", 형식: "고정식(수평)", 적용용량: 500 }] }] },
  };
  assert.equal(stepStatuses({ data }, "info").calc, "done");
});

test("형식 미선택 시스템뿐이면 calc=todo", () => {
  const data = { input2: { scenarios: [{ id: "ALT-1", systems: [{ 에너지원: "태양광", 형식: "", 적용용량: 500 }] }] } };
  assert.equal(stepStatuses({ data }, "info").calc, "todo");
});

test("input3 저장·검토의견 존재 시 optimize·report=done", () => {
  const data = { input3: { 건물유형: "" }, review: { text: "검토의견", at: 1 } };
  const s = stepStatuses({ data }, "info");
  assert.equal(s.optimize, "done");
  assert.equal(s.report, "done");
});

test("활성 단계는 완료여도 active 우선", () => {
  const s = stepStatuses({ data: { input1: 완성input1 } }, "info");
  assert.equal(s.info, "active");
});

test("project가 null이어도 안전", () => {
  assert.deepEqual(stepStatuses(null, "info"), { info: "active", calc: "todo", optimize: "todo", report: "todo" });
});
