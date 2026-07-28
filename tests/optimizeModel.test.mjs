import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEVELS, 요구도항목, EMPTY_INPUT3, 외피면적, getBaseAreas,
  AREA_RANGE_DEFAULT, facadeDefaultFor, withAreaDefaults, collectAreaData,
  buildOptimizeCtx, autoRequirements,
} from "../lib/optimizeModel.js";

test("요구도항목 8개·기본값 — 의무근접만 높음", () => {
  assert.equal(요구도항목.length, 8);
  assert.deepEqual(요구도항목.map(i => i.key),
    ["초기비용", "운영비", "인센티브", "디자인", "시공성", "의무근접", "법규제약", "건물적합"]);
  assert.equal(EMPTY_INPUT3.요구도.의무근접, "높음");
  assert.equal(EMPTY_INPUT3.요구도.초기비용, "보통");
  assert.deepEqual(LEVELS, ["매우높음", "높음", "보통", "낮음", "매우낮음"]);
});

test("외피면적 = 4·√건축 × (연면적/건축) × 층고", () => {
  assert.equal(외피면적(400, 2000), 4 * 20 * 5 * 3.5);   // 1400
  assert.equal(외피면적(0, 2000), 0);
  assert.equal(외피면적(400, 0), 0);
  assert.equal(외피면적(400, 2000, 4), 4 * 20 * 5 * 4);
});

test("getBaseAreas는 빈 문자열을 0으로 처리한다", () => {
  const b = getBaseAreas({ 건축면적: "", 연면적: 2000, 대지면적: 1000 });
  assert.equal(b.건축면적, 0);
  assert.equal(b.외피면적, 0);
  assert.equal(b.대지면적, 1000);
});

test("외피 기본 비율은 건물유형별, 미매핑은 15~30", () => {
  assert.deepEqual(facadeDefaultFor("공동주택"), { min: 10, max: 25 });
  assert.deepEqual(facadeDefaultFor("사무실·업무시설"), { min: 20, max: 60 });
  assert.deepEqual(facadeDefaultFor("호텔"), { min: 15, max: 30 });
  assert.deepEqual(AREA_RANGE_DEFAULT, { 옥상: { min: 20, max: 70 }, 대지: { min: 0, max: 50 } });
});

test("withAreaDefaults는 빈 칸만 채우고 원본을 바꾸지 않는다", () => {
  const 비율 = { 옥상: { min: "", max: 40 }, 외피: { min: "", max: "" }, 대지: { min: 5, max: "" }, 기계실: { pct: "" } };
  const out = withAreaDefaults(비율, "공동주택");
  assert.equal(out.옥상.min, 20);
  assert.equal(out.옥상.max, 40);          // 기존 값 유지
  assert.deepEqual(out.외피, { min: 10, max: 25 });
  assert.equal(out.대지.min, 5);
  assert.equal(out.대지.max, 50);
  assert.equal(out.기계실.pct, "");        // 기계실은 기본값 없음
  assert.equal(비율.옥상.min, "");         // 불변
});

test("collectAreaData — 범위·점·무제한·기계실 cap", () => {
  const base = { 건축면적: 1000, 연면적: 5000, 대지면적: 2000, 외피면적: 1400 };
  const ad = collectAreaData({
    옥상: { min: 20, max: 70 }, 외피: { min: 10, max: "" }, 대지: { min: "", max: "" }, 기계실: { pct: 5 },
  }, base);
  assert.deepEqual(ad.면적범위.옥상, { min: 200, max: 700 });
  assert.equal(ad.면적.옥상, 700);                                  // 상한
  assert.deepEqual(ad.면적범위.외피, { min: 140, max: 140 });       // 한쪽만 → 점
  assert.equal(ad.면적범위.대지, null);                             // 미입력 → 무제한
  assert.equal(ad.면적.대지, null);
  assert.deepEqual(ad.면적범위.기계실, { min: 50, max: 50 });       // 단일 cap
  assert.equal(ad.면적.기계실, 50);
});

test("buildOptimizeCtx — collectCtx 의미 동일", () => {
  const input1 = { 건축면적: 1000, 연면적: 5000, 대지면적: 2000 };
  const input3 = {
    ...EMPTY_INPUT3, 건물유형: "공동주택", 지열의무비율: 10, 전력생산비율기준: "",
    면적비율: { 옥상: { min: 20, max: 70 }, 외피: { min: 10, max: 25 }, 대지: { min: 0, max: 50 }, 기계실: { pct: "" } },
  };
  const ctx = buildOptimizeCtx({
    input1, input3, 총예상에너지사용량: 5492250.4, 의무비율: 14, 연간예상전력소비량: 123456, 지자체: "서울",
  });
  assert.equal(ctx.연간단위에너지소요량, 5492250);                  // 반올림
  assert.equal(ctx.의무설치비율기준, 14);
  assert.deepEqual(ctx.지열의무, { 비율: 10, 건축면적: 1000 });
  assert.equal(ctx.전력생산비율기준, null);                         // 빈 입력
  assert.equal(ctx.건물유형, "공동주택");
  assert.equal(ctx.지자체, "서울");
  assert.equal(ctx.연간예상전력소비량, 123456);
  assert.equal(ctx.면적.옥상, 700);
  assert.equal(ctx.요구도.의무근접, "높음");
});

test("buildOptimizeCtx — 지열의무 0/빈이면 null, 의무비율 null 유지", () => {
  const ctx = buildOptimizeCtx({
    input1: {}, input3: { ...EMPTY_INPUT3 }, 총예상에너지사용량: 0, 의무비율: null, 연간예상전력소비량: 0, 지자체: "",
  });
  assert.equal(ctx.지열의무, null);
  assert.equal(ctx.의무설치비율기준, null);
  assert.equal(ctx.건물유형, null);
  assert.equal(ctx.지자체, null);
});

test("autoRequirements — 시공성은 하위 4항목 평균의 최근접 등급", () => {
  const lib = [{
    사업형태: "민간", 건물유형: "공동주택",
    초기비용: "높음", 운영비: "보통", 인센티브: "낮음", 디자인: "매우높음",
    토지개발: "높음", 기계실: "높음", 공사기간: "보통", 공사난이도: "보통",
  }];
  const r = autoRequirements(lib, "민간", "공동주택");
  assert.equal(r.초기비용, "높음");
  assert.equal(r.디자인, "매우높음");
  assert.equal(r.시공성, "높음");        // (4+4+3+3)/4 = 3.5 → 높음(4)와 보통(3) 중 먼저 탐색된 최근접… 실제 legacy 탐색 순서 기준
  assert.equal(autoRequirements(lib, "공공", "공동주택"), null);
  assert.equal(autoRequirements(null, "민간", "공동주택"), null);
});
