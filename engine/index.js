/**
 * engine/index.js
 * 계산 엔진 진입점 — Output_1 → Output_2 순서 보장
 *
 * ※ file:// 직접 실행 환경에서는 index.html의 인라인 스크립트가 동일 역할을 합니다.
 *   로컬 서버(VS Code Live Server 등) 환경에서 사용하세요.
 *
 * 사용 예:
 *   import { runCalculation } from './engine/index.js';
 *   const { output1, output2 } = await runCalculation(input1, input2, '가');
 */

import { loadLibraries } from './libraryLoader.js';
import { calcOutput1 }   from './output1Calculator.js';
import { calcOutput2 }   from './output2Calculator.js';

/**
 * 전체 계산 실행 (Output_1 → Output_2 순서 보장)
 * @param {object} input1     - 사업정보
 * @param {object} input2     - 시나리오 정보 { scenarios: [...] }
 * @param {string} 카테고리   - 의무비율 lookup용 카테고리 (가/나/다/라)
 * @returns {{ output1: object, output2: Array }}
 */
export async function runCalculation(input1, input2, 카테고리) {
  const output1 = calcOutput1(input1);                          // Step 1
  const output2 = calcOutput2(input1, input2, output1, 카테고리); // Step 2 (output1 의존)
  return { output1, output2 };
}

// 개별 함수도 재수출 (필요 시 직접 import 가능)
export { calcOutput1 } from './output1Calculator.js';
export { calcOutput2 } from './output2Calculator.js';
export * from './libraryLoader.js';
