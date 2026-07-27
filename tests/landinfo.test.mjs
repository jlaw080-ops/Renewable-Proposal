import { test } from "node:test";
import assert from "node:assert/strict";
import { pickJusoCandidate, bldrgstParams, aggregateLandInfo } from "../lib/landinfo.js";

const jusoOk = {
  results: {
    common: { errorCode: "0" },
    juso: [{
      admCd: "1168010300", lnbrMnnm: "12", lnbrSlno: "0", mtYn: "0",
      roadAddr: "서울특별시 강남구 개포로109길 21", jibunAddr: "서울특별시 강남구 개포동 12",
    }],
  },
};

test("juso 응답에서 첫 후보를 추출한다", () => {
  const c = pickJusoCandidate(jusoOk);
  assert.equal(c.admCd, "1168010300");
  assert.equal(c.roadAddr, "서울특별시 강남구 개포로109길 21");
});

test("juso 결과 없음·오류는 null", () => {
  assert.equal(pickJusoCandidate({ results: { common: { errorCode: "0" }, juso: [] } }), null);
  assert.equal(pickJusoCandidate({ results: { common: { errorCode: "E0001" }, juso: null } }), null);
  assert.equal(pickJusoCandidate(null), null);
});

test("건축물대장 파라미터를 만든다 (bun/ji 4자리 패딩, 산=platGbCd 1)", () => {
  const p = bldrgstParams(pickJusoCandidate(jusoOk));
  assert.deepEqual(p, { sigunguCd: "11680", bjdongCd: "10300", bun: "0012", ji: "0000", platGbCd: "0" });
  const mountain = bldrgstParams({ admCd: "1168010300", lnbrMnnm: "5", lnbrSlno: "3", mtYn: "1" });
  assert.equal(mountain.platGbCd, "1");
  assert.equal(mountain.bun, "0005");
  assert.equal(mountain.ji, "0003");
});

test("표제부 목록을 집계한다 — 연면적·건축면적 합산, 대지면적·건폐율·용적률 최댓값", () => {
  const bld = { response: { header: { resultCode: "00" }, body: { items: { item: [
    { platArea: 0, archArea: 592.93, totArea: 8969.43, bcRat: 15.96, vlRat: 201.85 },
    { platArea: 43158, archArea: 600.5, totArea: 9100.57, bcRat: 0, vlRat: 0 },
  ] } } } };
  const agg = aggregateLandInfo(bld);
  assert.equal(agg.연면적, 18070);            // 8969.43 + 9100.57
  assert.equal(agg.건축면적, 1193.43);        // 592.93 + 600.5
  assert.equal(agg.대지면적, 43158);
  assert.equal(agg.건폐율, 15.96);
  assert.equal(agg.용적률, 201.85);
  assert.equal(agg.동수, 2);
});

test("item이 단일 객체여도 배열로 처리한다", () => {
  const bld = { response: { header: { resultCode: "00" }, body: { items: { item:
    { platArea: 100, archArea: 50, totArea: 200, bcRat: 50, vlRat: 200 } } } } };
  assert.equal(aggregateLandInfo(bld).동수, 1);
});

test("결과 없음(나대지)·오류 코드는 null", () => {
  assert.equal(aggregateLandInfo({ response: { header: { resultCode: "00" }, body: { items: "" } } }), null);
  assert.equal(aggregateLandInfo({ response: { header: { resultCode: "03" }, body: {} } }), null);
  assert.equal(aggregateLandInfo(null), null);
});
