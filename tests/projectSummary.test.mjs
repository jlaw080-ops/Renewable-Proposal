import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRepresentative, nextSegment, VERDICT_UI } from "../lib/projectSummary.js";

test("pickRepresentative: 빈 배열이면 null", () => {
  assert.equal(pickRepresentative([]), null);
  assert.equal(pickRepresentative(undefined), null);
});

test("pickRepresentative: 단일 ALT 그대로", () => {
  const alt = { id: "ALT-1", 비율: 3.2, 의무비율: 14, 만족여부: "No" };
  assert.deepEqual(pickRepresentative([alt]), alt);
});

test("pickRepresentative: 비율 최대 ALT 선택", () => {
  const a = { id: "ALT-1", 비율: 3.2, 의무비율: 14, 만족여부: "No" };
  const b = { id: "ALT-2", 비율: 15.1, 의무비율: 14, 만족여부: "Yes" };
  assert.deepEqual(pickRepresentative([a, b]), b);
});

test("pickRepresentative: 동률이면 앞 순서", () => {
  const a = { id: "ALT-1", 비율: 5, 의무비율: 14, 만족여부: "No" };
  const b = { id: "ALT-2", 비율: 5, 의무비율: 14, 만족여부: "No" };
  assert.equal(pickRepresentative([a, b]).id, "ALT-1");
});

test("nextSegment: 전부 미완이면 info", () => {
  assert.equal(nextSegment({ info: "todo", calc: "todo", optimize: "todo", report: "todo" }), "info");
});

test("nextSegment: 첫 미완 단계 반환 (active도 미완 취급)", () => {
  assert.equal(nextSegment({ info: "done", calc: "active", optimize: "todo", report: "todo" }), "calc");
  assert.equal(nextSegment({ info: "done", calc: "done", optimize: "todo", report: "todo" }), "optimize");
});

test("nextSegment: 전부 done이면 report", () => {
  assert.equal(nextSegment({ info: "done", calc: "done", optimize: "done", report: "done" }), "report");
});

test("VERDICT_UI: 세 판정 모두 tone·label·sym 보유", () => {
  for (const k of ["Yes", "No", "해당없음"]) {
    assert.ok(VERDICT_UI[k].tone && VERDICT_UI[k].label && VERDICT_UI[k].sym, k);
  }
});
