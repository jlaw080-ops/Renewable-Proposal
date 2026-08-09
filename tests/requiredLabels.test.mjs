// tests/requiredLabels.test.mjs — 진행 상황판이 의존하는 canCalculate missing 라벨 계약
import { test } from "node:test";
import assert from "node:assert/strict";
import { canCalculate } from "../lib/calcModel.js";

const REQUIRED_LABELS = ["사업형태", "사업연도", "대지위치", "용도별 연면적"];

test("빈 입력이면 필수 라벨 4종 전부 missing", () => {
  const { ok, missing } = canCalculate({});
  assert.equal(ok, false);
  assert.deepEqual(missing, REQUIRED_LABELS);
});

test("전부 채우면 ok=true·missing 빈 배열", () => {
  const { ok, missing } = canCalculate({
    사업형태: "공공기관", 사업연도: "2026", 대지위치: "서울특별시",
    용도별연면적목록: [{ 용도: "업무시설(공공)", 연면적: 50000 }],
  });
  assert.equal(ok, true);
  assert.deepEqual(missing, []);
});

test("일부만 채우면 남은 라벨만 missing (부분 진행 표시 근거)", () => {
  const { missing } = canCalculate({ 사업형태: "공공기관", 사업연도: "2026" });
  assert.deepEqual(missing, ["대지위치", "용도별 연면적"]);
});

test("용도 행이 있어도 연면적 0이면 용도별 연면적은 미충족", () => {
  const { missing } = canCalculate({
    사업형태: "공공기관", 사업연도: "2026", 대지위치: "서울특별시",
    용도별연면적목록: [{ 용도: "업무시설(공공)", 연면적: 0 }],
  });
  assert.deepEqual(missing, ["용도별 연면적"]);
});

test("missing 라벨은 항상 REQUIRED_LABELS의 부분집합", () => {
  const cases = [{}, { 사업형태: "공공기관" }, { 대지위치: "서울특별시" },
    { 용도별연면적목록: [{ 용도: "판매 및 영업시설", 연면적: 10 }] }];
  for (const c of cases) {
    for (const m of canCalculate(c).missing) assert.ok(REQUIRED_LABELS.includes(m), m);
  }
});
