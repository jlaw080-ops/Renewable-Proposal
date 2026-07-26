/**
 * review/reviewPromptManager.js
 * 검토 프롬프트 CRUD 관리
 *
 * localStorage 키: 'reviewPrompts'
 */

const STORAGE_KEY = 'reviewPrompts';

export const DEFAULT_PROMPT = '당신은 건축물 신재생에너지 의무설치 분야의 전문 컨설턴트입니다.\n아래 계산 데이터를 바탕으로 검토 의견서를 작성하세요.\n\n[필수 작성 항목 — 반드시 모두 포함]\n\n1. 사업 개요\n   - 사업형태(공공/민간), 사업연도, 대지위치, 주요 용도, 연면적(㎡)을 2~3문장으로 요약하세요.\n\n2. 예상에너지사용량 산출\n   - 용도별 연면적 × 지역계수 × 단위에너지사용량 = 예상에너지사용량(kWh/yr) 결과를 서술하세요.\n   - 건물 전체 총 예상에너지사용량(kWh/yr)을 명시하세요.\n\n3. 시나리오별 검토 (ALT가 여러 개인 경우 각각 별도 항목으로 작성)\n   각 ALT에 대해 반드시 아래 내용을 포함하세요:\n   - 적용된 신재생에너지 에너지원 및 형식 (예: 태양광-단결정, 연료전지-PEMFC)\n   - 설치 용량 (kW)\n   - 연간 신재생에너지 생산량 (kWh/yr)\n   - 신재생에너지 설치비율 (%)\n   - 법적 의무설치비율 (%)\n   - 의무비율 충족 여부 (충족 / 미달)\n\n4. 시나리오 비교 검토\n   - ALT가 2개 이상인 경우: 각 ALT의 에너지원 구성, 설치비율, 의무비율 충족 여부를 표 또는 비교 문장으로 정리하세요.\n   - ALT가 1개인 경우: 의무비율 대비 여유율 또는 부족분을 언급하세요.\n   - 권고 시나리오와 그 이유를 명시하세요.\n\n5. 유의사항 또는 추가 검토 필요 사항 (해당 시)\n\n[작성 원칙]\n- 수치는 반드시 단위와 함께 표기하세요 (예: 1,234 kWh/yr, 15%).\n- 인사말·마무리 문구 없이 검토 본문만 작성하세요.\n- 전체 분량 제한 없이 항목을 빠짐없이 완성하세요.';

/**
 * 저장된 프롬프트 목록을 불러옵니다.
 * @returns {Array<{name: string, body: string}>}
 */
export function getPrompts() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [{ name: '기본 지침 (default)', body: DEFAULT_PROMPT }];
}

/**
 * 프롬프트 목록을 저장합니다.
 * @param {Array<{name: string, body: string}>} prompts
 */
export function savePrompts(prompts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

/**
 * 새 프롬프트를 추가합니다.
 * @param {string} name  - 프롬프트 이름
 * @param {string} body  - 프롬프트 내용
 * @returns {Array} 업데이트된 목록
 */
export function addPrompt(name, body) {
  var prompts = getPrompts();
  if (prompts.some(function(p) { return p.name === name; })) {
    throw new Error('같은 이름의 프롬프트가 이미 존재합니다: ' + name);
  }
  prompts.push({ name: name, body: body });
  savePrompts(prompts);
  return prompts;
}

/**
 * 프롬프트를 수정합니다.
 * @param {string} name  - 수정할 프롬프트 이름
 * @param {string} body  - 새 내용
 * @returns {Array} 업데이트된 목록
 */
export function updatePrompt(name, body) {
  var prompts = getPrompts();
  var idx = prompts.findIndex(function(p) { return p.name === name; });
  if (idx < 0) throw new Error('프롬프트를 찾을 수 없습니다: ' + name);
  prompts[idx] = { name: name, body: body };
  savePrompts(prompts);
  return prompts;
}

/**
 * 프롬프트를 삭제합니다. (마지막 1개는 삭제 불가)
 * @param {string} name  - 삭제할 프롬프트 이름
 * @returns {Array} 업데이트된 목록
 */
export function deletePrompt(name) {
  var prompts = getPrompts();
  if (prompts.length <= 1) throw new Error('최소 1개의 프롬프트가 필요합니다.');
  var filtered = prompts.filter(function(p) { return p.name !== name; });
  savePrompts(filtered);
  return filtered;
}
