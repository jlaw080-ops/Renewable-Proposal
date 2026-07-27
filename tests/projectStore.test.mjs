import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// localStorage 목 — 브라우저 없이 스토어 로직 검증
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
globalThis.localStorage = new MemoryStorage();

const {
  listProjects, getProject, createProject, updateProject, deleteProject,
} = await import("../lib/projectStore.js");

beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

test("생성한 프로젝트가 목록에 나타난다", () => {
  const p = createProject("판교 데이터센터 검토");
  const list = listProjects();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, p.id);
  assert.equal(list[0].name, "판교 데이터센터 검토");
  assert.ok(p.createdAt > 0);
  assert.deepEqual(p.data, {});
});

test("빈 이름은 생성이 거부된다", () => {
  assert.throws(() => createProject("   "), /프로젝트 이름을 입력하세요/);
});

test("목록은 updatedAt 내림차순 — 방금 수정한 프로젝트가 맨 위", async () => {
  const a = createProject("A");
  const b = createProject("B");
  await new Promise(r => setTimeout(r, 5));
  updateProject(a.id, { name: "A-수정" });
  const list = listProjects();
  assert.equal(list[0].name, "A-수정");
  assert.equal(list[1].id, b.id);
});

test("updateProject는 원본을 변경하지 않고 새 객체를 반환한다(불변)", () => {
  const p = createProject("원본");
  const next = updateProject(p.id, { data: { input1: { 연도: 2026 } } });
  assert.notEqual(next, p);
  assert.deepEqual(p.data, {});                       // 원본 불변
  assert.deepEqual(next.data.input1, { 연도: 2026 });
  assert.equal(getProject(p.id).data.input1.연도, 2026);
});

test("data는 한 단계 깊은 병합 — 다른 섹션을 지우지 않는다", () => {
  const p = createProject("병합");
  updateProject(p.id, { data: { input1: { 연도: 2026 } } });
  updateProject(p.id, { data: { input2: { alts: [] } } });
  const got = getProject(p.id);
  assert.deepEqual(got.data.input1, { 연도: 2026 });
  assert.deepEqual(got.data.input2, { alts: [] });
});

test("없는 id 갱신은 에러", () => {
  assert.throws(() => updateProject("no-such-id", {}), /프로젝트를 찾을 수 없습니다/);
});

test("삭제하면 목록·단건 조회에서 사라진다", () => {
  const p = createProject("삭제 대상");
  deleteProject(p.id);
  assert.equal(getProject(p.id), null);
  assert.equal(listProjects().length, 0);
});

test("저장소가 손상된 JSON이어도 빈 목록으로 복구한다", () => {
  globalThis.localStorage.setItem("rp.projects.v1", "{깨진 json");
  assert.deepEqual(listProjects(), []);
});
