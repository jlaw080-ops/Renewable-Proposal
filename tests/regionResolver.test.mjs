import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGION_OPTIONS, resolveRegion, regionFromNaverElements, regionFromReverseGeocode,
} from "../lib/regionResolver.js";

test("REGION_OPTIONS는 의무비율 드롭다운 17개와 일치한다", () => {
  assert.equal(REGION_OPTIONS.length, 17);
  assert.ok(REGION_OPTIONS.includes("충청남도·세종특별자치시"));
  assert.ok(REGION_OPTIONS.includes("강원 영동") && REGION_OPTIONS.includes("강원 영서"));
});

test("시도 정식·축약 명칭 모두 매핑된다", () => {
  assert.equal(resolveRegion("서울특별시"), "서울특별시");
  assert.equal(resolveRegion("서울"), "서울특별시");
  assert.equal(resolveRegion("경기도"), "경기도");
  assert.equal(resolveRegion("전북특별자치도"), "전라북도");
});

test("강원은 시군구로 영동/영서를 구분한다", () => {
  assert.equal(resolveRegion("강원특별자치도", "강릉시"), "강원 영동");
  assert.equal(resolveRegion("강원특별자치도", "속초시"), "강원 영동");
  assert.equal(resolveRegion("강원특별자치도", "춘천시"), "강원 영서");
  assert.equal(resolveRegion("강원도", ""), "강원 영서"); // 시군구 불명 시 영서(legacy 동작 유지)
});

test("세종·충남은 통합 지역으로 매핑된다", () => {
  assert.equal(resolveRegion("세종특별자치시"), "충청남도·세종특별자치시");
  assert.equal(resolveRegion("충청남도"), "충청남도·세종특별자치시");
});

test("매핑 불가 시도는 null", () => {
  assert.equal(resolveRegion("도쿄도"), null);
  assert.equal(resolveRegion(""), null);
});

test("네이버 Geocoding addressElements에서 지역을 추출한다", () => {
  const elements = [
    { types: ["SIDO"], longName: "강원특별자치도" },
    { types: ["SIGUGUN"], longName: "동해시" },
  ];
  assert.equal(regionFromNaverElements(elements), "강원 영동");
  assert.equal(regionFromNaverElements([]), null);
});

test("Reverse Geocoding results에서 지역·주소를 추출한다", () => {
  const results = [{
    name: "legalcode",
    region: {
      area1: { name: "서울특별시" }, area2: { name: "강남구" },
      area3: { name: "역삼동" }, area4: { name: "" },
    },
  }];
  const r = regionFromReverseGeocode(results);
  assert.equal(r.region, "서울특별시");
  assert.equal(r.address, "서울특별시 강남구 역삼동");
  assert.deepEqual(regionFromReverseGeocode([]), { region: null, address: "" });
});
