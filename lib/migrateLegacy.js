// 구버전(projects_v2) → 신버전(rp.projects.v1 data) 변환 — 복사 방식(원본 보존)

export function stripHtml(html) {
  if (!html) return "";
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

export function readLegacyProjects(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function convertLegacyProject(legacy) {
  if (!legacy || typeof legacy !== "object" || !legacy.input1) return null;
  const data = {};

  const i1 = legacy.input1;
  data.input1 = {
    사업형태: i1.사업형태 ?? "", 사업연도: String(i1.사업연도 ?? ""), 대지위치: i1.대지위치 ?? "",
    대지면적: i1.대지면적 ?? "", 건축면적: i1.건축면적 ?? "", 연면적: i1.연면적 ?? "",
    건폐율: i1.건폐율 ?? "", 용적률: i1.용적률 ?? "",
    용도별연면적목록: (i1.용도별연면적목록 ?? []).map(r => {
      const row = { 용도: r.용도 ?? "", 연면적: r.연면적 ?? "" };
      if (r.세대수) row.세대수 = r.세대수;
      return row;
    }),
  };

  if (Array.isArray(legacy.scenarios) && legacy.scenarios.length) {
    data.input2 = {
      scenarios: legacy.scenarios.map(sc => ({
        id: sc.id,
        systems: (sc.systems ?? []).map(s => ({
          에너지원: s.에너지원 ?? "", 형식: s.형식 ?? "", 적용용량: s.적용용량 ?? "",
          단위에너지생산량: s.단위에너지생산량 ?? 0, 원별보정계수: s.원별보정계수 ?? 0,
        })),
      })),
    };
  }

  const reviewText = legacy.reviewText || stripHtml(legacy.reviewHTML);
  if (reviewText) data.review = { text: reviewText, at: Date.now() };
  if (legacy.coverImage) data.coverImage = legacy.coverImage;
  if (legacy.optimize?.memos && Object.keys(legacy.optimize.memos).length) data.optMemos = { ...legacy.optimize.memos };
  if (legacy.optimize?.explains && Object.keys(legacy.optimize.explains).length) data.optExplains = { ...legacy.optimize.explains };
  // legacy.optimize.inputs는 신규 input3와 구조가 달라 비매핑 (사용자가 ③에서 재입력)

  return { name: legacy.name || legacy.projectName || "가져온 프로젝트", data };
}
