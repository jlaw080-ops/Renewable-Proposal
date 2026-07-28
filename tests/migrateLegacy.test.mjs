import { test } from "node:test";
import assert from "node:assert/strict";
import { convertLegacyProject, stripHtml, readLegacyProjects } from "../lib/migrateLegacy.js";

const legacy = {
  name: "테스트 사업", savedAt: "2026.07.01 9:00:00", projectName: "테스트 사업",
  input1: {
    사업형태: "민간", 사업연도: "2025", 대지위치: "서울특별시",
    대지면적: 2000, 건축면적: 1000, 연면적: 20000, 건폐율: 50, 용적률: 200,
    용도별연면적목록: [
      { 용도: "공동주택", 비율: 75, 연면적: 15000, 세대수: "1000세대 이상" },
      { 용도: "판매 및 영업시설", 비율: 25, 연면적: 5000 },
    ],
  },
  scenarios: [{ id: "ALT-1", systems: [
    { 에너지원: "태양광", 형식: "태양광-고정식", 단위에너지생산량: 1358, 원별보정계수: 0.95, 적용용량: 50, 신재생에너지생산량: 64505 },
  ] }],
  activeAltIdx: 0,
  reviewHTML: "검토<br>의견", reviewText: "검토\n의견",
  coverImage: "data:image/png;base64,AAA",
  optimize: { inputs: { 무관: 1 }, memos: { 1: "메모1" }, explains: { 1: "설명1" } },
};

test("convertLegacyProject — 매핑 계약 전체", () => {
  const r = convertLegacyProject(legacy);
  assert.equal(r.name, "테스트 사업");
  assert.equal(r.data.input1.사업형태, "민간");
  assert.deepEqual(r.data.input1.용도별연면적목록[0], { 용도: "공동주택", 연면적: 15000, 세대수: "1000세대 이상" }); // 비율 제거
  assert.deepEqual(r.data.input1.용도별연면적목록[1], { 용도: "판매 및 영업시설", 연면적: 5000 });
  assert.equal(r.data.input2.scenarios[0].id, "ALT-1");
  assert.deepEqual(r.data.input2.scenarios[0].systems[0],
    { 에너지원: "태양광", 형식: "태양광-고정식", 적용용량: 50, 단위에너지생산량: 1358, 원별보정계수: 0.95 }); // 생산량 제거
  assert.equal(r.data.review.text, "검토\n의견");           // reviewText 우선
  assert.equal(typeof r.data.review.at, "number");
  assert.equal(r.data.coverImage, "data:image/png;base64,AAA");
  assert.deepEqual(r.data.optMemos, { 1: "메모1" });
  assert.deepEqual(r.data.optExplains, { 1: "설명1" });
  assert.equal(r.data.input3, undefined);                   // optimize.inputs 비매핑
});

test("convertLegacyProject — reviewText 없으면 reviewHTML 태그 제거 폴백", () => {
  const r = convertLegacyProject({ ...legacy, reviewText: "", reviewHTML: "a<br>b<b>굵게</b>" });
  assert.equal(r.data.review.text, "a\nb굵게");
});

test("convertLegacyProject — review 둘 다 없으면 review 미생성, input1 없으면 null", () => {
  const r = convertLegacyProject({ ...legacy, reviewText: "", reviewHTML: "" });
  assert.equal(r.data.review, undefined);
  assert.equal(convertLegacyProject({ name: "x" }), null);
  assert.equal(convertLegacyProject(null), null);
});

test("convertLegacyProject — 선택 필드 부재 허용 (최소 구버전)", () => {
  const r = convertLegacyProject({ name: "최소", input1: { 사업형태: "공공", 용도별연면적목록: [] } });
  assert.equal(r.name, "최소");
  assert.deepEqual(r.data.input2, undefined);               // scenarios 없음
  assert.equal(r.data.coverImage, undefined);
});

test("stripHtml", () => {
  assert.equal(stripHtml("a<br>b<br/>c<div>d</div>"), "a\nb\ncd");
  assert.equal(stripHtml(""), "");
});

test("readLegacyProjects — 안전 파싱", () => {
  assert.deepEqual(readLegacyProjects(JSON.stringify([{ name: "a" }])), [{ name: "a" }]);
  assert.deepEqual(readLegacyProjects("깨진 json"), []);
  assert.deepEqual(readLegacyProjects(null), []);
  assert.deepEqual(readLegacyProjects(JSON.stringify({ not: "array" })), []);
});
