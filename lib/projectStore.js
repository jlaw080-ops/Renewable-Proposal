// 프로젝트 localStorage CRUD — 이 모듈만이 rp.projects.v1 키를 소유한다.
// 모든 반환은 새 객체(불변). 브라우저·테스트 양쪽에서 globalThis.localStorage 사용.
const KEY = "rp.projects.v1";

function readAll() {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return []; // 손상된 저장소는 빈 목록으로 복구 (사용자 데이터는 이후 저장 시 재생성)
  }
}

function writeAll(projects) {
  globalThis.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function listProjects() {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id) {
  return readAll().find(p => p.id === id) ?? null;
}

export function createProject(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("프로젝트 이름을 입력하세요");
  const now = Date.now();
  const project = { id: crypto.randomUUID(), name: trimmed, createdAt: now, updatedAt: now, data: {} };
  writeAll([...readAll(), project]);
  return project;
}

export function updateProject(id, patch) {
  const all = readAll();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) throw new Error("프로젝트를 찾을 수 없습니다");
  const prev = all[idx];
  const next = {
    ...prev,
    ...patch,
    id: prev.id,
    createdAt: prev.createdAt,
    data: patch.data ? { ...prev.data, ...patch.data } : prev.data,
    updatedAt: Date.now(),
  };
  writeAll([...all.slice(0, idx), next, ...all.slice(idx + 1)]);
  return next;
}

export function deleteProject(id) {
  writeAll(readAll().filter(p => p.id !== id));
}
