import { test } from "node:test";
import assert from "node:assert/strict";
import { requiredCapacity } from "../lib/capacityHint.js";

// 계수곱 = 단위에너지생산량 × 원별보정계수. 아래 픽스처는 1358 × 1.56 = 2118.48
const sys = (적용용량, { 단위 = 1358, 보정 = 1.56 } = {}) => ({
  에너지원: "태양광", 형식: "고정식(수평)", 적용용량, 단위에너지생산량: 단위, 원별보정계수: 보정,
});
const 총 = 18_583_000;   // kWh/yr
const 의무 = 14.5;       // %
const 목표 = 총 * 의무 / 100;   // 2,694,535

test("단일 시스템·용량 미입력: 전체 필요 용량 (자기 행 제외)", () => {
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems: [sys("")], index: 0 });
  assert.equal(r.확보생산량, 0);
  assert.equal(r.잔여생산량, 목표);
  assert.equal(r.필요용량, Math.ceil(목표 / 2118.48));   // 1272
  assert.equal(r.충족, false);
});

test("자기 행의 기존 용량은 확보량에서 제외된다", () => {
  const 미달 = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems: [sys(500)], index: 0 });
  const 빈칸 = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems: [sys("")], index: 0 });
  assert.equal(미달.필요용량, 빈칸.필요용량);   // 자기 행을 빼므로 동일해야 한다
});

test("다른 행이 일부 채우면 잔여만 필요 (요청된 핵심 동작)", () => {
  const systems = [sys(500), sys("")];
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems, index: 1 });
  assert.equal(r.확보생산량, 500 * 2118.48);
  assert.equal(r.잔여생산량, 목표 - 500 * 2118.48);
  assert.equal(r.필요용량, Math.ceil((목표 - 500 * 2118.48) / 2118.48));
  assert.equal(r.충족, false);
});

test("다른 행이 목표를 이미 넘으면 충족·필요용량 0", () => {
  const systems = [sys(2000), sys("")];
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems, index: 1 });
  assert.equal(r.충족, true);
  assert.equal(r.잔여생산량, 0);
  assert.equal(r.필요용량, 0);
});

test("필요용량은 올림 — 그 값을 넣으면 실제로 의무비율을 만족한다", () => {
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems: [sys("")], index: 0 });
  const 비율 = (r.필요용량 * 2118.48) / 총 * 100;
  assert.ok(비율 >= 의무, `${비율} < ${의무}`);
  const 하나적게 = ((r.필요용량 - 1) * 2118.48) / 총 * 100;
  assert.ok(하나적게 < 의무, "올림이 과도하다(1kW 적어도 충족)");
});

test("서로 다른 계수의 시스템이 섞여도 각 행 기준으로 계산", () => {
  const 지열 = sys("", { 단위: 1000, 보정: 1.0 });   // 계수곱 1000
  const systems = [sys(500), 지열];
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems, index: 1 });
  assert.equal(r.필요용량, Math.ceil((목표 - 500 * 2118.48) / 1000));
});

test("계산 불가 조건은 null", () => {
  const base = { 총에너지사용량: 총, 의무비율: 의무, systems: [sys("")], index: 0 };
  assert.equal(requiredCapacity({ ...base, 의무비율: null }), null);        // 해당없음
  assert.equal(requiredCapacity({ ...base, 총에너지사용량: 0 }), null);      // 계산 전
  assert.equal(requiredCapacity({ ...base, systems: [sys("", { 단위: 0 })] }), null);  // 형식 미선택
  assert.equal(requiredCapacity({ ...base, systems: [sys("", { 보정: 0 })] }), null);
  assert.equal(requiredCapacity({ ...base, index: 5 }), null);              // 없는 행
  assert.equal(requiredCapacity({}), null);                                  // 인자 없음
});

test("적용용량이 문자열·빈칸·음수여도 안전", () => {
  const systems = [sys("300"), sys(""), sys(-100)];
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems, index: 1 });
  assert.equal(r.확보생산량, 300 * 2118.48);   // 문자열 300은 반영, 음수는 0으로 처리
});

test("두 행이 함께 목표를 채우면 전체충족 true·충족 false", () => {
  const systems = [sys(1044), sys(1045)];
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems, index: 0 });
  assert.equal(r.전체충족, true);
  assert.equal(r.충족, false);
});

test("혼자서도 목표를 넘기면 전체충족 true", () => {
  const systems = [sys(2089)];
  const r = requiredCapacity({ 총에너지사용량: 총, 의무비율: 의무, systems, index: 0 });
  assert.equal(r.전체충족, true);
});
