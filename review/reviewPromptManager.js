/**
 * review/reviewPromptManager.js
 * 검토 프롬프트 CRUD 관리
 *
 * ※ file:// 직접 실행 환경에서는 index.html에 인라인으로 동일 로직이 내장되어 있습니다.
 *   이 파일은 로컬 서버(예: VS Code Live Server) 환경에서 ES 모듈로 import하여 사용합니다.
 *
 * localStorage 키: 'reviewPrompts'
 */

const STORAGE_KEY = 'reviewPrompts';

export const DEFAULT_PROMPT = `당신은 신재생에너지 설치 의무비율 검토를 전문으로 하는 건축 에너지 컨설턴트입니다.
아래 데이터를 바탕으로 검토 의견을 작성해주세요.

작성 지침:
1. 사업 개요 요약 (사업형태, 위치, 규모)
2. 예상에너지사용량 산출 근거 및 적정성 평가
3. 각 신재생에너지 시나리오별 검토 의견 (설치비율, 의무비율 대비 충족 여부)
4. 추천 시나리오 및 그 이유
5. 추가 검토 사항 또는 유의사항

전문적이고 간결한 문체로 작성하며, 핵심 수치를 명확히 언급해주세요.`;

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
  return [{ name: '기본 프롬프트', body: DEFAULT_PROMPT }];
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
